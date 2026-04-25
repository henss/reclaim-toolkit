import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  parseReclaimTaskInputs,
  parseReclaimTaskPreviewInput,
  tasks
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

function loadTasksFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "tasks.example.json"), "utf8")
  ) as unknown;
}

function expectTaskTimePolicyExplanations(
  tasksWithPolicyExplanation: Array<{
    title: string;
    timePolicyExplanation?: {
      title: string;
      status: string;
      selectedPolicy?: { id: string; title?: string };
      selectionReason: string;
      availablePolicyMinutes?: number;
    };
  }>
): void {
  expect(tasksWithPolicyExplanation[0]?.timePolicyExplanation).toMatchObject({
    title: "Draft planning notes",
    status: "fit",
    selectedPolicy: {
      id: "policy-work",
      title: "Work Hours"
    },
    selectionReason: 'Matched preferred Reclaim time policy title "Work Hours".',
    availablePolicyMinutes: 360
  });
  expect(tasksWithPolicyExplanation[1]?.timePolicyExplanation).toMatchObject({
    title: "Review pull request",
    status: "fit",
    selectedPolicy: {
      id: "policy-work"
    },
    selectionReason: 'Matched preferred Reclaim time policy title "Work Hours".'
  });
}

describe("task preview receipt", () => {
  test("adds a stable preview receipt to task previews", () => {
    const raw = loadTasksFixture();
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
      tasks: Array<{
        title: string;
        timePolicyExplanation?: {
          title: string;
          status: string;
          selectedPolicy?: { id: string; title?: string };
          selectionReason: string;
          availablePolicyMinutes?: number;
        };
      }>;
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
    expectTaskTimePolicyExplanations(output.tasks);
  });
});

describe("task preview duplicate and fixture handling", () => {
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

  test("adds task time-policy explanations when preview input includes synthetic policy context", () => {
    const previewInput = parseReclaimTaskPreviewInput(loadTasksFixture());
    const preview = tasks.previewCreates(previewInput.tasks, {
      timePolicyContext: {
        timeSchemes: previewInput.timeSchemes,
        defaultTaskEventCategory: previewInput.defaultTaskEventCategory ?? "PERSONAL",
        preferredTimePolicyId: previewInput.preferredTimePolicyId,
        preferredTimePolicyTitle: previewInput.preferredTimePolicyTitle
      }
    });

    expectTaskTimePolicyExplanations(preview.tasks);
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
