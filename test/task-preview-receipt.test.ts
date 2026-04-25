import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { parseReclaimTaskInputs, tasks } from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

describe("task preview receipt", () => {
  test("adds a stable preview receipt to task previews", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "tasks.example.json"), "utf8")
    ) as unknown;

    const preview = tasks.previewCreates(parseReclaimTaskInputs(raw));

    expect(preview.taskCount).toBe(2);
    expect(preview.inputDuplicatePlan).toEqual({
      duplicateGroupCount: 0,
      duplicateGroups: []
    });
    expect(preview.previewReceipt).toMatchObject({
      operation: "task.preview",
      readinessStatus: "ready_for_confirmed_write"
    });
    expect(preview.previewReceipt.readinessGate).toContain("reclaim:tasks:create");
    expect(Date.parse(preview.previewReceipt.previewGeneratedAt)).not.toBeNaN();
  });

  test("emits the preview receipt through the task preview CLI", () => {
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
      inputDuplicatePlan: { duplicateGroupCount: number };
      previewReceipt: {
        operation: string;
        readinessStatus: string;
        previewGeneratedAt: string;
      };
    };
    expect(output.taskCount).toBe(2);
    expect(output.inputDuplicatePlan.duplicateGroupCount).toBe(0);
    expect(output.previewReceipt.operation).toBe("task.preview");
    expect(output.previewReceipt.readinessStatus).toBe("ready_for_confirmed_write");
    expect(Date.parse(output.previewReceipt.previewGeneratedAt)).not.toBeNaN();
  });

  test("flags duplicate imported inputs before confirmed writes", () => {
    const preview = tasks.previewCreates(
      [
        {
          title: "Review preview contract pull request",
          notes: "Synthetic GitHub pull request transformed into Reclaim input.",
          durationMinutes: 40,
          due: "2026-05-19T13:00:00+02:00",
          eventCategory: "WORK",
          splitAllowed: false
        },
        {
          title: "Review preview contract pull request",
          notes: "Synthetic GitHub pull request transformed into Reclaim input.",
          durationMinutes: 40,
          due: "2026-05-19T11:00:00.000Z",
          eventCategory: "WORK",
          splitAllowed: false
        }
      ],
      { timeSchemeId: "policy-work", eventCategory: "WORK" }
    );

    expect(preview.inputDuplicatePlan).toEqual({
      duplicateGroupCount: 1,
      duplicateGroups: [
        {
          title: "Review preview contract pull request",
          firstInputIndex: 0,
          duplicateInputIndexes: [1]
        }
      ]
    });
    expect(preview.previewReceipt.readinessStatus).toBe("evidence_pending");
    expect(preview.previewReceipt.readinessGate).toContain("duplicate input group");
  });

  test("preserves synthetic errand windows in the shopping preview fixture", () => {
    const result = runNpmCli([
      "reclaim:tasks:preview-create",
      "--",
      "--input",
      path.join("examples", "shopping-errand-windows.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      taskCount: number;
      tasks: Array<{
        title: string;
        request: {
          eventCategory: string;
          due?: string;
          snoozeUntil?: string;
          minChunkSize: number;
          maxChunkSize: number;
        };
      }>;
    };

    expect(output.taskCount).toBe(4);
    expect(output.tasks.map((task) => task.title)).toEqual([
      "Review synthetic shopping options",
      "Complete placeholder pickup errand",
      "Return a generic item",
      "Restock planning follow-up"
    ]);
    expect(output.tasks.every((task) => task.request.eventCategory === "PERSONAL")).toBe(true);
    expect(output.tasks[0]?.request.snoozeUntil).toBe("2026-05-18T10:30:00+02:00");
    expect(output.tasks[1]?.request.due).toBe("2026-05-18T14:00:00+02:00");
    expect(output.tasks[1]?.request.minChunkSize).toBe(output.tasks[1]?.request.maxChunkSize);
    expect(output.tasks[3]?.request.minChunkSize).toBe(1);
  });
});
