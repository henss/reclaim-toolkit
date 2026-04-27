import fs from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createReclaimClient,
  parseReclaimTaskUpdatePreviewInput,
  parseReclaimTaskUpdates,
  parseTaskWriteReceipts,
  tasks
} from "../src/index.js";
import {
  listen,
  makeTempDir,
  runNpmCli,
  runNpmCliAsync,
  writeConfigFile
} from "./cli-test-helpers.js";

function loadTaskUpdatesFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "task-updates.example.json"), "utf8")
  ) as unknown;
}

interface PatchCall {
  url: string | undefined;
  body: unknown;
}

interface TaskUpdateCliOutput {
  updatedTasks: Array<{ title: string; taskId: number }>;
  writeReceipts: Array<{ operation: string; taskId: number; rollbackHint: string }>;
}

const EXPECTED_CLI_PATCH_CALLS: PatchCall[] = [
  {
    url: "/api/tasks/101",
    body: {
      title: "Draft planning notes",
      notes: "Capture decisions and open questions before the weekly review.",
      timeChunksRequired: 4,
      maxChunkSize: 4,
      minChunkSize: 1,
      due: "2026-05-06T18:00:00+02:00"
    }
  },
  {
    url: "/api/tasks/102",
    body: {
      timeChunksRequired: 2,
      maxChunkSize: 2,
      minChunkSize: 2,
      snoozeUntil: "2026-05-07T09:30:00+02:00"
    }
  }
];

function writeSyntheticConfig(apiUrl: string): string {
  const repoPath = makeTempDir();
  const configPath = path.join(repoPath, "config", "reclaim.local.json");
  writeConfigFile(configPath, {
    apiUrl,
    apiKey: "synthetic-key",
    timeoutMs: 1000,
    defaultTaskEventCategory: "WORK"
  });
  return configPath;
}

function syntheticTaskTitle(taskId: number): string {
  return taskId === 101 ? "Draft planning notes" : "Review pull request";
}

function handleSyntheticTaskPatch(
  patchCalls: PatchCall[],
  request: IncomingMessage,
  response: ServerResponse
): void {
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk: string) => {
    body += chunk;
  });
  request.on("end", () => {
    const taskId = Number(request.url?.split("/").pop());
    patchCalls.push({ url: request.url, body: JSON.parse(body) as unknown });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      id: taskId,
      title: syntheticTaskTitle(taskId),
      eventCategory: "WORK",
      timeSchemeId: "policy-work"
    }));
  });
}

function createSyntheticTaskUpdateServer(patchCalls: PatchCall[]): Server {
  return createServer((request, response) => {
    if (request.method === "PATCH" && request.url?.startsWith("/api/tasks/")) {
      handleSyntheticTaskPatch(patchCalls, request, response);
      return;
    }
    response.writeHead(404);
    response.end();
  });
}

function expectConfirmedTaskUpdateCliOutput(output: TaskUpdateCliOutput): void {
  expect(output.updatedTasks).toEqual([
    { title: "Draft planning notes", taskId: 101 },
    { title: "Review pull request", taskId: 102 }
  ]);
  expect(output.writeReceipts).toEqual([
    expect.objectContaining({
      operation: "task.update",
      taskId: 101,
      rollbackHint: "Review prior task state before manually reverting Reclaim task 101."
    }),
    expect.objectContaining({
      operation: "task.update",
      taskId: 102,
      rollbackHint: "Review prior task state before manually reverting Reclaim task 102."
    })
  ]);
}

