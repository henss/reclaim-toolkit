import { previewTimePolicySelection } from "./time-policy-selection.js";
import type { ReclaimBufferRuleInput } from "./buffer-rules.js";
import type { ReclaimTaskAssignmentTimeScheme, ReclaimTaskEventCategory } from "./types.js";

const MINUTES_PER_HOUR = 60;

export interface BufferRuleProtectedTimeWindowDiff {
  status: "fit" | "partial" | "outside_window" | "unavailable";
  selectionReason: string;
  explanation: string;
  selectedPolicy?: {
    id: string;
    title: string;
    taskCategory: string;
    windowCount: number;
  };
  requestedWindow: {
    start: string;
    end: string;
    boundedMinutes: number;
    requiredMinutes: number;
  };
  checkedDays: string[];
  diffSummary: {
    fitDays: number;
    partialDays: number;
    outsideWindowDays: number;
    uncheckedDays: number;
  };
  diffLines: string[];
}

export interface BufferRulePolicyContext {
  timeSchemes: ReclaimTaskAssignmentTimeScheme[];
  defaultTaskEventCategory?: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

function parseClockMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return (hours * MINUTES_PER_HOUR) + minutes;
}

function formatPolicyWindow(window: { start?: string; end?: string }): string {
  return `${window.start ?? "<unset>"}-${window.end ?? "<unset>"}`;
}

function collectUniquePolicyDays(scheme: ReclaimTaskAssignmentTimeScheme): string[] {
  return [...new Set(
    (scheme.windows ?? [])
      .map((window) => window.dayOfWeek?.trim().toLowerCase())
      .filter((day): day is string => Boolean(day))
  )];
}

function computePolicyOverlapMinutes(
  scheme: ReclaimTaskAssignmentTimeScheme,
  dayName: string,
  requestedWindow: { start: string; end: string }
): {
  overlapMinutes: number;
  windowSummaries: string[];
} {
  const requestedStart = parseClockMinutes(requestedWindow.start);
  const requestedEnd = parseClockMinutes(requestedWindow.end);
  let overlapMinutes = 0;
  const windowSummaries: string[] = [];

  for (const window of scheme.windows ?? []) {
    if (window.dayOfWeek?.trim().toLowerCase() !== dayName) {
      continue;
    }

    windowSummaries.push(formatPolicyWindow(window));
    if (!window.start || !window.end) {
      continue;
    }

    const policyStart = parseClockMinutes(window.start);
    const policyEnd = parseClockMinutes(window.end);
    const overlapStart = Math.max(policyStart, requestedStart);
    const overlapEnd = Math.min(policyEnd, requestedEnd);
    if (overlapEnd > overlapStart) {
      overlapMinutes += overlapEnd - overlapStart;
    }
  }

  return {
    overlapMinutes,
    windowSummaries
  };
}

