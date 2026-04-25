import { z } from "zod";
import { createPreviewReceipt, type PreviewReceipt } from "./preview-receipts.js";
import { ReclaimTimeSchemeSnapshotSchema } from "./time-policy-selection.js";
import {
  explainFocusBlockConflict,
  type TimePolicyConflictFocusExplanation,
  type TimePolicyProposalContext
} from "./time-policy-proposals.js";
import type { ReclaimTaskEventCategory } from "./types.js";

const HOUR_MINUTE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ReclaimFocusDaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]);

export const ReclaimFocusInputSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  cadence: z.enum(["once", "daily", "weekly"]).default("once"),
  daysOfWeek: z.array(ReclaimFocusDaySchema).min(1).optional(),
  date: z.string().optional(),
  windowStart: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional(),
  windowEnd: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional(),
  alwaysPrivate: z.boolean().default(true)
}).superRefine((focus, context) => {
  if (focus.cadence === "once" && focus.daysOfWeek !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["daysOfWeek"],
      message: "One-time focus blocks should omit daysOfWeek."
    });
  }

  if (focus.cadence === "daily" && focus.daysOfWeek !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["daysOfWeek"],
      message: "Daily focus blocks should omit daysOfWeek."
    });
  }

  if (focus.cadence === "weekly" && focus.daysOfWeek === undefined) {
    context.addIssue({
      code: "custom",
      path: ["daysOfWeek"],
      message: "Weekly focus blocks require at least one dayOfWeek."
    });
  }

  if (focus.cadence !== "once" && focus.date !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["date"],
      message: "Recurring focus blocks should omit date."
    });
  }

  if (
    focus.windowStart !== undefined &&
    focus.windowEnd !== undefined &&
    focus.windowStart >= focus.windowEnd
  ) {
    context.addIssue({
      code: "custom",
      path: ["windowEnd"],
      message: "windowEnd must be later than windowStart."
    });
  }
});

export const ReclaimFocusInputListSchema = z.union([
  z.array(ReclaimFocusInputSchema),
  z.object({ focusBlocks: z.array(ReclaimFocusInputSchema) })
]).transform((value) => Array.isArray(value) ? value : value.focusBlocks);

export const ReclaimFocusPreviewInputSchema = z.object({
  focusBlocks: z.array(ReclaimFocusInputSchema),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([]),
  defaultTaskEventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
});

export type ReclaimFocusDay = z.infer<typeof ReclaimFocusDaySchema>;
export type ReclaimFocusInput = z.input<typeof ReclaimFocusInputSchema>;

export interface FocusPreviewInput {
  focusBlocks: ReclaimFocusInput[];
  timeSchemes: TimePolicyProposalContext["timeSchemes"];
  defaultTaskEventCategory?: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

export interface ReclaimFocusCreatePreviewRequest {
  title: string;
  notes?: string;
  durationMinutes: number;
  eventCategory: ReclaimTaskEventCategory;
  cadence: "once" | "daily" | "weekly";
  daysOfWeek?: ReclaimFocusDay[];
  date?: string;
  windowStart?: string;
  windowEnd?: string;
  alwaysPrivate: boolean;
}

export interface PreviewFocusCreate {
  title: string;
  request: ReclaimFocusCreatePreviewRequest;
  timePolicyExplanation?: TimePolicyConflictFocusExplanation;
}

export interface FocusCreatePreview {
  focusBlockCount: number;
  focusBlocks: PreviewFocusCreate[];
  writeSafety: "preview_only";
  previewReceipt: PreviewReceipt;
}

export function parseReclaimFocusInputs(raw: unknown): ReclaimFocusInput[] {
  return ReclaimFocusInputListSchema.parse(raw);
}

export function parseReclaimFocusPreviewInput(raw: unknown): FocusPreviewInput {
  const parsed = ReclaimFocusPreviewInputSchema.parse(raw);
  return {
    focusBlocks: parsed.focusBlocks,
    timeSchemes: parsed.timeSchemes,
    defaultTaskEventCategory: parsed.defaultTaskEventCategory,
    preferredTimePolicyId: parsed.preferredTimePolicyId,
    preferredTimePolicyTitle: parsed.preferredTimePolicyTitle
  };
}

function buildFocusPreviewRequest(
  focusInput: ReclaimFocusInput,
  options: {
    eventCategory?: ReclaimTaskEventCategory;
  } = {}
): ReclaimFocusCreatePreviewRequest {
  const parsed = ReclaimFocusInputSchema.parse(focusInput);
  return {
    title: parsed.title,
    notes: parsed.notes,
    durationMinutes: parsed.durationMinutes,
    eventCategory: parsed.eventCategory ?? options.eventCategory ?? "WORK",
    cadence: parsed.cadence,
    daysOfWeek: parsed.daysOfWeek,
    date: parsed.date,
    windowStart: parsed.windowStart,
    windowEnd: parsed.windowEnd,
    alwaysPrivate: parsed.alwaysPrivate
  };
}

export function previewFocusCreates(
  focusInputs: ReclaimFocusInput[],
  options: {
    eventCategory?: ReclaimTaskEventCategory;
    timePolicyContext?: TimePolicyProposalContext;
  } = {}
): FocusCreatePreview {
  const timePolicyContext = options.timePolicyContext;
  const defaultTaskEventCategory = options.eventCategory ?? timePolicyContext?.defaultTaskEventCategory ?? "WORK";
  return {
    focusBlockCount: focusInputs.length,
    focusBlocks: focusInputs.map((focusInput) => ({
      title: focusInput.title,
      request: buildFocusPreviewRequest(focusInput, options),
      timePolicyExplanation: timePolicyContext
        ? explainFocusBlockConflict(
          {
            title: focusInput.title,
            durationMinutes: focusInput.durationMinutes,
            eventCategory: focusInput.eventCategory,
            cadence: focusInput.cadence,
            daysOfWeek: focusInput.daysOfWeek,
            date: focusInput.date,
            windowStart: focusInput.windowStart,
            windowEnd: focusInput.windowEnd
          },
          {
            timeSchemes: timePolicyContext.timeSchemes,
            defaultTaskEventCategory,
            preferredTimePolicyId: timePolicyContext.preferredTimePolicyId,
            preferredTimePolicyTitle: timePolicyContext.preferredTimePolicyTitle
          }
        )
        : undefined
    })),
    writeSafety: "preview_only",
    previewReceipt: createPreviewReceipt({
      operation: "focus.preview",
      readinessStatus: "evidence_pending",
      readinessGate: "No reviewed public API-shape evidence for a Focus create endpoint is recorded."
    })
  };
}

export const focus = {
  previewCreates: previewFocusCreates
};
