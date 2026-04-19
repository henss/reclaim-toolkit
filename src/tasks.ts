import { z } from "zod";
import type { ReclaimClient } from "./client.js";
import type {
  ReclaimCreateTaskInput,
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskEventCategory,
  ReclaimTaskRecord
} from "./types.js";

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

export type ReclaimTaskInput = z.input<typeof ReclaimTaskInputSchema>;

export interface PreviewTaskCreate {
  title: string;
  request: ReclaimCreateTaskInput;
}

export interface TaskCreatePreview {
  taskCount: number;
  tasks: PreviewTaskCreate[];
}

export interface TaskCreateResult {
  createdTasks: Array<{ title: string; taskId: number }>;
  skippedTasks: Array<{ title: string; taskId: number; reason: "already_exists" }>;
}

export interface DuplicateTaskGroup {
  title: string;
  keptTaskId: number;
  duplicateTaskIds: number[];
}

export interface DuplicateTaskPlan {
  duplicateGroupCount: number;
  duplicateGroups: DuplicateTaskGroup[];
}

export interface DuplicateCleanupResult extends DuplicateTaskPlan {
  deletedTaskIds: number[];
}

export interface TimePolicyDiscoveryItem {
  id: string;
  title: string;
  taskCategory: string;
  description?: string;
  features: string[];
  matchesDefaultEventCategory: boolean;
}

export interface TimePolicySelectionPreview {
  selectedPolicy?: TimePolicyDiscoveryItem;
  selectionReason: string;
  policies: TimePolicyDiscoveryItem[];
}

export function parseReclaimTaskInputs(raw: unknown): ReclaimTaskInput[] {
  return ReclaimTaskInputListSchema.parse(raw);
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
  } = {}
): TaskCreatePreview {
  return {
    taskCount: taskInputs.length,
    tasks: taskInputs.map((task) => ({
      title: task.title,
      request: buildCreateInput(task, options)
    }))
  };
}

function normalizeOptionalText(value?: string): string {
  return (value ?? "").trim();
}

function normalizeDateTime(value?: string): string {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return "";
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return trimmed;
  }

  return new Date(parsed).toISOString();
}

function taskMatchesRequest(task: ReclaimTaskRecord, request: ReclaimCreateTaskInput): boolean {
  return (
    task.title === request.title &&
    normalizeOptionalText(task.notes) === normalizeOptionalText(request.notes) &&
    task.eventCategory === request.eventCategory &&
    task.timeSchemeId === request.timeSchemeId &&
    normalizeDateTime(task.due) === normalizeDateTime(request.due) &&
    normalizeDateTime(task.snoozeUntil) === normalizeDateTime(request.snoozeUntil)
  );
}

function normalizePolicyTitle(value: string): string {
  return value.trim().toLowerCase();
}

function findPolicyByTitle(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  preferredTitle: string
): ReclaimTaskAssignmentTimeScheme | undefined {
  const normalizedTitle = normalizePolicyTitle(preferredTitle);
  const exact = schemes.find((scheme) => normalizePolicyTitle(scheme.title) === normalizedTitle);
  if (exact) {
    return exact;
  }

  const partialMatches = schemes.filter((scheme) => normalizePolicyTitle(scheme.title).includes(normalizedTitle));
  return partialMatches.length === 1 ? partialMatches[0] : undefined;
}

