import { z } from "zod";
import type { ReclaimClient } from "./client.js";
import {
  createdTaskReceipt,
  deletedTaskReceipt,
  validateTaskWriteReceipts,
  type TaskWriteReceipt,
  type TaskWriteReceiptValidationResult
} from "./task-write-receipts.js";
import {
  previewTimePolicySelection,
  selectTimeScheme
} from "./time-policies.js";
import { createPreviewReceipt, type PreviewReceipt } from "./preview-receipts.js";
import { ReclaimTimeSchemeSnapshotSchema } from "./time-policy-selection.js";
import {
  explainTaskConflict,
  type ReclaimTimePolicyExplainerInput,
  type TimePolicyConflictTaskExplanation
} from "./time-policy-conflicts.js";
import {
  inspectExistingTaskDuplicates,
  inspectInputTaskDuplicates,
  taskMatchesRequest,
  type DuplicateTaskGroup,
  type DuplicateTaskPlan,
  type InputDuplicateTaskGroup,
  type InputDuplicateTaskPlan
} from "./task-duplicates.js";
import {
  previewUpdates,
  update
} from "./task-updates.js";
import type {
  ReclaimCreateTaskInput,
  ReclaimTaskEventCategory,
  ReclaimTaskRecord
} from "./types.js";

export {
  parseTaskWriteReceipts,
  type TaskReceiptRemoteTask,
  type TaskWriteReceipt,
  type TaskWriteReceiptValidationIssue,
  type TaskWriteReceiptValidationItem,
  type TaskWriteReceiptValidationResult
} from "./task-write-receipts.js";
export {
  inspectExistingTaskDuplicates,
  inspectInputTaskDuplicates,
  type DuplicateTaskGroup,
  type DuplicateTaskPlan,
  type InputDuplicateTaskGroup,
  type InputDuplicateTaskPlan
} from "./task-duplicates.js";
export {
  parseReclaimTaskUpdatePreviewInput,
  parseReclaimTaskUpdates,
  previewUpdates,
  update,
  ReclaimTaskUpdateInputSchema,
  ReclaimTaskUpdateListSchema,
  ReclaimTaskUpdatePreviewInputSchema,
  type PreviewTaskUpdate,
  type ReclaimTaskUpdateInput,
  type TaskUpdatePreview,
  type TaskUpdatePreviewChange,
  type TaskUpdatePreviewInput,
  type TaskUpdateResult
} from "./task-updates.js";

const RECLAIM_TIME_BLOCK_MINUTES = 15;
const REQUIRED_TIME_SCHEME_ID = "TASK_ASSIGNMENT_TIME_SCHEME_ID_REQUIRED";

export const ReclaimTaskInputSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  due: z.string().optional(),
  startAfter: z.string().optional(),
  timeSchemeId: z.string().min(1).optional(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  splitAllowed: z.boolean().default(true),
  alwaysPrivate: z.boolean().default(true)
});

export const ReclaimTaskInputListSchema = z.union([
  z.array(ReclaimTaskInputSchema),
  z.object({ tasks: z.array(ReclaimTaskInputSchema) })
]).transform((value) => Array.isArray(value) ? value : value.tasks);

export const ReclaimTaskPreviewInputSchema = z.object({
  tasks: z.array(ReclaimTaskInputSchema),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([]),
  defaultTaskEventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
});

export type ReclaimTaskInput = z.input<typeof ReclaimTaskInputSchema>;

