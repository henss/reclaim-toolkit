import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  accountAudit,
  parseReclaimAccountAuditSnapshot
} from "./account-audit.js";
import {
  bufferRules,
  parseReclaimBufferRulePreviewInput
} from "./buffer-rules.js";
import {
  bufferTemplates,
  parseReclaimBufferTemplateInputs
} from "./buffer-templates.js";
import { buffers, parseReclaimBufferInputs } from "./buffers.js";
import {
  DEFAULT_RECLAIM_CONFIG_PATH,
  parseReclaimConfig
} from "./config.js";
import { focus, parseReclaimFocusInputs } from "./focus.js";
import { habits, parseReclaimHabitInputs } from "./habits.js";
import { runReclaimHealthCheck } from "./health.js";
import {
  meetingAvailability,
  parseReclaimMeetingAvailabilityPreviewInput
} from "./meeting-availability.js";
import {
  meetingsHours,
  parseReclaimHoursPresetSwitchPreviewInput,
  parseReclaimMeetingsAndHoursSnapshot
} from "./meetings-hours.js";
import { getReclaimOnboardingWizard } from "./onboarding.js";
import {
  parseReclaimTaskInputs,
  tasks
} from "./tasks.js";
import {
  explainTimePolicyConflicts,
  parseReclaimTimePolicyExplainerInput
} from "./time-policies.js";
import {
  createRedactionCounters,
  redactValue,
  sanitizeErrorMessage,
  sanitizeFreeText,
  summarizeInput,
  summarizeOutput,
  supportBundleSafeDefaults,
  type PreviewIncidentSummary,
  type RedactionContext,
  type RedactionCounters
} from "./support-bundle-redaction.js";
import type {
  ReclaimConfig,
  ReclaimHealthCheckResult
} from "./types.js";

const PreviewCommandSchema = z.enum([
  "reclaim:onboarding",
  "reclaim:tasks:preview-create",
  "reclaim:habits:preview-create",
  "reclaim:focus:preview-create",
  "reclaim:buffers:preview-create",
  "reclaim:buffers:preview-rule",
  "reclaim:buffers:preview-template",
  "reclaim:meetings:preview-availability",
  "reclaim:meetings-hours:preview-inspect",
  "reclaim:meetings-hours:preview-switch",
  "reclaim:account-audit:preview-inspect",
  "reclaim:time-policies:explain-conflicts"
]);

const SupportBundleRequestSchema = z.object({
  incidentType: z.enum(["preview", "config"]),
  command: PreviewCommandSchema.optional(),
  input: z.unknown().optional(),
  configPath: z.string().optional(),
  includeHealthCheck: z.boolean().default(false),
  notes: z.string().optional()
}).superRefine((value, context) => {
  if (value.incidentType === "preview" && value.command === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Preview incidents require a supported command."
    });
  }
});

export type ReclaimSupportBundleCommand = z.infer<typeof PreviewCommandSchema>;

export interface ReclaimSupportBundleRequest {
  incidentType: "preview" | "config";
  command?: ReclaimSupportBundleCommand;
  input?: unknown;
  configPath?: string;
  includeHealthCheck: boolean;
  notes?: string;
}

export interface ReclaimSupportBundleOptions {
  baseDir?: string;
  fetchImpl?: typeof fetch;
}

interface RedactedConfigSummary {
  requestedPath: string;
  pathDisplay: "relative" | "absolute_redacted";
  status: "missing" | "valid" | "invalid";
  apiUrl: {
    classification: "missing" | "reclaim_cloud" | "localhost" | "custom_redacted";
    value?: string;
  };
  hasApiKey: boolean;
  defaultTaskEventCategory?: ReclaimConfig["defaultTaskEventCategory"];
  hasPreferredTimePolicyId: boolean;
  hasPreferredTimePolicyTitle: boolean;
  notes: string[];
}

interface RedactedHealthCheckSummary {
  attempted: true;
  status: "ok" | "failed";
  reachable?: boolean;
  taskCount?: number;
  taskAssignmentTimeSchemeCount?: number;
  notes: string[];
}

