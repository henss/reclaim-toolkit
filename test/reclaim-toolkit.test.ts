import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createReclaimClient,
  loadReclaimConfig,
  parseReclaimTaskInputs,
  runReclaimHealthCheck,
  tasks,
  type ReclaimTaskRecord
} from "../src/index.js";
import { createMockReclaimApiFetch, runMockReclaimApiDemo } from "../src/mock-lab.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "reclaim-toolkit-"));
}

function writeConfig(repoPath: string): void {
  const configDir = path.join(repoPath, "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "reclaim.local.json"),
    JSON.stringify(
      {
        apiUrl: "https://api.app.reclaim.ai",
        apiKey: "secret-key",
        timeoutMs: 1000,
        preferredTimePolicyId: "policy-work",
        defaultTaskEventCategory: "WORK"
      },
      null,
      2
    ),
    "utf8"
  );
}

describe("config and client", () => {
  test("loads config and normalizes the Reclaim API URL", () => {
    const repoPath = makeTempDir();
    writeConfig(repoPath);

    const config = loadReclaimConfig(undefined, repoPath);

    expect(config?.apiUrl).toBe("https://api.app.reclaim.ai/api");
    expect(config?.apiKey).toBe("secret-key");
    expect(config?.defaultTaskEventCategory).toBe("WORK");
  });

  test("sends bearer auth and JSON headers", async () => {
    const calls: Array<{ url: string; headers: Headers; body?: string }> = [];
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "PERSONAL"
      },
      (async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({
          url: String(input),
          headers: new Headers(init?.headers),
          body: typeof init?.body === "string" ? init.body : undefined
        });
        return new Response(JSON.stringify({ id: 7, title: "Draft planning notes" }), {
          status: 200
        });
      }) as typeof fetch
    );

    await client.createTask({
      title: "Draft planning notes",
      notes: "Capture open questions.",
      timeSchemeId: "policy-work",
      timeChunksRequired: 3,
      minChunkSize: 1,
      maxChunkSize: 3,
      eventCategory: "WORK"
    });

    expect(calls[0]?.url).toBe("https://api.app.reclaim.ai/api/tasks");
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer secret-key");
    expect(calls[0]?.headers.get("Content-Type")).toBe("application/json");
    expect(calls[0]?.body).toContain("\"alwaysPrivate\":true");
  });

  test("throws useful errors for non-OK responses", async () => {
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "PERSONAL"
      },
      (async () => new Response("nope", { status: 500, statusText: "Server Error" })) as typeof fetch
    );

    await expect(client.listTasks()).rejects.toThrow(
      "Reclaim request failed: 500 Server Error for /tasks"
    );
  });

  test("aborts requests when the timeout expires", async () => {
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1,
        defaultTaskEventCategory: "PERSONAL"
      },
      (async (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })) as typeof fetch
    );

    await expect(client.listTasks()).rejects.toThrow("aborted");
  });
});

