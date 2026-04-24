type HelpSafetyClass = "public_metadata" | "local_preview" | "authenticated_read" | "confirmed_write";
type HelpCurrentMode = "stable" | "preview_only" | "read_only" | "live_write";
type HelpReadinessStatus = "ready" | "evidence_pending" | "review_pending" | "blocked";

interface ReclaimCliHelpCommandDefinition {
  command: string;
  summary: string;
  safetyClass: HelpSafetyClass;
  currentMode: HelpCurrentMode;
  requiresConfig: boolean;
  groupId: "core" | "tasks" | "optional";
  includeByDefault: boolean;
  readinessStatus?: HelpReadinessStatus;
  readinessGate?: string;
}

interface ReclaimCliHelpCommand {
  command: string;
  summary: string;
  safetyClass: HelpSafetyClass;
  currentMode: HelpCurrentMode;
  requiresConfig: boolean;
  optionalSurface: boolean;
  readinessStatus?: HelpReadinessStatus;
  readinessGate?: string;
}

interface ReclaimCliHelpGroup {
  id: "core" | "tasks" | "optional";
  label: string;
  commands: ReclaimCliHelpCommand[];
}

export interface ReclaimCliHelp {
  help: "reclaim-toolkit-help";
  readSafety: "public_metadata";
  installSurface: "npm_first";
  configPath: string;
  includesOptionalSurfaces: boolean;
  optionalSurfaceHint?: {
    flag: "--include-optional";
    hiddenCommandCount: number;
    note: string;
  };
  groups: ReclaimCliHelpGroup[];
}

const HELP_GROUP_LABELS: Record<ReclaimCliHelpGroup["id"], string> = {
  core: "Core toolkit commands",
  tasks: "Task baseline",
  optional: "Optional Reclaim surfaces"
};