export interface ReclaimSupportBundle {
  bundleVersion: "1";
  generatedAt: string;
  incidentType: "preview" | "config";
  generator: "reclaim-toolkit-support-bundle";
  redactionPolicy: {
    mode: "strict_public_safe";
    safeDefaults: string[];
    counters: RedactionCounters;
  };
  config: RedactedConfigSummary;
  preview?: {
    command: ReclaimSupportBundleCommand;
    executionStatus: "ok" | "failed";
    summary: PreviewIncidentSummary;
    input?: unknown;
    result?: unknown;
    error?: string;
  };
  healthCheck?: RedactedHealthCheckSummary;
  notes?: string;
  scoutDecision: {
    category: "tooling";
    recommendation: "evaluate_registry_candidate";
    decision: "local_build";
    rationale: string;
  };
}

function normalizeDisplayPath(candidatePath: string): Pick<RedactedConfigSummary, "requestedPath" | "pathDisplay"> {
  if (path.isAbsolute(candidatePath)) {
    return {
      requestedPath: "<absolute-path-redacted>",
      pathDisplay: "absolute_redacted"
    };
  }

  return {
    requestedPath: candidatePath.replaceAll("\\", "/"),
    pathDisplay: "relative"
  };
}

function classifyApiUrl(apiUrl: string | undefined): RedactedConfigSummary["apiUrl"] {
  if (!apiUrl) {
    return { classification: "missing" };
  }

  try {
    const url = new URL(apiUrl);
    const normalized = `${url.origin}${url.pathname}`.replace(/\/+$/g, "");

    if (url.hostname === "api.app.reclaim.ai" || url.hostname.endsWith(".reclaim.ai")) {
      return {
        classification: "reclaim_cloud",
        value: normalized
      };
    }

    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return {
        classification: "localhost",
        value: normalized
      };
    }

    return { classification: "custom_redacted" };
  } catch {
    return { classification: "custom_redacted" };
  }
}


function supportedPreviewExecutors(command: ReclaimSupportBundleCommand): (input: unknown) => unknown {
  const executors: Record<ReclaimSupportBundleCommand, (input: unknown) => unknown> = {
    "reclaim:onboarding": (input) => {
      const request = z.object({
        configPath: z.string().optional()
      }).parse(input ?? {});
      return getReclaimOnboardingWizard(request.configPath);
    },
    "reclaim:tasks:preview-create": (input) => tasks.previewCreates(parseReclaimTaskInputs(input)),
    "reclaim:habits:preview-create": (input) => habits.previewCreates(parseReclaimHabitInputs(input)),
    "reclaim:focus:preview-create": (input) => focus.previewCreates(parseReclaimFocusInputs(input)),
    "reclaim:buffers:preview-create": (input) => buffers.previewCreates(parseReclaimBufferInputs(input)),
    "reclaim:buffers:preview-rule": (input) => bufferRules.preview(parseReclaimBufferRulePreviewInput(input)),
    "reclaim:buffers:preview-template": (input) => bufferTemplates.preview(parseReclaimBufferTemplateInputs(input)),
    "reclaim:meetings:preview-availability": (input) => (
      meetingAvailability.preview(parseReclaimMeetingAvailabilityPreviewInput(input))
    ),
    "reclaim:meetings-hours:preview-inspect": (input) => (
      meetingsHours.inspectSnapshot(parseReclaimMeetingsAndHoursSnapshot(input))
    ),
    "reclaim:meetings-hours:preview-switch": (input) => (
      meetingsHours.previewPresetSwitches(parseReclaimHoursPresetSwitchPreviewInput(input))
    ),
    "reclaim:account-audit:preview-inspect": (input) => (
      accountAudit.inspectSnapshot(parseReclaimAccountAuditSnapshot(input))
    ),
    "reclaim:time-policies:explain-conflicts": (input) => (
      explainTimePolicyConflicts(parseReclaimTimePolicyExplainerInput(input))
    )
  };

  return executors[command];
}

