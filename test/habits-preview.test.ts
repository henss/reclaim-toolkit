import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { habits, parseReclaimHabitInputs } from "../src/index.js";

describe("habits", () => {
  test("parses the synthetic habit fixture and emits a preview receipt", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "habits.example.json"), "utf8")
    ) as unknown;

    const parsedHabits = parseReclaimHabitInputs(raw);
    const preview = habits.previewCreates(parsedHabits);

    expect(parsedHabits).toHaveLength(2);
    expect(preview).toMatchObject({
      habitCount: 2,
      writeSafety: "preview_only",
      previewReceipt: {
        operation: "habit.preview",
        readinessStatus: "evidence_pending",
        readinessGate:
          "Habit field mapping still needs a bounded review against the generated OpenAPI contract before any live write helper."
      }
    });
    expect(Date.parse(preview.previewReceipt.previewGeneratedAt)).not.toBeNaN();
    expect(preview.habits[0]?.request).toMatchObject({
      title: "Morning project review",
      eventCategory: "WORK",
      cadence: "daily",
      alwaysPrivate: true
    });
    expect(preview.habits[1]?.request).toMatchObject({
      title: "Weekly workspace reset",
      eventCategory: "PERSONAL",
      cadence: "weekly",
      daysOfWeek: ["friday"],
      windowStart: "15:00",
      windowEnd: "17:00"
    });
  });

  test("rejects ambiguous habit cadence and window inputs", () => {
    expect(() =>
      parseReclaimHabitInputs({
        habits: [
          {
            title: "Daily review",
            durationMinutes: 15,
            cadence: "daily",
            daysOfWeek: ["monday"]
          }
        ]
      })
    ).toThrow("Daily habits should omit daysOfWeek.");

    expect(() =>
      parseReclaimHabitInputs({
        habits: [
          {
            title: "Weekly review",
            durationMinutes: 15,
            cadence: "weekly",
            windowStart: "17:00",
            windowEnd: "09:00"
          }
        ]
      })
    ).toThrow("Weekly habits require at least one dayOfWeek.");
  });
});
