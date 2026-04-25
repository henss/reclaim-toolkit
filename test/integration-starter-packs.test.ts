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
  },
  {
    fileName: "agent-ops-week-scenario-pack.example.json",
    expectedTitles: [
      "Triage synthetic inbound opportunity queue",
      "Draft agent-first pricing experiment brief",
      "Prepare concierge workflow dry run",
      "Review onboarding FAQ gaps for public toolkit",
      "Write weekly synthetic agent-ops readout"
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

      expect(parsedTasks).toHaveLength(expectedTitles.length);
      expect(preview.taskCount).toBe(expectedTitles.length);
      expect(preview.tasks.map((task) => task.title)).toEqual(expectedTitles);
      expect(preview.inputDuplicatePlan).toEqual({
        duplicateGroupCount: 0,
        duplicateGroups: []
      });
      expect(preview.tasks.every((task) => task.request.alwaysPrivate)).toBe(true);

      if (personalTitle) {
        expect(preview.tasks.find((task) => task.title === personalTitle)?.request.eventCategory).toBe("PERSONAL");
      }
    }
  );

  test.each(starterPackCases)(
    "supports CLI preview for $fileName",
    ({ fileName, expectedTitles }) => {
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
        inputDuplicatePlan: { duplicateGroupCount: number };
        tasks: Array<{ title: string; request: { timeSchemeId: string } }>;
      };
      expect(output.taskCount).toBe(expectedTitles.length);
      expect(output.tasks).toHaveLength(expectedTitles.length);
      expect(output.inputDuplicatePlan.duplicateGroupCount).toBe(0);
      expect(output.tasks.every((task) => task.request.timeSchemeId === "TASK_ASSIGNMENT_TIME_SCHEME_ID_REQUIRED")).toBe(
        true
      );
    }
  );
});
