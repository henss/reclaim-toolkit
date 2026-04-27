import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createReclaimClient,
  parseReclaimTaskUpdatePreviewInput,
  parseReclaimTaskUpdates,
  parseTaskWriteReceipts,
  tasks
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

function loadTaskUpdatesFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "task-updates.example.json"), "utf8")
  ) as unknown;
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
});
