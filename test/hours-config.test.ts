import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createHoursConfigDiffDigest,
  createReclaimClient,
  hoursConfig,
  parseReclaimHoursConfigDiffInput,
  parseReclaimHoursConfigSnapshot
} from "../src/index.js";
import { listen, makeTempDir, runNpmCli, runNpmCliAsync, writeConfigFile } from "./cli-test-helpers.js";

describe("hours config audit", () => {
  test("parses and inspects the synthetic hours-config fixture", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "hours-config.example.json"), "utf8")
    ) as unknown;

    const snapshot = parseReclaimHoursConfigSnapshot(raw);
    const inspection = hoursConfig.inspectSnapshot(snapshot);

    expect(inspection).toMatchObject({
      hourPolicyCount: 3,
      taskAssignmentPolicyCount: 2,
      availabilityPolicyCount: 2,
      totalWindowCount: 3,
      windowedHourPolicyCount: 2,
      policyWithoutWindowsCount: 1,
      timezoneCount: 1,
      readSafety: "read_only"
    });
    expect(inspection.taskCategoryBreakdown).toEqual([
      { label: "PERSONAL", count: 1 },
      { label: "WORK", count: 2 }
    ]);
    expect(inspection.weekdayCoverage).toEqual([
      { label: "monday", count: 1 },
      { label: "tuesday", count: 1 },
      { label: "wednesday", count: 1 }
    ]);
  });

  test("emits parseable JSON for the local preview audit command", () => {
    const result = runNpmCli([
      "reclaim:hours-config:preview-audit",
      "--",
      "--input",
      path.join("examples", "hours-config.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      hourPolicyCount: number;
      totalWindowCount: number;
      readSafety: string;
      timeSchemes?: unknown;
    };
    expect(output).toMatchObject({
      hourPolicyCount: 3,
      totalWindowCount: 3,
      readSafety: "read_only"
    });
    expect(output.timeSchemes).toBeUndefined();
  });

  test("classifies drift between two synthetic hours-config snapshots using source handles only", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "hours-config-diff.example.json"), "utf8")
    ) as unknown;

    const digest = createHoursConfigDiffDigest(parseReclaimHoursConfigDiffInput(raw));

    expect(digest).toMatchObject({
      sourceHandles: {
        baseline: "hours-config-baseline-v1",
        current: "hours-config-current-v2"
      },
      overallChangeClass: "mixed_drift",
      changedSignalCount: 7,
      driftBandCounts: {
        incremental: 7,
        material: 0
      },
      readSafety: "read_only"
    });
    expect(digest.metricChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "hourPolicyCount",
          group: "coverage",
          baseline: 2,
          current: 3,
          delta: 1
        }),
        expect.objectContaining({
          metric: "policyWithoutWindowsCount",
          group: "windowing",
          baseline: 0,
          current: 1,
          delta: 1
        }),
        expect.objectContaining({
          metric: "weekdayCoverage:thursday",
          group: "windowing",
          baseline: 0,
          current: 1,
          delta: 1
        })
      ])
    );
  });

  test("emits parseable JSON for the local preview diff command without leaking policy detail", () => {
    const result = runNpmCli([
      "reclaim:hours-config:preview-diff",
      "--",
      "--input",
      path.join("examples", "hours-config-diff.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      overallChangeClass: string;
      changedSignalCount: number;
      sourceHandles: { baseline: string; current: string };
      summary: string;
    };
    expect(output).toMatchObject({
      overallChangeClass: "mixed_drift",
      changedSignalCount: 7,
      sourceHandles: {
        baseline: "hours-config-baseline-v1",
        current: "hours-config-current-v2"
      }
    });
    expect(output.summary).toContain("hours-config-baseline-v1");
    expect(result.stdout).not.toContain("Work Hours");
    expect(result.stdout).not.toContain("policy-work");
  });

  test("summarizes authenticated hours-config reads without returning policy titles or ids", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/api/timeschemes") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify([
          {
            id: "policy-private-1",
            title: "Private Work Hours",
            taskCategory: "WORK",
            timezone: "Europe/Berlin",
            features: ["TASK_ASSIGNMENT", "AVAILABILITY"],
            windows: [
              { dayOfWeek: "monday", start: "09:00", end: "17:00" },
              { dayOfWeek: "tuesday", start: "09:00", end: "17:00" }
            ]
          },
          {
            id: "policy-private-2",
            title: "Quiet Hours",
            taskCategory: "PERSONAL",
            features: ["TASK_ASSIGNMENT"],
            windows: []
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
    writeConfigFile(configPath, {
      apiUrl: `http://127.0.0.1:${port}`,
      apiKey: "synthetic-key",
      timeoutMs: 1000,
      defaultTaskEventCategory: "WORK"
    });

    try {
      const result = await runNpmCliAsync(["reclaim:hours-config:audit", "--", "--config", configPath]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const output = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(output).toMatchObject({
        hourPolicyCount: 2,
        taskAssignmentPolicyCount: 2,
        availabilityPolicyCount: 1,
        totalWindowCount: 2,
        policyWithoutWindowsCount: 1,
        readSafety: "read_only"
      });
      expect(result.stdout).not.toContain("Private Work Hours");
      expect(result.stdout).not.toContain("Quiet Hours");
      expect(result.stdout).not.toContain("policy-private-1");
      expect(result.stdout).not.toContain("policy-private-2");
    } finally {
      server.close();
    }
  });

  test("reads the hours-config audit through the client surface", async () => {
    const calls: string[] = [];
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request) => {
        calls.push(String(input));
        return new Response(JSON.stringify([
          {
            id: "policy-work",
            title: "Work Hours",
            taskCategory: "WORK",
            timezone: "Europe/Berlin",
            features: ["TASK_ASSIGNMENT"],
            windows: [{ dayOfWeek: "monday", start: "09:00", end: "17:00" }]
          }
        ]), { status: 200 });
      }) as typeof fetch
    );

    const inspection = await hoursConfig.audit(client);

    expect(calls).toEqual(["https://api.app.reclaim.ai/api/timeschemes"]);
    expect(inspection).toMatchObject({
      hourPolicyCount: 1,
      taskAssignmentPolicyCount: 1,
      totalWindowCount: 1,
      readSafety: "read_only"
    });
  });
});
