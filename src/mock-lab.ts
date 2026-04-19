import fs from "node:fs";
import path from "node:path";
import { createReclaimClient } from "./client.js";
import { runReclaimHealthCheck } from "./health.js";
import { parseReclaimTaskInputs, tasks } from "./tasks.js";
import type {
  ReclaimConfig,
  ReclaimCreateTaskInput,
  ReclaimMeetingRecord,
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskRecord,
  ReclaimUpdateTaskInput
} from "./types.js";

export interface MockReclaimApiState {
  currentUser: {
    id: string;
    email: string;
    name: string;
  };
  meetings: ReclaimMeetingRecord[];
  timeSchemes: ReclaimTaskAssignmentTimeScheme[];
  tasks: ReclaimTaskRecord[];
  nextTaskId: number;
}

export interface MockReclaimApiDemoResult {
  health: Awaited<ReturnType<typeof runReclaimHealthCheck>>;
  timePolicies: ReturnType<typeof tasks.previewTimePolicySelection>;
  createPreview: ReturnType<typeof tasks.previewCreates>;
  createResult: Awaited<ReturnType<typeof tasks.create>>;
  duplicatePlan: ReturnType<typeof tasks.inspectDuplicates>;
  duplicateCleanup: Awaited<ReturnType<typeof tasks.cleanupDuplicates>>;
  finalTaskCount: number;
}

const DEMO_CONFIG: ReclaimConfig = {
  apiUrl: "https://mock.reclaim.local/api",
  apiKey: "mock-api-key",
  timeoutMs: 1000,
  defaultTaskEventCategory: "WORK",
  preferredTimePolicyId: "policy-work"
};

function createSeedState(): MockReclaimApiState {
  return {
    currentUser: {
      id: "user-demo",
      email: "demo.user@example.com",
      name: "Demo User"
    },
    meetings: [
      {
        id: "meeting-demo-1",
        title: "Project sync",
        start: "2026-05-06T10:00:00.000Z",
        end: "2026-05-06T10:30:00.000Z",
        durationMinutes: 30,
        attendeeCount: 3
      }
    ],
    timeSchemes: [
      {
        id: "policy-work",
        title: "Work Hours",
        taskCategory: "WORK",
        description: "Synthetic weekday task-assignment policy for examples.",
        features: ["TASK_ASSIGNMENT"]
      },
      {
        id: "policy-personal",
        title: "Personal Hours",
        taskCategory: "PERSONAL",
        description: "Synthetic personal task-assignment policy for examples.",
        features: ["TASK_ASSIGNMENT"]
      }
    ],
    tasks: [
      {
        id: 101,
        title: "Draft planning notes",
        notes: "Capture open questions before the weekly review.",
        eventCategory: "WORK",
        timeSchemeId: "policy-work",
        due: "2026-05-06T15:00:00.000Z",
        snoozeUntil: "2026-05-06T07:00:00.000Z"
      },
      {
        id: 102,
        title: "Draft planning notes",
        notes: "Capture open questions before the weekly review.",
        eventCategory: "WORK",
        timeSchemeId: "policy-work",
        due: "2026-05-06T15:00:00.000Z",
        snoozeUntil: "2026-05-06T07:00:00.000Z"
      }
    ],
    nextTaskId: 200
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function getRequestUrl(input: string | URL | Request): URL {
  if (input instanceof Request) {
    return new URL(input.url);
  }
  return new URL(String(input));
}

function getRequestMethod(init?: RequestInit): string {
  return init?.method?.toUpperCase() ?? "GET";
}

function readBody<T>(init?: RequestInit): T {
  return JSON.parse(typeof init?.body === "string" ? init.body : "{}") as T;
}

export function createMockReclaimApiFetch(state: MockReclaimApiState = createSeedState()): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = getRequestUrl(input);
    const method = getRequestMethod(init);
    const pathname = url.pathname.replace(/^\/api/, "");

    if (method === "GET" && pathname === "/users/current") {
      return jsonResponse(state.currentUser);
    }

    if (method === "GET" && pathname === "/timeschemes") {
      return jsonResponse(state.timeSchemes);
    }

    if (method === "GET" && pathname === "/meetings") {
      return jsonResponse(state.meetings);
    }

    if (method === "GET" && pathname === "/tasks") {
      return jsonResponse(state.tasks);
    }

    if (method === "POST" && pathname === "/tasks") {
      const body = readBody<ReclaimCreateTaskInput>(init);
      const createdTask: ReclaimTaskRecord = {
        id: state.nextTaskId++,
        title: body.title,
        notes: body.notes,
        eventCategory: body.eventCategory,
        timeSchemeId: body.timeSchemeId,
        due: body.due,
        snoozeUntil: body.snoozeUntil
      };
      state.tasks.push(createdTask);
      return jsonResponse(createdTask);
    }

    const taskMatch = pathname.match(/^\/tasks\/(\d+)$/);
    if (taskMatch && method === "PATCH") {
      const taskId = Number(taskMatch[1]);
      const existingTask = state.tasks.find((task) => task.id === taskId);
      if (!existingTask) {
        return jsonResponse({ message: "Task not found." }, 404);
      }
      const body = readBody<ReclaimUpdateTaskInput>(init);
      Object.assign(existingTask, body);
      return jsonResponse(existingTask);
    }

    if (taskMatch && method === "DELETE") {
      const taskId = Number(taskMatch[1]);
      state.tasks = state.tasks.filter((task) => task.id !== taskId);
      return new Response(null, { status: 204 });
    }

    return jsonResponse({ message: `Unhandled mock route: ${method} ${pathname}` }, 404);
  }) as typeof fetch;
}

export async function runMockReclaimApiDemo(
  inputPath = path.join("examples", "tasks.example.json")
): Promise<MockReclaimApiDemoResult> {
  const state = createSeedState();
  const fetchImpl = createMockReclaimApiFetch(state);
  const client = createReclaimClient(DEMO_CONFIG, fetchImpl);
  const rawInput = JSON.parse(fs.readFileSync(inputPath, "utf8")) as unknown;
  const taskInputs = parseReclaimTaskInputs(rawInput);
  const timePolicies = tasks.previewTimePolicySelection(await client.listTaskAssignmentTimeSchemes(), {
    preferredTimePolicyId: client.config.preferredTimePolicyId,
    preferredTimePolicyTitle: client.config.preferredTimePolicyTitle,
    eventCategory: client.config.defaultTaskEventCategory
  });
  const createPreview = tasks.previewCreates(taskInputs, {
    timeSchemeId: timePolicies.selectedPolicy?.id,
    eventCategory: client.config.defaultTaskEventCategory
  });
  const duplicatePlan = tasks.inspectDuplicates(taskInputs, await client.listTasks(), {
    timeSchemeId: timePolicies.selectedPolicy?.id,
    eventCategory: client.config.defaultTaskEventCategory
  });
  const duplicateCleanup = await tasks.cleanupDuplicates(client, duplicatePlan, {
    confirmDelete: true
  });
  const createResult = await tasks.create(client, taskInputs, {
    confirmWrite: true,
    timeSchemeId: timePolicies.selectedPolicy?.id
  });

  return {
    health: await runReclaimHealthCheck(DEMO_CONFIG, fetchImpl),
    timePolicies,
    createPreview,
    createResult,
    duplicatePlan,
    duplicateCleanup,
    finalTaskCount: state.tasks.length
  };
}
