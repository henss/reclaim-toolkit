import { describe, expect, it } from "vitest";
import {
  explainTimePolicyConflicts,
  parseReclaimTimePolicyExplainerInput
} from "../src/time-policy-conflicts.js";

describe("explainTimePolicyConflicts", () => {
  it("keeps task conflict explanations intact", () => {
    const result = explainTimePolicyConflicts(parseReclaimTimePolicyExplainerInput({
      defaultTaskEventCategory: "WORK",
      timeSchemes: [
        {
          id: "policy-work",
          title: "Work Hours",
          taskCategory: "WORK",
          features: ["TASK_ASSIGNMENT"],
          windows: [
            { dayOfWeek: "monday", start: "09:00", end: "12:00" }
          ]
        }
      ],
      tasks: [
        {
          title: "Draft launch checklist",
          durationMinutes: 90,
          startAfter: "2026-05-11T09:00:00.000Z",
          due: "2026-05-11T12:00:00.000Z"
        }
      ]
    }));

    expect(result.taskCount).toBe(1);
    expect(result.proposalCount).toBe(1);
    expect(result.tasks[0]).toMatchObject({
      title: "Draft launch checklist",
      status: "fit",
      taskEventCategory: "WORK",
      availablePolicyMinutes: 180
    });
  });

  it("reports weekly focus conflicts when a requested day lacks enough window time", () => {
    const result = explainTimePolicyConflicts(parseReclaimTimePolicyExplainerInput({
      defaultTaskEventCategory: "WORK",
      timeSchemes: [
        {
          id: "policy-work",
          title: "Work Hours",
          taskCategory: "WORK",
          features: ["TASK_ASSIGNMENT"],
          windows: [
            { dayOfWeek: "monday", start: "09:00", end: "11:00" },
            { dayOfWeek: "wednesday", start: "09:00", end: "09:45" }
          ]
        }
      ],
      focusBlocks: [
        {
          title: "Weekly writing block",
          durationMinutes: 60,
          cadence: "weekly",
          daysOfWeek: ["monday", "wednesday"],
          windowStart: "09:00",
          windowEnd: "10:00"
        }
      ]
    }));

    expect(result.focusBlockCount).toBe(1);
    expect(result.focusBlocks[0]?.status).toBe("conflict");
    expect(result.focusBlocks[0]?.checkedDays).toEqual(["monday", "wednesday"]);
    expect(result.focusBlocks[0]?.conflicts[0]).toContain("wednesday");
  });

  it("explains when a buffer fits at least one configured policy day", () => {
    const result = explainTimePolicyConflicts(parseReclaimTimePolicyExplainerInput({
      defaultTaskEventCategory: "WORK",
      timeSchemes: [
        {
          id: "policy-work",
          title: "Work Hours",
          taskCategory: "WORK",
          features: ["TASK_ASSIGNMENT"],
          windows: [
            { dayOfWeek: "tuesday", start: "12:00", end: "13:00" },
            { dayOfWeek: "thursday", start: "12:00", end: "12:20" }
          ]
        }
      ],
      buffers: [
        {
          title: "Post-review notes buffer",
          durationMinutes: 15,
          placement: "after",
          anchor: "Prototype review block",
          windowStart: "12:00",
          windowEnd: "12:30"
        }
      ]
    }));

    expect(result.bufferCount).toBe(1);
    expect(result.buffers[0]).toMatchObject({
      title: "Post-review notes buffer",
      status: "fit",
      placement: "after",
      checkedDays: ["tuesday", "thursday"]
    });
    expect(result.buffers[0]?.explanation).toContain("tuesday, thursday");
  });
});
