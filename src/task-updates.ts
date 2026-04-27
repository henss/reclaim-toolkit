import { z } from "zod";
import type { ReclaimClient } from "./client.js";
import { createPreviewReceipt, type PreviewReceipt } from "./preview-receipts.js";
import {
  updatedTaskReceipt,
  type TaskWriteReceipt
} from "./task-write-receipts.js";
import type {
  ReclaimTaskRecord,
  ReclaimUpdateTaskInput
} from "./types.js";

const RECLAIM_TIME_BLOCK_MINUTES = 15;

const TaskUpdateInputBaseSchema = z.object({
  taskId: z.number().int().nonnegative(),
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  due: z.string().optional(),
  startAfter: z.string().optional(),
  timeSchemeId: z.string().min(1).optional(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  splitAllowed: z.boolean().optional(),
  alwaysPrivate: z.boolean().optional()
});

export const ReclaimTaskUpdateInputSchema = TaskUpdateInputBaseSchema
  .refine(
    (value) => Object.keys(value).some((key) => key !== "taskId" && value[key as keyof typeof value] !== undefined),
    { message: "Task updates must include at least one field besides taskId." }
  )
  .refine((value) => value.splitAllowed === undefined || value.durationMinutes !== undefined, {
    message: "splitAllowed requires durationMinutes so chunk sizes can be recalculated."
  });

export const ReclaimTaskUpdateListSchema = z.union([
  z.array(ReclaimTaskUpdateInputSchema),
  z.object({ updates: z.array(ReclaimTaskUpdateInputSchema) })
]).transform((value) => Array.isArray(value) ? value : value.updates);

export const ReclaimTaskUpdatePreviewInputSchema = z.object({
  updates: z.array(ReclaimTaskUpdateInputSchema),
  currentTasks: z.array(z.object({
    id: z.number().int().nonnegative(),
    title: z.string(),
    notes: z.string().optional(),
    eventCategory: z.string(),
    timeSchemeId: z.string(),
    due: z.string().optional(),
    snoozeUntil: z.string().optional()
  })).default([])
});

export type ReclaimTaskUpdateInput = z.input<typeof ReclaimTaskUpdateInputSchema>;

export interface TaskUpdatePreviewInput {
  updates: ReclaimTaskUpdateInput[];
  currentTasks: ReclaimTaskRecord[];
}

export interface TaskUpdatePreviewChange {
  field: keyof ReclaimUpdateTaskInput;
  from?: string | number | boolean;
  to?: string | number | boolean;
}

export interface PreviewTaskUpdate {
  taskId: number;
  title?: string;
  currentTask?: ReclaimTaskRecord;
  request: ReclaimUpdateTaskInput;
  changes: TaskUpdatePreviewChange[];
}

export interface TaskUpdatePreview {
  updateCount: number;
  writeSafety: "preview_only";
  updates: PreviewTaskUpdate[];
  previewReceipt: PreviewReceipt;
}

export interface TaskUpdateResult {
  updatedTasks: Array<{ title: string; taskId: number }>;
  writeReceipts: TaskWriteReceipt[];
}

export function parseReclaimTaskUpdates(raw: unknown): ReclaimTaskUpdateInput[] {
  return ReclaimTaskUpdateListSchema.parse(raw);
}

export function parseReclaimTaskUpdatePreviewInput(raw: unknown): TaskUpdatePreviewInput {
  const parsed = ReclaimTaskUpdatePreviewInputSchema.parse(raw);
  return {
    updates: parsed.updates,
    currentTasks: parsed.currentTasks
  };
}

function toTimeChunks(durationMinutes: number): number {
  return Math.max(1, Math.ceil(durationMinutes / RECLAIM_TIME_BLOCK_MINUTES));
}

function buildUpdateInput(update: ReclaimTaskUpdateInput): ReclaimUpdateTaskInput {
  const request: ReclaimUpdateTaskInput = {
    title: update.title,
    notes: update.notes,
    timeSchemeId: update.timeSchemeId,
    eventCategory: update.eventCategory,
    due: update.due,
    snoozeUntil: update.startAfter,
    alwaysPrivate: update.alwaysPrivate
  };

  if (update.durationMinutes !== undefined) {
    const timeChunksRequired = toTimeChunks(update.durationMinutes);
    request.timeChunksRequired = timeChunksRequired;
    request.maxChunkSize = timeChunksRequired;
    request.minChunkSize = update.splitAllowed ?? true ? 1 : timeChunksRequired;
  }

  return Object.fromEntries(
    Object.entries(request).filter(([, value]) => value !== undefined)
  ) as ReclaimUpdateTaskInput;
}

function currentValueForField(
  task: ReclaimTaskRecord | undefined,
  field: keyof ReclaimUpdateTaskInput
): string | number | boolean | undefined {
  if (!task) {
    return undefined;
  }
  if (field === "snoozeUntil") {
    return task.snoozeUntil;
  }
  if (field === "title" || field === "notes" || field === "eventCategory" || field === "timeSchemeId" || field === "due") {
    return task[field];
  }
  return undefined;
}

function buildChanges(
  request: ReclaimUpdateTaskInput,
  currentTask: ReclaimTaskRecord | undefined
): TaskUpdatePreviewChange[] {
  return (Object.keys(request) as Array<keyof ReclaimUpdateTaskInput>).map((field) => ({
    field,
    from: currentValueForField(currentTask, field),
    to: request[field]
  }));
}

export function previewUpdates(
  updates: ReclaimTaskUpdateInput[],
  currentTasks: ReclaimTaskRecord[] = []
): TaskUpdatePreview {
  const previewUpdates = updates.map((update) => {
    const currentTask = currentTasks.find((task) => task.id === update.taskId);
    const request = buildUpdateInput(update);
    return {
      taskId: update.taskId,
      title: update.title ?? currentTask?.title,
      currentTask,
      request,
      changes: buildChanges(request, currentTask)
    };
  });

  return {
    updateCount: previewUpdates.length,
    writeSafety: "preview_only",
    updates: previewUpdates,
    previewReceipt: createPreviewReceipt({
      operation: "task.update.preview",
      readinessStatus: "ready_for_confirmed_write",
      readinessGate:
        "Review the previewed task update payloads, then run reclaim:tasks:update with --confirm-write to apply them."
    })
  };
}

export async function update(
  client: ReclaimClient,
  updates: ReclaimTaskUpdateInput[],
  options: { confirmWrite: boolean }
): Promise<TaskUpdateResult> {
  if (!options.confirmWrite) {
    throw new Error("Refusing to update Reclaim tasks without confirmWrite.");
  }

  const updatedTasks: TaskUpdateResult["updatedTasks"] = [];
  const writeReceipts: TaskWriteReceipt[] = [];

  for (const updateInput of updates) {
    const updatedTask = await client.updateTask(updateInput.taskId, buildUpdateInput(updateInput));
    updatedTasks.push({ title: updatedTask.title, taskId: updatedTask.id });
    writeReceipts.push(updatedTaskReceipt(updatedTask.id, updatedTask.title));
  }

  return { updatedTasks, writeReceipts };
}
