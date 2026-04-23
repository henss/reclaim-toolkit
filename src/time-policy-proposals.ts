import { z } from "zod";
import type {
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskEventCategory
} from "./types.js";
import {
  previewTimePolicySelection,
  toDiscoveryItem,
  type TimePolicyDiscoveryItem
} from "./time-policy-selection.js";

const MINUTES_PER_HOUR = 60;
const HOUR_MINUTE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export const ReclaimTimePolicyExplainerFocusSchema = z.object({
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  cadence: z.enum(["once", "daily", "weekly"]).default("once"),
  daysOfWeek: z.array(z.enum(WEEKDAY_NAMES)).min(1).optional(),
  date: z.string().optional(),
  windowStart: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional(),
  windowEnd: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional()
});

export const ReclaimTimePolicyExplainerBufferSchema = z.object({
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  placement: z.enum(["before", "after", "between"]).default("after"),
  anchor: z.string().min(1),
  windowStart: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional(),
  windowEnd: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional()
});

export interface ReclaimTimePolicyExplainerFocusBlock {
  title: string;
  durationMinutes: number;
  eventCategory?: ReclaimTaskEventCategory;
  cadence?: "once" | "daily" | "weekly";
  daysOfWeek?: Array<(typeof WEEKDAY_NAMES)[number]>;
  date?: string;
  windowStart?: string;
  windowEnd?: string;
}