const COMMAND_DEFINITIONS: ReclaimCliHelpCommandDefinition[] = [
  {
    command: "reclaim:help",
    summary: "Show npm-first CLI help and optional-surface readiness gates.",
    safetyClass: "public_metadata",
    currentMode: "stable",
    requiresConfig: false,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:onboarding",
    summary: "Show the credential-free onboarding wizard and local config readiness.",
    safetyClass: "public_metadata",
    currentMode: "stable",
    requiresConfig: false,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:config:status",
    summary: "Inspect the local config file without contacting Reclaim.",
    safetyClass: "public_metadata",
    currentMode: "stable",
    requiresConfig: false,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:openapi:capability-matrix",
    summary: "Compare shipped and roadmap surfaces against the published OpenAPI document.",
    safetyClass: "public_metadata",
    currentMode: "stable",
    requiresConfig: false,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:support:bundle",
    summary: "Generate a redacted support bundle for preview or config incidents.",
    safetyClass: "local_preview",
    currentMode: "stable",
    requiresConfig: false,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:health",
    summary: "Run an authenticated health check against a configured Reclaim API endpoint.",
    safetyClass: "authenticated_read",
    currentMode: "stable",
    requiresConfig: true,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:time-policies:list",
    summary: "List task-assignment time policies from a configured account.",
    safetyClass: "authenticated_read",
    currentMode: "stable",
    requiresConfig: true,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:time-policies:explain-conflicts",
    summary: "Explain policy fit for synthetic task, focus, and buffer previews.",
    safetyClass: "local_preview",
    currentMode: "stable",
    requiresConfig: false,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:demo:mock-api",
    summary: "Exercise the toolkit against the synthetic mock API surface.",
    safetyClass: "local_preview",
    currentMode: "stable",
    requiresConfig: false,
    groupId: "core",
    includeByDefault: true
  },
  {
    command: "reclaim:tasks:preview-create",
    summary: "Preview task create payloads from synthetic input fixtures.",
    safetyClass: "local_preview",
    currentMode: "stable",
    requiresConfig: false,
    groupId: "tasks",
    includeByDefault: true
  },
  {
    command: "reclaim:tasks:list",
    summary: "Read tasks from a configured account.",
    safetyClass: "authenticated_read",
    currentMode: "stable",
    requiresConfig: true,
    groupId: "tasks",
    includeByDefault: true
  },
  {
    command: "reclaim:tasks:filter",
    summary: "Read and filter tasks from a configured account.",
    safetyClass: "authenticated_read",
    currentMode: "stable",
    requiresConfig: true,
    groupId: "tasks",
    includeByDefault: true
  },
  {
    command: "reclaim:tasks:export",
    summary: "Export read-only task results as JSON or CSV content inside JSON output.",
    safetyClass: "authenticated_read",
    currentMode: "stable",
    requiresConfig: true,
    groupId: "tasks",
    includeByDefault: true
  },
  {
    command: "reclaim:tasks:inspect-duplicates",
    summary: "Preview duplicate risk before any task write.",
    safetyClass: "authenticated_read",
    currentMode: "stable",
    requiresConfig: true,
    groupId: "tasks",
    includeByDefault: true
  },
  {
    command: "reclaim:tasks:create",
    summary: "Create tasks after explicit write confirmation.",
    safetyClass: "confirmed_write",
    currentMode: "live_write",
    requiresConfig: true,
    groupId: "tasks",
    includeByDefault: true
  },
  {
    command: "reclaim:tasks:validate-write-receipts",
    summary: "Validate prior task write receipts against the configured account.",
    safetyClass: "authenticated_read",
    currentMode: "stable",
    requiresConfig: true,
    groupId: "tasks",
    includeByDefault: true
  },
  {
    command: "reclaim:tasks:cleanup-duplicates",
    summary: "Delete reviewed duplicate tasks after explicit confirmation.",
    safetyClass: "confirmed_write",
    currentMode: "live_write",
    requiresConfig: true,
    groupId: "tasks",
    includeByDefault: true
  },
  {
    command: "reclaim:habits:preview-create",
    summary: "Preview habit payloads from synthetic input fixtures.",
    safetyClass: "local_preview",
    currentMode: "preview_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "review_pending",
    readinessGate: "Habit field mapping still needs a bounded review against the generated OpenAPI contract before any live write helper."
  },
  {
    command: "reclaim:focus:preview-create",
    summary: "Preview focus-block payloads from synthetic input fixtures.",
    safetyClass: "local_preview",
    currentMode: "preview_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "evidence_pending",
    readinessGate: "No reviewed public API-shape evidence has been accepted for Focus create writes."
  },
  {
    command: "reclaim:buffers:preview-create",
    summary: "Preview buffer payloads from synthetic input fixtures.",
    safetyClass: "local_preview",
    currentMode: "preview_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "evidence_pending",
    readinessGate: "Buffer write behavior remains unproven because public anchor and placement semantics are not yet reviewed."
  },
  {
    command: "reclaim:buffers:preview-rule",
    summary: "Preview buffer rule diffs from synthetic rules and optional current buffers.",
    safetyClass: "local_preview",
    currentMode: "preview_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "evidence_pending",
    readinessGate: "Rule previews stay synthetic until Buffer write semantics are proven publicly."
  },
  {
    command: "reclaim:buffers:preview-template",
    summary: "Expand buffer templates into synthetic preview payloads.",
    safetyClass: "local_preview",
    currentMode: "preview_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "evidence_pending",
    readinessGate: "Template expansion remains preview-only because downstream Buffer writes are not yet approved."
  },
  {
    command: "reclaim:meetings:preview-availability",
    summary: "Simulate candidate meeting slots from synthetic availability fixtures.",
    safetyClass: "local_preview",
    currentMode: "preview_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "blocked",
    readinessGate: "Scheduling helpers stay preview-only until a separate public-safe routing review approves any live meeting write path."
  },
  {
    command: "reclaim:meetings:preview-recurring-reschedule",
    summary: "Simulate recurring meeting move suggestions from synthetic fixtures.",
    safetyClass: "local_preview",
    currentMode: "preview_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "blocked",
    readinessGate: "Recurring meeting reschedule stays synthetic because live calendar mutation and fallback routing remain out of bounds."
  },
  {
    command: "reclaim:meetings-hours:preview-inspect",
    summary: "Inspect synthetic meetings-and-hours snapshots without live account reads.",
    safetyClass: "local_preview",
    currentMode: "read_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "blocked",
    readinessGate: "Hours-related helpers remain read-only or preview-only until a separate scheduling review approves a narrow public write contract."
  },
  {
    command: "reclaim:meetings-hours:preview-switch",
    summary: "Preview hours preset switches from synthetic snapshots.",
    safetyClass: "local_preview",
    currentMode: "preview_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "blocked",
    readinessGate: "Hours switching is intentionally blocked from live writes pending separate scheduling-surface approval."
  },
  {
    command: "reclaim:meetings-hours:inspect",
    summary: "Read meetings and hours summaries from a configured account.",
    safetyClass: "authenticated_read",
    currentMode: "read_only",
    requiresConfig: true,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "blocked",
    readinessGate: "This surface stays read-only; live hours mutation is not approved in the public toolkit."
  },
  {
    command: "reclaim:account-audit:preview-inspect",
    summary: "Inspect synthetic account snapshots as counts and capability coverage only.",
    safetyClass: "local_preview",
    currentMode: "read_only",
    requiresConfig: false,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "ready",
    readinessGate: "This summary-only audit surface is already public-safe because it returns counts and capability coverage instead of private object details."
  },
  {
    command: "reclaim:account-audit:inspect",
    summary: "Read a summary-only account audit from a configured account.",
    safetyClass: "authenticated_read",
    currentMode: "read_only",
    requiresConfig: true,
    groupId: "optional",
    includeByDefault: false,
    readinessStatus: "ready",
    readinessGate: "This authenticated audit surface is intentionally limited to counts and capability coverage."
  }
];

