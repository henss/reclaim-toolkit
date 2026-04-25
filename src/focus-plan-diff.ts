import type { ReclaimFocusCreatePreviewRequest } from "./focus.js";

const FOCUS_DIFF_FIELDS = [
  "title",
  "notes",
  "durationMinutes",
  "eventCategory",
  "cadence",
  "daysOfWeek",
  "date",
  "windowStart",
  "windowEnd",
  "alwaysPrivate"
] as const;

export interface FocusPlanDiffSummary {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
}

export interface FocusPlanDiffReceipt {
  operation: "focus.plan.diff";
  action: "create" | "update" | "unchanged" | "remove";
  matchedCurrentTitle?: string;
  diffSummary: FocusPlanDiffSummary;
  diffLines: string[];
}

export function createEmptyFocusPlanDiffSummary(): FocusPlanDiffSummary {
  return {
    added: 0,
    changed: 0,
    removed: 0,
    unchanged: 0
  };
}

export function applyFocusPlanDiffSummary(
  target: FocusPlanDiffSummary,
  source: FocusPlanDiffSummary
): void {
  target.added += source.added;
  target.changed += source.changed;
  target.removed += source.removed;
  target.unchanged += source.unchanged;
}

function formatFocusDiffValue(value: ReclaimFocusCreatePreviewRequest[keyof ReclaimFocusCreatePreviewRequest]): string {
  if (value === undefined) {
    return "<unset>";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "<empty>";
  }

  return String(value);
}

export function buildFocusPlanDiffReceipt(
  before: ReclaimFocusCreatePreviewRequest | undefined,
  after: ReclaimFocusCreatePreviewRequest | undefined,
  matchedCurrentTitle?: string
): FocusPlanDiffReceipt {
  const diffSummary = createEmptyFocusPlanDiffSummary();
  const diffLines: string[] = [];

  for (const field of FOCUS_DIFF_FIELDS) {
    const beforeValue = before?.[field];
    const afterValue = after?.[field];
    const beforeFormatted = formatFocusDiffValue(beforeValue);
    const afterFormatted = formatFocusDiffValue(afterValue);
    const sameValue = JSON.stringify(beforeValue) === JSON.stringify(afterValue);

    if (sameValue) {
      if (before !== undefined || after !== undefined) {
        diffSummary.unchanged += 1;
        diffLines.push(`  ${field}: ${afterFormatted}`);
      }
      continue;
    }

    if (beforeValue === undefined) {
      diffSummary.added += 1;
      diffLines.push(`+ ${field}: ${afterFormatted}`);
      continue;
    }

    if (afterValue === undefined) {
      diffSummary.removed += 1;
      diffLines.push(`- ${field}: ${beforeFormatted}`);
      continue;
    }

    diffSummary.changed += 1;
    diffLines.push(`- ${field}: ${beforeFormatted}`, `+ ${field}: ${afterFormatted}`);
  }

  const action = before === undefined
    ? "create"
    : after === undefined
      ? "remove"
      : diffSummary.added > 0 || diffSummary.changed > 0 || diffSummary.removed > 0
        ? "update"
        : "unchanged";

  return {
    operation: "focus.plan.diff",
    action,
    matchedCurrentTitle,
    diffSummary,
    diffLines
  };
}
