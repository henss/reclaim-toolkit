import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  meetingAvailability,
  parseReclaimMeetingAvailabilityPreviewInput
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

describe("meeting availability preview helper", () => {
  test("parses and previews synthetic meeting availability slots", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "meeting-availability.example.json"), "utf8")
    ) as unknown;

    const parsed = parseReclaimMeetingAvailabilityPreviewInput(raw);
    const preview = meetingAvailability.preview(parsed);

    expect(preview).toMatchObject({
      writeSafety: "preview_only",
      busyMeetingCount: 3,
      selectedPolicy: {
        id: "policy-work",
        title: "Work Hours",
        matchesDefaultEventCategory: true
      },
      selectionReason: 'Matched preferred Reclaim time policy title "Work Hours".'
    });
    expect(preview.totalCandidateCount).toBeGreaterThan(0);
    expect(preview.returnedCandidateCount).toBeLessThanOrEqual(6);
    expect(preview.candidateSlots[0]).toMatchObject({
      date: "2026-05-11",
      startTime: "10:00",
      endTime: "10:45",
      durationMinutes: 45,
      policyId: "policy-work",
      policyTitle: "Work Hours"
    });
    expect(preview.daySummaries).toContainEqual({
      date: "2026-05-12",
      dayOfWeek: "tuesday",
      policyWindowCount: 1,
      candidateSlotCount: 11,
      blockedSlotCount: 0,
      notes: []
    });
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
      returnedCandidateCount: number;
      candidateSlots: Array<{ startTime: string; endTime: string }>;
    };
    expect(output.writeSafety).toBe("preview_only");
    expect(output.selectedPolicy?.id).toBe("policy-work");
    expect(output.returnedCandidateCount).toBeGreaterThan(0);
    expect(output.candidateSlots[0]?.startTime).toBe("10:00");
    expect(output.candidateSlots[0]?.endTime).toBe("10:45");
  });
});
