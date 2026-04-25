#!/usr/bin/env node

import fs from "node:fs";
import {
  accountAudit,
  createAccountAuditDriftDigest,
  parseReclaimAccountAuditDriftInput,
  parseReclaimAccountAuditSnapshot
} from "./account-audit.js";
import { loadReclaimApiCapabilityMatrix } from "./api-capability-matrix.js";
import {
  bufferRules,
  parseReclaimBufferRulePreviewInput
} from "./buffer-rules.js";
import {
  bufferTemplates,
  parseReclaimBufferTemplateInputs
} from "./buffer-templates.js";
import { buffers, parseReclaimBufferPreviewInput } from "./buffers.js";
import { createReclaimClient } from "./client.js";
import { getReclaimCliHelp } from "./cli-help.js";
import { getReclaimConfigStatus, loadReclaimConfig } from "./config.js";
import { focus, parseReclaimFocusPreviewInput } from "./focus.js";
import { habits, parseReclaimHabitInputs } from "./habits.js";
import { runReclaimHealthCheck } from "./health.js";
import {
  hoursConfig,
  parseReclaimHoursConfigDiffInput,
  parseReclaimHoursConfigSnapshot
} from "./hours-config.js";
import {
  meetingAvailability,
  parseReclaimMeetingAvailabilityPreviewInput
} from "./meeting-availability.js";
import {
  parseReclaimRecurringMeetingReschedulePreviewInput,
  recurringMeetingReschedule
} from "./meeting-recurring-reschedule.js";
import {
  meetingsHours,
  parseReclaimHoursPresetSwitchPreviewInput,
  parseReclaimMeetingsAndHoursSnapshot
} from "./meetings-hours.js";
import {
  runMockReclaimApiDemo,
  runMockReclaimFailureModeLab,
  type MockReclaimLabProfile
} from "./mock-lab.js";
import { getReclaimOnboardingWizard } from "./onboarding.js";
import {
  parseReclaimTaskPreviewInput,
  parseReclaimTaskInputs,
  parseTaskWriteReceipts,
  tasks,
  type TaskListFilters
} from "./tasks.js";
import {
  parseReclaimWeeklyScenarioComposerInput,
  weeklyScenarioComposer
} from "./weekly-scenario-composer.js";
import {
  explainTimePolicyConflicts,
  parseReclaimTimePolicyExplainerInput
} from "./time-policies.js";
import { parseReclaimSupportBundleRequest, supportBundle } from "./support-bundle.js";

function parseFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseTaskListFilters(): TaskListFilters {
  return {
    titleContains: parseFlag("--title-contains"),
    eventCategory: parseFlag("--event-category"),
    timeSchemeId: parseFlag("--time-scheme-id"),
    dueAfter: parseFlag("--due-after"),
    dueBefore: parseFlag("--due-before"),
    startAfterAfter: parseFlag("--start-after-after"),
    startAfterBefore: parseFlag("--start-after-before")
  };
}

function hasAnyTaskListFilter(filters: TaskListFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined && value !== "");
}

function parseTaskExportFormat(): "json" | "csv" {
  const format = parseFlag("--format") ?? "json";
  if (format !== "json" && format !== "csv") {
    throw new Error("Expected --format json or --format csv.");
  }
  return format;
}

function parseMockLabProfile(): MockReclaimLabProfile {
  const profile = parseFlag("--profile") ?? "baseline";
  if (profile === "baseline" || profile === "failure-modes") {
    return profile;
  }

  throw new Error("Expected --profile baseline or --profile failure-modes.");
}

async function runMockLabCommand(): Promise<void> {
  const profile = parseMockLabProfile();
  printJson(
    profile === "failure-modes"
      ? await runMockReclaimFailureModeLab()
      : await runMockReclaimApiDemo(parseFlag("--input"))
  );
}

function readJsonInput(): unknown {
  const inputPath = parseFlag("--input");
  if (!inputPath) {
    throw new Error("Expected --input <json>.");
  }
  return JSON.parse(fs.readFileSync(inputPath, "utf8")) as unknown;
}

function loadClient(): ReturnType<typeof createReclaimClient> {
  const config = loadReclaimConfig(parseFlag("--config"));
  if (!config) {
    throw new Error("Reclaim config is missing. Pass --config <path> or create config/reclaim.local.json.");
  }
  return createReclaimClient(config);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  printJson(getReclaimCliHelp({ includeOptional: hasFlag("--include-optional") }));
}