describe("task update previews", () => {
  test("previews synthetic task update payloads without Reclaim credentials", () => {
    const input = parseReclaimTaskUpdatePreviewInput(loadTaskUpdatesFixture());
    const preview = tasks.previewUpdates(input.updates, input.currentTasks);

    expect(preview).toMatchObject({
      updateCount: 2,
      writeSafety: "preview_only",
      previewReceipt: {
        operation: "task.update.preview",
        readinessStatus: "ready_for_confirmed_write"
      }
    });
    expect(preview.previewReceipt.readinessGate).toContain("reclaim:tasks:update");
    expect(preview.updates[0]).toMatchObject({
      taskId: 101,
      request: {
        notes: "Capture decisions and open questions before the weekly review.",
        timeChunksRequired: 4,
        minChunkSize: 1,
        maxChunkSize: 4,
        due: "2026-05-06T18:00:00+02:00"
      },
      changes: expect.arrayContaining([
        {
          field: "due",
          from: "2026-05-06T17:00:00+02:00",
          to: "2026-05-06T18:00:00+02:00"
        }
      ])
    });
    expect(preview.updates[1]?.request).toMatchObject({
      timeChunksRequired: 2,
      minChunkSize: 2,
      maxChunkSize: 2,
      snoozeUntil: "2026-05-07T09:30:00+02:00"
    });
  });

  test("emits task update previews through the CLI", () => {
    const result = runNpmCli([
      "reclaim:tasks:preview-update",
      "--",
      "--input",
      path.join("examples", "task-updates.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      updateCount: number;
      writeSafety: string;
      previewReceipt: { operation: string };
      updates: Array<{ taskId: number; request: { timeChunksRequired?: number } }>;
    };

    expect(output.updateCount).toBe(2);
    expect(output.writeSafety).toBe("preview_only");
    expect(output.previewReceipt.operation).toBe("task.update.preview");
    expect(output.updates.map((update) => update.taskId)).toEqual([101, 102]);
    expect(output.updates[0]?.request.timeChunksRequired).toBe(4);
  });

  test("requires at least one update field and a duration for split changes", () => {
    expect(() => parseReclaimTaskUpdates([{ taskId: 0, title: "Updated synthetic task" }])).toThrow();
    expect(() => parseReclaimTaskUpdates([{ taskId: 101 }])).toThrow();
    expect(() => parseReclaimTaskUpdates([{ taskId: 101, splitAllowed: false }])).toThrow();
  });
});

describe("task update writes", () => {
  test("refuses confirmed task updates without the explicit confirmation flag", async () => {
    const client = createReclaimClient({
      apiUrl: "https://api.app.reclaim.ai/api",
      apiKey: "secret-key",
      timeoutMs: 1000,
      defaultTaskEventCategory: "WORK"
    });

    await expect(tasks.update(client, [{ taskId: 101, title: "Updated synthetic task" }], {
      confirmWrite: false
    })).rejects.toThrow("Refusing to update Reclaim tasks without confirmWrite.");
  });

  test("applies confirmed task updates with write receipts", async () => {
    const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({
          url: String(input),
          method: init?.method,
          body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined
        });
        return new Response(
          JSON.stringify({
            id: 101,
            title: "Updated synthetic task",
            notes: "Updated notes.",
            eventCategory: "WORK",
            timeSchemeId: "policy-work"
          }),
          { status: 200 }
        );
      }) as typeof fetch
    );

    const result = await tasks.update(client, [
      {
        taskId: 101,
        title: "Updated synthetic task",
        notes: "Updated notes.",
        durationMinutes: 45,
        splitAllowed: false
      }
    ], { confirmWrite: true });

    expect(calls).toEqual([
      {
        url: "https://api.app.reclaim.ai/api/tasks/101",
        method: "PATCH",
        body: {
          title: "Updated synthetic task",
          notes: "Updated notes.",
          timeChunksRequired: 3,
          maxChunkSize: 3,
          minChunkSize: 3
        }
      }
    ]);
    expect(result.updatedTasks).toEqual([{ title: "Updated synthetic task", taskId: 101 }]);
    expect(result.writeReceipts[0]).toMatchObject({
      operation: "task.update",
      taskId: 101,
      title: "Updated synthetic task"
    });
    expect(parseTaskWriteReceipts(result)).toEqual(result.writeReceipts);
  });

  test("refuses the task update CLI without the confirmation flag", async () => {
    const configPath = writeSyntheticConfig("http://127.0.0.1:43210");

    const result = await runNpmCliAsync([
      "reclaim:tasks:update",
      "--",
      "--config",
      configPath,
      "--input",
      path.join("examples", "task-updates.example.json")
    ]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("Refusing to update Reclaim tasks without confirmWrite.");
  });

  test("applies confirmed task updates through the CLI against a synthetic API", async () => {
    const patchCalls: PatchCall[] = [];
    const server = createSyntheticTaskUpdateServer(patchCalls);
    const port = await listen(server);
    const configPath = writeSyntheticConfig(`http://127.0.0.1:${port}`);

    try {
      const result = await runNpmCliAsync([
        "reclaim:tasks:update",
        "--",
        "--config",
        configPath,
        "--input",
        path.join("examples", "task-updates.example.json"),
        "--confirm-write"
      ]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(patchCalls).toEqual(EXPECTED_CLI_PATCH_CALLS);
      expectConfirmedTaskUpdateCliOutput(JSON.parse(result.stdout) as TaskUpdateCliOutput);
    } finally {
      server.close();
    }
  });
});
