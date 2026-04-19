import { z } from "zod";
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

export type ReclaimBufferInput = z.input<typeof ReclaimBufferInputSchema>;

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
}

export interface BufferCreatePreview {
  bufferCount: number;
  buffers: PreviewBufferCreate[];
  writeSafety: "preview_only";
}

export function parseReclaimBufferInputs(raw: unknown): ReclaimBufferInput[] {
  return ReclaimBufferInputListSchema.parse(raw);
}

function buildBufferPreviewRequest(
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
  } = {}
): BufferCreatePreview {
  return {
    bufferCount: bufferInputs.length,
    buffers: bufferInputs.map((bufferInput) => ({
      title: bufferInput.title,
      request: buildBufferPreviewRequest(bufferInput, options)
    })),
    writeSafety: "preview_only"
  };
}

export const buffers = {
  previewCreates: previewBufferCreates
};
