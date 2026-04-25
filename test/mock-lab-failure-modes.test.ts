import { describe, expect, test } from "vitest";
import { runMockReclaimFailureModeLab } from "../src/mock-lab.js";

describe("mock API failure-mode lab", () => {
  test("runs the synthetic failure-mode profile without live credentials", async () => {
    const result = await runMockReclaimFailureModeLab();

    expect(result).toMatchObject({
      lab: "mock-api-failure-mode-matrix",
      profile: "failure-modes",
      executionOrderMatters: false
    });
    expect(result.scenarios).toEqual([
      {
        name: "paginatedTaskReads",
        category: "pagination",
        outcome: "recovered",
        details: {
          taskIds: [101, 102],
          requestCount: 2,
          requests: [
            "https://mock.reclaim.local/api/tasks",
            "https://mock.reclaim.local/api/tasks?page=2"
          ]
        }
      },
      {
        name: "boundedRateLimitRetry",
        category: "rate_limit",
        outcome: "recovered",
        details: {
          taskIds: [101, 102],
          requestCount: 3,
          requests: [
            "https://mock.reclaim.local/api/tasks",
            "https://mock.reclaim.local/api/tasks",
            "https://mock.reclaim.local/api/tasks?page=2"
          ]
        }
      },
      {
        name: "exhaustedRateLimitRetries",
        category: "rate_limit",
        outcome: "failed",
        details: {
          error: "Reclaim request failed: 429 Too Many Requests for /tasks"
        }
      },
      {
        name: "updateMissingTask",
        category: "not_found",
        outcome: "returned_error",
        details: {
          status: 404,
          json: {
            message: "Task not found."
          }
        }
      },
      {
        name: "unknownRoute",
        category: "unknown_route",
        outcome: "returned_error",
        details: {
          status: 404,
          json: {
            message: "Unhandled mock route: GET /unknown"
          }
        }
      }
    ]);
  });
});
