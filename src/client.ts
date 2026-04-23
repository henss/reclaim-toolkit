import type {
  ReclaimConfig,
  ReclaimCreateTaskInput,
  ReclaimCurrentUser,
  ReclaimMeetingRecord,
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskRecord,
  ReclaimTimeSchemeRecord,
  ReclaimUpdateTaskInput
} from "./types.js";
import { collectReclaimJson, fetchReclaimJson, performReclaimRequest } from "./client-read-collector.js";

export interface ReclaimClient {
  readonly config: ReclaimConfig;
  getCurrentUser(): Promise<ReclaimCurrentUser>;
  listMeetings(): Promise<ReclaimMeetingRecord[]>;
  listTasks(): Promise<ReclaimTaskRecord[]>;
  listTimeSchemes(): Promise<ReclaimTimeSchemeRecord[]>;
  listTaskAssignmentTimeSchemes(): Promise<ReclaimTaskAssignmentTimeScheme[]>;
  createTask(input: ReclaimCreateTaskInput): Promise<ReclaimTaskRecord>;
  updateTask(taskId: number, input: ReclaimUpdateTaskInput): Promise<ReclaimTaskRecord>;
  deleteTask(taskId: number): Promise<void>;
}

async function fetchReclaimNoContent(
  config: ReclaimConfig,
  relativePath: string,
  fetchImpl: typeof fetch
): Promise<void> {
  const response = await performReclaimRequest(config, relativePath, fetchImpl, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`Reclaim request failed: ${response.status} ${response.statusText} for ${relativePath}`);
  }
}

function mapTaskRecord(raw: unknown): ReclaimTaskRecord {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof record.id === "number" ? record.id : Number(record.id ?? 0),
    title: typeof record.title === "string" ? record.title : "Untitled task",
    notes: typeof record.notes === "string" ? record.notes : undefined,
    eventCategory: typeof record.eventCategory === "string" ? record.eventCategory : "PERSONAL",
    timeSchemeId: typeof record.timeSchemeId === "string" ? record.timeSchemeId : "",
    due: typeof record.due === "string" ? record.due : undefined,
    snoozeUntil: typeof record.snoozeUntil === "string" ? record.snoozeUntil : undefined
  };
}

function mapMeetingRecord(raw: unknown): ReclaimMeetingRecord {
  const record = (raw ?? {}) as Record<string, unknown>;
  const start = firstString(record.start, record.startDate, record.startsAt);
  const end = firstString(record.end, record.endDate, record.endsAt);
  const durationMinutes =
    typeof record.durationMinutes === "number" ? record.durationMinutes : durationBetween(start, end);
  const attendees = Array.isArray(record.attendees) ? record.attendees : undefined;
  return {
    id: typeof record.id === "string" ? record.id : String(record.id ?? ""),
    title: firstString(record.title, record.name) ?? "Untitled meeting",
    start,
    end,
    durationMinutes,
    attendeeCount: typeof record.attendeeCount === "number" ? record.attendeeCount : attendees?.length
  };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function durationBetween(start?: string, end?: string): number | undefined {
  if (!start || !end) {
    return undefined;
  }
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return undefined;
  }
  return Math.round((endMs - startMs) / 60000);
}

function mapTimeScheme(raw: unknown): ReclaimTimeSchemeRecord {
  const record = (raw ?? {}) as Record<string, unknown>;
  const windows = Array.isArray(record.windows)
    ? record.windows.map((window) => {
      const windowRecord = (window ?? {}) as Record<string, unknown>;
      return {
        dayOfWeek: firstString(windowRecord.dayOfWeek, windowRecord.day),
        start: firstString(windowRecord.start, windowRecord.startTime),
        end: firstString(windowRecord.end, windowRecord.endTime)
      };
    })
    : [];

  return {
    id: typeof record.id === "string" ? record.id : "",
    taskCategory: typeof record.taskCategory === "string" ? record.taskCategory : "PERSONAL",
    title: typeof record.title === "string" ? record.title : "Untitled time policy",
    description: typeof record.description === "string" ? record.description : undefined,
    timezone: firstString(record.timezone, record.timeZone),
    features: Array.isArray(record.features)
      ? record.features.filter((item): item is string => typeof item === "string")
      : [],
    windows
  };
}

function mapCurrentUser(raw: unknown): ReclaimCurrentUser {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof record.id === "string" ? record.id : "",
    email: typeof record.email === "string" ? record.email : "",
    name: typeof record.name === "string" ? record.name : undefined
  };
}

export function createReclaimClient(config: ReclaimConfig, fetchImpl: typeof fetch = fetch): ReclaimClient {
  return {
    config,
    async getCurrentUser(): Promise<ReclaimCurrentUser> {
      return mapCurrentUser(await fetchReclaimJson<unknown>(config, "/users/current", fetchImpl));
    },
    async listMeetings(): Promise<ReclaimMeetingRecord[]> {
      const response = await collectReclaimJson<unknown>(config, "/meetings", fetchImpl, ["meetings"]);
      return response.map(mapMeetingRecord);
    },
    async listTasks(): Promise<ReclaimTaskRecord[]> {
      const response = await collectReclaimJson<unknown>(config, "/tasks", fetchImpl, ["tasks"]);
      return response.map(mapTaskRecord);
    },
    async listTimeSchemes(): Promise<ReclaimTimeSchemeRecord[]> {
      const response = await collectReclaimJson<unknown>(config, "/timeschemes", fetchImpl, ["timeSchemes"]);
      return response.map(mapTimeScheme);
    },
    async listTaskAssignmentTimeSchemes(): Promise<ReclaimTaskAssignmentTimeScheme[]> {
      return (await this.listTimeSchemes()).filter((scheme) => scheme.features.includes("TASK_ASSIGNMENT"));
    },
    async createTask(input: ReclaimCreateTaskInput): Promise<ReclaimTaskRecord> {
      return mapTaskRecord(await fetchReclaimJson<unknown>(config, "/tasks", fetchImpl, {
        method: "POST",
        body: { ...input, alwaysPrivate: input.alwaysPrivate ?? true }
      }));
    },
    async updateTask(taskId: number, input: ReclaimUpdateTaskInput): Promise<ReclaimTaskRecord> {
      return mapTaskRecord(await fetchReclaimJson<unknown>(config, `/tasks/${taskId}`, fetchImpl, {
        method: "PATCH",
        body: input
      }));
    },
    async deleteTask(taskId: number): Promise<void> {
      await fetchReclaimNoContent(config, `/tasks/${taskId}`, fetchImpl);
    }
  };
}
