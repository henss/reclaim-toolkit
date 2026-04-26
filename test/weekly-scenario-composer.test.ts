import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  parseReclaimWeeklyScenarioComposerInput,
  weeklyScenarioComposer
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

function loadCompoundWeeklyFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "compound-weekly-preview.example.json"), "utf8")
  ) as unknown;
}

function loadWeeklyTimezoneEdgeFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "compound-weekly-timezone-edge.example.json"), "utf8")
  ) as unknown;
}

function expectTimezoneMismatchWarning(preview: ReturnType<typeof weeklyScenarioComposer.preview>): void {
  expect(preview.temporalEdgeCases ?? []).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: "timezone_mismatch",
      date: "2026-05-18",
      timezone: "America/New_York",
      referenceTimezone: "Europe/Berlin",
      affectedInput: "meeting availability policy timezone"
    })
  ]));
  expect(preview.previews.meetingAvailability?.selectedPolicyTimezone).toBe("America/New_York");
}

describe("weekly scenario composer", () => {
  test("parses and composes a public-safe weekly preview across multiple surfaces", () => {
    const parsed = parseReclaimWeeklyScenarioComposerInput(loadCompoundWeeklyFixture());
    const preview = weeklyScenarioComposer.preview(parsed);

    expect(preview).toMatchObject({
      composer: "reclaim-weekly-scenario-preview",
      writeSafety: "preview_only",
      scenario: {
        title: "Synthetic compound weekly preview",
        weekStartDate: "2026-05-18",
        weekEndDate: "2026-05-24",
        timezone: "Europe/Berlin",
        surfacesIncluded: ["tasks", "habits", "focus", "buffers", "meetingAvailability"]
      },
      weeklySummary: {
        surfaceCounts: {
          tasks: 2,
          habits: 2,
          focusBlocks: 2,
          buffers: 2
        },
        unscheduledEntryCount: 0,
        bufferAnchorIssueCount: 0,
        busyMeetingCount: 2
      },
      previewReceipt: {
        operation: "scenario.weekly.preview",
        readinessStatus: "evidence_pending"
      }
    });
    expect(Date.parse(preview.previewReceipt.previewGeneratedAt)).not.toBeNaN();
    expect(preview.days).toHaveLength(7);
    expect(preview.unscheduledEntries).toEqual([]);
    expect(preview.bufferAnchorIssues).toEqual([]);
    expect(preview.previews.meetingAvailability?.returnedCandidateCount).toBeGreaterThan(0);
    expect(preview.weeklySummary.surfaceCounts.meetingCandidateSlots).toBe(
      preview.previews.meetingAvailability?.returnedCandidateCount
    );

    const monday = preview.days.find((day) => day.date === "2026-05-18");
    expect(monday?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: "habit",
        title: "Daily preview inbox sweep",
        timingLabel: "08:30-09:00"
      }),
      expect.objectContaining({
        surface: "task",
        title: "Review public weekly preview contract",
        timingLabel: "due 11:30"
      })
    ]));

    const tuesday = preview.days.find((day) => day.date === "2026-05-19");
    expect(tuesday?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: "focus",
        title: "Weekly scenario synthesis block",
        timingLabel: "10:00-12:00"
      }),
      expect.objectContaining({
        surface: "buffer",
        title: "Post-synthesis notes buffer",
        anchor: "Weekly scenario synthesis block",
        placement: "after"
      }),
      expect.objectContaining({
        surface: "meeting_candidate",
        title: "Synthetic weekly preview sync"
      })
    ]));

    const friday = preview.days.find((day) => day.date === "2026-05-22");
    expect(friday?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: "task",
        title: "Write Friday synthetic schedule recap"
      }),
      expect.objectContaining({
        surface: "habit",
        title: "Friday workspace reset",
        eventCategory: "PERSONAL"
      }),
      expect.objectContaining({
        surface: "buffer",
        title: "Preview handoff buffer",
        placement: "before"
      })
    ]));
  });

  test("supports the CLI preview command for the compound weekly fixture", () => {
    const result = runNpmCli([
      "reclaim:scenarios:preview-weekly",
      "--",
      "--input",
      path.join("examples", "compound-weekly-preview.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      composer: string;
      days: Array<{ date: string; entryCount: number }>;
      weeklySummary: { scheduledEntryCount: number; busyMeetingCount: number };
      previews: { meetingAvailability?: { returnedCandidateCount: number } };
    };
    expect(output.composer).toBe("reclaim-weekly-scenario-preview");
    expect(output.days).toHaveLength(7);
    expect(output.days.find((day) => day.date === "2026-05-19")?.entryCount).toBeGreaterThan(0);
    expect(output.weeklySummary.busyMeetingCount).toBe(2);
    expect(output.weeklySummary.scheduledEntryCount).toBeGreaterThan(
      output.previews.meetingAvailability?.returnedCandidateCount ?? 0
    );
  });

  test("surfaces timezone mismatch warnings when the scenario and selected policy use different zones", () => {
    const parsed = parseReclaimWeeklyScenarioComposerInput(loadWeeklyTimezoneEdgeFixture());
    const preview = weeklyScenarioComposer.preview(parsed);

    expectTimezoneMismatchWarning(preview);
  });
});
