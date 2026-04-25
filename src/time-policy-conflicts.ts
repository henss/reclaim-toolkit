import { z } from "zod";
import type {
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskEventCategory
} from "./types.js";
import {
  ReclaimTimeSchemeSnapshotSchema,
  previewTimePolicySelection,
  toDiscoveryItem,
  type TimePolicyDiscoveryItem
} from "./time-policy-selection.js";
import {
  ReclaimTimePolicyExplainerBufferSchema,
  ReclaimTimePolicyExplainerFocusSchema,
  explainBufferConflict,
  explainFocusBlockConflict,
  type ReclaimTimePolicyExplainerBuffer,
  type ReclaimTimePolicyExplainerFocusBlock,
  type TimePolicyConflictBufferExplanation,
  type TimePolicyConflictFocusExplanation
} from "./time-policy-proposals.js";

const TASK_ASSIGNMENT_FEATURE = "TASK_ASSIGNMENT";
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const ReclaimTimePolicyExplainerTaskSchema = z.object({
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  due: z.string().optional(),
  startAfter: z.string().optional(),
  timeSchemeId: z.string().min(1).optional(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional()
});

const ReclaimTimePolicyExplainerHoursProfileSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  eventCategory: z.enum(["PERSONAL", "WORK"]),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
});

export const ReclaimTimePolicyExplainerInputSchema = z.object({
  tasks: z.array(ReclaimTimePolicyExplainerTaskSchema).default([]),
  focusBlocks: z.array(ReclaimTimePolicyExplainerFocusSchema).default([]),
  buffers: z.array(ReclaimTimePolicyExplainerBufferSchema).default([]),
  hoursProfiles: z.array(ReclaimTimePolicyExplainerHoursProfileSchema).default([]),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([]),
  defaultTaskEventCategory: z.enum(["PERSONAL", "WORK"]).default("PERSONAL"),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
});

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
  focusBlocks: ReclaimTimePolicyExplainerFocusBlock[];
  buffers: ReclaimTimePolicyExplainerBuffer[];
  hoursProfiles: ReclaimTimePolicyExplainerHoursProfile[];
  timeSchemes: ReclaimTaskAssignmentTimeScheme[];
  defaultTaskEventCategory: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

export interface ReclaimTimePolicyExplainerHoursProfile {
  id: string;
  title: string;
  eventCategory: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

interface TimePolicyConflictExplanationBase {
  title: string;
  status: "fit" | "conflict";
  eventCategory: ReclaimTaskEventCategory;
  requiredMinutes: number;
  selectedPolicy?: TimePolicyDiscoveryItem & { windowCount: number };
  selectionReason: string;
  explanation: string;
  conflicts: string[];
  availablePolicyMinutes?: number;
}

export interface TimePolicyConflictTaskExplanation extends TimePolicyConflictExplanationBase {
  taskEventCategory: ReclaimTaskEventCategory;
}

export interface TimePolicyConflictHoursProfileExplanation {
  profileId: string;
  title: string;
  status: "fit" | "conflict";
  eventCategory: ReclaimTaskEventCategory;
  selectedPolicy?: TimePolicyDiscoveryItem & { windowCount: number };
  selectionReason: string;
  explanation: string;
  conflicts: string[];
}

export interface TimePolicyConflictExplanation {
  proposalCount: number;
  taskCount: number;
  focusBlockCount: number;
  bufferCount: number;
  hoursProfileCount: number;
  policyCount: number;
  readSafety: "read_only";
  tasks: TimePolicyConflictTaskExplanation[];
  focusBlocks: TimePolicyConflictFocusExplanation[];
  buffers: TimePolicyConflictBufferExplanation[];
  hoursProfiles: TimePolicyConflictHoursProfileExplanation[];
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

function buildTaskExplanation(
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

function buildHoursProfileExplanation(
  selectedPolicy: (TimePolicyDiscoveryItem & { windowCount: number }) | undefined,
  conflicts: string[]
): string {
  if (conflicts.length > 0) {
    return conflicts.join(" ");
  }

  return `The hours profile resolves to ${selectedPolicy?.title ?? "the selected policy"} with ${selectedPolicy?.windowCount ?? 0} configured window(s).`;
}

export function parseReclaimTimePolicyExplainerInput(raw: unknown): ReclaimTimePolicyExplainerInput {
  return ReclaimTimePolicyExplainerInputSchema.parse(raw);
}

export function explainTimePolicyConflicts(
  input: ReclaimTimePolicyExplainerInput
): TimePolicyConflictExplanation {
  const tasks = input.tasks.map((task) => {
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

    const status: "fit" | "conflict" = conflicts.length > 0 ? "conflict" : "fit";
    return {
      title: task.title,
      status,
      eventCategory: taskEventCategory,
      taskEventCategory,
      requiredMinutes: task.durationMinutes,
      selectedPolicy,
      selectionReason: selectionPreview.selectionReason,
      explanation: buildTaskExplanation(
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
  });
  const focusBlocks = input.focusBlocks.map((focusBlock) => explainFocusBlockConflict(focusBlock, input));
  const buffers = input.buffers.map((buffer) => explainBufferConflict(buffer, input));
  const hoursProfiles = input.hoursProfiles.map((profile) => {
    const selectionPreview = previewTimePolicySelection(input.timeSchemes, {
      preferredTimePolicyId: profile.preferredTimePolicyId ?? input.preferredTimePolicyId,
      preferredTimePolicyTitle: profile.preferredTimePolicyTitle ?? input.preferredTimePolicyTitle,
      eventCategory: profile.eventCategory
    });
    const selectedScheme = selectionPreview.selectedPolicy
      ? input.timeSchemes.find((scheme) => scheme.id === selectionPreview.selectedPolicy?.id)
      : undefined;
    const selectedPolicy = selectedPolicyWithWindowCount(selectedScheme, profile.eventCategory);
    const conflicts: string[] = [];

    if (!selectedScheme) {
      conflicts.push("No matching Reclaim time policy was available for this hours profile.");
    } else {
      if (selectedScheme.taskCategory !== profile.eventCategory) {
        conflicts.push(
          `Selected policy category ${selectedScheme.taskCategory} does not match hours profile event category ${profile.eventCategory}.`
        );
      }
      if ((selectedScheme.windows?.length ?? 0) === 0) {
        conflicts.push("Selected policy did not include any hours windows for this profile preview.");
      }
    }

    return {
      profileId: profile.id,
      title: profile.title,
      status: conflicts.length > 0 ? "conflict" : "fit",
      eventCategory: profile.eventCategory,
      selectedPolicy,
      selectionReason: selectionPreview.selectionReason,
      explanation: buildHoursProfileExplanation(selectedPolicy, conflicts),
      conflicts
    } satisfies TimePolicyConflictHoursProfileExplanation;
  });

  return {
    proposalCount: tasks.length + focusBlocks.length + buffers.length + hoursProfiles.length,
    taskCount: tasks.length,
    focusBlockCount: focusBlocks.length,
    bufferCount: buffers.length,
    hoursProfileCount: hoursProfiles.length,
    policyCount: input.timeSchemes.length,
    readSafety: "read_only",
    tasks,
    focusBlocks,
    buffers,
    hoursProfiles
  };
}
