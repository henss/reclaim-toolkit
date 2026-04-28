// [MANAGED_BY_PORTFOLIO_GUIDANCE_SYNC]
/* global console, process */
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "config", "docs-quality.yaml");
const config = readConfig(configPath);
const diagnostics = [];
const docsRoot = normalize(config.docs.root);

checkReadme();
const docs = collectMarkdown(path.join(repoRoot, docsRoot));
checkRootMarkdown(docs);
checkRequiredIndexes();
checkDuplicateTitles(docs);
checkLineBudgets(docs);
checkReachability(docs);

const finalDiagnostics =
  config.mode === "audit"
    ? diagnostics.map((diagnostic) => ({
        ...diagnostic,
        severity:
          diagnostic.code === "docs/generated-marker-missing" ? diagnostic.severity : "warning",
      }))
    : diagnostics;
const errors = finalDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
const warnings = finalDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;

console.log("Docs quality lint");
console.log(`- config: ${path.relative(repoRoot, configPath).replaceAll("\\", "/")}`);
console.log(`- errors: ${errors}`);
console.log(`- warnings: ${warnings}`);
if (finalDiagnostics.length === 0) {
  console.log("\nNo docs quality diagnostics found.");
} else {
  for (const diagnostic of finalDiagnostics) {
    console.log(`\n${diagnostic.severity.toUpperCase()} ${diagnostic.code} ${diagnostic.file}`);
    console.log(`  ${diagnostic.message}`);
    console.log(`  Fix: ${diagnostic.fix}`);
  }
}
process.exitCode = errors > 0 ? 1 : 0;

function checkReadme() {
  const file = normalize(config.readme.path);
  const absolute = path.join(repoRoot, file);
  if (!fs.existsSync(absolute)) {
    add(
      "docs/readme-missing",
      "error",
      file,
      "README entrypoint does not exist.",
      "Create README.md or update config/docs-quality.yaml.",
    );
    return;
  }
  const text = fs.readFileSync(absolute, "utf8");
  const lineCount = splitLines(text).length;
  if (lineCount > config.readme.max_lines) {
    add(
      "docs/readme-too-long",
      "error",
      file,
      `README has ${lineCount} lines; maximum is ${config.readme.max_lines}.`,
      "Move detailed feature, reference, or architecture material into docs/.",
    );
  }
  for (const required of config.readme.required_links) {
    if (!text.includes(required)) {
      add(
        "docs/readme-missing-docs-link",
        config.readme.required_link_severity,
        file,
        `README does not link to ${required}.`,
        "Keep README short and link readers to the docs entrypoint.",
      );
    }
  }
}

function collectMarkdown(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  return listFiles(root)
    .filter((file) => /\.mdx?$/i.test(file))
    .map((absolute) => {
      const file = normalize(path.relative(repoRoot, absolute));
      const text = fs.readFileSync(absolute, "utf8");
      const parsed = parseMarkdown(text, file);
      return { file, text, lines: splitLines(text), title: parsed.title, links: parsed.links };
    });
}

function checkRootMarkdown(docs) {
  const allowed = new Set(config.docs.root_markdown_files.allowed.map(normalize));
  for (const doc of docs) {
    if (path.posix.dirname(doc.file) === docsRoot && !allowed.has(doc.file)) {
      add(
        "docs/root-markdown-extra",
        config.docs.root_markdown_files.extra_file_severity,
        doc.file,
        "Docs root contains a Markdown file outside the configured entrypoint set.",
        "Move detailed docs into an owned docs subdirectory or add a deliberate config exemption.",
      );
    }
  }
}

function checkRequiredIndexes() {
  for (const file of config.docs.required_directory_indexes.map(normalize)) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      add(
        "docs/directory-index-missing",
        config.docs.required_directory_index_severity,
        file,
        "Configured docs directory index is missing.",
        "Add the index page before moving this repo from audit mode to blocking docs lint.",
      );
    }
  }
}