export function previewTimePolicySelection(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  options: {
    preferredTimePolicyId?: string;
    preferredTimePolicyTitle?: string;
    eventCategory: ReclaimTaskEventCategory;
  }
): TimePolicySelectionPreview {
  const policies = schemes.map((scheme) => ({
    id: scheme.id,
    title: scheme.title,
    taskCategory: scheme.taskCategory,
    description: scheme.description,
    features: scheme.features,
    matchesDefaultEventCategory: scheme.taskCategory === options.eventCategory
  }));

  if (policies.length === 0) {
    return {
      selectionReason: "No Reclaim task-assignment time policies were returned.",
      policies
    };
  }

  if (options.preferredTimePolicyId) {
    const selectedPolicy = policies.find((scheme) => scheme.id === options.preferredTimePolicyId);
    return {
      selectedPolicy,
      selectionReason: selectedPolicy
        ? `Matched preferred Reclaim time policy id ${options.preferredTimePolicyId}.`
        : `Preferred Reclaim time policy id ${options.preferredTimePolicyId} was not found.`,
      policies
    };
  }

  if (options.preferredTimePolicyTitle) {
    const selectedScheme = findPolicyByTitle(schemes, options.preferredTimePolicyTitle);
    const selectedPolicy = selectedScheme ? policies.find((scheme) => scheme.id === selectedScheme.id) : undefined;
    return {
      selectedPolicy,
      selectionReason: selectedPolicy
        ? `Matched preferred Reclaim time policy title "${options.preferredTimePolicyTitle}".`
        : `Preferred Reclaim time policy title "${options.preferredTimePolicyTitle}" was not found as an exact or unique partial match.`,
      policies
    };
  }

  const selectedPolicy =
    policies.find((scheme) => scheme.matchesDefaultEventCategory) ?? policies[0];
  return {
    selectedPolicy,
    selectionReason: selectedPolicy.matchesDefaultEventCategory
      ? `Selected the first Reclaim time policy matching event category ${options.eventCategory}.`
      : "Selected the first returned Reclaim time policy because none matched the default event category.",
    policies
  };
}

function selectTimeScheme(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  options: {
    preferredTimePolicyId?: string;
    preferredTimePolicyTitle?: string;
    eventCategory: ReclaimTaskEventCategory;
  }
): ReclaimTaskAssignmentTimeScheme {
  if (schemes.length === 0) {
    throw new Error("No Reclaim task-assignment time policies were returned.");
  }

  if (options.preferredTimePolicyId) {
    const exact = schemes.find((scheme) => scheme.id === options.preferredTimePolicyId);
    if (!exact) {
      throw new Error(`Preferred Reclaim time policy id ${options.preferredTimePolicyId} was not found.`);
    }
    return exact;
  }

  if (options.preferredTimePolicyTitle) {
    const match = findPolicyByTitle(schemes, options.preferredTimePolicyTitle);
    if (!match) {
      throw new Error(
        `Preferred Reclaim time policy title "${options.preferredTimePolicyTitle}" was not found as an exact or unique partial match.`
      );
    }
    return match;
  }

  const preview = previewTimePolicySelection(schemes, options);
  return schemes.find((scheme) => scheme.id === preview.selectedPolicy?.id) ?? schemes[0]!;
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
  const existingTasks = await client.listTasks();
  const createdTasks: TaskCreateResult["createdTasks"] = [];
  const skippedTasks: TaskCreateResult["skippedTasks"] = [];

  for (const task of taskInputs) {
    const request = buildCreateInput(task, { timeSchemeId, eventCategory });
    const existingTask = existingTasks.find((candidate) => taskMatchesRequest(candidate, request));
    if (existingTask) {
      skippedTasks.push({ title: task.title, taskId: existingTask.id, reason: "already_exists" });
      continue;
    }

    const createdTask = await client.createTask(request);
    existingTasks.push(createdTask);
    createdTasks.push({ title: task.title, taskId: createdTask.id });
  }

  return { createdTasks, skippedTasks };
}

export function inspectDuplicates(
  taskInputs: ReclaimTaskInput[],
  existingTasks: ReclaimTaskRecord[],
  options: {
    timeSchemeId?: string;
    eventCategory?: ReclaimTaskEventCategory;
  } = {}
): DuplicateTaskPlan {
  const duplicateGroups: DuplicateTaskGroup[] = [];

  for (const task of taskInputs) {
    const request = buildCreateInput(task, options);
    const matches = existingTasks
      .filter((candidate) => taskMatchesRequest(candidate, request))
      .sort((left, right) => left.id - right.id);
    if (matches.length <= 1) {
      continue;
    }
    duplicateGroups.push({
      title: task.title,
      keptTaskId: matches[0]!.id,
      duplicateTaskIds: matches.slice(1).map((candidate) => candidate.id)
    });
  }

  return {
    duplicateGroupCount: duplicateGroups.length,
    duplicateGroups
  };
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
  for (const group of plan.duplicateGroups) {
    for (const duplicateTaskId of group.duplicateTaskIds) {
      await client.deleteTask(duplicateTaskId);
      deletedTaskIds.push(duplicateTaskId);
    }
  }

  return {
    ...plan,
    deletedTaskIds
  };
}

export const tasks = {
  previewCreates,
  previewTimePolicySelection,
  create,
  inspectDuplicates,
  cleanupDuplicates
};
