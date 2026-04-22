import { z } from "zod";
import {
  buildBufferPreviewRequest,
  type PreviewBufferCreate,
  ReclaimBufferInputListSchema,
  ReclaimBufferInputSchema,
  type ReclaimBufferCreatePreviewRequest
} from "./buffers.js";

const BUFFER_RULE_DIFF_FIELDS = [
  "title",
  "notes",
  "durationMinutes",
  "eventCategory",
  "placement",
  "anchor",
  "windowStart",
  "windowEnd",
  "alwaysPrivate"
] as const;

export const ReclaimBufferRuleInputSchema = ReclaimBufferInputSchema.extend({
  ruleId: z.string().min(1)
});

export const ReclaimBufferRulePreviewInputSchema = z.object({
  rules: z.array(ReclaimBufferRuleInputSchema),
  currentBuffers: ReclaimBufferInputListSchema.optional()
});

export type ReclaimBufferRuleInput = z.input<typeof ReclaimBufferRuleInputSchema>;
export type ReclaimBufferRulePreviewInput = z.infer<typeof ReclaimBufferRulePreviewInputSchema>;

export interface BufferRulePreviewReceipt {
  operation: "buffer.rule.preview";
  previewId: string;
  ruleId: string;
  title: string;
  action: "create" | "update";
  status: "mock_preview_diff_recorded";
  matchedBufferTitle?: string;
  diffSummary: {
    added: number;
    changed: number;
    removed: number;
    unchanged: number;
  };
  diffLines: string[];
  rollbackHint: string;
}

export interface MockBufferRulePreviewResponse {
  previewId: string;
  mode: "mock_reclaim_buffer_rule_preview";
  status: "preview_ready";
  action: "create" | "update";
  matchedBufferTitle?: string;
}

export interface PreviewBufferRule {
  ruleId: string;
  title: string;
  request: ReclaimBufferCreatePreviewRequest;
  currentBuffer?: PreviewBufferCreate;
  mockResponse: MockBufferRulePreviewResponse;
  previewReceipt: BufferRulePreviewReceipt;
}

export interface BufferRulePreview {
  ruleCount: number;
  rules: PreviewBufferRule[];
  writeSafety: "preview_only";
}

function formatDiffValue(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

function buildPreviewBufferCreate(bufferInput: z.input<typeof ReclaimBufferInputSchema>): PreviewBufferCreate {
  const parsed = ReclaimBufferInputSchema.parse(bufferInput);
  return {
    title: parsed.title,
    request: buildBufferPreviewRequest(parsed)
  };
}

function findCurrentBuffer(
  rule: ReclaimBufferRuleInput,
  currentBuffers: PreviewBufferCreate[]
): PreviewBufferCreate | undefined {
  return currentBuffers.find((buffer) =>
    buffer.request.title === rule.title ||
    (buffer.request.anchor === rule.anchor && buffer.request.placement === rule.placement)
  );
}

function buildBufferRuleDiff(
  currentRequest: ReclaimBufferCreatePreviewRequest | undefined,
  nextRequest: ReclaimBufferCreatePreviewRequest
): {
  action: "create" | "update";
  summary: BufferRulePreviewReceipt["diffSummary"];
  diffLines: string[];
} {
  const summary = {
    added: 0,
    changed: 0,
    removed: 0,
    unchanged: 0
  };
  const diffLines: string[] = [];

  for (const field of BUFFER_RULE_DIFF_FIELDS) {
    const before = formatDiffValue(currentRequest?.[field]);
    const after = formatDiffValue(nextRequest[field]);

    if (before === after) {
      summary.unchanged += 1;
      diffLines.push(`  ${field}: ${after ?? "<unset>"}`);
      continue;
    }

    if (before === undefined) {
      summary.added += 1;
      diffLines.push(`+ ${field}: ${after ?? "<unset>"}`);
      continue;
    }

    if (after === undefined) {
      summary.removed += 1;
      diffLines.push(`- ${field}: ${before}`);
      continue;
    }

    summary.changed += 1;
    diffLines.push(`- ${field}: ${before}`, `+ ${field}: ${after}`);
  }

  return {
    action: currentRequest ? "update" : "create",
    summary,
    diffLines
  };
}

function buildBufferRulePreview(
  ruleInput: ReclaimBufferRuleInput,
  currentBuffers: PreviewBufferCreate[],
  index: number
): PreviewBufferRule {
  const parsed = ReclaimBufferRuleInputSchema.parse(ruleInput);
  const request = buildBufferPreviewRequest(parsed);
  const currentBuffer = findCurrentBuffer(parsed, currentBuffers);
  const diff = buildBufferRuleDiff(currentBuffer?.request, request);
  const previewId = `buffer-rule-preview-${index + 1}`;

  return {
    ruleId: parsed.ruleId,
    title: request.title,
    request,
    currentBuffer,
    mockResponse: {
      previewId,
      mode: "mock_reclaim_buffer_rule_preview",
      status: "preview_ready",
      action: diff.action,
      matchedBufferTitle: currentBuffer?.title
    },
    previewReceipt: {
      operation: "buffer.rule.preview",
      previewId,
      ruleId: parsed.ruleId,
      title: request.title,
      action: diff.action,
      status: "mock_preview_diff_recorded",
      matchedBufferTitle: currentBuffer?.title,
      diffSummary: diff.summary,
      diffLines: diff.diffLines,
      rollbackHint: "No rollback is required because this helper only emits a synthetic preview diff."
    }
  };
}

export function parseReclaimBufferRulePreviewInput(raw: unknown): ReclaimBufferRulePreviewInput {
  return ReclaimBufferRulePreviewInputSchema.parse(raw);
}

export function previewBufferRules(input: ReclaimBufferRulePreviewInput): BufferRulePreview {
  const parsed = ReclaimBufferRulePreviewInputSchema.parse(input);
  const currentBuffers = (parsed.currentBuffers ?? []).map((bufferInput) => buildPreviewBufferCreate(bufferInput));

  return {
    ruleCount: parsed.rules.length,
    rules: parsed.rules.map((rule, index) => buildBufferRulePreview(rule, currentBuffers, index)),
    writeSafety: "preview_only"
  };
}

export const bufferRules = {
  preview: previewBufferRules
};
