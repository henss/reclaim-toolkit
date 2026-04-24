import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { parseReclaimTaskInputs, tasks } from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

describe("event prep block example pack", () => {
  test("parses and previews the synthetic fixture", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "event-prep-block-example-pack.example.json"), "utf8")
    ) as unknown;

    const parsedTasks = parseReclaimTaskInputs(raw);
    const preview = tasks.previewCreates(parsedTasks, {
      timeSchemeId: "policy-work",
      eventCategory: "WORK"
    });

    expect(parsedTasks).toHaveLength(5);
    expect(preview.taskCount).toBe(5);
    expect(preview.tasks.map((task) => task.title)).toEqual([
      "Finalize placeholder guest visit run-of-show",
      "Prepare venue-ready signage checklist",
      "Reset demo environment for guest walkthrough",
      "Draft host handoff notes for visit day",
      "Prepare post-visit follow-up summary shell"
    ]);
    expect(preview.tasks.every((task) => task.request.eventCategory === "WORK")).toBe(true);
    expect(preview.tasks.every((task) => task.request.alwaysPrivate)).toBe(true);
    expect(preview.tasks.find((task) => task.title === "Reset demo environment for guest walkthrough")?.request)
      .toMatchObject({
        timeChunksRequired: 5,
        minChunkSize: 1,
        maxChunkSize: 5,
        snoozeUntil: "2026-05-27T08:00:00+02:00"
      });
  });

  test("supports CLI preview", () => {
    const result = runNpmCli([
      "reclaim:tasks:preview-create",
      "--",
      "--input",
      path.join("examples", "event-prep-block-example-pack.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      taskCount: number;
      tasks: Array<{ title: string; request: { timeSchemeId: string } }>;
    };
    expect(output.taskCount).toBe(5);
    expect(output.tasks).toHaveLength(5);
    expect(output.tasks.every((task) => task.request.timeSchemeId === "TASK_ASSIGNMENT_TIME_SCHEME_ID_REQUIRED")).toBe(
      true
    );
  });
});
