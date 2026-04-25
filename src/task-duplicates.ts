import type { ReclaimCreateTaskInput, ReclaimTaskRecord } from "./types.js";

export interface DuplicateTaskGroup {
  title: string;
  keptTaskId: number;
  duplicateTaskIds: number[];
}

export interface DuplicateTaskPlan {
  duplicateGroupCount: number;
  duplicateGroups: DuplicateTaskGroup[];
}

export interface InputDuplicateTaskGroup {
  title: string;
  firstInputIndex: number;
  duplicateInputIndexes: number[];
}

export interface InputDuplicateTaskPlan {
  duplicateGroupCount: number;
  duplicateGroups: InputDuplicateTaskGroup[];
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

function comparableTaskSignature(task: {
  title: string;
  notes?: string;
  eventCategory: string;
  timeSchemeId: string;
  due?: string;
  snoozeUntil?: string;
}): string {
  return JSON.stringify({
    title: task.title,
    notes: normalizeOptionalText(task.notes),
    eventCategory: task.eventCategory,
    timeSchemeId: task.timeSchemeId,
    due: normalizeDateTime(task.due),
    snoozeUntil: normalizeDateTime(task.snoozeUntil)
  });
}

export function taskMatchesRequest(task: ReclaimTaskRecord, request: ReclaimCreateTaskInput): boolean {
  return comparableTaskSignature(task) === comparableTaskSignature(request);
}

export function inspectExistingTaskDuplicates(
  requests: ReclaimCreateTaskInput[],
  existingTasks: ReclaimTaskRecord[]
): DuplicateTaskPlan {
  const duplicateGroups: DuplicateTaskGroup[] = [];

  for (const request of requests) {
    const matches = existingTasks
      .filter((candidate) => taskMatchesRequest(candidate, request))
      .sort((left, right) => left.id - right.id);
    if (matches.length <= 1) {
      continue;
    }

    duplicateGroups.push({
      title: request.title,
      keptTaskId: matches[0]!.id,
      duplicateTaskIds: matches.slice(1).map((candidate) => candidate.id)
    });
  }

  return {
    duplicateGroupCount: duplicateGroups.length,
    duplicateGroups
  };
}

export function inspectInputTaskDuplicates(requests: ReclaimCreateTaskInput[]): InputDuplicateTaskPlan {
  const groupsBySignature = new Map<
    string,
    { title: string; firstInputIndex: number; duplicateInputIndexes: number[] }
  >();

  requests.forEach((request, index) => {
    const signature = comparableTaskSignature(request);
    const existingGroup = groupsBySignature.get(signature);
    if (existingGroup) {
      existingGroup.duplicateInputIndexes.push(index);
      return;
    }

    groupsBySignature.set(signature, {
      title: request.title,
      firstInputIndex: index,
      duplicateInputIndexes: []
    });
  });

  const duplicateGroups = [...groupsBySignature.values()].filter(
    (group) => group.duplicateInputIndexes.length > 0
  );

  return {
    duplicateGroupCount: duplicateGroups.length,
    duplicateGroups
  };
}