function isHelpRequest(command: string | undefined): boolean {
  return !command || command === "--help" || command === "help";
}

type CommandHandler = () => Promise<void> | void;

function buildCoreCommandHandlers(): Record<string, CommandHandler> {
  return {
    "reclaim:config:status": () => {
      printJson(getReclaimConfigStatus(parseFlag("--config")));
    },
    "reclaim:help": printHelp,
    "reclaim:onboarding": () => {
      printJson(getReclaimOnboardingWizard(parseFlag("--config")));
    },
    "reclaim:health": async () => {
      printJson(await runReclaimHealthCheck(parseFlag("--config")));
    },
    "reclaim:openapi:capability-matrix": async () => {
      printJson(await loadReclaimApiCapabilityMatrix({ inputPath: parseFlag("--input") }));
    },
    "reclaim:time-policies:list": async () => {
      const client = loadClient();
      printJson(tasks.previewTimePolicySelection(await client.listTaskAssignmentTimeSchemes(), {
        preferredTimePolicyId: client.config.preferredTimePolicyId,
        preferredTimePolicyTitle: client.config.preferredTimePolicyTitle,
        eventCategory: client.config.defaultTaskEventCategory
      }));
    },
    "reclaim:time-policies:explain-conflicts": () => {
      printJson(explainTimePolicyConflicts(parseReclaimTimePolicyExplainerInput(readJsonInput())));
    },
    "reclaim:support:bundle": async () => {
      printJson(await supportBundle.generate(parseReclaimSupportBundleRequest(readJsonInput())));
    }
  };
}

function buildPreviewCommandHandlers(): Record<string, CommandHandler> {
  return {
    "reclaim:tasks:preview-create": () => {
      const input = parseReclaimTaskPreviewInput(readJsonInput());
      printJson(tasks.previewCreates(input.tasks, {
        timePolicyContext: input.timeSchemes.length > 0 || input.defaultTaskEventCategory !== undefined
          ? {
            timeSchemes: input.timeSchemes,
            defaultTaskEventCategory: input.defaultTaskEventCategory ?? "PERSONAL",
            preferredTimePolicyId: input.preferredTimePolicyId,
            preferredTimePolicyTitle: input.preferredTimePolicyTitle
          }
          : undefined
      }));
    },
    "reclaim:scenarios:preview-weekly": () => {
      printJson(weeklyScenarioComposer.preview(parseReclaimWeeklyScenarioComposerInput(readJsonInput())));
    },
    "reclaim:habits:preview-create": () => {
      printJson(habits.previewCreates(parseReclaimHabitInputs(readJsonInput())));
    },
    "reclaim:focus:preview-create": () => {
      const input = parseReclaimFocusPreviewInput(readJsonInput());
      printJson(focus.previewCreates(input.focusBlocks, {
        currentFocusBlocks: input.currentFocusBlocks,
        timePolicyContext: input.timeSchemes.length > 0 || input.defaultTaskEventCategory !== undefined
          ? {
            timeSchemes: input.timeSchemes,
            defaultTaskEventCategory: input.defaultTaskEventCategory ?? "WORK",
            preferredTimePolicyId: input.preferredTimePolicyId,
            preferredTimePolicyTitle: input.preferredTimePolicyTitle
          }
          : undefined
      }));
    },
    "reclaim:buffers:preview-create": () => {
      const input = parseReclaimBufferPreviewInput(readJsonInput());
      printJson(buffers.previewCreates(input.buffers, {
        timePolicyContext: input.timeSchemes.length > 0 || input.defaultTaskEventCategory !== undefined
          ? {
            timeSchemes: input.timeSchemes,
            defaultTaskEventCategory: input.defaultTaskEventCategory ?? "PERSONAL",
            preferredTimePolicyId: input.preferredTimePolicyId,
            preferredTimePolicyTitle: input.preferredTimePolicyTitle
          }
          : undefined
      }));
    },
    "reclaim:buffers:preview-rule": () => {
      printJson(bufferRules.preview(parseReclaimBufferRulePreviewInput(readJsonInput())));
    },
    "reclaim:buffers:preview-template": () => {
      printJson(bufferTemplates.preview(parseReclaimBufferTemplateInputs(readJsonInput())));
    },
    "reclaim:meetings:preview-availability": () => {
      printJson(meetingAvailability.preview(parseReclaimMeetingAvailabilityPreviewInput(readJsonInput())));
    },
    "reclaim:meetings:preview-recurring-reschedule": () => {
      printJson(recurringMeetingReschedule.preview(parseReclaimRecurringMeetingReschedulePreviewInput(readJsonInput())));
    },
    "reclaim:meetings-hours:preview-inspect": () => {
      printJson(meetingsHours.previewInspectSnapshot(parseReclaimMeetingsAndHoursSnapshot(readJsonInput())));
    },
    "reclaim:meetings-hours:preview-switch": () => {
      printJson(meetingsHours.previewPresetSwitches(parseReclaimHoursPresetSwitchPreviewInput(readJsonInput())));
    },
    "reclaim:hours-config:preview-audit": () => {
      printJson(hoursConfig.inspectSnapshot(parseReclaimHoursConfigSnapshot(readJsonInput())));
    },
    "reclaim:hours-config:preview-diff": () => {
      printJson(hoursConfig.createDiffDigest(parseReclaimHoursConfigDiffInput(readJsonInput())));
    },
    "reclaim:account-audit:preview-inspect": () => {
      printJson(accountAudit.inspectSnapshot(parseReclaimAccountAuditSnapshot(readJsonInput())));
    },
    "reclaim:account-audit:preview-drift": () => {
      printJson(createAccountAuditDriftDigest(parseReclaimAccountAuditDriftInput(readJsonInput())));
    }
  };
}

