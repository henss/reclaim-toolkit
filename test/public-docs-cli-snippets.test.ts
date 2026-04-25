import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
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
    expect(documentedCommands.map((entry) => `${entry.file}: ${entry.command}`)).toEqual([
      "README.md: npm run reclaim:help",
      "README.md: npm run reclaim:help -- --include-optional",
      "README.md: npm run reclaim:onboarding",
      "README.md: npm run reclaim:config:status -- --config config/reclaim.local.json",
      "README.md: npm run reclaim:support:bundle -- --input examples/support-bundle-preview.example.json",
      "README.md: npm run reclaim:health -- --config config/reclaim.local.json",
      "README.md: npm run reclaim:openapi:capability-matrix",
      "README.md: npm run reclaim:openapi:capability-matrix -- --input generated/reclaim-openapi/reclaim-api-0.1.raw.yml",
      "README.md: npm run reclaim:time-policies:list -- --config config/reclaim.local.json",
      "README.md: npm run reclaim:time-policies:explain-conflicts -- --input examples/time-policy-conflicts.example.json",
      "README.md: npm run reclaim:tasks:preview-create -- --input examples/tasks.example.json",
      "README.md: npm run reclaim:tasks:preview-create -- --input examples/scheduling-recipes.example.json",
      "README.md: npm run reclaim:tasks:preview-create -- --input examples/shopping-errand-windows.example.json",
      "README.md: npm run reclaim:tasks:preview-create -- --input examples/event-prep-block-example-pack.example.json",
      "README.md: npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json",
      "README.md: npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json",
      "README.md: npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json",
      "README.md: npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json",
      "README.md: npm run reclaim:scenarios:preview-weekly -- --input examples/compound-weekly-preview.example.json",
      "README.md: npm run reclaim:habits:preview-create -- --input examples/habits.example.json",
      "README.md: npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json",
      "README.md: npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json",
      "README.md: npm run reclaim:buffers:preview-rule -- --input examples/buffer-rules.example.json",
      "README.md: npm run reclaim:buffers:preview-template -- --input examples/buffer-templates.example.json",
      "README.md: npm run reclaim:meetings:preview-availability -- --input examples/meeting-availability.example.json",
      "README.md: npm run reclaim:meetings:preview-recurring-reschedule -- --input examples/recurring-meeting-reschedule.example.json",
      "README.md: npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json",
      "README.md: npm run reclaim:account-audit:preview-inspect -- --input examples/account-audit.example.json",
      "README.md: npm run reclaim:meetings-hours:inspect -- --config config/reclaim.local.json",
      "README.md: npm run reclaim:account-audit:inspect -- --config config/reclaim.local.json",
      "README.md: npm run reclaim:demo:mock-api -- --input examples/tasks.example.json",
      "README.md: npm run reclaim:demo:mock-api -- --profile failure-modes",
      "README.md: npm run reclaim:tasks:list -- --config config/reclaim.local.json",
      "README.md: npm run reclaim:tasks:filter -- --config config/reclaim.local.json --title-contains notes --event-category WORK",
      "README.md: npm run reclaim:tasks:export -- --config config/reclaim.local.json --event-category WORK --format csv",
      "README.md: npm run reclaim:tasks:create -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-write",
      "README.md: npm run reclaim:tasks:inspect-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json",
      "README.md: npm run reclaim:tasks:cleanup-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-reviewed-delete",
      "README.md: npm run --silent reclaim:onboarding",
      "README.md: npm run --silent reclaim:tasks:preview-create -- --input examples/tasks.example.json",
      "README.md: npm run reclaim:demo:mock-api -- --input examples/tasks.example.json",
      "README.md: npm run reclaim:demo:mock-api -- --profile failure-modes",
      "README.md: npm run reclaim:openapi:generate",
      "docs/account-audit.md: npm run reclaim:account-audit:preview-inspect -- --input examples/account-audit.example.json",
      "docs/account-audit.md: npm run reclaim:account-audit:inspect -- --config config/reclaim.local.json",
      "docs/agent-ops-week-scenario-pack.md: npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json",
      "docs/buffer-rules.md: npm run reclaim:buffers:preview-rule -- --input examples/buffer-rules.example.json",
      "docs/buffer-templates.md: npm run reclaim:buffers:preview-template -- --input examples/buffer-templates.example.json",
      "docs/cli-json-profile.md: npm run --silent reclaim:tasks:preview-create -- --input examples/tasks.example.json",
      "docs/event-prep-block-example-pack.md: npm run reclaim:tasks:preview-create -- --input examples/event-prep-block-example-pack.example.json",
      "docs/focus-and-buffers.md: npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json",
      "docs/focus-and-buffers.md: npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json",
      "docs/habits.md: npm run reclaim:habits:preview-create -- --input examples/habits.example.json",
      "docs/integration-starter-packs.md: npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json",
      "docs/integration-starter-packs.md: npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json",
      "docs/integration-starter-packs.md: npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json",
      "docs/integration-starter-packs.md: npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json",
      "docs/meeting-availability.md: npm run reclaim:meetings:preview-availability -- --input examples/meeting-availability.example.json",
      "docs/meetings-and-hours.md: npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json",
      "docs/meetings-and-hours.md: npm run reclaim:meetings-hours:preview-switch -- --input examples/meetings-hours-profile-switch.example.json",
      "docs/meetings-and-hours.md: npm run reclaim:meetings-hours:inspect -- --config config/reclaim.local.json",
      "docs/openapi-client-generation.md: npm run reclaim:openapi:prepare-spec",
      "docs/openapi-client-generation.md: npm run reclaim:openapi:generate",
      "docs/openapi-client-generation.md: npm run reclaim:openapi:capability-matrix",
      "docs/openapi-client-generation.md: npm run reclaim:openapi:capability-matrix -- --input generated/reclaim-openapi/reclaim-api-0.1.raw.yml",
      "docs/recurring-meeting-reschedule.md: npm run reclaim:meetings:preview-recurring-reschedule -- --input examples/recurring-meeting-reschedule.example.json",
      "docs/support-bundles.md: npm run reclaim:support:bundle -- --input examples/support-bundle-preview.example.json",
      "docs/tasks.md: npm run reclaim:time-policies:list -- --config config/reclaim.local.json",
      "docs/tasks.md: npm run reclaim:tasks:list -- --config config/reclaim.local.json",
      "docs/tasks.md: npm run reclaim:tasks:filter -- --config config/reclaim.local.json --title-contains notes --event-category WORK",
      "docs/tasks.md: npm run reclaim:tasks:export -- --config config/reclaim.local.json --event-category WORK",
      "docs/tasks.md: npm run reclaim:tasks:export -- --config config/reclaim.local.json --event-category WORK --format csv",
      "docs/tasks.md: npm run reclaim:demo:mock-api -- --input examples/tasks.example.json",
      "docs/tasks.md: npm run reclaim:demo:mock-api -- --input examples/scheduling-recipes.example.json",
      "docs/tasks.md: npm run reclaim:demo:mock-api -- --profile failure-modes",
      "docs/tasks.md: npm run reclaim:tasks:validate-write-receipts -- --config config/reclaim.local.json --input examples/task-write-receipts.example.json",
      "docs/tasks.md: npm run reclaim:tasks:preview-create -- --input examples/shopping-errand-windows.example.json",
      "docs/tasks.md: npm run reclaim:tasks:preview-create -- --input examples/event-prep-block-example-pack.example.json",
      "docs/tasks.md: npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json",
      "docs/tasks.md: npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json",
      "docs/tasks.md: npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json",
      "docs/tasks.md: npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json",
      "docs/time-policy-conflicts.md: npm run reclaim:time-policies:explain-conflicts -- --input examples/time-policy-conflicts.example.json",
      "docs/weekly-scenario-composer.md: npm run reclaim:scenarios:preview-weekly -- --input examples/compound-weekly-preview.example.json",
      "examples/README.md: npm run reclaim:onboarding",
      "examples/README.md: npm run reclaim:tasks:preview-create -- --input examples/scheduling-recipes.example.json",
      "examples/README.md: npm run reclaim:tasks:preview-create -- --input examples/shopping-errand-windows.example.json",
      "examples/README.md: npm run reclaim:tasks:preview-create -- --input examples/event-prep-block-example-pack.example.json",
      "examples/README.md: npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json",
      "examples/README.md: npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json",
      "examples/README.md: npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json",
      "examples/README.md: npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json",
      "examples/README.md: npm run reclaim:scenarios:preview-weekly -- --input examples/compound-weekly-preview.example.json",
      "examples/README.md: npm run reclaim:habits:preview-create -- --input examples/habits.example.json",
      "examples/README.md: npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json",
      "examples/README.md: npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json",
      "examples/README.md: npm run reclaim:time-policies:explain-conflicts -- --input examples/time-policy-conflicts.example.json",
      "examples/README.md: npm run reclaim:buffers:preview-rule -- --input examples/buffer-rules.example.json",
      "examples/README.md: npm run reclaim:buffers:preview-template -- --input examples/buffer-templates.example.json",
      "examples/README.md: npm run reclaim:meetings:preview-availability -- --input examples/meeting-availability.example.json",
      "examples/README.md: npm run reclaim:meetings:preview-recurring-reschedule -- --input examples/recurring-meeting-reschedule.example.json",
      "examples/README.md: npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json",
      "examples/README.md: npm run reclaim:meetings-hours:preview-switch -- --input examples/meetings-hours-profile-switch.example.json",
      "examples/README.md: npm run reclaim:tasks:validate-write-receipts -- --config config/reclaim.local.json --input examples/task-write-receipts.example.json",
      "examples/README.md: npm run reclaim:demo:mock-api -- --input examples/tasks.example.json",
      "examples/README.md: npm run reclaim:demo:mock-api -- --profile failure-modes",
      "examples/README.md: npm run reclaim:time-policies:list -- --config config/reclaim.local.json",
      "examples/README.md: npm run reclaim:account-audit:preview-inspect -- --input examples/account-audit.example.json"
    ]);
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
