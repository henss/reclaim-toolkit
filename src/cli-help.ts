import {
  reclaimCommandDefinitions,
  type ReclaimCommandCurrentMode as HelpCurrentMode,
  type ReclaimCommandGroupId,
  type ReclaimCommandReadinessStatus as HelpReadinessStatus,
  type ReclaimCommandSafetyClass as HelpSafetyClass,
  type ReclaimCommandSafetyDefinition
} from "./command-safety-manifest.js";

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
  id: ReclaimCommandGroupId;
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

function toHelpCommand(definition: ReclaimCommandSafetyDefinition): ReclaimCliHelpCommand {
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
  const visibleCommands = reclaimCommandDefinitions.filter((definition) => includeOptional || definition.includeByDefault);
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

  const hiddenCommandCount = reclaimCommandDefinitions.filter((definition) => !definition.includeByDefault).length;

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
