import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BoundaryRule = {
  id: string;
  description: string;
  pattern: RegExp;
};

type BoundaryFinding = {
  filePath: string;
  line: number;
  ruleId: string;
  description: string;
  sample: string;
};

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TARGETS = [path.join(REPO_ROOT, "examples")];
const TEXT_EXTENSIONS = new Set([".json", ".md"]);

const BOUNDARY_RULES: BoundaryRule[] = [
  {
    id: "private-workspace-path",
    description: "private workspace paths must not appear in public examples",
    pattern: /\b[A-Z]:(?:\\{1,2}|\/)workspace(?:\\{1,2}|\/)|\/workspace\/(?:llm-orchestrator|personal-ops)\b/i
  },
  {
    id: "private-orchestrator-surface",
    description: "private orchestrator surfaces must stay out of public examples",
    pattern: /\b(?:llm-orchestrator|personal-ops|private scheduling ledger|scheduling ledger|\.runtime)\b/i
  },
  {
    id: "private-household-or-support-policy",
    description: "household, health-support, and calendar-fallback policy details are private",
    pattern: /\b(?:household|health[- ]support|calendar fallback|fallback calendar)\b/i
  },
  {
    id: "personal-operator-marker",
    description: "personal operator names or operating policy must not appear in public examples",
    pattern: /\b(?:Stefan|personal operating policy|owner-specific operating policy)\b/i
  }
];

function listTargetFiles(targets: string[]): string[] {
  const files: string[] = [];

  for (const target of targets) {
    if (!fs.existsSync(target)) {
      throw new Error(`Public-boundary lint target does not exist: ${path.relative(REPO_ROOT, target)}`);
    }

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
        const entryPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
          files.push(...listTargetFiles([entryPath]));
          continue;
        }
        if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) {
          files.push(entryPath);
        }
      }
      continue;
    }

    if (stat.isFile() && TEXT_EXTENSIONS.has(path.extname(target))) {
      files.push(target);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function findLineNumber(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function findBoundaryRuleMatches(filePath: string, text: string): BoundaryFinding[] {
  const findings: BoundaryFinding[] = [];

  for (const rule of BOUNDARY_RULES) {
    const match = rule.pattern.exec(text);
    if (!match || match.index === undefined) {
      continue;
    }

    findings.push({
      filePath,
      line: findLineNumber(text, match.index),
      ruleId: rule.id,
      description: rule.description,
      sample: match[0]
    });
  }

  return findings;
}

function findNonExampleEmails(filePath: string, text: string): BoundaryFinding[] {
  const findings: BoundaryFinding[] = [];
  const emailPattern = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
  let match: RegExpExecArray | null;

  while ((match = emailPattern.exec(text)) !== null) {
    const fullEmail = match[0];
    const domain = match[1]?.toLowerCase() ?? "";
    if (domain === "example.com" || domain.endsWith(".example.com")) {
      continue;
    }

    findings.push({
      filePath,
      line: findLineNumber(text, match.index),
      ruleId: "non-example-email",
      description: "public examples may only use example.com email addresses",
      sample: fullEmail
    });
  }

  return findings;
}

function validateJsonFixture(filePath: string, text: string): BoundaryFinding[] {
  if (path.extname(filePath) !== ".json") {
    return [];
  }

  try {
    JSON.parse(text) as unknown;
    return [];
  } catch (error) {
    return [
      {
        filePath,
        line: 1,
        ruleId: "invalid-json",
        description: error instanceof Error ? error.message : "invalid JSON",
        sample: path.basename(filePath)
      }
    ];
  }
}

function checkFiles(files: string[]): BoundaryFinding[] {
  return files.flatMap((filePath) => {
    const text = fs.readFileSync(filePath, "utf8");
    return [
      ...validateJsonFixture(filePath, text),
      ...findBoundaryRuleMatches(filePath, text),
      ...findNonExampleEmails(filePath, text)
    ];
  });
}

function formatFinding(finding: BoundaryFinding): string {
  const relativePath = path.relative(REPO_ROOT, finding.filePath).replaceAll("\\", "/");
  return `${relativePath}:${finding.line} ${finding.ruleId}: ${finding.description} (${finding.sample})`;
}

function main(): void {
  const targets = process.argv.slice(2).map((target) => path.resolve(REPO_ROOT, target));
  const files = listTargetFiles(targets.length > 0 ? targets : DEFAULT_TARGETS);
  const findings = checkFiles(files);

  if (findings.length > 0) {
    console.error(`Public-boundary lint found ${findings.length} issue(s):`);
    for (const finding of findings) {
      console.error(`- ${formatFinding(finding)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Public-boundary lint passed for ${files.length} file(s).`);
}

main();
