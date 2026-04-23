import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createReclaimClient,
  parseTaskWriteReceipts,
  tasks,
  type TaskWriteReceipt
} from "../src/index.js";
import {
  listen,
  makeTempDir,
  runNpmCliAsync,
  writeConfigFile
} from "./cli-test-helpers.js";

describe("task write receipt validation", () => {
  test("parses receipt arrays and wrapped writeReceipts objects", () => {
    const receipt: TaskWriteReceipt = {
      operation: "task.create",
      taskId: 41,
      title: "Review pull request",
      confirmedAt: "2026-05-06T08:15:00.000Z",
      rollbackHint: "Delete Reclaim task 41 if this confirmed create should be undone."
    };

    expect(parseTaskWriteReceipts([receipt])).toEqual([receipt]);
    expect(parseTaskWriteReceipts({ writeReceipts: [receipt] })).toEqual([receipt]);
  });

  test("reports missing, mismatched, and still-present remote task states", async () => {
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request) => {
        const url = String(input);
        if (!url.endsWith("/tasks")) {
          return new Response("[]", { status: 200 });
        }
        return new Response(
          JSON.stringify([
            {
              id: 41,
              title: "Review pull request",
              notes: "Check tests.",
              eventCategory: "WORK",
              timeSchemeId: "policy-work"
            },
            {
              id: 42,
              title: "Renamed remote task",
              eventCategory: "WORK",
              timeSchemeId: "policy-work"
            },
            {
              id: 43,
              title: "Lingering duplicate",
              eventCategory: "WORK",
              timeSchemeId: "policy-work"
            }
          ]),
          { status: 200 }
        );
      }) as typeof fetch
    );

    const result = await tasks.validateWriteReceipts(client, [
      {
        operation: "task.create",
        taskId: 41,
        title: "Review pull request",
        confirmedAt: "2026-05-06T08:15:00.000Z",
        rollbackHint: "Delete Reclaim task 41 if this confirmed create should be undone."
      },
      {
        operation: "task.create",
        taskId: 42,
        title: "Original title",
        confirmedAt: "2026-05-06T08:16:00.000Z",
        rollbackHint: "Delete Reclaim task 42 if this confirmed create should be undone."
      },
      {
        operation: "task.create",
        taskId: 99,
        title: "Missing task",
        confirmedAt: "2026-05-06T08:17:00.000Z",
        rollbackHint: "Delete Reclaim task 99 if this confirmed create should be undone."
      },
      {
        operation: "task.delete",
        taskId: 43,
        title: "Lingering duplicate",
        confirmedAt: "2026-05-06T08:18:00.000Z",
        rollbackHint: "Recreate the task from the reviewed input or audit source if deleting Reclaim task 43 was unintended."
      },
      {
        operation: "task.delete",
        taskId: 44,
        title: "Already gone",
        confirmedAt: "2026-05-06T08:19:00.000Z",
        rollbackHint: "Recreate the task from the reviewed input or audit source if deleting Reclaim task 44 was unintended."
      }
    ]);

    expect(result).toMatchObject({
      receiptCount: 5,
      readSafety: "read_only",
      validReceiptCount: 2,
      invalidReceiptCount: 3
    });
    expect(result.receipts).toEqual([
      {
        operation: "task.create",
        taskId: 41,
        title: "Review pull request",
        confirmedAt: "2026-05-06T08:15:00.000Z",
        status: "valid",
        issues: [],
        remoteTask: {
          id: 41,
          title: "Review pull request",
          notes: "Check tests.",
          eventCategory: "WORK",
          timeSchemeId: "policy-work"
        }
      },
      {
        operation: "task.create",
        taskId: 42,
        title: "Original title",
        confirmedAt: "2026-05-06T08:16:00.000Z",
        status: "invalid",
        issues: [
          {
            code: "remote_title_mismatch",
            message:
              "Remote Reclaim task 42 has title \"Renamed remote task\" instead of receipt title \"Original title\"."
          }
        ],
        remoteTask: {
          id: 42,
          title: "Renamed remote task",
          eventCategory: "WORK",
          timeSchemeId: "policy-work"
        }
      },
      {
        operation: "task.create",
        taskId: 99,
        title: "Missing task",
        confirmedAt: "2026-05-06T08:17:00.000Z",
        status: "invalid",
        issues: [
          {
            code: "remote_task_missing",
            message: "Remote state no longer includes Reclaim task 99 for this create receipt."
          }
        ]
      },
      {
        operation: "task.delete",
        taskId: 43,
        title: "Lingering duplicate",
        confirmedAt: "2026-05-06T08:18:00.000Z",
        status: "invalid",
        issues: [
          {
            code: "remote_task_still_present",
            message: "Remote state still includes Reclaim task 43 for this delete receipt."
          }
        ],
        remoteTask: {
          id: 43,
          title: "Lingering duplicate",
          eventCategory: "WORK",
          timeSchemeId: "policy-work"
        }
      },
      {
        operation: "task.delete",
        taskId: 44,
        title: "Already gone",
        confirmedAt: "2026-05-06T08:19:00.000Z",
        status: "valid",
        issues: []
      }
    ]);
  });

  test("validates write receipts through the authenticated read CLI command", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/api/tasks") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify([
          {
            id: 41,
            title: "Review pull request",
            eventCategory: "WORK",
            timeSchemeId: "policy-work"
          },
          {
            id: 43,
            title: "Lingering duplicate",
            eventCategory: "WORK",
            timeSchemeId: "policy-work"
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
    const receiptPath = path.join(repoPath, "receipts.json");
    writeConfigFile(configPath, {
      apiUrl: `http://127.0.0.1:${port}`,
      apiKey: "synthetic-key",
      timeoutMs: 1000,
      defaultTaskEventCategory: "WORK"
    });
    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        writeReceipts: [
          {
            operation: "task.create",
            taskId: 41,
            title: "Review pull request",
            confirmedAt: "2026-05-06T08:15:00.000Z",
            rollbackHint: "Delete Reclaim task 41 if this confirmed create should be undone."
          },
          {
            operation: "task.delete",
            taskId: 43,
            title: "Lingering duplicate",
            confirmedAt: "2026-05-06T08:18:00.000Z",
            rollbackHint: "Recreate the task from the reviewed input or audit source if deleting Reclaim task 43 was unintended."
          }
        ]
      }),
      "utf8"
    );

    try {
      const result = await runNpmCliAsync([
        "reclaim:tasks:validate-write-receipts",
        "--",
        "--config",
        configPath,
        "--input",
        receiptPath
      ]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const output = JSON.parse(result.stdout) as {
        receiptCount: number;
        readSafety: string;
        validReceiptCount: number;
        invalidReceiptCount: number;
        receipts: Array<{ taskId: number; status: string; issues: Array<{ code: string }> }>;
      };
      expect(output).toMatchObject({
        receiptCount: 2,
        readSafety: "read_only",
        validReceiptCount: 1,
        invalidReceiptCount: 1
      });
      expect(output.receipts).toMatchObject([
        { taskId: 41, status: "valid", issues: [] },
        {
          taskId: 43,
          status: "invalid",
          issues: [{ code: "remote_task_still_present" }]
        }
      ]);
    } finally {
      server.close();
    }
  });
});