export interface TaskPreviewInput {
  tasks: ReclaimTaskInput[];
  timeSchemes: ReclaimTimePolicyExplainerInput["timeSchemes"];
  defaultTaskEventCategory?: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

export interface TaskPreviewTimePolicyContext {
  timeSchemes: ReclaimTimePolicyExplainerInput["timeSchemes"];
  defaultTaskEventCategory: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

export interface PreviewTaskCreate {
  title: string;
  request: ReclaimCreateTaskInput;
  timePolicyExplanation?: TimePolicyConflictTaskExplanation;
}

export interface TaskCreatePreview {
  taskCount: number;
  tasks: PreviewTaskCreate[];
  inputDuplicatePlan: InputDuplicateTaskPlan;
  previewReceipt: PreviewReceipt;
}

export interface TaskCreateResult {
  inputDuplicatePlan: InputDuplicateTaskPlan;
  duplicatePlan: DuplicateTaskPlan;
  createdTasks: Array<{ title: string; taskId: number }>;
  skippedTasks: Array<{ title: string; taskId: number; reason: "already_exists" }>;
  writeReceipts: TaskWriteReceipt[];
}

export interface DuplicateCleanupResult extends DuplicateTaskPlan {
  deletedTaskIds: number[];
  writeReceipts: TaskWriteReceipt[];
}

export interface TaskListFilters {
  titleContains?: string;
  eventCategory?: string;
  timeSchemeId?: string;
  dueAfter?: string;
  dueBefore?: string;
  startAfterAfter?: string;
  startAfterBefore?: string;
}

export interface TaskListItem {
  id: number;
  title: string;
  notes?: string;
  eventCategory: string;
  timeSchemeId: string;
  due?: string;
  startAfter?: string;
}

export interface TaskListResult {
  taskCount: number;
  readSafety: "read_only";
  filters: TaskListFilters;
  tasks: TaskListItem[];
}

export interface TaskExportResult {
  format: "json" | "csv";
  taskCount: number;
  readSafety: "read_only";
  filters: TaskListFilters;
  fields: Array<keyof TaskListItem>;
  tasks?: TaskListItem[];
  content?: string;
}

export function parseReclaimTaskInputs(raw: unknown): ReclaimTaskInput[] {
  return ReclaimTaskInputListSchema.parse(raw);
}

export function parseReclaimTaskPreviewInput(raw: unknown): TaskPreviewInput {
  const parsed = ReclaimTaskPreviewInputSchema.parse(raw);
  return {
    tasks: parsed.tasks,
    timeSchemes: parsed.timeSchemes,
    defaultTaskEventCategory: parsed.defaultTaskEventCategory,
    preferredTimePolicyId: parsed.preferredTimePolicyId,
    preferredTimePolicyTitle: parsed.preferredTimePolicyTitle
  };
}

function toTimeChunks(durationMinutes: number): number {
  return Math.max(1, Math.ceil(durationMinutes / RECLAIM_TIME_BLOCK_MINUTES));
}

function buildCreateInput(
  task: ReclaimTaskInput,
  options: {
    timeSchemeId?: string;
    eventCategory?: ReclaimTaskEventCategory;
  } = {}
): ReclaimCreateTaskInput {
  const timeChunksRequired = toTimeChunks(task.durationMinutes);
  const splitAllowed = task.splitAllowed ?? true;

  return {
    title: task.title,
    notes: task.notes,
    timeSchemeId: task.timeSchemeId ?? options.timeSchemeId ?? REQUIRED_TIME_SCHEME_ID,
    timeChunksRequired,
    minChunkSize: splitAllowed ? 1 : timeChunksRequired,
    maxChunkSize: timeChunksRequired,
    eventCategory: task.eventCategory ?? options.eventCategory ?? "PERSONAL",
    due: task.due,
    snoozeUntil: task.startAfter,
    alwaysPrivate: task.alwaysPrivate ?? true
  };
}

export function previewCreates(
  taskInputs: ReclaimTaskInput[],
  options: {
    timeSchemeId?: string;
    eventCategory?: ReclaimTaskEventCategory;
    timePolicyContext?: TaskPreviewTimePolicyContext;
  } = {}
): TaskCreatePreview {
  const timePolicyContext = options.timePolicyContext;
  const defaultTaskEventCategory = options.eventCategory ?? timePolicyContext?.defaultTaskEventCategory ?? "PERSONAL";
  const previewTasks = taskInputs.map((task) => ({
    title: task.title,
    request: buildCreateInput(task, options),
    timePolicyExplanation: timePolicyContext
      ? explainTaskConflict(
        {
          title: task.title,
          durationMinutes: task.durationMinutes,
          due: task.due,
          startAfter: task.startAfter,
          timeSchemeId: task.timeSchemeId ?? options.timeSchemeId,
          eventCategory: task.eventCategory
        },
        {
          tasks: [],
          focusBlocks: [],
          buffers: [],
          hoursProfiles: [],
          timeSchemes: timePolicyContext.timeSchemes,
          defaultTaskEventCategory,
          preferredTimePolicyId: timePolicyContext.preferredTimePolicyId,
          preferredTimePolicyTitle: timePolicyContext.preferredTimePolicyTitle
        }
      )
      : undefined
  }));
  const inputDuplicatePlan = inspectInputTaskDuplicates(previewTasks.map((task) => task.request));
  const hasInputDuplicates = inputDuplicatePlan.duplicateGroupCount > 0;

  return {
    taskCount: taskInputs.length,
    tasks: previewTasks,
    inputDuplicatePlan,
    previewReceipt: createPreviewReceipt({
      operation: "task.preview",
      readinessStatus: hasInputDuplicates ? "evidence_pending" : "ready_for_confirmed_write",
      readinessGate: hasInputDuplicates
        ? `Review ${inputDuplicatePlan.duplicateGroupCount} duplicate input group(s) before any confirmed write.`
        : "Review the previewed task payloads, then run reclaim:tasks:create with --confirm-write to apply them."
    })
  };
}

function normalizeFilters(filters: TaskListFilters = {}): TaskListFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as TaskListFilters;
}

function parseComparableDate(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${label} date-time: ${value}`);
  }
  return parsed;
}

function taskDateMatches(
  value: string | undefined,
  filters: { after?: string; before?: string },
  label: string
): boolean {
  if (!filters.after && !filters.before) {
    return true;
  }
  if (!value) {
    return false;
  }
  const taskTime = parseComparableDate(value, label);
  if (filters.after && taskTime < parseComparableDate(filters.after, `${label} after`)) {
    return false;
  }
  if (filters.before && taskTime > parseComparableDate(filters.before, `${label} before`)) {
    return false;
  }
  return true;
}

function toTaskListItem(task: ReclaimTaskRecord): TaskListItem {
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

function taskMatchesFilters(task: ReclaimTaskRecord, filters: TaskListFilters): boolean {
  if (filters.titleContains && !task.title.toLowerCase().includes(filters.titleContains.toLowerCase())) {
    return false;
  }
  if (filters.eventCategory && task.eventCategory !== filters.eventCategory) {
    return false;
  }
  if (filters.timeSchemeId && task.timeSchemeId !== filters.timeSchemeId) {
    return false;
  }
  if (!taskDateMatches(task.due, { after: filters.dueAfter, before: filters.dueBefore }, "due")) {
    return false;
  }
  if (!taskDateMatches(
    task.snoozeUntil,
    { after: filters.startAfterAfter, before: filters.startAfterBefore },
    "startAfter"
  )) {
    return false;
  }
  return true;
}

export function listExistingTasks(
  existingTasks: ReclaimTaskRecord[],
  filters: TaskListFilters = {}
): TaskListResult {
  const normalizedFilters = normalizeFilters(filters);
  const filteredTasks = existingTasks
    .filter((task) => taskMatchesFilters(task, normalizedFilters))
    .sort((left, right) => left.id - right.id)
    .map(toTaskListItem);

  return {
    taskCount: filteredTasks.length,
    readSafety: "read_only",
    filters: normalizedFilters,
    tasks: filteredTasks
  };
}

function escapeCsvCell(value: unknown): string {
  const text = value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: TaskListItem[], fields: Array<keyof TaskListItem>): string {
  return [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => escapeCsvCell(row[field])).join(","))
  ].join("\n");
}

export function exportExistingTasks(
  existingTasks: ReclaimTaskRecord[],
  options: {
    filters?: TaskListFilters;
    format?: "json" | "csv";
  } = {}
): TaskExportResult {
  const format = options.format ?? "json";
  const list = listExistingTasks(existingTasks, options.filters);
  const fields: Array<keyof TaskListItem> = [
    "id",
    "title",
    "notes",
    "eventCategory",
    "timeSchemeId",
    "due",
    "startAfter"
  ];

  if (format === "csv") {
    return {
      format,
      taskCount: list.taskCount,
      readSafety: "read_only",
      filters: list.filters,
      fields,
      content: toCsv(list.tasks, fields)
    };
  }

  return {
    format,
    taskCount: list.taskCount,
    readSafety: "read_only",
    filters: list.filters,
    fields,
    tasks: list.tasks
  };
}

export async function create(
  client: ReclaimClient,
  taskInputs: ReclaimTaskInput[],
  options: {
    confirmWrite: boolean;
    timeSchemeId?: string;
    eventCategory?: ReclaimTaskEventCategory;
  }
): Promise<TaskCreateResult> {
  if (!options.confirmWrite) {
    throw new Error("Refusing to create Reclaim tasks without confirmWrite.");
  }

  const eventCategory = options.eventCategory ?? client.config.defaultTaskEventCategory;
  const timeSchemeId =
    options.timeSchemeId ??
    selectTimeScheme(await client.listTaskAssignmentTimeSchemes(), {
      preferredTimePolicyId: client.config.preferredTimePolicyId,
      preferredTimePolicyTitle: client.config.preferredTimePolicyTitle,
      eventCategory
    }).id;
  const requests = taskInputs.map((task) => buildCreateInput(task, { timeSchemeId, eventCategory }));
  const inputDuplicatePlan = inspectInputTaskDuplicates(requests);
  const existingTasks = await client.listTasks();
  const duplicatePlan = inspectExistingTaskDuplicates(requests, existingTasks);
  const createdTasks: TaskCreateResult["createdTasks"] = [];
  const skippedTasks: TaskCreateResult["skippedTasks"] = [];
  const writeReceipts: TaskWriteReceipt[] = [];

  for (const [index, task] of taskInputs.entries()) {
    const request = requests[index]!;
    const existingTask = existingTasks.find((candidate) => taskMatchesRequest(candidate, request));
    if (existingTask) {
      skippedTasks.push({ title: task.title, taskId: existingTask.id, reason: "already_exists" });
      continue;
    }

    const createdTask = await client.createTask(request);
    existingTasks.push(createdTask);
    createdTasks.push({ title: task.title, taskId: createdTask.id });
    writeReceipts.push(createdTaskReceipt(createdTask.id, task.title));
  }

  return { inputDuplicatePlan, duplicatePlan, createdTasks, skippedTasks, writeReceipts };
}

export function inspectDuplicates(
  taskInputs: ReclaimTaskInput[],
  existingTasks: ReclaimTaskRecord[],
  options: {
    timeSchemeId?: string;
    eventCategory?: ReclaimTaskEventCategory;
  } = {}
): DuplicateTaskPlan {
  return inspectExistingTaskDuplicates(
    taskInputs.map((task) => buildCreateInput(task, options)),
    existingTasks
  );
}

export async function cleanupDuplicates(
  client: ReclaimClient,
  plan: DuplicateTaskPlan,
  options: { confirmDelete: boolean }
): Promise<DuplicateCleanupResult> {
  if (!options.confirmDelete) {
    throw new Error("Refusing to delete Reclaim task duplicates without confirmDelete.");
  }

  const deletedTaskIds: number[] = [];
  const writeReceipts: TaskWriteReceipt[] = [];
  for (const group of plan.duplicateGroups) {
    for (const duplicateTaskId of group.duplicateTaskIds) {
      await client.deleteTask(duplicateTaskId);
      deletedTaskIds.push(duplicateTaskId);
      writeReceipts.push(deletedTaskReceipt(duplicateTaskId, group.title));
    }
  }

  return {
    ...plan,
    deletedTaskIds,
    writeReceipts
  };
}

export async function validateWriteReceipts(
  client: ReclaimClient,
  receipts: TaskWriteReceipt[]
): Promise<TaskWriteReceiptValidationResult> {
  return validateTaskWriteReceipts(client, receipts);
}

export const tasks = {
  previewCreates,
  previewTimePolicySelection,
  listExistingTasks,
  exportExistingTasks,
  create,
  previewUpdates,
  update,
  inspectInputDuplicates: (
    taskInputs: ReclaimTaskInput[],
    options: {
      timeSchemeId?: string;
      eventCategory?: ReclaimTaskEventCategory;
    } = {}
  ): InputDuplicateTaskPlan => inspectInputTaskDuplicates(taskInputs.map((task) => buildCreateInput(task, options))),
  inspectDuplicates,
  cleanupDuplicates,
  validateWriteReceipts
};
