import { describe, expect, test } from "vitest";
import { createReclaimClient } from "../src/client.js";
import { createMockReclaimApiFetch, type MockReclaimApiState } from "../src/mock-lab.js";
import type { ReclaimConfig } from "../src/types.js";

const TEST_CONFIG: ReclaimConfig = {
  apiUrl: "https://mock.reclaim.local/api",
  apiKey: "mock-api-key",
  timeoutMs: 1000,
  defaultTaskEventCategory: "WORK"
};

function createPaginatedState(): MockReclaimApiState {
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
      },
      {
        id: "meeting-demo-2",
        title: "Review cadence",
        start: "2026-05-06T12:00:00.000Z",
        end: "2026-05-06T12:45:00.000Z",
        durationMinutes: 45,
        attendeeCount: 2
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
        title: "Prepare status update",
        notes: "Use synthetic placeholder details.",
        eventCategory: "WORK",
        timeSchemeId: "policy-work",
        due: "2026-05-06T17:00:00.000Z"
      }
    ],
    nextTaskId: 200
  };
}

describe("paginated Reclaim read collectors", () => {
  test("collects task pages until nextPage is exhausted", async () => {
    const requestedUrls: string[] = [];
    const client = createReclaimClient(
      TEST_CONFIG,
      (async (input: string | URL | Request, init?: RequestInit) => {
        requestedUrls.push(String(input));
        return createMockReclaimApiFetch(createPaginatedState(), {
          tasks: { pageSize: 1 }
        })(input, init);
      }) as typeof fetch
    );

    const tasks = await client.listTasks();

    expect(tasks.map((task) => task.id)).toEqual([101, 102]);
    expect(requestedUrls).toEqual([
      "https://mock.reclaim.local/api/tasks",
      "https://mock.reclaim.local/api/tasks?page=2"
    ]);
  });

  test("collects paginated meetings and time schemes from endpoint-specific keys", async () => {
    const client = createReclaimClient(
      TEST_CONFIG,
      createMockReclaimApiFetch(createPaginatedState(), {
        meetings: { pageSize: 1 },
        timeSchemes: { pageSize: 1 }
      })
    );

    const [meetings, timeSchemes] = await Promise.all([
      client.listMeetings(),
      client.listTaskAssignmentTimeSchemes()
    ]);

    expect(meetings.map((meeting) => meeting.id)).toEqual(["meeting-demo-1", "meeting-demo-2"]);
    expect(timeSchemes.map((scheme) => scheme.id)).toEqual(["policy-work", "policy-personal"]);
  });

  test("retries a rate-limited task page when Retry-After is provided", async () => {
    const client = createReclaimClient(
      TEST_CONFIG,
      createMockReclaimApiFetch(createPaginatedState(), {
        tasks: {
          pageSize: 1,
          rateLimitResponses: 1,
          retryAfterSeconds: 0
        }
      })
    );

    const tasks = await client.listTasks();

    expect(tasks.map((task) => task.id)).toEqual([101, 102]);
  });

  test("fails after exhausting bounded rate-limit retries", async () => {
    const client = createReclaimClient(
      TEST_CONFIG,
      createMockReclaimApiFetch(createPaginatedState(), {
        tasks: {
          rateLimitResponses: 3,
          retryAfterSeconds: 0
        }
      })
    );

    await expect(client.listTasks()).rejects.toThrow(
      "Reclaim request failed: 429 Too Many Requests for /tasks"
    );
  });
});
