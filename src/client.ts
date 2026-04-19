import type {
  ReclaimConfig,
  ReclaimCreateTaskInput,
  ReclaimCurrentUser,
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskRecord,
  ReclaimUpdateTaskInput
} from "./types.js";

export interface ReclaimClient {
  readonly config: ReclaimConfig;
  getCurrentUser(): Promise<ReclaimCurrentUser>;
  listTasks(): Promise<ReclaimTaskRecord[]>;
  listTaskAssignmentTimeSchemes(): Promise<ReclaimTaskAssignmentTimeScheme[]>;
  createTask(input: ReclaimCreateTaskInput): Promise<ReclaimTaskRecord>;
  updateTask(taskId: number, input: ReclaimUpdateTaskInput): Promise<ReclaimTaskRecord>;
  deleteTask(taskId: number): Promise<void>;
}

function createAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

async function fetchReclaimJson<T>(
  config: ReclaimConfig,
  relativePath: string,
  fetchImpl: typeof fetch,
  options?: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
  }
): Promise<T> {
  const response = await fetchImpl(`${config.apiUrl}${relativePath}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    signal: createAbortSignal(config.timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Reclaim request failed: ${response.status} ${response.statusText} for ${relativePath}`);
  }

  return (await response.json()) as T;
}

async function fetchReclaimNoContent(
  config: ReclaimConfig,
  relativePath: string,
  fetchImpl: typeof fetch
): Promise<void> {
  const response = await fetchImpl(`${config.apiUrl}${relativePath}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    signal: createAbortSignal(config.timeoutMs)
  });

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

function mapTimeScheme(raw: unknown): ReclaimTaskAssignmentTimeScheme {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof record.id === "string" ? record.id : "",
    taskCategory: typeof record.taskCategory === "string" ? record.taskCategory : "PERSONAL",
    title: typeof record.title === "string" ? record.title : "Untitled time policy",
    description: typeof record.description === "string" ? record.description : undefined,
    features: Array.isArray(record.features)
      ? record.features.filter((item): item is string => typeof item === "string")
      : []
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
    async listTasks(): Promise<ReclaimTaskRecord[]> {
      const response = await fetchReclaimJson<unknown[]>(config, "/tasks", fetchImpl);
      return response.map(mapTaskRecord);
    },
    async listTaskAssignmentTimeSchemes(): Promise<ReclaimTaskAssignmentTimeScheme[]> {
      const response = await fetchReclaimJson<unknown[]>(config, "/timeschemes", fetchImpl);
      return response.map(mapTimeScheme).filter((scheme) => scheme.features.includes("TASK_ASSIGNMENT"));
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
