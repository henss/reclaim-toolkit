import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  parseReclaimRecurringMeetingReschedulePreviewInput,
  recurringMeetingReschedule
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

function loadRecurringMeetingFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "recurring-meeting-reschedule.example.json"), "utf8")
  ) as unknown;
}

describe("recurring meeting reschedule preview", () => {
  test("simulates keep, move, and blocked outcomes for a recurring series", () => {
    const parsed = parseReclaimRecurringMeetingReschedulePreviewInput(loadRecurringMeetingFixture());
    const preview = recurringMeetingReschedule.preview(parsed);

    expect(preview).toMatchObject({
      writeSafety: "preview_only",
      selectionReason: 'Matched preferred Reclaim time policy title "Work Hours".',
      occurrenceCount: 3,
      keptOccurrenceCount: 1,
      movedOccurrenceCount: 1,
      blockedOccurrenceCount: 1
    });
    expect(preview.outcomes[0]).toMatchObject({
      occurrenceDate: "2026-06-01",
      action: "keep",
      originalSlot: {
        isAvailable: true,
        startTime: "10:00",
        endTime: "10:45"
      },
      suggestedSlots: []
    });
    expect(preview.outcomes[1]).toMatchObject({
      occurrenceDate: "2026-06-08",
      action: "move",
      originalSlot: {
        isAvailable: false,
        blockingMeetingTitles: ["Quarterly planning block"]
      }
    });
    expect(preview.outcomes[1]?.suggestedSlots[0]).toMatchObject({
      date: "2026-06-09",
      startTime: "09:00",
      endTime: "09:45",
      daysFromOriginal: 1
    });
    expect(preview.outcomes[2]).toMatchObject({
      occurrenceDate: "2026-06-15",
      action: "blocked",
      originalSlot: {
        isAvailable: false,
        blockingMeetingTitles: ["Launch rehearsal"]
      },
      suggestedSlots: []
    });
  });

  test("rejects occurrence durations that do not match the recurring series", () => {
    expect(() =>
      parseReclaimRecurringMeetingReschedulePreviewInput({
        series: {
          title: "Weekly product sync",
          durationMinutes: 45
        },
        occurrences: [
          {
            date: "2026-06-01",
            startTime: "10:00",
            endTime: "11:00"
          }
        ],
        busyMeetings: [],
        timeSchemes: []
      })
    ).toThrow("Occurrence duration must match series.durationMinutes (45).");
  });

  test("emits parseable JSON for the recurring reschedule preview CLI command", () => {
    const result = runNpmCli([
      "reclaim:meetings:preview-recurring-reschedule",
      "--",
      "--input",
      path.join("examples", "recurring-meeting-reschedule.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      writeSafety: string;
      movedOccurrenceCount: number;
      outcomes: Array<{
        action: string;
        suggestedSlots: Array<{ date: string; startTime: string }>;
      }>;
    };
    expect(output.writeSafety).toBe("preview_only");
    expect(output.movedOccurrenceCount).toBe(1);
    expect(output.outcomes[1]?.action).toBe("move");
    expect(output.outcomes[1]?.suggestedSlots[0]).toEqual(expect.objectContaining({
      date: "2026-06-09",
      startTime: "09:00"
    }));
  });
});
