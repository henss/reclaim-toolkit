import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  assertReclaimFixturePrivacy,
  fixtureRecorder,
  parseReclaimFixtureRecording,
  scrubReclaimFixtureRecording
} from "../src/fixture-recorder.js";

describe("reclaim fixture recorder", () => {
  test("scrubs a synthetic raw interaction recording into a public-safe fixture", () => {
    const rawRecording = parseReclaimFixtureRecording(JSON.parse(
      fs.readFileSync(path.join("examples", "reclaim-fixture-recording.example.json"), "utf8")
    ) as unknown);

    const scrubbed = scrubReclaimFixtureRecording(rawRecording, {
      scrubbedAt: "2026-05-01T08:05:00.000Z"
    });

    expect(scrubbed).toMatchObject({
      fixture: "reclaim-sanitized-recording-fixture",
      sourceFixture: "reclaim-recorded-interaction-fixture",
      scrubbedAt: "2026-05-01T08:05:00.000Z",
      interactionCount: 2,
      leakCheck: {
        passed: true,
        findingCount: 0,
        findings: []
      }
    });
    expect(scrubbed.interactions[0]).toMatchObject({
      label: "list-tasks",
      request: {
        method: "GET",
        pathTemplate: "/api/tasks",
        queryKeys: ["status", "view"],
        headers: {
          "content-type": "application/json"
        }
      },
      response: {
        status: 200,
        headers: {
          "content-type": "application/json"
        },
        body: [
          expect.objectContaining({
            id: "<redacted-id>",
            title: "<redacted-text>",
            notes: "<redacted-text>",
            eventCategory: "WORK",
            timeSchemeId: "<redacted-id>",
            due: "2026-05-01T10:00:00.000Z"
          })
        ]
      }
    });
    expect(scrubbed.interactions[1]?.response.body).toEqual(expect.objectContaining({
      id: "<redacted-id>",
      email: "<redacted-email>",
      name: "<redacted-text>"
    }));

    const serialized = JSON.stringify(scrubbed);
    expect(serialized).not.toContain("Bearer synthetic-secret-key");
    expect(serialized).not.toContain("fixture.person@example.com");
    expect(serialized).not.toContain("Prototype fixture scrubber");
    expect(serialized).not.toContain("Fixture Person");
    expect(scrubbed.redactionPolicy.counters.apiKeys).toBeGreaterThan(0);
    expect(scrubbed.redactionPolicy.counters.ids).toBeGreaterThan(0);
    expect(scrubbed.redactionPolicy.counters.text).toBeGreaterThan(0);
  });

  test("fails the leak assertion when private-looking fields remain", () => {
    const scrubbed = scrubReclaimFixtureRecording({
      fixture: "reclaim-recorded-interaction-fixture",
      interactions: [
        {
          label: "user-profile",
          request: {
            method: "GET",
            path: "/api/users/current"
          },
          response: {
            status: 200,
            body: {
              id: "user-private-1",
              email: "fixture.person@example.com"
            }
          }
        }
      ]
    });

    const leakyFixture = {
      ...scrubbed,
      interactions: [
        {
          ...scrubbed.interactions[0],
          response: {
            ...scrubbed.interactions[0]!.response,
            body: {
              id: "user-private-1",
              email: "fixture.person@example.com"
            }
          }
        }
      ]
    };

    expect(() => assertReclaimFixturePrivacy(leakyFixture)).toThrow(
      "Sanitized fixture still contains private-looking fields: email-pattern"
    );
  });

  test("exposes the recorder through the grouped module surface", () => {
    const scrubbed = fixtureRecorder.scrubRecording({
      fixture: "reclaim-recorded-interaction-fixture",
      interactions: [
        {
          label: "list-timeschemes",
          request: {
            method: "GET",
            path: "/api/timeschemes"
          },
          response: {
            status: 200,
            body: [
              {
                id: "policy-work",
                title: "Work Hours",
                taskCategory: "WORK",
                timezone: "Europe/Berlin",
                windows: [{ dayOfWeek: "monday", start: "09:00", end: "17:00" }]
              }
            ]
          }
        }
      ]
    });

    expect(scrubbed.interactions[0]).toMatchObject({
      request: {
        pathTemplate: "/api/timeschemes"
      },
      response: {
        body: [
          {
            id: "<redacted-id>",
            title: "<redacted-text>",
            taskCategory: "WORK",
            timezone: "Europe/Berlin",
            windows: [{ dayOfWeek: "monday", start: "09:00", end: "17:00" }]
          }
        ]
      }
    });
    expect(fixtureRecorder.inspectPrivacy(scrubbed)).toEqual({
      passed: true,
      findingCount: 0,
      findings: []
    });
  });
});
