import { z } from "zod";
import type {
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskEventCategory
} from "./types.js";

const TASK_ASSIGNMENT_FEATURE = "TASK_ASSIGNMENT";
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const ReclaimTimeSchemeWindowSnapshotSchema = z.object({
  dayOfWeek: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional()
});

const ReclaimTimeSchemeSnapshotSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  taskCategory: z.string().default("PERSONAL"),
  description: z.string().optional(),
  timezone: z.string().optional(),
  features: z.array(z.string()).default([]),
  windows: z.array(ReclaimTimeSchemeWindowSnapshotSchema).default([])
});

const ReclaimTimePolicyExplainerTaskSchema = z.object({
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  due: z.string().optional(),
  startAfter: z.string().optional(),
  timeSchemeId: z.string().min(1).optional(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional()
});

export const ReclaimTimePolicyExplainerInputSchema = z.object({
  tasks: z.array(ReclaimTimePolicyExplainerTaskSchema).default([]),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([]),
  defaultTaskEventCategory: z.enum(["PERSONAL", "WORK"]).default("PERSONAL"),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
});

export interface TimePolicyDiscoveryItem {
  id: string;
  title: string;
  taskCategory: string;
  description?: string;
  features: string[];
  matchesDefaultEventCategory: boolean;
}

export interface TimePolicySelectionPreview {
  selectedPolicy?: TimePolicyDiscoveryItem;
  selectionReason: string;
  policies: TimePolicyDiscoveryItem[];
}

export interface ReclaimTimePolicyExplainerTask {
  title: string;
  durationMinutes: number;
  due?: string;
  startAfter?: string;
  timeSchemeId?: string;
  eventCategory?: ReclaimTaskEventCategory;
}

export interface ReclaimTimePolicyExplainerInput {
  tasks: ReclaimTimePolicyExplainerTask[];
  timeSchemes: ReclaimTaskAssignmentTimeScheme[];
  defaultTaskEventCategory: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

export interface TimePolicyConflictTaskExplanation {
  title: string;
  status: "fit" | "conflict";
  taskEventCategory: ReclaimTaskEventCategory;
  requiredMinutes: number;
  selectedPolicy?: TimePolicyDiscoveryItem & { windowCount: number };
  selectionReason: string;
  explanation: string;
  conflicts: string[];
  availablePolicyMinutes?: number;
}

export interface TimePolicyConflictExplanation {
  taskCount: number;
  policyCount: number;
  readSafety: "read_only";
  tasks: TimePolicyConflictTaskExplanation[];
}

function normalizePolicyTitle(value: string): string {
  return value.trim().toLowerCase();
}

function findPolicyByTitle(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  preferredTitle: string
): ReclaimTaskAssignmentTimeScheme | undefined {
  const normalizedTitle = normalizePolicyTitle(preferredTitle);
  const exact = schemes.find((scheme) => normalizePolicyTitle(scheme.title) === normalizedTitle);
  if (exact) {
    return exact;
  }

  const partialMatches = schemes.filter((scheme) => normalizePolicyTitle(scheme.title).includes(normalizedTitle));
  return partialMatches.length === 1 ? partialMatches[0] : undefined;
}

function toDiscoveryItem(
  scheme: ReclaimTaskAssignmentTimeScheme,
  eventCategory: ReclaimTaskEventCategory
): TimePolicyDiscoveryItem {
  return {
    id: scheme.id,
    title: scheme.title,
    taskCategory: scheme.taskCategory,
    description: scheme.description,
    features: scheme.features,
    matchesDefaultEventCategory: scheme.taskCategory === eventCategory
  };
}

export function previewTimePolicySelection(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  options: {
    preferredTimePolicyId?: string;
    preferredTimePolicyTitle?: string;
    eventCategory: ReclaimTaskEventCategory;
  }
): TimePolicySelectionPreview {
  const policies = schemes.map((scheme) => toDiscoveryItem(scheme, options.eventCategory));

  if (policies.length === 0) {
    return {
      selectionReason: "No Reclaim task-assignment time policies were returned.",
      policies
    };
  }

  if (options.preferredTimePolicyId) {
    const selectedPolicy = policies.find((scheme) => scheme.id === options.preferredTimePolicyId);
    return {
      selectedPolicy,
      selectionReason: selectedPolicy
        ? `Matched preferred Reclaim time policy id ${options.preferredTimePolicyId}.`
        : `Preferred Reclaim time policy id ${options.preferredTimePolicyId} was not found.`,
      policies
    };
  }

  if (options.preferredTimePolicyTitle) {
    const selectedScheme = findPolicyByTitle(schemes, options.preferredTimePolicyTitle);
    const selectedPolicy = selectedScheme ? policies.find((scheme) => scheme.id === selectedScheme.id) : undefined;
    return {
      selectedPolicy,
      selectionReason: selectedPolicy
        ? `Matched preferred Reclaim time policy title "${options.preferredTimePolicyTitle}".`
        : `Preferred Reclaim time policy title "${options.preferredTimePolicyTitle}" was not found as an exact or unique partial match.`,
      policies
    };
  }

  const selectedPolicy =
    policies.find((scheme) => scheme.matchesDefaultEventCategory) ?? policies[0];
  return {
    selectedPolicy,
    selectionReason: selectedPolicy.matchesDefaultEventCategory
      ? `Selected the first Reclaim time policy matching event category ${options.eventCategory}.`
      : "Selected the first returned Reclaim time policy because none matched the default event category.",
    policies
  };
}

export function selectTimeScheme(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  options: {
    preferredTimePolicyId?: string;
    preferredTimePolicyTitle?: string;
    eventCategory: ReclaimTaskEventCategory;
  }
): ReclaimTaskAssignmentTimeScheme {
  if (schemes.length === 0) {
    throw new Error("No Reclaim task-assignment time policies were returned.");
  }

  if (options.preferredTimePolicyId) {
    const exact = schemes.find((scheme) => scheme.id === options.preferredTimePolicyId);
    if (!exact) {
      throw new Error(`Preferred Reclaim time policy id ${options.preferredTimePolicyId} was not found.`);
    }
    return exact;
  }

  if (options.preferredTimePolicyTitle) {
    const match = findPolicyByTitle(schemes, options.preferredTimePolicyTitle);
    if (!match) {
      throw new Error(
        `Preferred Reclaim time policy title "${options.preferredTimePolicyTitle}" was not found as an exact or unique partial match.`
      );
    }
    return match;
  }

  const preview = previewTimePolicySelection(schemes, options);
  return schemes.find((scheme) => scheme.id === preview.selectedPolicy?.id) ?? schemes[0]!;
}

export function parseReclaimTimePolicyExplainerInput(raw: unknown): ReclaimTimePolicyExplainerInput {
  return ReclaimTimePolicyExplainerInputSchema.parse(raw);
}

function parseIsoDate(value: string | undefined, label: string, conflicts: string[]): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    conflicts.push(`Task ${label} "${value}" is not a valid ISO date-time.`);
    return undefined;
  }
  return parsed;
}