function buildConfigSummary(configPath: string, baseDir: string): {
  summary: RedactedConfigSummary;
  config?: ReclaimConfig;
} {
  const pathInfo = normalizeDisplayPath(configPath);
  const absolutePath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      summary: {
        ...pathInfo,
        status: "missing",
        apiUrl: { classification: "missing" },
        hasApiKey: false,
        hasPreferredTimePolicyId: false,
        hasPreferredTimePolicyTitle: false,
        notes: ["No local Reclaim config was found at the requested path."]
      }
    };
  }

  try {
    const config = parseReclaimConfig(JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown);
    return {
      summary: {
        ...pathInfo,
        status: "valid",
        apiUrl: classifyApiUrl(config.apiUrl),
        hasApiKey: config.apiKey.length > 0,
        defaultTaskEventCategory: config.defaultTaskEventCategory,
        hasPreferredTimePolicyId: Boolean(config.preferredTimePolicyId),
        hasPreferredTimePolicyTitle: Boolean(config.preferredTimePolicyTitle),
        notes: [
          "The config file exists and parses successfully.",
          "API keys, absolute paths, and preferred policy identifiers are intentionally excluded."
        ]
      },
      config
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      summary: {
        ...pathInfo,
        status: "invalid",
        apiUrl: { classification: "missing" },
        hasApiKey: true,
        hasPreferredTimePolicyId: false,
        hasPreferredTimePolicyTitle: false,
        notes: [
          "The config file exists but could not be parsed.",
          message
        ]
      }
    };
  }
}

function redactHealthCheck(
  result: ReclaimHealthCheckResult,
  context: RedactionContext
): RedactedHealthCheckSummary {
  return {
    attempted: true,
    status: "ok",
    reachable: result.reachable,
    taskCount: result.taskCount,
    taskAssignmentTimeSchemeCount: result.taskAssignmentTimeSchemeCount,
    notes: result.notes.map((note) => sanitizeErrorMessage(note, context))
  };
}

export function parseReclaimSupportBundleRequest(raw: unknown): ReclaimSupportBundleRequest {
  return SupportBundleRequestSchema.parse(raw);
}

export async function generateReclaimSupportBundle(
  request: ReclaimSupportBundleRequest,
  options: ReclaimSupportBundleOptions = {}
): Promise<ReclaimSupportBundle> {
  const baseDir = options.baseDir ?? process.cwd();
  const context: RedactionContext = { counters: createRedactionCounters() };
  const configPath = request.configPath ?? DEFAULT_RECLAIM_CONFIG_PATH;
  const configSummary = buildConfigSummary(configPath, baseDir);

  const bundle: ReclaimSupportBundle = {
    bundleVersion: "1",
    generatedAt: new Date().toISOString(),
    incidentType: request.incidentType,
    generator: "reclaim-toolkit-support-bundle",
    redactionPolicy: {
      mode: "strict_public_safe",
      safeDefaults: supportBundleSafeDefaults,
      counters: context.counters
    },
    config: {
      ...configSummary.summary,
      notes: configSummary.summary.notes.map((note) => sanitizeErrorMessage(note, context))
    },
    scoutDecision: {
      category: "tooling",
      recommendation: "evaluate_registry_candidate",
      decision: "local_build",
      rationale: "The scout found no npm-adjacent package candidate for this capability, and the existing repo already has a small CLI-plus-JSON seam that makes a local implementation lower-risk than adding another dependency surface."
    }
  };

  if (request.notes) {
    bundle.notes = sanitizeFreeText(request.notes, context);
  }

  if (request.incidentType === "preview" && request.command) {
    const executor = supportedPreviewExecutors(request.command);
    const inputSummary = summarizeInput(request.input);
    try {
      const result = executor(request.input);
      const outputSummary = summarizeOutput(result);
      bundle.preview = {
        command: request.command,
        executionStatus: "ok",
        summary: {
          ...inputSummary,
          ...outputSummary
        },
        input: redactValue(request.input, context),
        result: redactValue(result, context)
      };
    } catch (error) {
      bundle.preview = {
        command: request.command,
        executionStatus: "failed",
        summary: inputSummary,
        input: redactValue(request.input, context),
        error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error), context)
      };
    }
  }

  if (request.includeHealthCheck) {
    if (!configSummary.config) {
      bundle.healthCheck = {
        attempted: true,
        status: "failed",
        notes: ["Health check was requested, but the local config is missing or invalid."]
      };
    } else {
      try {
        const result = await runReclaimHealthCheck(configSummary.config, options.fetchImpl);
        bundle.healthCheck = redactHealthCheck(result, context);
      } catch (error) {
        bundle.healthCheck = {
          attempted: true,
          status: "failed",
          notes: [sanitizeErrorMessage(error instanceof Error ? error.message : String(error), context)]
        };
      }
    }
  }

  return bundle;
}

export const supportBundle = {
  generate: generateReclaimSupportBundle,
  parseRequest: parseReclaimSupportBundleRequest
};
