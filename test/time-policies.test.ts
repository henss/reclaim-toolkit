import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  explainTimePolicyConflicts,
  parseReclaimTimePolicyExplainerInput
} from "../src/time-policies.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "reclaim-toolkit-time-policies-"));
}

function runNpmCli(args: string[]): SpawnSyncReturns<string> {
  if (process.platform === "win32") {
    return spawnSync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", ["npm", "run", "--silent", ...args].join(" ")],
      {
        cwd: process.cwd(),
        encoding: "utf8"
      }
    );
  }

  return spawnSync("npm", ["run", "--silent", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

describe("time policy conflict explainer", () => {
  test("explains fit and conflict outcomes from synthetic policy windows", () => {
    const result = explainTimePolicyConflicts(parseReclaimTimePolicyExplainerInput({
      defaultTaskEventCategory: "WORK",
      preferredTimePolicyTitle: "Deep Work",
      timeSchemes: [
        {
          id: "policy-work",
          title: "Deep Work",
          taskCategory: "WORK",
          features: ["TASK_ASSIGNMENT"],
          windows: [{ dayOfWeek: "monday", start: "09:00", end: "12:00" }]
        },
        {
          id: "policy-personal",
          title: "Personal Hours",
          taskCategory: "PERSONAL",
          features: ["TASK_ASSIGNMENT"],
          windows: [{ dayOfWeek: "monday", start: "13:00", end: "16:00" }]
        }
      ],
      tasks: [
        {
          title: "Draft launch checklist",
          durationMinutes: 90,
          startAfter: "2026-05-11T09:00:00.000Z",
          due: "2026-05-11T12:00:00.000Z"
        },
        {
          title: "Review admin forms",
          durationMinutes: 120,
          timeSchemeId: "policy-personal",
          eventCategory: "WORK",
          startAfter: "2026-05-11T13:00:00.000Z",
          due: "2026-05-11T15:00:00.000Z"
        }
      ]
    }));

    expect(result).toMatchObject({
      taskCount: 2,
      policyCount: 2,
      readSafety: "read_only"
    });
    expect(result.tasks[0]).toMatchObject({
      title: "Draft launch checklist",
      status: "fit",
      requiredMinutes: 90,
      availablePolicyMinutes: 180,
      selectionReason: 'Matched preferred Reclaim time policy title "Deep Work".'
    });
    expect(result.tasks[0]?.explanation).toContain("180 minute(s)");
    expect(result.tasks[1]).toMatchObject({
      title: "Review admin forms",
      status: "conflict",
      selectionReason: "Task input requested explicit Reclaim time policy id policy-personal."
    });
    expect(result.tasks[1]?.conflicts).toContain(
      "Selected policy category PERSONAL does not match task event category WORK."
    );
  });

  test("reports explicit missing policy ids as conflicts", () => {
    const result = explainTimePolicyConflicts(parseReclaimTimePolicyExplainerInput({
      defaultTaskEventCategory: "WORK",
      timeSchemes: [],
      tasks: [
        {
          title: "Missing policy check",
          durationMinutes: 30,
          timeSchemeId: "policy-missing"
        }
      ]
    }));

    expect(result.tasks[0]).toMatchObject({
      status: "conflict",
      selectionReason: "Task input requested explicit Reclaim time policy id policy-missing, but it was not found."
    });
    expect(result.tasks[0]?.conflicts).toContain(
      "No matching Reclaim task-assignment time policy was available for this task."
    );
  });

  test("emits parseable JSON for the synthetic preview CLI command", () => {
    const repoPath = makeTempDir();
    const inputPath = path.join(repoPath, "time-policy-conflicts.json");
    fs.writeFileSync(
      inputPath,
      JSON.stringify({
        defaultTaskEventCategory: "WORK",
        preferredTimePolicyId: "policy-work",
        timeSchemes: [
          {
            id: "policy-work",
            title: "Work Hours",
            taskCategory: "WORK",
            features: ["TASK_ASSIGNMENT"],
            windows: [{ dayOfWeek: "monday", start: "09:00", end: "10:00" }]
          }
        ],
        tasks: [
          {
            title: "Short planning pass",
            durationMinutes: 30,
            startAfter: "2026-05-11T09:00:00.000Z",
            due: "2026-05-11T10:00:00.000Z"
          }
        ]
      }, null, 2),
      "utf8"
    );

    const result = runNpmCli([
      "reclaim:time-policies:explain-conflicts",
      "--",
      "--input",
      inputPath
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      readSafety: string;
      tasks: Array<{
        title: string;
        status: string;
        availablePolicyMinutes?: number;
        selectionReason: string;
      }>;
    };
    expect(output.readSafety).toBe("read_only");
    expect(output.tasks).toHaveLength(1);
    expect(output.tasks[0]).toMatchObject({
      title: "Short planning pass",
      status: "fit",
      availablePolicyMinutes: 60,
      selectionReason: "Matched preferred Reclaim time policy id policy-work."
    });
  });
});