function parseClockMinutes(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^(?<hours>\d{2}):(?<minutes>\d{2})$/.exec(value);
  if (!match?.groups) {
    return undefined;
  }

  const hours = Number(match.groups.hours);
  const minutes = Number(match.groups.minutes);
  if (hours > 23 || minutes > 59) {
    return undefined;
  }

  return hours * MINUTES_PER_HOUR + minutes;
}

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function computeAvailablePolicyMinutes(
  scheme: ReclaimTaskAssignmentTimeScheme,
  rangeStart: Date,
  rangeEnd: Date
): number | undefined {
  if (!scheme.windows?.length) {
    return undefined;
  }

  let totalMinutes = 0;
  for (
    let dayStart = startOfUtcDay(rangeStart);
    dayStart <= rangeEnd.getTime();
    dayStart += MILLISECONDS_PER_DAY
  ) {
    const day = new Date(dayStart);
    const weekdayName = WEEKDAY_NAMES[day.getUTCDay()];
    for (const window of scheme.windows) {
      if (window.dayOfWeek?.trim().toLowerCase() !== weekdayName) {
        continue;
      }

      const startMinutes = parseClockMinutes(window.start);
      const endMinutes = parseClockMinutes(window.end);
      if (startMinutes === undefined || endMinutes === undefined || endMinutes <= startMinutes) {
        continue;
      }

      const windowStart = dayStart + startMinutes * MILLISECONDS_PER_MINUTE;
      const windowEnd = dayStart + endMinutes * MILLISECONDS_PER_MINUTE;
      const overlapStart = Math.max(windowStart, rangeStart.getTime());
      const overlapEnd = Math.min(windowEnd, rangeEnd.getTime());
      if (overlapEnd <= overlapStart) {
        continue;
      }

      totalMinutes += Math.floor((overlapEnd - overlapStart) / MILLISECONDS_PER_MINUTE);
    }
  }

  return totalMinutes;
}

function explicitSelectionPreview(
  scheme: ReclaimTaskAssignmentTimeScheme | undefined,
  requestedTimeSchemeId: string,
  eventCategory: ReclaimTaskEventCategory
): { selectedPolicy?: TimePolicyDiscoveryItem; selectionReason: string } {
  return {
    selectedPolicy: scheme ? toDiscoveryItem(scheme, eventCategory) : undefined,
    selectionReason: scheme
      ? `Task input requested explicit Reclaim time policy id ${requestedTimeSchemeId}.`
      : `Task input requested explicit Reclaim time policy id ${requestedTimeSchemeId}, but it was not found.`
  };
}

