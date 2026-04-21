import { z } from "zod";
import {
  buildBufferPreviewRequest,
  ReclaimBufferInputSchema,
  type ReclaimBufferCreatePreviewRequest
} from "./buffers.js";
import type { ReclaimTaskEventCategory } from "./types.js";

export const ReclaimBufferTemplateKindSchema = z.enum([
  "meeting_recovery",
  "transition_time"
]);

export const ReclaimBufferTemplateInputSchema = z.object({
  template: ReclaimBufferTemplateKindSchema,
  anchor: z.string().min(1),
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  windowStart: z.string().optional(),
  windowEnd: z.string().optional(),
  alwaysPrivate: z.boolean().default(true)
}).superRefine((templateInput, context) => {
  const parsed = ReclaimBufferInputSchema.safeParse({
    title: templateInput.title ?? "Template placeholder",
    notes: templateInput.notes,
    durationMinutes: templateInput.durationMinutes ?? 10,
    eventCategory: templateInput.eventCategory,
    placement: "after",
    anchor: templateInput.anchor,
    windowStart: templateInput.windowStart,
    windowEnd: templateInput.windowEnd,
    alwaysPrivate: templateInput.alwaysPrivate
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      context.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message
      });
    }
  }
});

export const ReclaimBufferTemplateInputListSchema = z.union([
  z.array(ReclaimBufferTemplateInputSchema),
  z.object({ templates: z.array(ReclaimBufferTemplateInputSchema) })
]).transform((value) => Array.isArray(value) ? value : value.templates);

export type ReclaimBufferTemplateKind = z.infer<typeof ReclaimBufferTemplateKindSchema>;
export type ReclaimBufferTemplateInput = z.input<typeof ReclaimBufferTemplateInputSchema>;

interface BufferTemplateDefinition {
  title: string;
  notes: string;
  durationMinutes: number;
  placement: "before" | "after" | "between";
  eventCategory: ReclaimTaskEventCategory;
}

export interface MockBufferTemplatePreviewResponse {
  previewId: string;
  mode: "mock_reclaim_buffer_preview";
  status: "preview_ready";
  acceptedPlacement: "before" | "after" | "between";
  acceptedAnchor: string;
}

export interface BufferTemplatePreviewReceipt {
  operation: "buffer.preview";
  previewId: string;
  template: ReclaimBufferTemplateKind;
  title: string;
  status: "mock_preview_recorded";
  rollbackHint: string;
}

export interface PreviewBufferTemplate {
  template: ReclaimBufferTemplateKind;
  title: string;
  request: ReclaimBufferCreatePreviewRequest;
  mockResponse: MockBufferTemplatePreviewResponse;
  previewReceipt: BufferTemplatePreviewReceipt;
}

export interface BufferTemplatePreview {
  templateCount: number;
  templates: PreviewBufferTemplate[];
  writeSafety: "preview_only";
}

const BUFFER_TEMPLATE_DEFINITIONS: Record<ReclaimBufferTemplateKind, BufferTemplateDefinition> = {
  meeting_recovery: {
    title: "Meeting recovery buffer",
    notes: "Hold a short follow-up window after a generic meeting.",
    durationMinutes: 15,
    placement: "after",
    eventCategory: "WORK"
  },
  transition_time: {
    title: "Transition time buffer",
    notes: "Create a short context-switch window between generic work blocks.",
    durationMinutes: 10,
    placement: "between",
    eventCategory: "WORK"
  }
};

export function parseReclaimBufferTemplateInputs(raw: unknown): ReclaimBufferTemplateInput[] {
  return ReclaimBufferTemplateInputListSchema.parse(raw);
}

function buildMockBufferTemplatePreviewResponse(
  templateInput: ReclaimBufferTemplateInput,
  request: ReclaimBufferCreatePreviewRequest,
  index: number
): MockBufferTemplatePreviewResponse {
  return {
    previewId: `buffer-template-preview-${index + 1}`,
    mode: "mock_reclaim_buffer_preview",
    status: "preview_ready",
    acceptedPlacement: request.placement,
    acceptedAnchor: templateInput.anchor
  };
}

function buildBufferTemplatePreview(
  templateInput: ReclaimBufferTemplateInput,
  index: number
): PreviewBufferTemplate {
  const parsed = ReclaimBufferTemplateInputSchema.parse(templateInput);
  const definition = BUFFER_TEMPLATE_DEFINITIONS[parsed.template];
  const request = buildBufferPreviewRequest({
    title: parsed.title ?? definition.title,
    notes: parsed.notes ?? definition.notes,
    durationMinutes: parsed.durationMinutes ?? definition.durationMinutes,
    eventCategory: parsed.eventCategory ?? definition.eventCategory,
    placement: definition.placement,
    anchor: parsed.anchor,
    windowStart: parsed.windowStart,
    windowEnd: parsed.windowEnd,
    alwaysPrivate: parsed.alwaysPrivate
  });
  const mockResponse = buildMockBufferTemplatePreviewResponse(parsed, request, index);

  return {
    template: parsed.template,
    title: request.title,
    request,
    mockResponse,
    previewReceipt: {
      operation: "buffer.preview",
      previewId: mockResponse.previewId,
      template: parsed.template,
      title: request.title,
      status: "mock_preview_recorded",
      rollbackHint: "No rollback is required because this helper only emits preview metadata."
    }
  };
}

export function previewBufferTemplates(templateInputs: ReclaimBufferTemplateInput[]): BufferTemplatePreview {
  return {
    templateCount: templateInputs.length,
    templates: templateInputs.map((templateInput, index) => buildBufferTemplatePreview(templateInput, index)),
    writeSafety: "preview_only"
  };
}

export const bufferTemplates = {
  preview: previewBufferTemplates
};