export function buildProtectedTimeWindowDiff(
  rule: ReclaimBufferRuleInput,
  context: BufferRulePolicyContext
): BufferRuleProtectedTimeWindowDiff | undefined {
  if (!rule.windowStart || !rule.windowEnd) {
    return undefined;
  }

  const eventCategory = rule.eventCategory ?? context.defaultTaskEventCategory ?? "PERSONAL";
  const selection = previewTimePolicySelection(context.timeSchemes, {
    preferredTimePolicyId: context.preferredTimePolicyId,
    preferredTimePolicyTitle: context.preferredTimePolicyTitle,
    eventCategory
  });
  const selectedScheme = selection.selectedPolicy
    ? context.timeSchemes.find((scheme) => scheme.id === selection.selectedPolicy?.id)
    : undefined;
  const requestedWindow = {
    start: rule.windowStart,
    end: rule.windowEnd,
    boundedMinutes: parseClockMinutes(rule.windowEnd) - parseClockMinutes(rule.windowStart),
    requiredMinutes: rule.durationMinutes
  };

  if (!selectedScheme) {
    return {
      status: "unavailable",
      selectionReason: selection.selectionReason,
      explanation: "No matching protected-time policy was available for this bounded buffer rule preview.",
      requestedWindow,
      checkedDays: [],
      diffSummary: {
        fitDays: 0,
        partialDays: 0,
        outsideWindowDays: 0,
        uncheckedDays: 0
      },
      diffLines: [
        `? requestedWindow: ${requestedWindow.start}-${requestedWindow.end} (${requestedWindow.boundedMinutes} bounded minute(s), ${requestedWindow.requiredMinutes} required minute(s))`,
        "? selectedPolicy: <none>",
        `? selectionReason: ${selection.selectionReason}`
      ]
    };
  }

  const checkedDays = collectUniquePolicyDays(selectedScheme);
  if (checkedDays.length === 0) {
    return {
      status: "unavailable",
      selectionReason: selection.selectionReason,
      explanation: "The selected protected-time policy does not expose named windows for a bounded diff preview.",
      selectedPolicy: {
        id: selectedScheme.id,
        title: selectedScheme.title,
        taskCategory: selectedScheme.taskCategory,
        windowCount: selectedScheme.windows?.length ?? 0
      },
      requestedWindow,
      checkedDays: [],
      diffSummary: {
        fitDays: 0,
        partialDays: 0,
        outsideWindowDays: 0,
        uncheckedDays: selectedScheme.windows?.length ?? 0
      },
      diffLines: [
        `? requestedWindow: ${requestedWindow.start}-${requestedWindow.end} (${requestedWindow.boundedMinutes} bounded minute(s), ${requestedWindow.requiredMinutes} required minute(s))`,
        `? selectedPolicy: ${selectedScheme.title} (${selectedScheme.id})`,
        "? protectedWindows: <no named day windows>"
      ]
    };
  }

  const diffSummary = {
    fitDays: 0,
    partialDays: 0,
    outsideWindowDays: 0,
    uncheckedDays: 0
  };
  const diffLines = [
    `  requestedWindow: ${requestedWindow.start}-${requestedWindow.end} (${requestedWindow.boundedMinutes} bounded minute(s), ${requestedWindow.requiredMinutes} required minute(s))`,
    `  selectedPolicy: ${selectedScheme.title} (${selectedScheme.id})`,
    `  selectionReason: ${selection.selectionReason}`
  ];

  for (const dayName of checkedDays) {
    const overlap = computePolicyOverlapMinutes(selectedScheme, dayName, requestedWindow);
    const protectedWindows = overlap.windowSummaries.join(", ") || "<no window detail>";
    if (overlap.overlapMinutes >= requestedWindow.requiredMinutes) {
      diffSummary.fitDays += 1;
      diffLines.push(
        `+ ${dayName}: ${overlap.overlapMinutes} overlapping minute(s) inside protected windows ${protectedWindows}`
      );
      continue;
    }

    if (overlap.overlapMinutes > 0) {
      diffSummary.partialDays += 1;
      diffLines.push(
        `~ ${dayName}: ${overlap.overlapMinutes} overlapping minute(s), below the ${requestedWindow.requiredMinutes}-minute requirement, inside protected windows ${protectedWindows}`
      );
      continue;
    }

    diffSummary.outsideWindowDays += 1;
    diffLines.push(`- ${dayName}: no overlap against protected windows ${protectedWindows}`);
  }

  const status =
    diffSummary.partialDays > 0 || (diffSummary.fitDays > 0 && diffSummary.outsideWindowDays > 0)
      ? "partial"
      : diffSummary.fitDays > 0
        ? "fit"
        : "outside_window";

  const explanation =
    status === "fit"
      ? `The buffer rule fits protected-time windows on all checked day(s): ${checkedDays.join(", ")}.`
      : status === "partial"
        ? `The buffer rule fits some protected-time windows but not all checked day(s): ${checkedDays.join(", ")}.`
        : `The buffer rule does not overlap any protected-time window enough to satisfy its ${requestedWindow.requiredMinutes}-minute requirement.`;

  return {
    status,
    selectionReason: selection.selectionReason,
    explanation,
    selectedPolicy: {
      id: selectedScheme.id,
      title: selectedScheme.title,
      taskCategory: selectedScheme.taskCategory,
      windowCount: selectedScheme.windows?.length ?? 0
    },
    requestedWindow,
    checkedDays,
    diffSummary,
    diffLines
  };
}
