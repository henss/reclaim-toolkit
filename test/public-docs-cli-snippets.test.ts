import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { expectedPublicDocsCommands } from "./public-docs-cli-snippets.expected.js";
import { runNpmCli } from "./cli-test-helpers.js";

interface DocumentedCommand {
  file: string;
  command: string;
}

interface ParsedCommand {
  script: string;
  args: string[];
}

const ROOT_README = "README.md";
const EXAMPLES_README = path.join("examples", "README.md");
const DOCS_DIRECTORY = "docs";
const RECLAIM_COMMAND_PATTERN = /npm run(?: --silent)? reclaim:[^\r\n`]+/g;
const CONVENTIONAL_CONFIG_PATH = "config/reclaim.local.json";

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function collectMarkdownFiles(): string[] {
  const docsFiles = fs.readdirSync(DOCS_DIRECTORY)
    .filter((name) => name.endsWith(".md"))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => path.join(DOCS_DIRECTORY, name));

  return [ROOT_README, ...docsFiles, EXAMPLES_README];
}

function collectDocumentedCommands(): DocumentedCommand[] {
  return collectMarkdownFiles().flatMap((file) => {
    const markdown = fs.readFileSync(file, "utf8");
    return [...markdown.matchAll(RECLAIM_COMMAND_PATTERN)].map((match) => ({
      file: normalizeRelativePath(file),
      command: match[0]
    }));
  });
}

function parseDocumentedCommand(commandLine: string): ParsedCommand {
  const tokens = commandLine.split(/\s+/);
  const runIndex = tokens.findIndex((token) => token === "run");
  if (runIndex < 0) {
    throw new Error(`Expected npm run command, received ${commandLine}`);
  }

  const args = tokens.slice(runIndex + 1);
  if (args[0] === "--silent") {
    args.shift();
  }

  const script = args.shift();
  if (!script) {
    throw new Error(`Expected reclaim-toolkit script in ${commandLine}`);
  }

  return { script, args };
}

function parseFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function isCredentialFreeExecutableExample(commandLine: string): boolean {
  if (commandLine.includes("--config")) {
    return false;
  }

  if (commandLine === "npm run reclaim:openapi:prepare-spec") {
    return false;
  }

  if (commandLine === "npm run reclaim:openapi:generate") {
    return false;
  }

  if (commandLine === "npm run reclaim:openapi:capability-matrix") {
    return false;
  }

  return true;
}

const documentedCommands = collectDocumentedCommands();
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("public docs CLI snippets", () => {
  test("keeps the reclaim CLI command inventory stable across public markdown", () => {
    expect(documentedCommands.map((entry) => `${entry.file}: ${entry.command}`)).toEqual(expectedPublicDocsCommands);
  });

  test("keeps public markdown commands aligned to shipped scripts, fixture paths, and safety flags", () => {
    for (const entry of documentedCommands) {
      const parsed = parseDocumentedCommand(entry.command);
      expect(packageJson.scripts[parsed.script], `${entry.file}: ${entry.command}`).toBeDefined();

      const inputPath = parseFlagValue(parsed.args, "--input");
      if (inputPath) {
        expect(fs.existsSync(inputPath), `${entry.file}: ${entry.command}`).toBe(true);
      }

      const configPath = parseFlagValue(parsed.args, "--config");
      if (configPath) {
        expect(configPath, `${entry.file}: ${entry.command}`).toBe(CONVENTIONAL_CONFIG_PATH);
      }

      if (parsed.script === "reclaim:tasks:create") {
        expect(parsed.args, `${entry.file}: ${entry.command}`).toContain("--confirm-write");
      }

      if (parsed.script === "reclaim:tasks:cleanup-duplicates") {
        expect(parsed.args, `${entry.file}: ${entry.command}`).toContain("--confirm-reviewed-delete");
      }
    }
  });

  test("executes the credential-free local examples advertised in public docs", { timeout: 30000 }, () => {
    const executedCommands = [...new Set(
      documentedCommands
        .map((entry) => entry.command)
        .filter(isCredentialFreeExecutableExample)
    )];

    for (const commandLine of executedCommands) {
      const parsed = parseDocumentedCommand(commandLine);
      const result = runNpmCli([parsed.script, ...parsed.args]);

      expect(result.status, commandLine).toBe(0);
      expect(result.stderr, commandLine).toBe("");
      expect(() => JSON.parse(result.stdout), commandLine).not.toThrow();
    }
  });
});