function selectedPolicyWithWindowCount(
  scheme: ReclaimTaskAssignmentTimeScheme | undefined,
  eventCategory: ReclaimTaskEventCategory
): (TimePolicyDiscoveryItem & { windowCount: number }) | undefined {
  if (!scheme) {
    return undefined;
  }

  return {
    ...toDiscoveryItem(scheme, eventCategory),
    windowCount: scheme.windows?.length ?? 0
  };
}

function buildExplanation(
  status: "fit" | "conflict",
  requiredMinutes: number,
  availablePolicyMinutes: number | undefined,
  selectedPolicy: (TimePolicyDiscoveryItem & { windowCount: number }) | undefined,
  conflicts: string[],
  hasBoundedWindowCheck: boolean
): string {
  if (status === "conflict") {
    return conflicts.join(" ");
  }

  if (availablePolicyMinutes !== undefined) {
    return `Task needs ${requiredMinutes} minutes and the selected policy exposes ${availablePolicyMinutes} minute(s) inside the bounded window.`;
  }

  if (hasBoundedWindowCheck) {
    return "The selected policy passed the bounded window check.";
  }

  if (selectedPolicy?.windowCount) {
    return "The selected policy and task category line up, but no bounded startAfter/due range was provided for a capacity check.";
  }

  return "The selected policy is available for this task, but no policy windows were supplied for a capacity check.";
}

export function explainTimePolicyConflicts(
  input: ReclaimTimePolicyExplainerInput
): TimePolicyConflictExplanation {
  return {
    taskCount: input.tasks.length,
    policyCount: input.timeSchemes.length,
    readSafety: "read_only",
    tasks: input.tasks.map((task) => {
      const taskEventCategory = task.eventCategory ?? input.defaultTaskEventCategory;
      const selectionPreview = task.timeSchemeId
        ? explicitSelectionPreview(
          input.timeSchemes.find((scheme) => scheme.id === task.timeSchemeId),
          task.timeSchemeId,
          taskEventCategory
        )
        : previewTimePolicySelection(input.timeSchemes, {
          preferredTimePolicyId: input.preferredTimePolicyId,
          preferredTimePolicyTitle: input.preferredTimePolicyTitle,
          eventCategory: taskEventCategory
        });
      const selectedScheme = selectionPreview.selectedPolicy
        ? input.timeSchemes.find((scheme) => scheme.id === selectionPreview.selectedPolicy?.id)
        : undefined;
      const selectedPolicy = selectedPolicyWithWindowCount(selectedScheme, taskEventCategory);
      const conflicts: string[] = [];

      if (!selectedScheme) {
        conflicts.push("No matching Reclaim task-assignment time policy was available for this task.");
      } else {
        if (!selectedScheme.features.includes(TASK_ASSIGNMENT_FEATURE)) {
          conflicts.push(`Selected policy ${selectedScheme.id} does not advertise the ${TASK_ASSIGNMENT_FEATURE} feature.`);
        }
        if (selectedScheme.taskCategory !== taskEventCategory) {
          conflicts.push(
            `Selected policy category ${selectedScheme.taskCategory} does not match task event category ${taskEventCategory}.`
          );
        }
      }

      const startAfter = parseIsoDate(task.startAfter, "startAfter", conflicts);
      const due = parseIsoDate(task.due, "due", conflicts);
      if (startAfter && due && due.getTime() <= startAfter.getTime()) {
        conflicts.push("Task due must be later than startAfter for a bounded policy check.");
      }

      let availablePolicyMinutes: number | undefined;
      const hasBoundedWindowCheck = Boolean(startAfter && due && selectedScheme && conflicts.length === 0);
      if (hasBoundedWindowCheck) {
        availablePolicyMinutes = computeAvailablePolicyMinutes(selectedScheme!, startAfter!, due!);
        if (availablePolicyMinutes === undefined) {
          conflicts.push("Selected policy did not include windows for a bounded capacity check.");
        } else if (availablePolicyMinutes === 0) {
          conflicts.push("Selected policy windows do not expose any schedulable time between startAfter and due.");
        } else if (availablePolicyMinutes < task.durationMinutes) {
          conflicts.push(
            `Task needs ${task.durationMinutes} minutes but the selected policy exposes only ${availablePolicyMinutes} minute(s) between startAfter and due.`
          );
        }
      }

      const status = conflicts.length > 0 ? "conflict" : "fit";
      return {
        title: task.title,
        status,
        taskEventCategory,
        requiredMinutes: task.durationMinutes,
        selectedPolicy,
        selectionReason: selectionPreview.selectionReason,
        explanation: buildExplanation(
          status,
          task.durationMinutes,
          availablePolicyMinutes,
          selectedPolicy,
          conflicts,
          hasBoundedWindowCheck
        ),
        conflicts,
        availablePolicyMinutes
      };
    })
  };
}

export const timePolicies = {
  previewSelection: previewTimePolicySelection,
  explainConflicts: explainTimePolicyConflicts
};
