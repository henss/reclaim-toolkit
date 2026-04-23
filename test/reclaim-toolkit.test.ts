import fs from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createReclaimClient,
  habits,
  loadReclaimConfig,
  meetingsHours,
  parseReclaimHabitInputs,
  parseReclaimMeetingsAndHoursSnapshot,
  parseReclaimTaskInputs,
  runReclaimHealthCheck,
  tasks,
  type ReclaimTaskRecord
} from "../src/index.js";
import { createMockReclaimApiFetch, runMockReclaimApiDemo } from "../src/mock-lab.js";
import {
  listen,
  makeTempDir,
  runNpmCli,
  runNpmCliAsync,
  writeConfigFile
} from "./cli-test-helpers.js";

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


describe("agent-safe CLI JSON profile", () => {
  test("passes the public-boundary lint for committed example fixtures", () => {
    const result = runNpmCli(["lint:public-boundary"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe("Public-boundary lint passed for 10 file(s).");
  });

  test("public-boundary lint rejects private workspace markers in examples", () => {
    const repoPath = makeTempDir();
    const examplePath = path.join(repoPath, "leaky.example.json");
    fs.writeFileSync(
      examplePath,
      JSON.stringify({ tasks: [{ title: "Copy from D:\\workspace\\llm-orchestrator" }] }),
      "utf8"
    );

    const result = runNpmCli(["lint:public-boundary", "--", examplePath]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("private-workspace-path");
    expect(result.stderr).toContain("private-orchestrator-surface");
  });

  test("emits a public-safe onboarding wizard without requiring config", () => {
    const result = runNpmCli(["reclaim:onboarding"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      wizard: string;
      writeSafety: string;
      config: { path: string; exists: boolean; parseStatus: string; notes: string[] };
      steps: Array<{ id: string; safetyClass: string; status: string; command?: string; notes: string[] }>;
    };
    expect(output).toMatchObject({
      wizard: "reclaim-toolkit-onboarding",
      writeSafety: "no_live_writes",
      config: {
        path: "config/reclaim.local.json",
        exists: false,
        parseStatus: "missing"
      }
    });
    expect(result.stdout).not.toContain("D:\\workspace");
    expect(output.steps.find((step) => step.id === "preview-fixtures")).toMatchObject({
      safetyClass: "local_preview",
      status: "ready",
      command: "npm run reclaim:tasks:preview-create -- --input examples/tasks.example.json"
    });
    expect(output.steps.find((step) => step.id === "confirmed-write-review")).toMatchObject({
      safetyClass: "confirmed_write_review",
      status: "review_required"
    });
  });

  test("onboarding reports a synthetic local config as ready without validating credentials", () => {
    const repoPath = makeTempDir();
    const configPath = path.join(repoPath, "config", "reclaim.local.json");
    writeConfigFile(configPath, {
      apiUrl: "http://127.0.0.1:43210",
      apiKey: "synthetic-key",
      timeoutMs: 1000,
      defaultTaskEventCategory: "WORK"
    });

    const result = runNpmCli(["reclaim:onboarding", "--", "--config", configPath]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      config: { exists: boolean; parseStatus: string; normalizedApiUrl?: string; defaultTaskEventCategory?: string };
      steps: Array<{ id: string; status: string }>;
    };
    expect(output.config).toMatchObject({
      exists: true,
      parseStatus: "valid",
      normalizedApiUrl: "http://127.0.0.1:43210/api",
      defaultTaskEventCategory: "WORK"
    });
    expect(output.steps.find((step) => step.id === "authenticated-read")?.status).toBe("ready");
  });

  test("emits parseable JSON on stdout for successful npm-silent commands", () => {
    const result = runNpmCli([
      "reclaim:tasks:preview-create",
      "--",
      "--input",
      path.join("examples", "tasks.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      taskCount: number;
      tasks: Array<{ title: string; request: { timeSchemeId: string; alwaysPrivate: boolean } }>;
      writeReceipts?: unknown;
    };
    expect(output.taskCount).toBe(2);
    expect(output.tasks[0]?.title).toBe("Draft planning notes");
    expect(output.tasks[0]?.request).toMatchObject({
      timeSchemeId: "TASK_ASSIGNMENT_TIME_SCHEME_ID_REQUIRED",
      alwaysPrivate: true
    });
    expect(output.writeReceipts).toBeUndefined();
  });

  test("emits diagnostics on stderr and no JSON stdout for failed npm-silent commands", () => {
    const result = runNpmCli(["reclaim:tasks:preview-create"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("Expected --input <json>.");
  });

  test("emits parseable JSON for another local preview command", () => {
    const result = runNpmCli([
      "reclaim:meetings-hours:preview-inspect",
      "--",
      "--input",
      path.join("examples", "meetings-and-hours.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as { meetingCount: number; readSafety: string };
    expect(output.meetingCount).toBe(2);
    expect(output.readSafety).toBe("read_only");
  });

  test("emits policy discovery JSON for the authenticated time-policy command", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/api/timeschemes") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify([
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
            description: "Synthetic task-assignment policy for focused work.",
            features: ["TASK_ASSIGNMENT"]
          }
        ]));
        return;
      }

      response.writeHead(404);
      response.end();
    });
    const port = await listen(server);
    const repoPath = makeTempDir();
    const configPath = path.join(repoPath, "config", "reclaim.local.json");
    writeConfigFile(configPath, {
      apiUrl: `http://127.0.0.1:${port}`,
      apiKey: "synthetic-key",
      timeoutMs: 1000,
      defaultTaskEventCategory: "WORK",
      preferredTimePolicyTitle: "deep"
    });

    try {
      const result = await runNpmCliAsync(["reclaim:time-policies:list", "--", "--config", configPath]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const output = JSON.parse(result.stdout) as {
        selectedPolicy?: { id: string; title: string; matchesDefaultEventCategory: boolean };
        selectionReason: string;
        policies: Array<{ id: string; matchesDefaultEventCategory: boolean }>;
      };
      expect(output.selectedPolicy).toMatchObject({
        id: "policy-deep-work",
        title: "Deep Work",
        matchesDefaultEventCategory: true
      });
      expect(output.selectionReason).toBe('Matched preferred Reclaim time policy title "deep".');
      expect(output.policies).toHaveLength(2);
      expect(output.policies.find((policy) => policy.id === "policy-personal")?.matchesDefaultEventCategory).toBe(
        false
      );
    } finally {
      server.close();
    }
  });

  test("emits task list, filter, and export JSON for authenticated read commands", async () => {
    const syntheticTasks = [
      {
        id: 12,
        title: "Review pull request",
        notes: "Check tests and leave concise notes.",
        eventCategory: "WORK",
        timeSchemeId: "policy-work",
        due: "2026-05-07T10:00:00.000Z",
        snoozeUntil: "2026-05-07T07:00:00.000Z"
      },
      {
        id: 11,
        title: "Draft planning notes",
        notes: "Capture open questions.",
        eventCategory: "WORK",
        timeSchemeId: "policy-work",
        due: "2026-05-06T15:00:00.000Z",
        snoozeUntil: "2026-05-06T07:00:00.000Z"
      },
      {
        id: 13,
        title: "Update personal admin notes",
        eventCategory: "PERSONAL",
        timeSchemeId: "policy-personal"
      }
    ];
    const server = createServer((request, response) => {
      if (request.url === "/api/tasks") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(syntheticTasks));
        return;
      }

      response.writeHead(404);
      response.end();
    });
    const port = await listen(server);
    const repoPath = makeTempDir();
    const configPath = path.join(repoPath, "config", "reclaim.local.json");
    writeConfigFile(configPath, {
      apiUrl: `http://127.0.0.1:${port}`,
      apiKey: "synthetic-key",
      timeoutMs: 1000,
      defaultTaskEventCategory: "WORK"
    });

    try {
      const listResult = await runNpmCliAsync(["reclaim:tasks:list", "--", "--config", configPath]);
      expect(listResult.status).toBe(0);
      expect(listResult.stderr).toBe("");
      const listOutput = JSON.parse(listResult.stdout) as {
        taskCount: number;
        readSafety: string;
        tasks: Array<{ id: number; title: string; startAfter?: string }>;
      };
      expect(listOutput).toMatchObject({ taskCount: 3, readSafety: "read_only" });
      expect(listOutput.tasks.map((task) => task.id)).toEqual([11, 12, 13]);
      expect(listOutput.tasks[0]).toMatchObject({
        title: "Draft planning notes",
        startAfter: "2026-05-06T07:00:00.000Z"
      });

      const filterResult = await runNpmCliAsync([
        "reclaim:tasks:filter",
        "--",
        "--config",
        configPath,
        "--title-contains",
        "notes",
        "--event-category",
        "WORK",
        "--due-before",
        "2026-05-07T00:00:00.000Z"
      ]);
      expect(filterResult.status).toBe(0);
      expect(filterResult.stderr).toBe("");
      const filterOutput = JSON.parse(filterResult.stdout) as {
        taskCount: number;
        filters: { titleContains: string; eventCategory: string; dueBefore: string };
        tasks: Array<{ title: string }>;
      };
      expect(filterOutput).toMatchObject({
        taskCount: 1,
        filters: {
          titleContains: "notes",
          eventCategory: "WORK",
          dueBefore: "2026-05-07T00:00:00.000Z"
        }
      });
      expect(filterOutput.tasks).toEqual([
        {
          id: 11,
          title: "Draft planning notes",
          notes: "Capture open questions.",
          eventCategory: "WORK",
          timeSchemeId: "policy-work",
          due: "2026-05-06T15:00:00.000Z",
          startAfter: "2026-05-06T07:00:00.000Z"
        }
      ]);

      const exportResult = await runNpmCliAsync([
        "reclaim:tasks:export",
        "--",
        "--config",
        configPath,
        "--event-category",
        "WORK",
        "--format",
        "csv"
      ]);
      expect(exportResult.status).toBe(0);
      expect(exportResult.stderr).toBe("");
      const exportOutput = JSON.parse(exportResult.stdout) as {
        format: string;
        taskCount: number;
        readSafety: string;
        content: string;
      };
      expect(exportOutput).toMatchObject({ format: "csv", taskCount: 2, readSafety: "read_only" });
      expect(exportOutput.content.split("\n")[0]).toBe("id,title,notes,eventCategory,timeSchemeId,due,startAfter");
      expect(exportOutput.content).toContain("11,Draft planning notes,Capture open questions.,WORK,policy-work");
      expect(exportOutput.content).toContain("12,Review pull request,Check tests and leave concise notes.,WORK,policy-work");
    } finally {
      server.close();
    }
  });
});

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

  test("reads meetings and time schemes through the read-only client surface", async () => {
    const calls: string[] = [];
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/meetings")) {
          return new Response(
            JSON.stringify([
              {
                id: "meeting-demo-1",
                title: "Project sync",
                start: "2026-05-06T10:00:00.000Z",
                end: "2026-05-06T10:30:00.000Z",
                attendees: [{ id: "person-1" }, { id: "person-2" }]
              }
            ]),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify([
            {
              id: "policy-work",
              title: "Work Hours",
              taskCategory: "WORK",
              timezone: "Europe/Berlin",
              features: ["TASK_ASSIGNMENT"],
              windows: [{ dayOfWeek: "monday", start: "09:00", end: "17:00" }]
            }
          ]),
          { status: 200 }
        );
      }) as typeof fetch
    );

    const inspection = await meetingsHours.inspect(client);

    expect(calls).toEqual([
      "https://api.app.reclaim.ai/api/meetings",
      "https://api.app.reclaim.ai/api/timeschemes"
    ]);
    expect(inspection).toMatchObject({
      meetingCount: 1,
      hourPolicyCount: 1,
      readSafety: "read_only"
    });
    expect(inspection.meetings[0]).toMatchObject({
      title: "Project sync",
      durationMinutes: 30,
      attendeeCount: 2
    });
    expect(inspection.hourPolicies[0]).toMatchObject({
      title: "Work Hours",
      windowCount: 1
    });
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

    expect(result.duplicatePlan).toEqual({
      duplicateGroupCount: 0,
      duplicateGroups: []
    });
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
    expect(result.createResult.duplicatePlan).toEqual({
      duplicateGroupCount: 0,
      duplicateGroups: []
    });
    expect(result.createResult.createdTasks).toEqual([{ title: "Review pull request", taskId: 200 }]);
    expect(result.finalTaskCount).toBe(2);
  });

  test("runs the synthetic mock API demo lab with the scheduling recipe pack", async () => {
    const result = await runMockReclaimApiDemo(path.join("examples", "scheduling-recipes.example.json"));

    expect(result.health.reachable).toBe(true);
    expect(result.createPreview.taskCount).toBe(6);
    expect(result.duplicatePlan.duplicateGroupCount).toBe(0);
    expect(result.duplicateCleanup.deletedTaskIds).toEqual([]);
    expect(result.createResult.createdTasks).toHaveLength(6);
    expect(result.createResult.writeReceipts).toHaveLength(6);
    expect(result.finalTaskCount).toBe(8);
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

describe("habits", () => {
  test("parses and previews the synthetic habit fixture without write capability", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "habits.example.json"), "utf8")
    ) as unknown;

    const parsedHabits = parseReclaimHabitInputs(raw);
    const preview = habits.previewCreates(parsedHabits);

    expect(parsedHabits).toHaveLength(2);
    expect(preview).toMatchObject({
      habitCount: 2,
      writeSafety: "preview_only"
    });
    expect(preview.habits[0]?.request).toMatchObject({
      title: "Morning project review",
      eventCategory: "WORK",
      cadence: "daily",
      alwaysPrivate: true
    });
    expect(preview.habits[1]?.request).toMatchObject({
      title: "Weekly workspace reset",
      eventCategory: "PERSONAL",
      cadence: "weekly",
      daysOfWeek: ["friday"],
      windowStart: "15:00",
      windowEnd: "17:00"
    });
  });

  test("rejects ambiguous habit cadence and window inputs", () => {
    expect(() =>
      parseReclaimHabitInputs({
        habits: [
          {
            title: "Daily review",
            durationMinutes: 15,
            cadence: "daily",
            daysOfWeek: ["monday"]
          }
        ]
      })
    ).toThrow("Daily habits should omit daysOfWeek.");

    expect(() =>
      parseReclaimHabitInputs({
        habits: [
          {
            title: "Weekly review",
            durationMinutes: 15,
            cadence: "weekly",
            windowStart: "17:00",
            windowEnd: "09:00"
          }
        ]
      })
    ).toThrow("Weekly habits require at least one dayOfWeek.");
  });
});

describe("meetings and hours", () => {
  test("parses and inspects the synthetic meetings and hours fixture", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "meetings-and-hours.example.json"), "utf8")
    ) as unknown;

    const snapshot = parseReclaimMeetingsAndHoursSnapshot(raw);
    const inspection = meetingsHours.inspectSnapshot(snapshot);

    expect(inspection).toMatchObject({
      meetingCount: 2,
      hourPolicyCount: 2,
      readSafety: "read_only"
    });
    expect(inspection.meetings[0]?.title).toBe("Project sync");
    expect(inspection.hourPolicies[0]).toMatchObject({
      id: "policy-work",
      title: "Work Hours",
      taskCategory: "WORK",
      timezone: "Europe/Berlin",
      windowCount: 2
    });
  });

});
