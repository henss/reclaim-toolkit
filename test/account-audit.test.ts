import { createServer, type Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  accountAudit,
  createAccountAuditDriftDigest,
  createReclaimClient,
  parseReclaimAccountAuditDriftInput,
  parseReclaimAccountAuditSnapshot
} from "../src/index.js";
import {
  listen,
  makeTempDir,
  runNpmCli,
  runNpmCliAsync,
  writeConfigFile
} from "./cli-test-helpers.js";

describe("account audit snapshot", () => {
  test("parses and inspects the synthetic account audit fixture", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "account-audit.example.json"), "utf8")
    ) as unknown;

    const snapshot = parseReclaimAccountAuditSnapshot(raw);
    const inspection = accountAudit.inspectSnapshot(snapshot);

    expect(inspection).toMatchObject({
      identity: {
        authenticated: true,
        hasDisplayName: true
      },
      taskCount: 2,
      dueTaskCount: 1,
      snoozedTaskCount: 1,
      meetingCount: 2,
      meetingsWithAttendeesCount: 1,
      totalMeetingDurationMinutes: 75,
      hourPolicyCount: 2,
      taskAssignmentPolicyCount: 2,
      windowedHourPolicyCount: 2,
      timezoneCount: 1,
      readSafety: "read_only"
    });
    expect(inspection.taskCategoryBreakdown).toEqual([
      { label: "PERSONAL", count: 1 },
      { label: "WORK", count: 1 }
    ]);
    expect(inspection.timeSchemeFeatureCoverage).toEqual([
      { label: "AVAILABILITY", count: 1 },
      { label: "TASK_ASSIGNMENT", count: 2 }
    ]);
  });

  test("emits parseable JSON for the local preview audit command", () => {
    const result = runNpmCli([
      "reclaim:account-audit:preview-inspect",
      "--",
      "--input",
      path.join("examples", "account-audit.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      identity: { authenticated: boolean };
      taskCount: number;
      meetingCount: number;
      readSafety: string;
      tasks?: unknown;
      meetings?: unknown;
    };
    expect(output).toMatchObject({
      identity: { authenticated: true },
      taskCount: 2,
      meetingCount: 2,
      readSafety: "read_only"
    });
    expect(output.tasks).toBeUndefined();
    expect(output.meetings).toBeUndefined();
  });

  test("classifies drift between two synthetic account audit snapshots using source handles only", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "account-audit-drift.example.json"), "utf8")
    ) as unknown;

    const digest = createAccountAuditDriftDigest(parseReclaimAccountAuditDriftInput(raw));

    expect(digest).toMatchObject({
      sourceHandles: {
        baseline: "account-audit-baseline-v1",
        current: "account-audit-current-v2"
      },
      overallChangeClass: "mixed_drift",
      changedSignalCount: 12,
      driftBandCounts: {
        incremental: 11,
        material: 1
      },
      readSafety: "read_only"
    });
    expect(digest.summary).toContain("mixed_drift");
    expect(digest.metricChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "taskCount",
          group: "activity",
          baseline: 2,
          current: 3,
          delta: 1,
          driftBand: "incremental"
        }),
        expect.objectContaining({
          metric: "totalMeetingDurationMinutes",
          group: "activity",
          baseline: 75,
          current: 120,
          delta: 45,
          driftBand: "material"
        }),
        expect.objectContaining({
          metric: "hourPolicyCount",
          group: "coverage",
          baseline: 2,
          current: 3,
          delta: 1,
          driftBand: "incremental"
        }),
        expect.objectContaining({
          metric: "timeSchemeFeature:FOCUS_PROTECTION",
          group: "coverage",
          baseline: 0,
          current: 1,
          delta: 1,
          driftBand: "incremental"
        })
      ])
    );
  });

  test("emits parseable JSON for the local preview drift command without leaking snapshot detail", () => {
    const result = runNpmCli([
      "reclaim:account-audit:preview-drift",
      "--",
      "--input",
      path.join("examples", "account-audit-drift.example.json")
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
      changedSignalCount: 12,
      sourceHandles: {
        baseline: "account-audit-baseline-v1",
        current: "account-audit-current-v2"
      }
    });
    expect(output.summary).toContain("account-audit-baseline-v1");
    expect(result.stdout).not.toContain("Review budget note");
    expect(result.stdout).not.toContain("meeting-demo-3");
    expect(result.stdout).not.toContain("demo.user@example.com");
  });

  test("drops finance-sensitive snapshot extras from the drift digest", () => {
    const digest = createAccountAuditDriftDigest(parseReclaimAccountAuditDriftInput({
      baseline: {
        handle: "finance-baseline",
        snapshot: {
          currentUser: {
            id: "user-1",
            email: "person@example.com",
            name: "Demo User"
          },
          tasks: [],
          meetings: [],
          timeSchemes: [],
          balanceCents: 152500,
          accountIdentifier: "acct-private-1",
          recentTransactions: [
            {
              id: "txn-1",
              amountCents: -2500,
              memo: "Card statement"
            }
          ]
        }
      },
      current: {
        handle: "finance-current",
        snapshot: {
          currentUser: {
            id: "user-1",
            email: "person@example.com",
            name: "Demo User"
          },
          tasks: [
            {
              id: 11,
              title: "Synthetic task",
              eventCategory: "WORK",
              timeSchemeId: "policy-work"
            }
          ],
          meetings: [],
          timeSchemes: [],
          balanceCents: 98000,
          accountIdentifier: "acct-private-2",
          recentTransactions: [
            {
              id: "txn-2",
              amountCents: -54500,
              memo: "Wire transfer"
            }
          ]
        }
      }
    }));

    const output = JSON.stringify(digest);

    expect(digest).toMatchObject({
      sourceHandles: {
        baseline: "finance-baseline",
        current: "finance-current"
      },
      overallChangeClass: "activity_drift",
      changedSignalCount: 2,
      readSafety: "read_only"
    });
    expect(output).not.toContain("balanceCents");
    expect(output).not.toContain("accountIdentifier");
    expect(output).not.toContain("recentTransactions");
    expect(output).not.toContain("txn-1");
    expect(output).not.toContain("txn-2");
    expect(output).not.toContain("152500");
    expect(output).not.toContain("98000");
  });

  test("summarizes authenticated account reads without returning private titles or ids", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/api/users/current") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          id: "user-private-1",
          email: "private.person@example.com",
          name: "Private Person"
        }));
        return;
      }

      if (request.url === "/api/tasks") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify([
          {
            id: 11,
            title: "Sensitive planning title",
            eventCategory: "WORK",
            timeSchemeId: "policy-work",
            due: "2026-05-06T15:00:00.000Z"
          },
          {
            id: 12,
            title: "Private admin title",
            eventCategory: "PERSONAL",
            timeSchemeId: "policy-personal",
            snoozeUntil: "2026-05-06T07:00:00.000Z"
          }
        ]));
        return;
      }

      if (request.url === "/api/meetings") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify([
          {
            id: "meeting-private-1",
            title: "Private meeting title",
            start: "2026-05-06T10:00:00.000Z",
            end: "2026-05-06T10:30:00.000Z",
            attendeeCount: 2
          }
        ]));
        return;
      }

      if (request.url === "/api/timeschemes") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify([
          {
            id: "policy-work",
            title: "Work Hours",
            taskCategory: "WORK",
            timezone: "Europe/Berlin",
            features: ["TASK_ASSIGNMENT", "AVAILABILITY"],
            windows: [{ dayOfWeek: "monday", start: "09:00", end: "17:00" }]
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
      const result = await runNpmCliAsync(["reclaim:account-audit:inspect", "--", "--config", configPath]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const output = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(output).toMatchObject({
        identity: {
          authenticated: true,
          hasDisplayName: true
        },
        taskCount: 2,
        meetingCount: 1,
        taskAssignmentPolicyCount: 1,
        readSafety: "read_only"
      });
      expect(result.stdout).not.toContain("Sensitive planning title");
      expect(result.stdout).not.toContain("Private meeting title");
      expect(result.stdout).not.toContain("private.person@example.com");
      expect(result.stdout).not.toContain("user-private-1");
      expect(result.stdout).not.toContain("meeting-private-1");
    } finally {
      server.close();
    }
  });

  test("reads the account audit snapshot through the client surface", async () => {
    const calls: string[] = [];
    const client = createReclaimClient(
      {
        apiUrl: "https://api.app.reclaim.ai/api",
        apiKey: "secret-key",
        timeoutMs: 1000,
        defaultTaskEventCategory: "WORK"
      },
      (async (input: string | URL | Request) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/users/current")) {
          return new Response(JSON.stringify({
            id: "user-1",
            email: "person@example.com",
            name: "Demo User"
          }), { status: 200 });
        }
        if (url.endsWith("/tasks")) {
          return new Response(JSON.stringify([
            {
              id: 11,
              title: "Task title",
              eventCategory: "WORK",
              timeSchemeId: "policy-work",
              due: "2026-05-06T15:00:00.000Z"
            }
          ]), { status: 200 });
        }
        if (url.endsWith("/meetings")) {
          return new Response(JSON.stringify([
            {
              id: "meeting-1",
              title: "Meeting title",
              start: "2026-05-06T10:00:00.000Z",
              end: "2026-05-06T10:30:00.000Z",
              attendees: [{ id: "person-1" }]
            }
          ]), { status: 200 });
        }
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

    const inspection = await accountAudit.inspect(client);

    expect(calls).toEqual([
      "https://api.app.reclaim.ai/api/users/current",
      "https://api.app.reclaim.ai/api/tasks",
      "https://api.app.reclaim.ai/api/meetings",
      "https://api.app.reclaim.ai/api/timeschemes"
    ]);
    expect(inspection).toMatchObject({
      identity: {
        authenticated: true,
        hasDisplayName: true
      },
      taskCount: 1,
      meetingCount: 1,
      taskAssignmentPolicyCount: 1,
      readSafety: "read_only"
    });
  });
});
