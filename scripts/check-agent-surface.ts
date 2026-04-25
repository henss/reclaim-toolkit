// Managed by llm-orchestrator TypeScript agent-surface standard.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
interface BudgetOverride {
  maxLines: number;
  reason: string;
}
interface BudgetConfig {
  defaults: {
    sourceMaxLines: number;
    testMaxLines: number;
    softSourceLines: number;
    softTestLines: number;
  };
  overrides: Record<string, BudgetOverride>;
}
interface FileReport {
  filePath: string;
  lines: number;
  baselineLines?: number;
  maxLines: number;
  softLimit: number;
  kind: "source" | "test";
}
interface ParsedArgs {
  staged: boolean;
  changedAgainst?: string;
  files: string[];
}
interface RuleDelta {
  ruleId: string;
  baselineCount: number;
  currentCount: number;
}
const BLOCKING_RULE_IDS = new Set(["complexity", "max-depth", "max-lines-per-function", "max-params"]);
const AGENT_SAFE_PATTERN_RULES: Array<{
  ruleId: string;
  count: (text: string, relativePath: string) => number;
}> = [
  {
    ruleId: "agent-safe/no-export-star-barrel-growth",
    count: (text) => countMatches(text, /^\s*export\s+\*/gm)
  },
  {
    ruleId: "agent-safe/no-dynamic-import-growth",
    count: (text) => countMatches(text, /\bimport\s*\(/g)
  },
  {
    ruleId: "agent-safe/no-require-growth",
    count: (text) => countMatches(text, /\brequire\s*\(/g)
  },
  {
    ruleId: "agent-safe/no-ambient-declare-growth",
    count: (text) => countMatches(text, /^\s*declare\s+(?:global|module|namespace|const|let|var|function|class)\b/gm)
  },
  {
    ruleId: "agent-safe/no-grab-bag-utils-path-growth",
    count: (_text, relativePath) => (/\/utils(?:\/|\.|$)/.test(relativePath) ? 1 : 0)
  }
];
const MIN_MEANINGFUL_OVERSIZE_REDUCTION_LINES = 5;
const MIN_MEANINGFUL_OVERSIZE_REDUCTION_RATIO = 0.03;
const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "agent-surface-budgets.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as BudgetConfig;
function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { staged: false, files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--staged") {
      parsed.staged = true;
      continue;
    }
    if (value === "--changed-against") {
      parsed.changedAgainst = argv[index + 1];
      index += 1;
      continue;
    }
    parsed.files.push(value);
  }
  return parsed;
}
function runGit(args: string[]): string {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}
function listChangedFiles(args: ParsedArgs): string[] {
  if (args.files.length > 0) return args.files;
  if (args.staged) {
    return runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]).split(/\r?\n/).filter(Boolean);
  }
  if (args.changedAgainst) {
    return runGit(["diff", "--name-only", "--diff-filter=ACMR", `${args.changedAgainst}..HEAD`]).split(/\r?\n/).filter(Boolean);
  }
  return [];
}

function walk(directory: string, output: string[]): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".runtime" || entry.name === "dist" || entry.name === "generated") {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, output);
      continue;
    }
    if (entry.isFile() && /\.(ts|js|mjs|cjs)$/.test(absolutePath)) {
      output.push(absolutePath);
    }
  }
}

function toRepoRelative(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function toAbsolutePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
}

function isTrackedSurface(relativePath: string): boolean {
  return /\.(ts|js|mjs|cjs)$/.test(relativePath);
}

