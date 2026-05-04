import { z } from "zod";
import type { ReclaimClient } from "./client.js";
import { createPreviewReceipt, type PreviewReceipt } from "./preview-receipts.js";
import {
  previewUpdates,
  update,
  type PreviewTaskUpdate,
  type ReclaimTaskUpdateInput,
  type TaskUpdateResult
} from "./task-updates.js";
import type { ReclaimTaskRecord } from "./types.js";

const NoteReplacementSchema = z.object({
  from: z.string().min(1),
  to: z.string()
});

const ReclaimTaskRetargetBaseSchema = z.object({
  taskIds: z.array(z.number().int().positive()).min(1),
  sourceAnchor: z.string().min(1),
  targetAnchor: z.string().min(1),
  noteReplacements: z.array(NoteReplacementSchema).default([])
});

const ReclaimTaskSnapshotSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  notes: z.string().optional(),
  eventCategory: z.string(),
  timeSchemeId: z.string(),
  due: z.string().optional(),
  snoozeUntil: z.string().optional()
});

export const ReclaimTaskRetargetInputSchema = ReclaimTaskRetargetBaseSchema;

export const ReclaimTaskRetargetPreviewInputSchema = ReclaimTaskRetargetBaseSchema.extend({
  currentTasks: z.array(ReclaimTaskSnapshotSchema)
});

export type ReclaimTaskRetargetInput = z.infer<typeof ReclaimTaskRetargetInputSchema>;
export type ReclaimTaskRetargetPreviewInput = z.infer<typeof ReclaimTaskRetargetPreviewInputSchema>;

export interface TaskRetargetSkippedTask {
  taskId: number;
  title?: string;
  reason: "no_retargetable_fields";
}

export interface TaskRetargetBuildResult {
  taskIds: number[];
  retargetDeltaMs: number;
  updates: ReclaimTaskUpdateInput[];
  skippedTasks: TaskRetargetSkippedTask[];
}

export interface TaskRetargetPreview extends TaskRetargetBuildResult {
  updateCount: number;
  writeSafety: "preview_only";
  previewUpdates: PreviewTaskUpdate[];
  previewReceipt: PreviewReceipt;
}

export interface TaskRetargetResult extends TaskRetargetBuildResult, TaskUpdateResult {
}

export function parseReclaimTaskRetargetInput(raw: unknown): ReclaimTaskRetargetInput {
  return ReclaimTaskRetargetInputSchema.parse(raw);
}

export function parseReclaimTaskRetargetPreviewInput(raw: unknown): ReclaimTaskRetargetPreviewInput {
  return ReclaimTaskRetargetPreviewInputSchema.parse(raw);
}

function parseDateTime(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${label} date-time: ${value}`);
  }
  return parsed;
}

function shiftDateTime(value: string, deltaMs: number, label: string): string {
  return new Date(parseDateTime(value, label) + deltaMs).toISOString();
}

function applyNoteReplacements(
  notes: string | undefined,
  replacements: ReclaimTaskRetargetInput["noteReplacements"]
): string | undefined {
  if (notes === undefined || replacements.length === 0) {
    return undefined;
  }

  return replacements.reduce((current, replacement) => (
    current.replaceAll(replacement.from, replacement.to)
  ), notes);
}

function findTask(taskId: number, currentTasks: ReclaimTaskRecord[]): ReclaimTaskRecord {
  const task = currentTasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw new Error(`Cannot retarget task ${taskId}: current task snapshot is missing.`);
  }
  return task;
}

export function buildRetargetTaskUpdates(
  input: ReclaimTaskRetargetInput,
  currentTasks: ReclaimTaskRecord[]
): TaskRetargetBuildResult {
  const retargetDeltaMs =
    parseDateTime(input.targetAnchor, "targetAnchor") - parseDateTime(input.sourceAnchor, "sourceAnchor");
  const updates: ReclaimTaskUpdateInput[] = [];
  const skippedTasks: TaskRetargetSkippedTask[] = [];

  for (const taskId of input.taskIds) {
    const task = findTask(taskId, currentTasks);
    const updateInput: ReclaimTaskUpdateInput = { taskId };
    if (task.due) {
      updateInput.due = shiftDateTime(task.due, retargetDeltaMs, `due for task ${taskId}`);
    }
    if (task.snoozeUntil) {
      updateInput.startAfter = shiftDateTime(task.snoozeUntil, retargetDeltaMs, `startAfter for task ${taskId}`);
    }
    const replacedNotes = applyNoteReplacements(task.notes, input.noteReplacements);
    if (replacedNotes !== undefined && replacedNotes !== task.notes) {
      updateInput.notes = replacedNotes;
    }

    if (Object.keys(updateInput).length === 1) {
      skippedTasks.push({ taskId, title: task.title, reason: "no_retargetable_fields" });
      continue;
    }
    updates.push(updateInput);
  }

  return {
    taskIds: input.taskIds,
    retargetDeltaMs,
    updates,
    skippedTasks
  };
}

export function previewRetarget(input: ReclaimTaskRetargetPreviewInput): TaskRetargetPreview {
  const built = buildRetargetTaskUpdates(input, input.currentTasks);
  const updatePreview = previewUpdates(built.updates, input.currentTasks);

  return {
    ...built,
    updateCount: built.updates.length,
    writeSafety: "preview_only",
    previewUpdates: updatePreview.updates,
    previewReceipt: createPreviewReceipt({
      operation: "task.retarget.preview",
      readinessStatus: "ready_for_confirmed_write",
      readinessGate:
        "Review the retargeted task update payloads, then run reclaim:tasks:retarget with --confirm-write to apply them."
    })
  };
}

export async function retarget(
  client: ReclaimClient,
  input: ReclaimTaskRetargetInput,
  options: { confirmWrite: boolean }
): Promise<TaskRetargetResult> {
  if (!options.confirmWrite) {
    throw new Error("Refusing to retarget Reclaim tasks without confirmWrite.");
  }

  const built = buildRetargetTaskUpdates(input, await client.listTasks());
  const result = await update(client, built.updates, options);

  return {
    ...built,
    ...result
  };
}