function checkDuplicateTitles(docs) {
  const byTitle = new Map();
  for (const doc of docs) {
    if (!doc.title) {
      continue;
    }
    const key = doc.title.toLowerCase();
    byTitle.set(key, [...(byTitle.get(key) ?? []), doc]);
  }
  for (const group of byTitle.values()) {
    if (group.length < 2) {
      continue;
    }
    for (const doc of group) {
      const others = group
        .filter((other) => other.file !== doc.file)
        .map((other) => other.file)
        .join(", ");
      add(
        "docs/duplicate-title",
        config.docs.content_shape_severity,
        doc.file,
        `Duplicate title "${doc.title}" also appears in ${others}.`,
        "Use unique page titles so agents can route to the right document.",
      );
    }
  }
}

function checkLineBudgets(docs) {
  for (const doc of docs) {
    if (matchesAny(doc.file, config.docs.exempt_line_count)) {
      continue;
    }
    const budget = lineBudget(doc.file);
    if (doc.lines.length > budget) {
      add(
        "docs/file-too-long",
        config.docs.content_shape_severity,
        doc.file,
        `Markdown file has ${doc.lines.length} lines; maximum is ${budget}.`,
        "Split the page by reader task, reference surface, or generated/source-owned boundary.",
      );
    }
  }
}

