import { z } from "zod";
import type { ReclaimClient } from "./client.js";
import type { ReclaimTaskRecord } from "./types.js";

export interface TaskWriteReceipt {
  operation: "task.create" | "task.delete";
  taskId: number;
  title?: string;
  confirmedAt: string;
  rollbackHint: string;
}

export const TaskWriteReceiptSchema = z.object({
  operation: z.enum(["task.create", "task.delete"]),
  taskId: z.number().int().nonnegative(),
  title: z.string().optional(),
  confirmedAt: z.string().min(1),
  rollbackHint: z.string().min(1)
});

export const TaskWriteReceiptListSchema = z.union([
  z.array(TaskWriteReceiptSchema),
  z.object({ writeReceipts: z.array(TaskWriteReceiptSchema) })
]).transform((value) => Array.isArray(value) ? value : value.writeReceipts);

export interface TaskWriteReceiptValidationIssue {
  code: "remote_task_missing" | "remote_task_still_present" | "remote_title_mismatch";
  message: string;
}

export interface TaskReceiptRemoteTask {
  id: number;
  title: string;
  notes?: string;
  eventCategory: string;
  timeSchemeId: string;
  due?: string;
  startAfter?: string;
}

export interface TaskWriteReceiptValidationItem {
  operation: TaskWriteReceipt["operation"];
  taskId: number;
  title?: string;
  confirmedAt: string;
  status: "valid" | "invalid";
  issues: TaskWriteReceiptValidationIssue[];
  remoteTask?: TaskReceiptRemoteTask;
}

export interface TaskWriteReceiptValidationResult {
  receiptCount: number;
  readSafety: "read_only";
  validReceiptCount: number;
  invalidReceiptCount: number;
  receipts: TaskWriteReceiptValidationItem[];
}

export function parseTaskWriteReceipts(raw: unknown): TaskWriteReceipt[] {
  return TaskWriteReceiptListSchema.parse(raw);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createdTaskReceipt(taskId: number, title: string): TaskWriteReceipt {
  return {
    operation: "task.create",
    taskId,
    title,
    confirmedAt: nowIso(),
    rollbackHint: `Delete Reclaim task ${taskId} if this confirmed create should be undone.`
  };
}

export function deletedTaskReceipt(taskId: number, title: string): TaskWriteReceipt {
  return {
    operation: "task.delete",
    taskId,
    title,
    confirmedAt: nowIso(),
    rollbackHint: `Recreate the task from the reviewed input or audit source if deleting Reclaim task ${taskId} was unintended.`
  };
}

function toRemoteTaskSummary(task: ReclaimTaskRecord): TaskReceiptRemoteTask {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    eventCategory: task.eventCategory,
    timeSchemeId: task.timeSchemeId,
    due: task.due,
    startAfter: task.snoozeUntil
  };
}

function validateTaskWriteReceipt(
  receipt: TaskWriteReceipt,
  existingTasks: ReclaimTaskRecord[]
): TaskWriteReceiptValidationItem {
  const remoteTask = existingTasks.find((task) => task.id === receipt.taskId);
  const issues: TaskWriteReceiptValidationIssue[] = [];

  if (receipt.operation === "task.create") {
    if (!remoteTask) {
      issues.push({
        code: "remote_task_missing",
        message: `Remote state no longer includes Reclaim task ${receipt.taskId} for this create receipt.`
      });
    } else if (receipt.title && remoteTask.title !== receipt.title) {
      issues.push({
        code: "remote_title_mismatch",
        message:
          `Remote Reclaim task ${receipt.taskId} has title "${remoteTask.title}" instead of receipt title "${receipt.title}".`
      });
    }
  }

  if (receipt.operation === "task.delete" && remoteTask) {
    issues.push({
      code: "remote_task_still_present",
      message: `Remote state still includes Reclaim task ${receipt.taskId} for this delete receipt.`
    });
  }

  return {
    operation: receipt.operation,
    taskId: receipt.taskId,
    title: receipt.title,
    confirmedAt: receipt.confirmedAt,
    status: issues.length === 0 ? "valid" : "invalid",
    issues,
    remoteTask: remoteTask ? toRemoteTaskSummary(remoteTask) : undefined
  };
}

export async function validateTaskWriteReceipts(
  client: ReclaimClient,
  receipts: TaskWriteReceipt[]
): Promise<TaskWriteReceiptValidationResult> {
  const existingTasks = await client.listTasks();
  const validatedReceipts = receipts.map((receipt) => validateTaskWriteReceipt(receipt, existingTasks));
  const invalidReceiptCount = validatedReceipts.filter((receipt) => receipt.status === "invalid").length;

  return {
    receiptCount: receipts.length,
    readSafety: "read_only",
    validReceiptCount: receipts.length - invalidReceiptCount,
    invalidReceiptCount,
    receipts: validatedReceipts
  };
}
