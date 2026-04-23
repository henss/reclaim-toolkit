import { createServer } from "node:http";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  generateReclaimSupportBundle,
  parseReclaimSupportBundleRequest
} from "../src/support-bundle.js";
import {
  listen,
  makeTempDir,
  runNpmCli,
  writeConfigFile
} from "./cli-test-helpers.js";

describe("support bundle", () => {
  test("generates a redacted preview bundle from a synthetic incident packet", async () => {
    const request = parseReclaimSupportBundleRequest({
      incidentType: "preview",
      command: "reclaim:meetings:preview-availability",
      notes: "Copied from a household-heavy private troubleshooting pass.",
      input: {
        request: {
          title: "Household planning block",
          durationMinutes: 45,
          eventCategory: "WORK",
          dateRangeStart: "2026-05-11",
          dateRangeEnd: "2026-05-12"
        },
        timeSchemes: [
          {
            id: "policy-work-private",
            title: "Work Hours",
            taskCategory: "WORK",
            features: ["TASK_ASSIGNMENT"],
            windows: [{ dayOfWeek: "monday", start: "09:00", end: "12:00" }]
          }
        ],
        busyMeetings: [
          {
            id: "meeting-123",
            title: "Stefan private sync",
            date: "2026-05-11",
            startTime: "09:00",
            endTime: "10:00"
          }
        ]
      }
    });

    const bundle = await generateReclaimSupportBundle(request);

    expect(bundle.incidentType).toBe("preview");
    expect(bundle.preview).toMatchObject({
      command: "reclaim:meetings:preview-availability",
      executionStatus: "ok",
      summary: {
        inputTopLevelKeys: ["busyMeetings", "request", "timeSchemes"],
        outputSafety: "preview_only"
      }
    });
    expect(bundle.notes).toBe("<redacted-text>");
    expect(bundle.preview?.input).toEqual(expect.objectContaining({
      request: expect.objectContaining({
        title: "<redacted-text>",
        eventCategory: "WORK",
        dateRangeStart: "2026-05-11"
      }),
      timeSchemes: [
        expect.objectContaining({
          id: "<redacted-id>",
          title: "<redacted-text>"
        })
      ],
      busyMeetings: [
        expect.objectContaining({
          id: "<redacted-id>",
          title: "<redacted-text>"
        })
      ]
    }));
    expect(JSON.stringify(bundle)).not.toContain("Stefan private sync");
    expect(JSON.stringify(bundle)).not.toContain("policy-work-private");
    expect(bundle.redactionPolicy.counters.ids).toBeGreaterThan(0);
    expect(bundle.redactionPolicy.counters.text).toBeGreaterThan(0);
  });

  test("sanitizes config incidents and optional health checks", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/api/users/current") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          id: "user-private-1",
          email: "private.person@example.com"
        }));
        return;
      }

      if (request.url === "/api/tasks") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end("[]");
        return;
      }

      if (request.url === "/api/timeschemes") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify([
          {
            id: "policy-work",
            title: "Work Hours",
            taskCategory: "WORK",
            features: ["TASK_ASSIGNMENT"]
          }
        ]));
        return;
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("[]");
    });
    const port = await listen(server);
    const repoPath = makeTempDir();
    const configPath = path.join(repoPath, "config", "reclaim.local.json");
    writeConfigFile(configPath, {
      apiUrl: `http://127.0.0.1:${port}`,
      apiKey: "super-secret",
      timeoutMs: 1000,
      defaultTaskEventCategory: "WORK",
      preferredTimePolicyId: "policy-private"
    });

    try {
      const bundle = await generateReclaimSupportBundle({
        incidentType: "config",
        configPath,
        includeHealthCheck: true
      });

      expect(bundle.config).toMatchObject({
        requestedPath: "<absolute-path-redacted>",
        pathDisplay: "absolute_redacted",
        status: "valid",
        apiUrl: {
          classification: "localhost",
          value: `http://127.0.0.1:${port}/api`
        },
        hasApiKey: true,
        hasPreferredTimePolicyId: true,
        defaultTaskEventCategory: "WORK"
      });
      expect(bundle.healthCheck).toMatchObject({
        attempted: true,
        status: "ok",
        reachable: true,
        taskCount: 0,
        taskAssignmentTimeSchemeCount: 1
      });
      expect(JSON.stringify(bundle)).not.toContain("private.person@example.com");
      expect(JSON.stringify(bundle)).not.toContain("user-private-1");
      expect(JSON.stringify(bundle)).not.toContain("super-secret");
      expect(JSON.stringify(bundle)).not.toContain(repoPath);
    } finally {
      server.close();
    }
  });

  test("emits parseable JSON for the CLI support bundle command", () => {
    const result = runNpmCli([
      "reclaim:support:bundle",
      "--",
      "--input",
      path.join("examples", "support-bundle-preview.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      incidentType: string;
      preview?: {
        command: string;
        executionStatus: string;
        summary: { outputSafety: string };
      };
      config: { status: string };
    };
    expect(output.incidentType).toBe("preview");
    expect(output.preview).toMatchObject({
      command: "reclaim:meetings:preview-availability",
      executionStatus: "ok",
      summary: {
        outputSafety: "preview_only"
      }
    });
    expect(output.config.status).toBe("missing");
  });
});