function checkReachability(docs) {
  const byFile = new Map(docs.map((doc) => [doc.file, doc]));
  const entrypoints = config.docs.entrypoints.map(normalize);
  const existing = entrypoints.filter((file) => fs.existsSync(path.join(repoRoot, file)));
  if (existing.length === 0) {
    for (const file of entrypoints) {
      add(
        "docs/reachability-entrypoint-missing",
        config.docs.missing_entrypoint_severity,
        file,
        "Docs reachability entrypoint is missing, so orphan checks are audit-only.",
        "Add docs/index.md before enforcing no-orphan docs.",
      );
    }
    return;
  }

  const reachable = new Set();
  const queue = [...existing];
  while (queue.length > 0) {
    const file = queue.shift();
    if (reachable.has(file)) {
      continue;
    }
    reachable.add(file);
    const doc = byFile.get(file);
    if (!doc) {
      continue;
    }
    for (const link of doc.links) {
      const resolved = resolveLink(file, link);
      if (resolved && byFile.has(resolved) && !reachable.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  for (const doc of docs) {
    if (!reachable.has(doc.file) && !matchesAny(doc.file, config.docs.exclude_from_reachability)) {
      add(
        "docs/orphan-page",
        config.docs.content_shape_severity,
        doc.file,
        "Docs page is not reachable from a configured docs entrypoint.",
        "Link this page from docs/index.md, a directory index, or an intentional navigation page.",
      );
    }
  }
}

function parseMarkdown(text, file) {
  let body = text;
  if (text.startsWith("---\n") || text.startsWith("---\r\n")) {
    const normalized = text.replace(/\r\n/g, "\n");
    const end = normalized.indexOf("\n---", 4);
    if (end === -1) {
      add(
        "docs/frontmatter-invalid",
        "error",
        file,
        "Markdown frontmatter start marker has no closing marker.",
        "Fix or remove the YAML frontmatter marker.",
      );
    } else {
      body = normalized.slice(end + 4);
    }
  }
  return {
    title: body.match(/^#\s+(.+)$/m)?.[1]?.trim(),
    links: [...body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
      .map((match) => match[1]?.trim())
      .filter(Boolean),
  };
}

function readConfig(file) {
  const text = fs.readFileSync(file, "utf8");
  return {
    mode: scalar(text, "mode") || "blocking",
    readme: {
      path: scalar(text, "readme.path") || "README.md",
      max_lines: Number(scalar(text, "readme.max_lines") || 120),
      required_links: list(text, "readme.required_links"),
      required_link_severity: scalar(text, "readme.required_link_severity") || "warning",
    },
    docs: {
      root: scalar(text, "docs.root") || "docs",
      entrypoints: list(text, "docs.entrypoints"),
      missing_entrypoint_severity: scalar(text, "docs.missing_entrypoint_severity") || "warning",
      exclude_from_reachability: list(text, "docs.exclude_from_reachability"),
      exempt_line_count: list(text, "docs.exempt_line_count"),
      max_file_lines: {
        default: Number(scalar(text, "docs.max_file_lines.default") || 500),
        by_directory: map(text, "docs.max_file_lines.by_directory"),
      },
      required_directory_indexes: list(text, "docs.required_directory_indexes"),
      required_directory_index_severity:
        scalar(text, "docs.required_directory_index_severity") || "warning",
      root_markdown_files: {
        allowed: list(text, "docs.root_markdown_files.allowed"),
        extra_file_severity: scalar(text, "docs.root_markdown_files.extra_file_severity") || "warning",
      },
      content_shape_severity: scalar(text, "docs.content_shape_severity") || "warning",
    },
  };
}

function scalar(text, dottedPath) {
  const lines = text.split(/\r?\n/);
  const target = locate(lines, dottedPath);
  if (target < 0) {
    return undefined;
  }
  const key = dottedPath.split(".").at(-1);
  const match = lines[target].match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+?)\\s*$`));
  return match?.[1]?.replace(/^['"]|['"]$/g, "");
}

function list(text, dottedPath) {
  const lines = text.split(/\r?\n/);
  const start = locate(lines, dottedPath);
  if (start < 0) {
    return [];
  }
  const baseIndent = indent(lines[start]);
  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }
    if (indent(line) <= baseIndent) {
      break;
    }
    const match = line.match(/^\s*-\s+(.+?)\s*$/);
    if (match) {
      values.push(match[1]);
    }
  }
  return values;
}

function map(text, dottedPath) {
  const lines = text.split(/\r?\n/);
  const start = locate(lines, dottedPath);
  if (start < 0) {
    return {};
  }
  const baseIndent = indent(lines[start]);
  const values = {};
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }
    if (indent(line) <= baseIndent) {
      break;
    }
    const match = line.match(/^\s*([^:#]+):\s*(\d+)\s*$/);
    if (match) {
      values[normalize(match[1].trim())] = Number(match[2]);
    }
  }
  return values;
}

function locate(lines, dottedPath) {
  const parts = dottedPath.split(".");
  let start = 0;
  let parentIndent = -1;
  for (const part of parts) {
    let found = -1;
    for (let index = start; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.trim()) {
        continue;
      }
      if (parentIndent >= 0 && indent(line) <= parentIndent) {
        break;
      }
      if (line.match(new RegExp(`^\\s*${escapeRegExp(part)}:`))) {
        found = index;
        break;
      }
    }
    if (found < 0) {
      return -1;
    }
    parentIndent = indent(lines[found]);
    start = found + 1;
  }
  return start - 1;
}

function listFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  });
}

function resolveLink(source, link) {
  const target = link.split("#", 1)[0];
  if (!target || /^[a-z]+:/i.test(target) || target.startsWith("/")) {
    return undefined;
  }
  const resolved = normalize(path.posix.join(path.posix.dirname(source), target));
  return /\.mdx?$/i.test(resolved) ? resolved : undefined;
}

function lineBudget(file) {
  const match = Object.entries(config.docs.max_file_lines.by_directory).find(([dir]) =>
    file.startsWith(`${normalize(dir)}/`),
  );
  return match?.[1] ?? config.docs.max_file_lines.default;
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => matchesPattern(file, normalize(pattern)));
}

function matchesPattern(file, pattern) {
  if (pattern.endsWith("/**")) {
    return file.startsWith(pattern.slice(0, -3));
  }
  if (!pattern.includes("*")) {
    return file === pattern;
  }
  return new RegExp(`^${pattern.split("*").map(escapeRegExp).join(".*")}$`).test(file);
}

function add(code, severity, file, message, fix) {
  diagnostics.push({ code, severity, file: normalize(file), message, fix });
}

function splitLines(text) {
  const lines = text.split(/\r?\n/);
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

function normalize(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

function indent(line) {
  return line.match(/^\s*/)[0].length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