function getLineCountFromText(text: string): number {
  return text.split(/\r?\n/).length;
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function getGitFileText(ref: string, relativePath: string): string | undefined {
  const result = spawnSync("git", ["show", `${ref}:${relativePath}`], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout : undefined;
}

function getBaselineRef(args: ParsedArgs): string {
  return args.changedAgainst ?? "HEAD";
}

function getFileKind(relativePath: string): "source" | "test" {
  return /(^|\/)(evals|tests|__tests__)(\/|$)|\.(test|spec)\./.test(relativePath) ? "test" : "source";
}

function buildReport(absolutePath: string, args: ParsedArgs): FileReport {
  const relativePath = toRepoRelative(absolutePath);
  const kind = getFileKind(relativePath);
  const override = config.overrides[relativePath];
  const lines = getLineCountFromText(fs.readFileSync(absolutePath, "utf8"));
  const baselineText = getGitFileText(getBaselineRef(args), relativePath);
  const baselineLines = baselineText ? getLineCountFromText(baselineText) : undefined;
  const maxLines = override?.maxLines ?? (kind === "test" ? config.defaults.testMaxLines : config.defaults.sourceMaxLines);
  const softLimit = kind === "test" ? config.defaults.softTestLines : config.defaults.softSourceLines;
  return { filePath: relativePath, lines, baselineLines, maxLines, softLimit, kind };
}

function collectReports(args: ParsedArgs): FileReport[] {
  const changedFiles = listChangedFiles(args);
  const absoluteFiles =
    changedFiles.length > 0
      ? changedFiles.map(toAbsolutePath).filter((candidate) => fs.existsSync(candidate))
      : (() => {
          const discovered: string[] = [];
          walk(repoRoot, discovered);
          return discovered;
        })();
  return absoluteFiles
    .map((absolutePath) => buildReport(absolutePath, args))
    .filter((report) => isTrackedSurface(report.filePath))
    .sort((left, right) => right.lines - left.lines);
}

function getMeaningfulOversizeReduction(baselineLines: number): number {
  return Math.max(MIN_MEANINGFUL_OVERSIZE_REDUCTION_LINES, Math.ceil(baselineLines * MIN_MEANINGFUL_OVERSIZE_REDUCTION_RATIO));
}

function findLineViolations(reports: FileReport[], changedOnly: boolean): string[] {
  const violations: string[] = [];
  for (const report of reports) {
    if (report.lines <= report.maxLines) continue;
    const baselineLines = report.baselineLines;
    const messagePrefix = `- ${report.filePath}: ${report.lines} lines exceeds ${report.maxLines}`;
    if (!changedOnly) {
      if (baselineLines === undefined) {
        violations.push(`${messagePrefix}\n  reason: new file must stay within the hard budget.`);
      } else if (baselineLines > report.maxLines && report.lines > baselineLines) {
        violations.push(`${messagePrefix}\n  reason: oversize file grew from baseline ${baselineLines}.`);
      } else if (baselineLines <= report.maxLines) {
        violations.push(`${messagePrefix}\n  reason: file crossed the hard budget from baseline ${baselineLines}.`);
      }
      continue;
    }
    if (baselineLines === undefined) {
      violations.push(`${messagePrefix}\n  reason: new file must stay within the hard budget.`);
      continue;
    }
    if (baselineLines > report.maxLines) {
      const requiredReduction = getMeaningfulOversizeReduction(baselineLines);
      const actualReduction = baselineLines - report.lines;
      if (actualReduction < requiredReduction) {
        violations.push(`${messagePrefix}\n  reason: touched oversize file must shrink meaningfully before commit (baseline ${baselineLines}, reduced ${actualReduction}, required ${requiredReduction}). Cosmetic line shaving or formatting-only edits do not count; extract a real seam or otherwise make the file structurally smaller.`);
      }
      continue;
    }
    violations.push(`${messagePrefix}\n  reason: file crossed the hard budget from baseline ${baselineLines}.`);
  }
  return violations;
}

async function loadStructuralRuleViolations(reports: FileReport[], baselineRef: string): Promise<Map<string, RuleDelta[]>> {
  const eslint = new ESLint({ cwd: repoRoot });
  const currentResults = await eslint.lintFiles(reports.map((report) => report.filePath));
  const baselineResults = new Map<string, number>();
  const baselinePaths = new Set<string>();
  for (const report of reports) {
    const baselineText = getGitFileText(baselineRef, report.filePath);
    if (!baselineText) continue;
    baselinePaths.add(report.filePath);
    const [result] = await eslint.lintText(baselineText, { filePath: path.join(repoRoot, report.filePath) });
    for (const message of result.messages) {
      if (!message.ruleId || !BLOCKING_RULE_IDS.has(message.ruleId)) continue;
      const key = `${report.filePath}::${message.ruleId}`;
      baselineResults.set(key, (baselineResults.get(key) ?? 0) + 1);
    }
  }
  const deltas = new Map<string, RuleDelta[]>();
  for (const result of currentResults) {
    const relativePath = toRepoRelative(result.filePath);
    if (!baselinePaths.has(relativePath)) continue;
    const counts = new Map<string, number>();
    for (const message of result.messages) {
      if (!message.ruleId || !BLOCKING_RULE_IDS.has(message.ruleId)) continue;
      counts.set(message.ruleId, (counts.get(message.ruleId) ?? 0) + 1);
    }
    const fileDeltas: RuleDelta[] = [];
    for (const [ruleId, currentCount] of counts.entries()) {
      const baselineCount = baselineResults.get(`${relativePath}::${ruleId}`) ?? 0;
      if (currentCount > baselineCount) {
        fileDeltas.push({ ruleId, baselineCount, currentCount });
      }
    }
    if (fileDeltas.length > 0) deltas.set(relativePath, fileDeltas);
  }
  mergeRuleDeltas(deltas, collectAgentSafePatternDeltas(reports, baselineRef));
  return deltas;
}

function collectAgentSafePatternDeltas(reports: FileReport[], baselineRef: string): Map<string, RuleDelta[]> {
  const deltas = new Map<string, RuleDelta[]>();
  for (const report of reports) {
    const absolutePath = path.join(repoRoot, report.filePath);
    const currentText = fs.readFileSync(absolutePath, "utf8");
    const baselineText = getGitFileText(baselineRef, report.filePath) ?? "";
    const fileDeltas: RuleDelta[] = [];
    for (const rule of AGENT_SAFE_PATTERN_RULES) {
      const currentCount = rule.count(currentText, report.filePath);
      const baselineCount = rule.count(baselineText, report.filePath);
      if (currentCount > baselineCount) {
        fileDeltas.push({ ruleId: rule.ruleId, baselineCount, currentCount });
      }
    }
    if (fileDeltas.length > 0) deltas.set(report.filePath, fileDeltas);
  }
  return deltas;
}

function mergeRuleDeltas(target: Map<string, RuleDelta[]>, source: Map<string, RuleDelta[]>): void {
  for (const [filePath, deltas] of source.entries()) {
    target.set(filePath, [...(target.get(filePath) ?? []), ...deltas]);
  }
}

function renderNearLimitReports(reports: FileReport[]): void {
  const nearLimit = reports.filter((report) => report.lines > report.softLimit);
  if (nearLimit.length === 0) return;
  console.log("Near-limit files:");
  for (const report of nearLimit.slice(0, 12)) {
    const baseline = report.baselineLines !== undefined ? ` baseline=${report.baselineLines}` : "";
    console.log(`- ${report.filePath}: ${report.lines} lines (${report.kind} budget=${report.maxLines}${baseline})`);
  }
  console.log("");
}

function renderViolations(lineViolations: string[], structuralDeltas: Map<string, RuleDelta[]>): never {
  console.error("Agent-surface guard violations:");
  for (const violation of lineViolations) console.error(violation);
  for (const [filePath, deltas] of structuralDeltas.entries()) {
    for (const delta of deltas) {
      console.error(`- ${filePath}: ${delta.ruleId} worsened from ${delta.baselineCount} to ${delta.currentCount}; refactor instead of increasing complexity.`);
    }
  }
  console.error("");
  console.error("LLM-friendly refactor guidance:");
  console.error("- Split by responsibility, not by arbitrary line count.");
  console.error("- Keep orchestration entrypoints thin and move domain logic into focused modules.");
  console.error("- For tests, extract scenario builders or shared assertions before adding more long inline fixtures.");
  console.error("- When a touched file is already oversized, the commit must leave it meaningfully smaller or structurally simpler than before; cosmetic formatting or shaving a couple of lines is not a refactor.");
  console.error("- If the next safe change still needs a large surface, land the refactor first, then apply the feature in the new seam.");
  console.error("- Avoid giant one-shot patch applications on Windows. Prefer small file-by-file edits or scripted codemods.");
  console.error("- For self-contained TypeScript exports, prefer the repo codemod: pnpm refactor:extract-exports -- --source <file> --target <new-file> --exports Foo,bar");
  process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const reports = collectReports(args);
  const changedOnly = args.staged || Boolean(args.changedAgainst) || args.files.length > 0;
  console.log("Agent surface budget check");
  console.log("");
  if (reports.length === 0) {
    console.log(changedOnly ? "No tracked TypeScript surfaces to check." : "No tracked source surfaces were found.");
    return;
  }
  renderNearLimitReports(reports);
  const lineViolations = findLineViolations(reports, changedOnly);
  const structuralDeltas = changedOnly ? await loadStructuralRuleViolations(reports, getBaselineRef(args)) : new Map<string, RuleDelta[]>();
  if (lineViolations.length > 0 || structuralDeltas.size > 0) {
    renderViolations(lineViolations, structuralDeltas);
  }
  console.log(changedOnly ? "Checked files stay within agent-surface growth limits." : "All tracked source surfaces are within their current line budgets.");
}

await main();