export interface ReclaimTimePolicyExplainerBuffer {
  title: string;
  durationMinutes: number;
  eventCategory?: ReclaimTaskEventCategory;
  placement?: "before" | "after" | "between";
  anchor: string;
  windowStart?: string;
  windowEnd?: string;
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

export interface TimePolicyConflictFocusExplanation extends TimePolicyConflictExplanationBase {
  cadence: "once" | "daily" | "weekly";
  checkedDays: string[];
}

export interface TimePolicyConflictBufferExplanation extends TimePolicyConflictExplanationBase {
  placement: "before" | "after" | "between";
  anchor: string;
  checkedDays: string[];
}

export interface TimePolicyProposalContext {
  timeSchemes: ReclaimTaskAssignmentTimeScheme[];
  defaultTaskEventCategory: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
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

function parseIsoDateOnly(value: string, label: string, conflicts: string[]): Date | undefined {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    conflicts.push(`Focus block ${label} "${value}" is not a valid ISO date.`);
    return undefined;
  }
  return parsed;
}

function computeDailyWindowMinutes(
  scheme: ReclaimTaskAssignmentTimeScheme,
  dayName: string,
  windowStart: string,
  windowEnd: string
): number | undefined {
  if (!scheme.windows?.length) {
    return undefined;
  }

  const requestedStart = parseClockMinutes(windowStart);
  const requestedEnd = parseClockMinutes(windowEnd);
  if (requestedStart === undefined || requestedEnd === undefined || requestedEnd <= requestedStart) {
    return undefined;
  }

  let totalMinutes = 0;
  for (const window of scheme.windows) {
    if (window.dayOfWeek?.trim().toLowerCase() !== dayName) {
      continue;
    }

    const startMinutes = parseClockMinutes(window.start);
    const endMinutes = parseClockMinutes(window.end);
    if (startMinutes === undefined || endMinutes === undefined || endMinutes <= startMinutes) {
      continue;
    }

    const overlapStart = Math.max(startMinutes, requestedStart);
    const overlapEnd = Math.min(endMinutes, requestedEnd);
    if (overlapEnd <= overlapStart) {
      continue;
    }

    totalMinutes += overlapEnd - overlapStart;
  }

  return totalMinutes;
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

function summarizeProposalCheck(
  label: "Focus block" | "Buffer",
  requiredMinutes: number,
  checkedDays: string[],
  availableByDay: Map<string, number>,
  conflicts: string[],
  selectedPolicy: (TimePolicyDiscoveryItem & { windowCount: number }) | undefined,
  boundedCheckSummary: string | undefined
): string {
  if (conflicts.length > 0) {
    return conflicts.join(" ");
  }

  if (boundedCheckSummary) {
    return boundedCheckSummary;
  }

  if (checkedDays.length > 0) {
    const minutesByDay = checkedDays
      .map((day) => `${day}: ${availableByDay.get(day) ?? 0} minute(s)`)
      .join(", ");
    return `${label} needs ${requiredMinutes} minutes and fits inside the selected policy window on ${minutesByDay}.`;
  }

  if (selectedPolicy?.windowCount) {
    return `${label} matches the selected policy category, but no bounded preview window was supplied for a capacity check.`;
  }

  return `${label} matches the selected policy category, but the policy did not include windows for a capacity check.`;
}

function selectPolicyForProposal(
  context: TimePolicyProposalContext,
  eventCategory: ReclaimTaskEventCategory
): {
  scheme: ReclaimTaskAssignmentTimeScheme | undefined;
  selectionReason: string;
  selectedPolicy: (TimePolicyDiscoveryItem & { windowCount: number }) | undefined;
} {
  const selectionPreview = previewTimePolicySelection(context.timeSchemes, {
    preferredTimePolicyId: context.preferredTimePolicyId,
    preferredTimePolicyTitle: context.preferredTimePolicyTitle,
    eventCategory
  });
  const scheme = selectionPreview.selectedPolicy
    ? context.timeSchemes.find((candidate) => candidate.id === selectionPreview.selectedPolicy?.id)
    : undefined;
  return {
    scheme,
    selectionReason: selectionPreview.selectionReason,
    selectedPolicy: selectedPolicyWithWindowCount(scheme, eventCategory)
  };
}

function uniqueWeekdaysFromScheme(scheme: ReclaimTaskAssignmentTimeScheme | undefined): string[] {
  if (!scheme?.windows?.length) {
    return [];
  }

  return [...new Set(
    scheme.windows
      .map((window) => window.dayOfWeek?.trim().toLowerCase())
      .filter((dayName): dayName is string => Boolean(dayName))
  )];
}

export function explainFocusBlockConflict(
  focusBlock: ReclaimTimePolicyExplainerFocusBlock,
  context: TimePolicyProposalContext
): TimePolicyConflictFocusExplanation {
  const eventCategory = focusBlock.eventCategory ?? context.defaultTaskEventCategory;
  const { scheme, selectionReason, selectedPolicy } = selectPolicyForProposal(context, eventCategory);
  const conflicts: string[] = [];
  const checkedDays: string[] = [];
  const availableByDay = new Map<string, number>();

  if (!scheme) {
    conflicts.push("No matching Reclaim time policy was available for this focus block.");
  } else if (scheme.taskCategory !== eventCategory) {
    conflicts.push(`Selected policy category ${scheme.taskCategory} does not match focus block event category ${eventCategory}.`);
  }

  let boundedCheckSummary: string | undefined;
  if (focusBlock.windowStart && focusBlock.windowEnd && scheme && conflicts.length === 0) {
    let targetDays: string[] = [];
    if (focusBlock.cadence === "weekly") {
      targetDays = focusBlock.daysOfWeek ?? [];
    } else if (focusBlock.cadence === "once" && focusBlock.date) {
      const date = parseIsoDateOnly(focusBlock.date, "date", conflicts);
      if (date) {
        targetDays = [WEEKDAY_NAMES[date.getUTCDay()]];
      }
    } else if (focusBlock.cadence === "daily") {
      targetDays = [...WEEKDAY_NAMES];
    }

    if (targetDays.length === 0) {
      boundedCheckSummary = "The focus block has a preview window, but its cadence does not provide enough day information for a bounded policy check.";
    } else {
      for (const dayName of targetDays) {
        checkedDays.push(dayName);
        const availableMinutes = computeDailyWindowMinutes(scheme, dayName, focusBlock.windowStart, focusBlock.windowEnd);
        if (availableMinutes === undefined) {
          conflicts.push("Selected policy did not include windows for a bounded focus-block capacity check.");
          break;
        }
        availableByDay.set(dayName, availableMinutes);
        if (availableMinutes < focusBlock.durationMinutes) {
          conflicts.push(
            `Focus block needs ${focusBlock.durationMinutes} minutes inside ${focusBlock.windowStart}-${focusBlock.windowEnd}, but the selected policy exposes only ${availableMinutes} minute(s) on ${dayName}.`
          );
        }
      }
    }
  }

  return {
    title: focusBlock.title,
    status: conflicts.length > 0 ? "conflict" : "fit",
    eventCategory,
    requiredMinutes: focusBlock.durationMinutes,
    selectedPolicy,
    selectionReason,
    explanation: summarizeProposalCheck(
      "Focus block",
      focusBlock.durationMinutes,
      checkedDays,
      availableByDay,
      conflicts,
      selectedPolicy,
      boundedCheckSummary
    ),
    conflicts,
    cadence: focusBlock.cadence ?? "once",
    checkedDays
  };
}

export function explainBufferConflict(
  buffer: ReclaimTimePolicyExplainerBuffer,
  context: TimePolicyProposalContext
): TimePolicyConflictBufferExplanation {
  const eventCategory = buffer.eventCategory ?? context.defaultTaskEventCategory;
  const { scheme, selectionReason, selectedPolicy } = selectPolicyForProposal(context, eventCategory);
  const conflicts: string[] = [];
  const checkedDays: string[] = [];
  const availableByDay = new Map<string, number>();

  if (!scheme) {
    conflicts.push("No matching Reclaim time policy was available for this buffer.");
  } else if (scheme.taskCategory !== eventCategory) {
    conflicts.push(`Selected policy category ${scheme.taskCategory} does not match buffer event category ${eventCategory}.`);
  }

  let boundedCheckSummary: string | undefined;
  if (buffer.windowStart && buffer.windowEnd && scheme && conflicts.length === 0) {
    const targetDays = uniqueWeekdaysFromScheme(scheme);
    if (targetDays.length === 0) {
      conflicts.push("Selected policy did not include windows for a bounded buffer capacity check.");
    } else {
      for (const dayName of targetDays) {
        const availableMinutes = computeDailyWindowMinutes(scheme, dayName, buffer.windowStart, buffer.windowEnd) ?? 0;
        if (availableMinutes >= buffer.durationMinutes) {
          checkedDays.push(dayName);
          availableByDay.set(dayName, availableMinutes);
        }
      }

      if (checkedDays.length === 0) {
        conflicts.push(
          `Buffer needs ${buffer.durationMinutes} minutes inside ${buffer.windowStart}-${buffer.windowEnd}, but no selected policy window exposes enough overlapping time on any configured day.`
        );
      } else {
        boundedCheckSummary = `Buffer needs ${buffer.durationMinutes} minutes and fits inside the selected policy window on ${checkedDays.join(", ")}.`;
      }
    }
  }

  return {
    title: buffer.title,
    status: conflicts.length > 0 ? "conflict" : "fit",
    eventCategory,
    requiredMinutes: buffer.durationMinutes,
    selectedPolicy,
    selectionReason,
    explanation: summarizeProposalCheck(
      "Buffer",
      buffer.durationMinutes,
      checkedDays,
      availableByDay,
      conflicts,
      selectedPolicy,
      boundedCheckSummary
    ),
    conflicts,
    placement: buffer.placement ?? "after",
    anchor: buffer.anchor,
    checkedDays
  };
}
