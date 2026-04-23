import { describe, expect, test } from "vitest";
import { createReclaimClient, tasks } from "../src/index.js";

describe("task create duplicate warnings", () => {
  test("includes warning-only duplicate detection before task creation", async () => {
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        preferredTimePolicyId: "policy-work",
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/timeschemes")) {
          return new Response(
            JSON.stringify([
              {
                id: "policy-work",
                taskCategory: "WORK",
                title: "Work Hours",
                features: ["TASK_ASSIGNMENT"]
              }
            ]),
            { status: 200 }
          );
        }
        if (url.endsWith("/tasks") && (init?.method ?? "GET") === "GET") {
          return new Response(
            JSON.stringify([
              {
                id: 21,
                title: "Draft planning notes",
                notes: "Capture open questions.",
                eventCategory: "WORK",
                timeSchemeId: "policy-work",
                due: "2026-05-06T15:00:00.000Z"
              },
              {
                id: 22,
                title: "Draft planning notes",
                notes: "Capture open questions.",
                eventCategory: "WORK",
                timeSchemeId: "policy-work",
                due: "2026-05-06T15:00:00.000Z"
              }
            ]),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            id: 23,
            title: "Review pull request",
            eventCategory: "WORK",
            timeSchemeId: "policy-work"
          }),
          { status: 200 }
        );
      }) as typeof fetch
    );

    const result = await tasks.create(
      client,
      [
        {
          title: "Draft planning notes",
          notes: "Capture open questions.",
          durationMinutes: 45,
          due: "2026-05-06T17:00:00+02:00"
        },
        {
          title: "Review pull request",
          notes: "Check tests.",
          durationMinutes: 30
        }
      ],
      { confirmWrite: true }
    );

    expect(result.duplicatePlan).toEqual({
      duplicateGroupCount: 1,
      duplicateGroups: [{ title: "Draft planning notes", keptTaskId: 21, duplicateTaskIds: [22] }]
    });
    expect(result.skippedTasks).toEqual([
      { title: "Draft planning notes", taskId: 21, reason: "already_exists" }
    ]);
    expect(result.createdTasks).toEqual([{ title: "Review pull request", taskId: 23 }]);
  });
});
