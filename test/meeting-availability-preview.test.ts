import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  meetingAvailability,
  parseReclaimMeetingAvailabilityPreviewInput
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

function loadMeetingAvailabilityFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "meeting-availability.example.json"), "utf8")
  ) as unknown;
}

function expectTuesdayWindowExclusion(
  value:
    | Array<{
      date: string;
      dayOfWeek?: string;
      policyWindowCount?: number;
      candidateWindowCount?: number;
      candidateSlotCount?: number;
      excludedWindowCount?: number;
      blockedSlotCount?: number;
      availableMinutes?: number;
      notes?: string[];
    }>
) {
  expect(value).toContainEqual({
    date: "2026-05-12",
    dayOfWeek: "tuesday",
    policyWindowCount: 1,
    candidateWindowCount: 0,
    candidateSlotCount: 0,
    excludedWindowCount: 1,
    blockedSlotCount: 1,
    notes: [
      "No viable availability windows remained after applying the synthetic busy meetings and requested preview bounds.",
      "The overlapping policy window exposed only 30 minute(s), below the requested 45 minute duration."
    ]
  });
}

function expectPreviewSelection(preview: ReturnType<typeof meetingAvailability.preview>): void {
  expect(preview).toMatchObject({
    writeSafety: "preview_only",
    busyMeetingCount: 4,
    selectedPolicy: {
      id: "policy-work",
      title: "Work Hours",
      matchesDefaultEventCategory: true
    },
    selectionReason: 'Matched preferred Reclaim time policy title "Work Hours".',
    totalCandidateWindowCount: 4,
    returnedCandidateWindowCount: 4
  });
}

describe("meeting availability preview helper", () => {
  test("parses and previews synthetic meeting availability slots", () => {
    const parsed = parseReclaimMeetingAvailabilityPreviewInput(loadMeetingAvailabilityFixture());
    const preview = meetingAvailability.preview(parsed);

    expectPreviewSelection(preview);
    expect(preview.candidateWindows[0]).toMatchObject({
      date: "2026-05-11",
      startTime: "10:00",
      endTime: "11:00",
      availableMinutes: 60,
      durationMinutes: 45,
      slotCount: 1,
      policyId: "policy-work"
    });
    expect(preview.excludedWindows).toContainEqual({
      date: "2026-05-12",
      dayOfWeek: "tuesday",
      policyWindowStart: "09:00",
      policyWindowEnd: "15:00",
      requestedWindowStart: "09:00",
      requestedWindowEnd: "15:00",
      availableMinutes: 30,
      reason: "The overlapping policy window exposed only 30 minute(s), below the requested 45 minute duration.",
      blockingMeetingTitles: []
    });
    expect(preview.totalCandidateCount).toBe(14);
    expect(preview.returnedCandidateCount).toBeLessThanOrEqual(6);
    expect(preview.candidateSlots[0]).toMatchObject({
      date: "2026-05-11",
      startTime: "10:00",
      endTime: "10:45",
      durationMinutes: 45,
      policyId: "policy-work",
      policyTitle: "Work Hours"
    });
    expectTuesdayWindowExclusion(preview.daySummaries);
  });

  test("rejects inverted ranges and invalid busy meeting windows", () => {
    expect(() =>
      parseReclaimMeetingAvailabilityPreviewInput({
        request: {
          title: "Prototype sync",
          durationMinutes: 30,
          eventCategory: "WORK",
          dateRangeStart: "2026-05-13",
          dateRangeEnd: "2026-05-12"
        },
        timeSchemes: [],
        busyMeetings: []
      })
    ).toThrow("dateRangeEnd must be on or after dateRangeStart.");

    expect(() =>
      parseReclaimMeetingAvailabilityPreviewInput({
        request: {
          title: "Prototype sync",
          durationMinutes: 30,
          eventCategory: "WORK",
          dateRangeStart: "2026-05-12",
          dateRangeEnd: "2026-05-13"
        },
        timeSchemes: [],
        busyMeetings: [
          {
            title: "Bad block",
            date: "2026-05-12",
            startTime: "11:00",
            endTime: "10:30"
          }
        ]
      })
    ).toThrow("endTime must be later than startTime.");
  });

  test("emits parseable JSON for the meeting availability preview CLI command", () => {
    const result = runNpmCli([
      "reclaim:meetings:preview-availability",
      "--",
      "--input",
      path.join("examples", "meeting-availability.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      writeSafety: string;
      selectedPolicy?: { id: string };
      candidateWindows: Array<{ startTime: string; endTime: string }>;
      excludedWindows: Array<{ date: string; availableMinutes: number }>;
      returnedCandidateCount: number;
      candidateSlots: Array<{ startTime: string; endTime: string }>;
    };
    expect(output.writeSafety).toBe("preview_only");
    expect(output.selectedPolicy?.id).toBe("policy-work");
    expect(output.candidateWindows[0]?.startTime).toBe("10:00");
    expect(output.candidateWindows[0]?.endTime).toBe("11:00");
    expect(output.excludedWindows).toEqual(expect.arrayContaining([expect.objectContaining({
      date: "2026-05-12",
      availableMinutes: 30
    })]));
    expect(output.returnedCandidateCount).toBeGreaterThan(0);
    expect(output.candidateSlots[0]?.startTime).toBe("10:00");
    expect(output.candidateSlots[0]?.endTime).toBe("10:45");
  });
});
