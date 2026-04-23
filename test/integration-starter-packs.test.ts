import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { parseReclaimTaskInputs, tasks } from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

type StarterPackCase = {
  fileName: string;
  expectedTitles: readonly string[];
  personalTitle?: string;
};

const starterPackCases: readonly StarterPackCase[] = [
  {
    fileName: "todoist-starter-pack.example.json",
    expectedTitles: [
      "Review sprint handoff checklist",
      "Draft release follow-up notes",
      "Prepare personal admin reminder"
    ],
    personalTitle: "Prepare personal admin reminder"
  },
  {
    fileName: "linear-starter-pack.example.json",
    expectedTitles: [
      "Prototype dashboard summary panel",
      "Write QA handoff notes for preview flow",
      "Triage onboarding copy polish follow-ups"
    ]
  },
  {
    fileName: "github-starter-pack.example.json",
    expectedTitles: [
      "Review preview contract pull request",
      "Investigate failing export smoke test",
      "Draft release note summary from merged changes"
    ]
  }
] as const;

describe("integration starter packs", () => {
  test.each(starterPackCases)(
    "parses and previews $fileName",
    ({ fileName, expectedTitles, personalTitle }) => {
      const examplePath = path.join(process.cwd(), "examples", fileName);
      const raw = JSON.parse(fs.readFileSync(examplePath, "utf8")) as unknown;

      const parsedTasks = parseReclaimTaskInputs(raw);
      const preview = tasks.previewCreates(parsedTasks, {
      timeSchemeId: "policy-work",
      eventCategory: "WORK"
    });

    expect(parsedTasks).toHaveLength(3);
    expect(preview.taskCount).toBe(3);
    expect(preview.tasks.map((task) => task.title)).toEqual(expectedTitles);
    expect(preview.tasks.every((task) => task.request.alwaysPrivate)).toBe(true);

    if (personalTitle) {
      expect(preview.tasks.find((task) => task.title === personalTitle)?.request.eventCategory).toBe("PERSONAL");
    }
    }
  );

  test.each(starterPackCases)(
    "supports CLI preview for $fileName",
    ({ fileName }) => {
      const result = runNpmCli([
        "reclaim:tasks:preview-create",
        "--",
        "--input",
        path.join("examples", fileName)
      ]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const output = JSON.parse(result.stdout) as {
        taskCount: number;
        tasks: Array<{ title: string; request: { timeSchemeId: string } }>;
      };
      expect(output.taskCount).toBe(3);
      expect(output.tasks).toHaveLength(3);
      expect(output.tasks.every((task) => task.request.timeSchemeId === "TASK_ASSIGNMENT_TIME_SCHEME_ID_REQUIRED")).toBe(
        true
      );
    }
  );
});
