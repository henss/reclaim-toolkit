import { z } from "zod";
import { createPreviewReceipt, type PreviewReceipt } from "./preview-receipts.js";
import { ReclaimTimeSchemeSnapshotSchema } from "./time-policy-selection.js";
import {
  explainBufferConflict,
  type TimePolicyConflictBufferExplanation,
  type TimePolicyProposalContext
} from "./time-policy-proposals.js";
import type { ReclaimTaskEventCategory } from "./types.js";

const HOUR_MINUTE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ReclaimBufferInputSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  placement: z.enum(["before", "after", "between"]).default("after"),
  anchor: z.string().min(1),
  windowStart: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional(),
  windowEnd: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional(),
  alwaysPrivate: z.boolean().default(true)
}).superRefine((buffer, context) => {
  if (
    buffer.windowStart !== undefined &&
    buffer.windowEnd !== undefined &&
    buffer.windowStart >= buffer.windowEnd
  ) {
    context.addIssue({
      code: "custom",
      path: ["windowEnd"],
      message: "windowEnd must be later than windowStart."
    });
  }
});

export const ReclaimBufferInputListSchema = z.union([
  z.array(ReclaimBufferInputSchema),
  z.object({ buffers: z.array(ReclaimBufferInputSchema) })
]).transform((value) => Array.isArray(value) ? value : value.buffers);

export const ReclaimBufferPreviewInputSchema = z.object({
  buffers: z.array(ReclaimBufferInputSchema),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([]),
  defaultTaskEventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
});

export type ReclaimBufferInput = z.input<typeof ReclaimBufferInputSchema>;

export interface BufferPreviewInput {
  buffers: ReclaimBufferInput[];
  timeSchemes: TimePolicyProposalContext["timeSchemes"];
  defaultTaskEventCategory?: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

export interface ReclaimBufferCreatePreviewRequest {
  title: string;
  notes?: string;
  durationMinutes: number;
  eventCategory: ReclaimTaskEventCategory;
  placement: "before" | "after" | "between";
  anchor: string;
  windowStart?: string;
  windowEnd?: string;
  alwaysPrivate: boolean;
}

export interface PreviewBufferCreate {
  title: string;
  request: ReclaimBufferCreatePreviewRequest;
  timePolicyExplanation?: TimePolicyConflictBufferExplanation;
}

export interface BufferCreatePreview {
  bufferCount: number;
  buffers: PreviewBufferCreate[];
  writeSafety: "preview_only";
  previewReceipt: PreviewReceipt;
}

export function parseReclaimBufferInputs(raw: unknown): ReclaimBufferInput[] {
  return ReclaimBufferInputListSchema.parse(raw);
}

export function parseReclaimBufferPreviewInput(raw: unknown): BufferPreviewInput {
  const parsed = ReclaimBufferPreviewInputSchema.parse(raw);
  return {
    buffers: parsed.buffers,
    timeSchemes: parsed.timeSchemes,
    defaultTaskEventCategory: parsed.defaultTaskEventCategory,
    preferredTimePolicyId: parsed.preferredTimePolicyId,
    preferredTimePolicyTitle: parsed.preferredTimePolicyTitle
  };
}

export function buildBufferPreviewRequest(
  bufferInput: ReclaimBufferInput,
  options: {
    eventCategory?: ReclaimTaskEventCategory;
  } = {}
): ReclaimBufferCreatePreviewRequest {
  const parsed = ReclaimBufferInputSchema.parse(bufferInput);
  return {
    title: parsed.title,
    notes: parsed.notes,
    durationMinutes: parsed.durationMinutes,
    eventCategory: parsed.eventCategory ?? options.eventCategory ?? "PERSONAL",
    placement: parsed.placement,
    anchor: parsed.anchor,
    windowStart: parsed.windowStart,
    windowEnd: parsed.windowEnd,
    alwaysPrivate: parsed.alwaysPrivate
  };
}

export function previewBufferCreates(
  bufferInputs: ReclaimBufferInput[],
  options: {
    eventCategory?: ReclaimTaskEventCategory;
    timePolicyContext?: TimePolicyProposalContext;
  } = {}
): BufferCreatePreview {
  const timePolicyContext = options.timePolicyContext;
  const defaultTaskEventCategory = options.eventCategory ?? timePolicyContext?.defaultTaskEventCategory ?? "PERSONAL";
  return {
    bufferCount: bufferInputs.length,
    buffers: bufferInputs.map((bufferInput) => ({
      title: bufferInput.title,
      request: buildBufferPreviewRequest(bufferInput, options),
      timePolicyExplanation: timePolicyContext
        ? explainBufferConflict(
          {
            title: bufferInput.title,
            durationMinutes: bufferInput.durationMinutes,
            eventCategory: bufferInput.eventCategory,
            placement: bufferInput.placement,
            anchor: bufferInput.anchor,
            windowStart: bufferInput.windowStart,
            windowEnd: bufferInput.windowEnd
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
      operation: "buffer.preview",
      readinessStatus: "evidence_pending",
      readinessGate:
        "Anchor semantics are not proven against a reviewed public endpoint, so Buffer writes stay preview-only."
    })
  };
}

export const buffers = {
  previewCreates: previewBufferCreates
};