function buildAuthenticatedReadCommandHandlers(): Record<string, CommandHandler> {
  return {
    "reclaim:meetings-hours:inspect": async () => {
      printJson(await meetingsHours.inspect(loadClient()));
    },
    "reclaim:hours-config:audit": async () => {
      printJson(await hoursConfig.audit(loadClient()));
    },
    "reclaim:account-audit:inspect": async () => {
      printJson(await accountAudit.inspect(loadClient()));
    },
    "reclaim:demo:mock-api": runMockLabCommand,
    "reclaim:tasks:list": async () => {
      const client = loadClient();
      printJson(tasks.listExistingTasks(await client.listTasks(), parseTaskListFilters()));
    },
    "reclaim:tasks:filter": async () => {
      const filters = parseTaskListFilters();
      if (!hasAnyTaskListFilter(filters)) {
        throw new Error("Expected at least one task filter flag.");
      }
      const client = loadClient();
      printJson(tasks.listExistingTasks(await client.listTasks(), filters));
    },
    "reclaim:tasks:export": async () => {
      const client = loadClient();
      printJson(tasks.exportExistingTasks(await client.listTasks(), {
        filters: parseTaskListFilters(),
        format: parseTaskExportFormat()
      }));
    },
    "reclaim:tasks:validate-write-receipts": async () => {
      const client = loadClient();
      printJson(await tasks.validateWriteReceipts(client, parseTaskWriteReceipts(readJsonInput())));
    },
    "reclaim:tasks:inspect-duplicates": async () => {
      const taskInputs = parseReclaimTaskInputs(readJsonInput());
      const client = loadClient();
      printJson(tasks.inspectDuplicates(taskInputs, await client.listTasks(), {
        timeSchemeId: client.config.preferredTimePolicyId,
        eventCategory: client.config.defaultTaskEventCategory
      }));
    }
  };
}

function buildTaskWriteCommandHandlers(): Record<string, CommandHandler> {
  return {
    "reclaim:tasks:create": async () => {
      printJson(await tasks.create(loadClient(), parseReclaimTaskInputs(readJsonInput()), {
        confirmWrite: hasFlag("--confirm-write")
      }));
    },
    "reclaim:tasks:cleanup-duplicates": async () => {
      const taskInputs = parseReclaimTaskInputs(readJsonInput());
      const client = loadClient();
      const plan = tasks.inspectDuplicates(taskInputs, await client.listTasks(), {
        timeSchemeId: client.config.preferredTimePolicyId,
        eventCategory: client.config.defaultTaskEventCategory
      });
      printJson(await tasks.cleanupDuplicates(client, plan, {
        confirmDelete: hasFlag("--confirm-reviewed-delete")
      }));
    }
  };
}

function buildCommandHandlers(): Record<string, CommandHandler> {
  return {
    ...buildCoreCommandHandlers(),
    ...buildPreviewCommandHandlers(),
    ...buildAuthenticatedReadCommandHandlers(),
    ...buildTaskWriteCommandHandlers()
  };
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (isHelpRequest(command)) {
    printHelp();
    return;
  }
  const handler = command ? buildCommandHandlers()[command] : undefined;
  if (handler) {
    await handler();
    return;
  }

  throw new Error("Unknown command.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
