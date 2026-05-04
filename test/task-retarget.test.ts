import fs from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createReclaimClient,
  parseReclaimTaskRetargetInput,
  parseReclaimTaskRetargetPreviewInput,
  tasks
} from "../src/index.js";
import {
  listen,
  makeTempDir,
  runNpmCli,
  runNpmCliAsync,
  writeConfigFile
} from "./cli-test-helpers.js";

interface PatchCall {
  url: string | undefined;
  body: unknown;
}

interface TaskRetargetCliOutput {
  retargetDeltaMs: number;
  updates: Array<{ taskId: number; due?: string; startAfter?: string; notes?: string }>;
  updatedTasks: Array<{ title: string; taskId: number }>;
}

function loadTaskRetargetFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "task-retarget.example.json"), "utf8")
  ) as unknown;
}

function writeSyntheticConfig(apiUrl: string): string {
  const repoPath = makeTempDir();
  const configPath = path.join(repoPath, "config", "reclaim.local.json");
  writeConfigFile(configPath, {
    apiUrl,
    apiKey: "synthetic-key",
    timeoutMs: 1000,
    defaultTaskEventCategory: "PERSONAL"
  });
  return configPath;
}

function syntheticTasks(): Array<Record<string, unknown>> {
  return [
    {
      id: 201,
      title: "Prepare long-cook meal",
      notes: "Original target 2026-05-03.",
      eventCategory: "PERSONAL",
      timeSchemeId: "policy-personal",
      due: "2026-05-04T12:00:00.000Z",
      snoozeUntil: "2026-05-03T10:00:00.000Z"
    },
    {
      id: 202,
      title: "Check ingredients",
      notes: "Confirm pantry before 2026-05-03.",
      eventCategory: "PERSONAL",
      timeSchemeId: "policy-personal",
      due: "2026-05-03T18:00:00.000Z"
    }
  ];
}

function syntheticTaskTitle(taskId: number): string {
  return taskId === 201 ? "Prepare long-cook meal" : "Check ingredients";
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
      eventCategory: "PERSONAL",
      timeSchemeId: "policy-personal"
    }));
  });
}

function createSyntheticTaskRetargetServer(patchCalls: PatchCall[]): Server {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/api/tasks") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ tasks: syntheticTasks() }));
      return;
    }
    if (request.method === "PATCH" && request.url?.startsWith("/api/tasks/")) {
      handleSyntheticTaskPatch(patchCalls, request, response);
      return;
    }
    response.writeHead(404);
    response.end();
  });
}

describe("task retarget previews", () => {
  test("previews date-shifted update payloads from a synthetic task snapshot", () => {
    const input = parseReclaimTaskRetargetPreviewInput(loadTaskRetargetFixture());
    const preview = tasks.previewRetarget(input);

    expect(preview).toMatchObject({
      taskIds: [201, 202],
      retargetDeltaMs: 604800000,
      updateCount: 2,
      writeSafety: "preview_only",
      previewReceipt: {
        operation: "task.retarget.preview",
        readinessStatus: "ready_for_confirmed_write"
      }
    });
    expect(preview.previewReceipt.readinessGate).toContain("reclaim:tasks:retarget");
    expect(preview.updates).toEqual([
      {
        taskId: 201,
        due: "2026-05-11T12:00:00.000Z",
        startAfter: "2026-05-10T10:00:00.000Z",
        notes: "Original target 2026-05-10."
      },
      {
        taskId: 202,
        due: "2026-05-10T18:00:00.000Z",
        notes: "Confirm pantry before 2026-05-10."
      }
    ]);
    expect(preview.previewUpdates[0]?.request).toMatchObject({
      due: "2026-05-11T12:00:00.000Z",
      snoozeUntil: "2026-05-10T10:00:00.000Z"
    });
  });

  test("emits task retarget previews through the CLI", () => {
    const result = runNpmCli([
      "reclaim:tasks:preview-retarget",
      "--",
      "--input",
      path.join("examples", "task-retarget.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      updateCount: number;
      writeSafety: string;
      previewReceipt: { operation: string };
      previewUpdates: Array<{ taskId: number; request: { snoozeUntil?: string } }>;
    };

    expect(output.updateCount).toBe(2);
    expect(output.writeSafety).toBe("preview_only");
    expect(output.previewReceipt.operation).toBe("task.retarget.preview");
    expect(output.previewUpdates[0]?.request.snoozeUntil).toBe("2026-05-10T10:00:00.000Z");
  });

  test("requires valid anchors and matching current task snapshots", () => {
    expect(() => parseReclaimTaskRetargetInput({
      taskIds: [],
      sourceAnchor: "2026-05-03T00:00:00.000Z",
      targetAnchor: "2026-05-10T00:00:00.000Z"
    })).toThrow();
    expect(() => tasks.previewRetarget({
      taskIds: [999],
      sourceAnchor: "invalid",
      targetAnchor: "2026-05-10T00:00:00.000Z",
      noteReplacements: [],
      currentTasks: []
    })).toThrow("Invalid sourceAnchor date-time");
    expect(() => tasks.previewRetarget({
      taskIds: [999],
      sourceAnchor: "2026-05-03T00:00:00.000Z",
      targetAnchor: "2026-05-10T00:00:00.000Z",
      noteReplacements: [],
      currentTasks: []
    })).toThrow("current task snapshot is missing");
  });
});

describe("task retarget writes", () => {
  test("refuses task retarget writes without the explicit confirmation flag", async () => {
    const client = createReclaimClient({
      apiUrl: "https://api.app.reclaim.ai/api",
      apiKey: "secret-key",
      timeoutMs: 1000,
      defaultTaskEventCategory: "PERSONAL"
    });

    await expect(tasks.retarget(client, parseReclaimTaskRetargetInput(loadTaskRetargetFixture()), {
      confirmWrite: false
    })).rejects.toThrow("Refusing to retarget Reclaim tasks without confirmWrite.");
  });

  test("applies confirmed task retargets through the CLI against a synthetic API", async () => {
    const patchCalls: PatchCall[] = [];
    const server = createSyntheticTaskRetargetServer(patchCalls);
    const port = await listen(server);
    const configPath = writeSyntheticConfig(`http://127.0.0.1:${port}`);

    try {
      const result = await runNpmCliAsync([
        "reclaim:tasks:retarget",
        "--",
        "--config",
        configPath,
        "--input",
        path.join("examples", "task-retarget.example.json"),
        "--confirm-write"
      ]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(patchCalls).toEqual([
        {
          url: "/api/tasks/201",
          body: {
            notes: "Original target 2026-05-10.",
            due: "2026-05-11T12:00:00.000Z",
            snoozeUntil: "2026-05-10T10:00:00.000Z"
          }
        },
        {
          url: "/api/tasks/202",
          body: {
            notes: "Confirm pantry before 2026-05-10.",
            due: "2026-05-10T18:00:00.000Z"
          }
        }
      ]);

      const output = JSON.parse(result.stdout) as TaskRetargetCliOutput;
      expect(output.retargetDeltaMs).toBe(604800000);
      expect(output.updatedTasks).toEqual([
        { title: "Prepare long-cook meal", taskId: 201 },
        { title: "Check ingredients", taskId: 202 }
      ]);
    } finally {
      server.close();
    }
  });
});