function toHelpCommand(definition: ReclaimCliHelpCommandDefinition): ReclaimCliHelpCommand {
  return {
    command: definition.command,
    summary: definition.summary,
    safetyClass: definition.safetyClass,
    currentMode: definition.currentMode,
    requiresConfig: definition.requiresConfig,
    optionalSurface: definition.groupId === "optional",
    readinessStatus: definition.readinessStatus,
    readinessGate: definition.readinessGate
  };
}

export function getReclaimCliHelp(options?: { includeOptional?: boolean }): ReclaimCliHelp {
  const includeOptional = options?.includeOptional ?? false;
  const visibleCommands = COMMAND_DEFINITIONS.filter((definition) => includeOptional || definition.includeByDefault);
  const groups = (["core", "tasks", "optional"] as const)
    .map((groupId) => {
      const commands = visibleCommands
        .filter((definition) => definition.groupId === groupId)
        .map(toHelpCommand);

      if (commands.length === 0) {
        return undefined;
      }

      return {
        id: groupId,
        label: HELP_GROUP_LABELS[groupId],
        commands
      };
    })
    .filter((group): group is ReclaimCliHelpGroup => group !== undefined);

  const hiddenCommandCount = COMMAND_DEFINITIONS.filter((definition) => !definition.includeByDefault).length;

  return {
    help: "reclaim-toolkit-help",
    readSafety: "public_metadata",
    installSurface: "npm_first",
    configPath: "config/reclaim.local.json",
    includesOptionalSurfaces: includeOptional,
    optionalSurfaceHint: includeOptional
      ? undefined
      : {
          flag: "--include-optional",
          hiddenCommandCount,
          note:
            "Optional preview-only and read-only surfaces stay hidden by default so help output remains focused on the conventional public baseline."
        },
    groups
  };
}