describe("health and tasks", () => {
  test("reports healthy reads when authenticated endpoints respond", async () => {
    const result = await runReclaimHealthCheck(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/users/current")) {
          return new Response(JSON.stringify({ id: "user-1", email: "person@example.com" }), {
            status: 200
          });
        }
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
        return new Response("[]", { status: 200 });
      }) as typeof fetch
    );

    expect(result.reachable).toBe(true);
    expect(result.userEmail).toBe("person@example.com");
    expect(result.taskAssignmentTimeSchemeCount).toBe(1);
    expect(result.taskCount).toBe(0);
  });

  test("previews task creates with chunks, due, and start-after values", () => {
    const preview = tasks.previewCreates(
      [
        {
          title: "Review pull request",
          notes: "Check tests.",
          durationMinutes: 30,
          due: "2026-05-07T12:00:00+02:00",
          startAfter: "2026-05-07T09:00:00+02:00",
          splitAllowed: false
        }
      ],
      { timeSchemeId: "policy-work", eventCategory: "WORK" }
    );

    expect(preview.tasks[0]?.request).toMatchObject({
      title: "Review pull request",
      timeChunksRequired: 2,
      minChunkSize: 2,
      maxChunkSize: 2,
      due: "2026-05-07T12:00:00+02:00",
      snoozeUntil: "2026-05-07T09:00:00+02:00",
      eventCategory: "WORK"
    });
  });

  test("parses the synthetic scheduling recipe pack", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "scheduling-recipes.example.json"), "utf8")
    ) as unknown;

    const parsedTasks = parseReclaimTaskInputs(raw);
    const preview = tasks.previewCreates(parsedTasks, {
      timeSchemeId: "policy-work",
      eventCategory: "WORK"
    });

    expect(parsedTasks).toHaveLength(6);
    expect(preview.taskCount).toBe(6);
    expect(preview.tasks.map((task) => task.title)).toContain("Weekly planning review");
    expect(preview.tasks.find((task) => task.title === "Review design notes")?.request).toMatchObject({
      timeChunksRequired: 2,
      minChunkSize: 2,
      maxChunkSize: 2,
      snoozeUntil: "2026-05-12T09:30:00+02:00"
    });
    expect(preview.tasks.find((task) => task.title === "Update personal admin notes")?.request.eventCategory).toBe(
      "PERSONAL"
    );
  });

  test("previews time policy discovery and selected policy reasoning", () => {
    const preview = tasks.previewTimePolicySelection(
      [
        {
          id: "policy-personal",
          title: "Personal Hours",
          taskCategory: "PERSONAL",
          features: ["TASK_ASSIGNMENT"]
        },
        {
          id: "policy-deep-work",
          title: "Deep Work",
          taskCategory: "WORK",
          description: "Default work policy for focused task blocks.",
          features: ["TASK_ASSIGNMENT"]
        }
      ],
      { preferredTimePolicyTitle: "deep", eventCategory: "WORK" }
    );

    expect(preview.selectedPolicy).toMatchObject({
      id: "policy-deep-work",
      title: "Deep Work",
      matchesDefaultEventCategory: true
    });
    expect(preview.selectionReason).toBe('Matched preferred Reclaim time policy title "deep".');
    expect(preview.policies).toHaveLength(2);
  });

  test("falls back to the default event category when no preferred policy is configured", () => {
    const preview = tasks.previewTimePolicySelection(
      [
        {
          id: "policy-personal",
          title: "Personal Hours",
          taskCategory: "PERSONAL",
          features: ["TASK_ASSIGNMENT"]
        },
        {
          id: "policy-work",
          title: "Work Hours",
          taskCategory: "WORK",
          features: ["TASK_ASSIGNMENT"]
        }
      ],
      { eventCategory: "WORK" }
    );

    expect(preview.selectedPolicy?.id).toBe("policy-work");
    expect(preview.selectionReason).toBe("Selected the first Reclaim time policy matching event category WORK.");
  });

  test("refuses task creation without confirmation", async () => {
    const client = createReclaimClient({
      apiUrl: "https://api.app.reclaim.ai/api",
      apiKey: "secret-key",
      timeoutMs: 1000,
      defaultTaskEventCategory: "WORK"
    });

    await expect(tasks.create(client, [], { confirmWrite: false })).rejects.toThrow(
      "Refusing to create Reclaim tasks without confirmWrite."
    );
  });

  test("creates missing tasks and skips exact existing matches", async () => {
    const createdBodies: string[] = [];
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
                id: 9,
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
        createdBodies.push(typeof init?.body === "string" ? init.body : "");
        return new Response(
          JSON.stringify({
            id: 10,
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

    expect(result.skippedTasks).toEqual([
      { title: "Draft planning notes", taskId: 9, reason: "already_exists" }
    ]);
    expect(result.createdTasks).toEqual([{ title: "Review pull request", taskId: 10 }]);
    expect(result.writeReceipts).toHaveLength(1);
    expect(result.writeReceipts[0]).toMatchObject({
      operation: "task.create",
      taskId: 10,
      title: "Review pull request",
      rollbackHint: "Delete Reclaim task 10 if this confirmed create should be undone."
    });
    expect(Date.parse(result.writeReceipts[0]?.confirmedAt ?? "")).not.toBeNaN();
    expect(createdBodies[0]).toContain("\"title\":\"Review pull request\"");
  });

  test("validates configured preferred time policy ids before creating tasks", async () => {
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        preferredTimePolicyId: "policy-missing",
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request) => {
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
        return new Response("[]", { status: 200 });
      }) as typeof fetch
    );

    await expect(
      tasks.create(client, [{ title: "Review pull request", durationMinutes: 30 }], { confirmWrite: true })
    ).rejects.toThrow("Preferred Reclaim time policy id policy-missing was not found.");
  });

  test("inspects and cleans exact duplicates while keeping the oldest task", async () => {
    const existingTasks: ReclaimTaskRecord[] = [
      {
        id: 3,
        title: "Draft planning notes",
        notes: "Capture open questions.",
        eventCategory: "WORK",
        timeSchemeId: "policy-work"
      },
      {
        id: 4,
        title: "Draft planning notes",
        notes: "Capture open questions.",
        eventCategory: "WORK",
        timeSchemeId: "policy-work"
      }
    ];
    const plan = tasks.inspectDuplicates(
      [{ title: "Draft planning notes", notes: "Capture open questions.", durationMinutes: 45 }],
      existingTasks,
      { timeSchemeId: "policy-work", eventCategory: "WORK" }
    );
    const deletedIds: number[] = [];
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "DELETE") {
          deletedIds.push(Number(String(input).split("/").pop()));
          return new Response(null, { status: 204 });
        }
        return new Response("[]", { status: 200 });
      }) as typeof fetch
    );

    expect(plan).toEqual({
      duplicateGroupCount: 1,
      duplicateGroups: [{ title: "Draft planning notes", keptTaskId: 3, duplicateTaskIds: [4] }]
    });
    await expect(tasks.cleanupDuplicates(client, plan, { confirmDelete: false })).rejects.toThrow(
      "Refusing to delete Reclaim task duplicates without confirmDelete."
    );
    const cleanupResult = await tasks.cleanupDuplicates(client, plan, { confirmDelete: true });

    expect(cleanupResult).toMatchObject({ deletedTaskIds: [4] });
    expect(cleanupResult.writeReceipts).toHaveLength(1);
    expect(cleanupResult.writeReceipts[0]).toMatchObject({
      operation: "task.delete",
      taskId: 4,
      title: "Draft planning notes",
      rollbackHint: "Recreate the task from the reviewed input or audit source if deleting Reclaim task 4 was unintended."
    });
    expect(Date.parse(cleanupResult.writeReceipts[0]?.confirmedAt ?? "")).not.toBeNaN();
    expect(deletedIds).toEqual([4]);
  });

  test("runs the synthetic mock API demo lab without live credentials", async () => {
    const result = await runMockReclaimApiDemo();

    expect(result.health.reachable).toBe(true);
    expect(result.health.userEmail).toBe("demo.user@example.com");
    expect(result.timePolicies.selectedPolicy?.id).toBe("policy-work");
    expect(result.duplicateCleanup.deletedTaskIds).toEqual([102]);
    expect(result.createResult.skippedTasks).toEqual([
      { title: "Draft planning notes", taskId: 101, reason: "already_exists" }
    ]);
    expect(result.createResult.createdTasks).toEqual([{ title: "Review pull request", taskId: 200 }]);
    expect(result.finalTaskCount).toBe(2);
  });

  test("serves task CRUD through the synthetic mock API fetch", async () => {
    const client = createReclaimClient(
      {
        apiUrl: "https://mock.reclaim.local/api",
        apiKey: "mock-api-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "WORK"
      },
      createMockReclaimApiFetch()
    );

    const created = await client.createTask({
      title: "Prepare demo outline",
      notes: "Use public-safe placeholder material.",
      timeSchemeId: "policy-work",
      timeChunksRequired: 2,
      minChunkSize: 1,
      maxChunkSize: 2,
      eventCategory: "WORK"
    });
    const updated = await client.updateTask(created.id, { notes: "Keep the demo synthetic." });
    await client.deleteTask(created.id);

    expect(created.id).toBe(200);
    expect(updated.notes).toBe("Keep the demo synthetic.");
    expect((await client.listTasks()).map((task) => task.id)).not.toContain(created.id);
  });
});
