import fs from "node:fs";
import path from "node:path";
import { DEFAULT_RECLAIM_CONFIG_PATH, parseReclaimConfig } from "./config.js";

export type ReclaimOnboardingStepId =
  | "install"
  | "create-config"
  | "validate-config"
  | "preview-fixtures"
  | "practice-mock-api"
  | "authenticated-read"
  | "confirmed-write-review";

export interface ReclaimOnboardingStep {
  id: ReclaimOnboardingStepId;
  title: string;
  safetyClass: "local_preview" | "authenticated_read" | "confirmed_write_review";
  status: "ready" | "needs_config" | "review_required";
  command?: string;
  notes: string[];
}

export interface ReclaimOnboardingWizardResult {
  wizard: "reclaim-toolkit-onboarding";
  writeSafety: "no_live_writes";
  config: {
    path: string;
    exists: boolean;
    parseStatus: "missing" | "valid" | "invalid";
    normalizedApiUrl?: string;
    defaultTaskEventCategory?: "PERSONAL" | "WORK";
    notes: string[];
  };
  steps: ReclaimOnboardingStep[];
}

function configCommandPath(configPath: string): string {
  return configPath.replaceAll("\\", "/");
}

function inspectConfig(configPath: string, baseDir: string): ReclaimOnboardingWizardResult["config"] {
  const absolutePath = path.resolve(baseDir, configPath);
  const displayPath = configCommandPath(configPath);

  if (!fs.existsSync(absolutePath)) {
    return {
      path: displayPath,
      exists: false,
      parseStatus: "missing",
      notes: [
        "No local Reclaim config was found.",
        "Copy examples/reclaim.config.example.json to a local, uncommitted config path before authenticated reads."
      ]
    };
  }

  try {
    const config = parseReclaimConfig(JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown);
    return {
      path: displayPath,
      exists: true,
      parseStatus: "valid",
      normalizedApiUrl: config.apiUrl,
      defaultTaskEventCategory: config.defaultTaskEventCategory,
      notes: [
        "Local config parses successfully.",
        "This wizard does not validate credentials; run reclaim:health when you are ready for an authenticated read."
      ]
    };
  } catch (error) {
    return {
      path: displayPath,
      exists: true,
      parseStatus: "invalid",
      notes: [
        "Local config exists but could not be parsed.",
        error instanceof Error ? error.message : String(error)
      ]
    };
  }
}

function command(script: string, args = ""): string {
  return `npm run ${script}${args ? ` -- ${args}` : ""}`;
}

export function getReclaimOnboardingWizard(
  configPath = DEFAULT_RECLAIM_CONFIG_PATH,
  baseDir = process.cwd()
): ReclaimOnboardingWizardResult {
  const config = inspectConfig(configPath, baseDir);
  const configArg = `--config ${config.path}`;

  return {
    wizard: "reclaim-toolkit-onboarding",
    writeSafety: "no_live_writes",
    config,
    steps: [
      {
        id: "install",
        title: "Install dependencies",
        safetyClass: "local_preview",
        status: "ready",
        command: "npm install",
        notes: ["Use the npm-first command surface documented by this package."]
      },
      {
        id: "create-config",
        title: "Create a local config",
        safetyClass: "local_preview",
        status: config.exists ? "ready" : "needs_config",
        notes: [
          `Use examples/reclaim.config.example.json as a shape reference for ${config.path}.`,
          "Keep API keys and account-specific policy ids out of committed files."
        ]
      },
      {
        id: "validate-config",
        title: "Validate local config shape",
        safetyClass: "local_preview",
        status: config.parseStatus === "valid" ? "ready" : "needs_config",
        command: command("reclaim:config:status", configArg),
        notes: ["Checks config presence and parseability without contacting Reclaim."]
      },
      {
        id: "preview-fixtures",
        title: "Preview synthetic task fixtures",
        safetyClass: "local_preview",
        status: "ready",
        command: command("reclaim:tasks:preview-create", "--input examples/tasks.example.json"),
        notes: ["Uses committed synthetic examples only and does not require credentials."]
      },
      {
        id: "practice-mock-api",
        title: "Practice with the synthetic mock API",
        safetyClass: "local_preview",
        status: "ready",
        command: command("reclaim:demo:mock-api", "--input examples/tasks.example.json"),
        notes: ["Exercises health, policy selection, duplicate cleanup, and task create flows against an in-memory mock."]
      },
      {
        id: "authenticated-read",
        title: "Try an authenticated read",
        safetyClass: "authenticated_read",
        status: config.parseStatus === "valid" ? "ready" : "needs_config",
        command: command("reclaim:health", configArg),
        notes: ["Contacts Reclaim with the configured API key and does not write account data."]
      },
      {
        id: "confirmed-write-review",
        title: "Review confirmed writes separately",
        safetyClass: "confirmed_write_review",
        status: "review_required",
        notes: [
          "Task creation and duplicate cleanup require explicit confirmation flags.",
          "Run preview and duplicate-inspection commands first, then review the JSON before any confirmed write."
        ]
      }
    ]
  };
}
