import fs from "node:fs";
import path from "node:path";

interface Finding {
  filePath: string;
  marker: string;
}

const repoRoot = process.cwd();
const defaultTarget = path.join(repoRoot, "examples");
const targets = process.argv.slice(2).filter((arg) => arg !== "--");
const scanRoots = targets.length > 0 ? targets.map((target) => path.resolve(target)) : [defaultTarget];

const markerPatterns: Array<{ marker: string; pattern: RegExp }> = [
  { marker: "private-workspace-path", pattern: /[A-Z]:\\+workspace\\+/i },
  { marker: "private-orchestrator-surface", pattern: /llm-orchestrator/i }
];

const files = scanRoots.flatMap((scanRoot) => collectFiles(scanRoot));
const findings = files.flatMap((filePath) => findPrivateMarkers(filePath));

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${path.relative(repoRoot, finding.filePath)}: ${finding.marker}`);
  }
  process.exit(1);
}

console.log(`Public-boundary lint passed for ${files.length} file(s).`);

function collectFiles(scanRoot: string): string[] {
  const stat = fs.statSync(scanRoot);
  if (stat.isFile()) {
    return [scanRoot];
  }

  return fs
    .readdirSync(scanRoot, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(scanRoot, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    })
    .sort((left, right) => left.localeCompare(right));
}

function findPrivateMarkers(filePath: string): Finding[] {
  const text = fs.readFileSync(filePath, "utf8");
  return markerPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ marker }) => ({ filePath, marker }));
}
