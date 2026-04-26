import { z } from "zod";
import { buffers, ReclaimBufferInputSchema, type BufferCreatePreview, type ReclaimBufferInput } from "./buffers.js";
import { focus, ReclaimFocusInputSchema, type FocusCreatePreview, type ReclaimFocusInput } from "./focus.js";
import { habits, ReclaimHabitInputSchema, type HabitCreatePreview, type ReclaimHabitInput } from "./habits.js";
import {
  meetingAvailability,
  ReclaimMeetingAvailabilityPreviewInputSchema,
  type MeetingAvailabilityPreview,
  type ReclaimMeetingAvailabilityPreviewInput
} from "./meeting-availability.js";
import { createPreviewReceipt, type PreviewReceipt } from "./preview-receipts.js";
import { tasks, ReclaimTaskInputSchema, type ReclaimTaskInput, type TaskCreatePreview } from "./tasks.js";
import {
  createTimezoneMismatchEdgeCase,
  type PreviewTemporalEdgeCase
} from "./timezone-edge-cases.js";
import type { ReclaimTaskEventCategory } from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

const ReclaimWeeklyScenarioMetadataSchema = z.object({
  title: z.string().min(1),
  weekStartDate: z.string().regex(DATE_PATTERN, "Expected weekStartDate in YYYY-MM-DD format."),
  timezone: z.string().min(1).default("UTC"),
  defaultEventCategory: z.enum(["PERSONAL", "WORK"]).default("WORK")
});

export const ReclaimWeeklyScenarioComposerInputSchema = z.object({
  scenario: ReclaimWeeklyScenarioMetadataSchema,
  tasks: z.array(ReclaimTaskInputSchema).default([]),
  habits: z.array(ReclaimHabitInputSchema).default([]),
  focusBlocks: z.array(ReclaimFocusInputSchema).default([]),
  buffers: z.array(ReclaimBufferInputSchema).default([]),
  meetingAvailability: ReclaimMeetingAvailabilityPreviewInputSchema.optional()
});

export type ReclaimWeeklyScenarioComposerInput = z.infer<typeof ReclaimWeeklyScenarioComposerInputSchema>;

export type WeeklyScenarioSurface =
  | "task"
  | "habit"
  | "focus"
  | "buffer"
  | "meeting_candidate";

export interface WeeklyScenarioAgendaEntry {
  surface: WeeklyScenarioSurface;
  title: string;
  date?: string;
  dayOfWeek?: string;
  eventCategory?: ReclaimTaskEventCategory;
  timingLabel: string;
  notes?: string;
  cadence?: "once" | "daily" | "weekly";
  placement?: "before" | "after" | "between";
  anchor?: string;
}

export interface WeeklyScenarioBufferAnchorIssue {
  bufferTitle: string;
  anchor: string;
  reason: string;
}

export interface WeeklyScenarioDay {
  date: string;
  dayOfWeek: string;
  entryCount: number;
  entries: WeeklyScenarioAgendaEntry[];
}

export interface WeeklyScenarioSummary {
  surfaceCounts: {
    tasks: number;
    habits: number;
    focusBlocks: number;
    buffers: number;
    meetingCandidateSlots: number;
  };
  scheduledEntryCount: number;
  unscheduledEntryCount: number;
  bufferAnchorIssueCount: number;
  busyMeetingCount: number;
}

export interface WeeklyScenarioComposerPreview {
  composer: "reclaim-weekly-scenario-preview";
  scenario: {
    title: string;
    weekStartDate: string;
    weekEndDate: string;
    timezone: string;
    surfacesIncluded: string[];
  };
  weeklySummary: WeeklyScenarioSummary;
  days: WeeklyScenarioDay[];
  unscheduledEntries: WeeklyScenarioAgendaEntry[];
  bufferAnchorIssues: WeeklyScenarioBufferAnchorIssue[];
  temporalEdgeCases?: PreviewTemporalEdgeCase[];
  previews: {
    tasks: TaskCreatePreview;
    habits: HabitCreatePreview;
    focus: FocusCreatePreview;
    buffers: BufferCreatePreview;
    meetingAvailability?: MeetingAvailabilityPreview;
  };
  writeSafety: "preview_only";
  previewReceipt: PreviewReceipt;
}

function listWeekDatesInclusive(weekStartDate: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(`${weekStartDate}T00:00:00.000Z`);
  for (let offset = 0; offset < 7; offset += 1) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return dates;
}

function toDayOfWeek(date: string): string {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC"
  }).toLowerCase();
}

function toIsoDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const matchedDate = value.match(/^\d{4}-\d{2}-\d{2}/);
  return matchedDate?.[0];
}

function toIsoTime(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const matchedTime = value.match(/T(\d{2}:\d{2})/);
  return matchedTime?.[1];
}

function buildTimeRangeLabel(start: string | undefined, end: string | undefined): string {
  if (start && end) {
    return `${start}-${end}`;
  }
  if (start) {
    return `after ${start}`;
  }
  if (end) {
    return `until ${end}`;
  }
  return "all day";
}

function isDateWithinWeek(date: string | undefined, weekDates: Set<string>): date is string {
  return Boolean(date && weekDates.has(date));
}

function buildTaskEntries(
  taskInputs: ReclaimTaskInput[],
  defaultEventCategory: ReclaimTaskEventCategory,
  weekDates: Set<string>
): { scheduledEntries: WeeklyScenarioAgendaEntry[]; unscheduledEntries: WeeklyScenarioAgendaEntry[] } {
  const preview = tasks.previewCreates(taskInputs, { eventCategory: defaultEventCategory });
  const scheduledEntries: WeeklyScenarioAgendaEntry[] = [];
  const unscheduledEntries: WeeklyScenarioAgendaEntry[] = [];

  for (const task of preview.tasks) {
    const dueDate = toIsoDate(task.request.due);
    const dueTime = toIsoTime(task.request.due);
    const startAfterDate = toIsoDate(task.request.snoozeUntil);
    const startAfterTime = toIsoTime(task.request.snoozeUntil);
    const date = dueDate ?? startAfterDate;
    const entry: WeeklyScenarioAgendaEntry = {
      surface: "task",
      title: task.title,
      date,
      dayOfWeek: date ? toDayOfWeek(date) : undefined,
      eventCategory: task.request.eventCategory,
      timingLabel: dueTime
        ? `due ${dueTime}`
        : startAfterTime
          ? `start after ${startAfterTime}`
          : "unscheduled preview",
      notes: task.request.notes
    };

    if (isDateWithinWeek(date, weekDates)) {
      scheduledEntries.push(entry);
      continue;
    }

    unscheduledEntries.push(entry);
  }

  return { scheduledEntries, unscheduledEntries };
}

function occursOnDate(
  date: string,
  cadence: "daily" | "weekly",
  daysOfWeek: string[] | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  if (startDate && date < startDate) {
    return false;
  }
  if (endDate && date > endDate) {
    return false;
  }
  if (cadence === "daily") {
    return true;
  }
  return daysOfWeek?.includes(toDayOfWeek(date)) ?? false;
}

function buildHabitEntries(
  habitInputs: ReclaimHabitInput[],
  defaultEventCategory: ReclaimTaskEventCategory,
  weekDates: string[]
): WeeklyScenarioAgendaEntry[] {
  const preview = habits.previewCreates(habitInputs, { eventCategory: defaultEventCategory });
  const entries: WeeklyScenarioAgendaEntry[] = [];

  for (const habit of preview.habits) {
    if (habit.request.cadence === "daily" || habit.request.cadence === "weekly") {
      for (const date of weekDates) {
        if (!occursOnDate(date, habit.request.cadence, habit.request.daysOfWeek, habit.request.startDate, habit.request.endDate)) {
          continue;
        }
        entries.push({
          surface: "habit",
          title: habit.title,
          date,
          dayOfWeek: toDayOfWeek(date),
          eventCategory: habit.request.eventCategory,
          timingLabel: buildTimeRangeLabel(habit.request.windowStart, habit.request.windowEnd),
          notes: habit.request.notes,
          cadence: habit.request.cadence
        });
      }
    }
  }

  return entries;
}

function buildFocusEntries(
  focusInputs: ReclaimFocusInput[],
  defaultEventCategory: ReclaimTaskEventCategory,
  weekDates: string[]
): { scheduledEntries: WeeklyScenarioAgendaEntry[]; unscheduledEntries: WeeklyScenarioAgendaEntry[] } {
  const preview = focus.previewCreates(focusInputs, { eventCategory: defaultEventCategory });
  const weekDateSet = new Set(weekDates);
  const scheduledEntries: WeeklyScenarioAgendaEntry[] = [];
  const unscheduledEntries: WeeklyScenarioAgendaEntry[] = [];

  for (const focusBlock of preview.focusBlocks) {
    if (focusBlock.request.cadence === "once") {
      const date = focusBlock.request.date;
      const entry: WeeklyScenarioAgendaEntry = {
        surface: "focus",
        title: focusBlock.title,
        date,
        dayOfWeek: date ? toDayOfWeek(date) : undefined,
        eventCategory: focusBlock.request.eventCategory,
        timingLabel: buildTimeRangeLabel(focusBlock.request.windowStart, focusBlock.request.windowEnd),
        notes: focusBlock.request.notes,
        cadence: focusBlock.request.cadence
      };

      if (isDateWithinWeek(date, weekDateSet)) {
        scheduledEntries.push(entry);
      } else {
        unscheduledEntries.push(entry);
      }
      continue;
    }

    for (const date of weekDates) {
      if (!occursOnDate(date, focusBlock.request.cadence, focusBlock.request.daysOfWeek, undefined, undefined)) {
        continue;
      }
      scheduledEntries.push({
        surface: "focus",
        title: focusBlock.title,
        date,
        dayOfWeek: toDayOfWeek(date),
        eventCategory: focusBlock.request.eventCategory,
        timingLabel: buildTimeRangeLabel(focusBlock.request.windowStart, focusBlock.request.windowEnd),
        notes: focusBlock.request.notes,
        cadence: focusBlock.request.cadence
      });
    }
  }

  return { scheduledEntries, unscheduledEntries };
}

function buildBufferEntries(
  bufferInputs: ReclaimBufferInput[],
  defaultEventCategory: ReclaimTaskEventCategory,
  anchorEntries: WeeklyScenarioAgendaEntry[]
): {
  scheduledEntries: WeeklyScenarioAgendaEntry[];
  unscheduledEntries: WeeklyScenarioAgendaEntry[];
  anchorIssues: WeeklyScenarioBufferAnchorIssue[];
} {
  const preview = buffers.previewCreates(bufferInputs, { eventCategory: defaultEventCategory });
  const scheduledEntries: WeeklyScenarioAgendaEntry[] = [];
  const unscheduledEntries: WeeklyScenarioAgendaEntry[] = [];
  const anchorIssues: WeeklyScenarioBufferAnchorIssue[] = [];

  for (const buffer of preview.buffers) {
    const matchingAnchors = anchorEntries.filter((entry) => entry.title === buffer.request.anchor && entry.date);
    if (matchingAnchors.length === 0) {
      unscheduledEntries.push({
        surface: "buffer",
        title: buffer.title,
        eventCategory: buffer.request.eventCategory,
        timingLabel: buildTimeRangeLabel(buffer.request.windowStart, buffer.request.windowEnd),
        notes: buffer.request.notes,
        placement: buffer.request.placement,
        anchor: buffer.request.anchor
      });
      anchorIssues.push({
        bufferTitle: buffer.title,
        anchor: buffer.request.anchor,
        reason: "No scheduled task, habit, or focus entry matched this anchor inside the preview week."
      });
      continue;
    }

    for (const anchorEntry of matchingAnchors) {
      scheduledEntries.push({
        surface: "buffer",
        title: buffer.title,
        date: anchorEntry.date,
        dayOfWeek: anchorEntry.dayOfWeek,
        eventCategory: buffer.request.eventCategory,
        timingLabel: buildTimeRangeLabel(buffer.request.windowStart, buffer.request.windowEnd),
        notes: buffer.request.notes,
        placement: buffer.request.placement,
        anchor: buffer.request.anchor
      });
    }
  }

  return { scheduledEntries, unscheduledEntries, anchorIssues };
}

function buildMeetingCandidateEntries(preview: MeetingAvailabilityPreview | undefined): WeeklyScenarioAgendaEntry[] {
  if (!preview) {
    return [];
  }

  return preview.candidateSlots.map((slot) => ({
    surface: "meeting_candidate",
    title: preview.request.title,
    date: slot.date,
    dayOfWeek: toDayOfWeek(slot.date),
    eventCategory: preview.request.eventCategory,
    timingLabel: `${slot.startTime}-${slot.endTime}`,
    notes: `Candidate slot from ${slot.policyTitle}.`
  }));
}

function entrySortKey(entry: WeeklyScenarioAgendaEntry): string {
  const time = entry.timingLabel.match(TIME_PATTERN)?.[0] ?? "99:99";
  return `${time}:${entry.surface}:${entry.title}`;
}

function groupEntriesByDay(weekDates: string[], entries: WeeklyScenarioAgendaEntry[]): WeeklyScenarioDay[] {
  return weekDates.map((date) => {
    const dayEntries = entries
      .filter((entry) => entry.date === date)
      .sort((left, right) => entrySortKey(left).localeCompare(entrySortKey(right)));

    return {
      date,
      dayOfWeek: toDayOfWeek(date),
      entryCount: dayEntries.length,
      entries: dayEntries
    };
  });
}

function listIncludedSurfaces(input: ReclaimWeeklyScenarioComposerInput): string[] {
  return [
    input.tasks.length > 0 ? "tasks" : undefined,
    input.habits.length > 0 ? "habits" : undefined,
    input.focusBlocks.length > 0 ? "focus" : undefined,
    input.buffers.length > 0 ? "buffers" : undefined,
    input.meetingAvailability ? "meetingAvailability" : undefined
  ].filter((surface): surface is string => surface !== undefined);
}

function listWeeklyScenarioTemporalEdgeCases(
  scenarioTimezone: string,
  weekStartDate: string,
  meetingPreview: MeetingAvailabilityPreview | undefined
): PreviewTemporalEdgeCase[] {
  const mismatch = meetingPreview?.selectedPolicyTimezone
    ? createTimezoneMismatchEdgeCase({
      date: weekStartDate,
      referenceTimezone: scenarioTimezone,
      comparedTimezone: meetingPreview.selectedPolicyTimezone,
      affectedInput: "meeting availability policy timezone"
    })
    : undefined;

  return [
    ...(meetingPreview?.temporalEdgeCases ?? []),
    ...(mismatch ? [mismatch] : [])
  ];
}

export function parseReclaimWeeklyScenarioComposerInput(raw: unknown): ReclaimWeeklyScenarioComposerInput {
  return ReclaimWeeklyScenarioComposerInputSchema.parse(raw);
}

export function previewWeeklyScenario(
  input: ReclaimWeeklyScenarioComposerInput
): WeeklyScenarioComposerPreview {
  const parsed = ReclaimWeeklyScenarioComposerInputSchema.parse(input);
  const weekDates = listWeekDatesInclusive(parsed.scenario.weekStartDate);
  const weekDateSet = new Set(weekDates);
  const taskPreview = tasks.previewCreates(parsed.tasks, {
    eventCategory: parsed.scenario.defaultEventCategory
  });
  const habitPreview = habits.previewCreates(parsed.habits, {
    eventCategory: parsed.scenario.defaultEventCategory
  });
  const focusPreview = focus.previewCreates(parsed.focusBlocks, {
    eventCategory: parsed.scenario.defaultEventCategory
  });
  const bufferPreview = buffers.previewCreates(parsed.buffers, {
    eventCategory: parsed.scenario.defaultEventCategory
  });
  const meetingPreview = parsed.meetingAvailability
    ? meetingAvailability.preview(parsed.meetingAvailability)
    : undefined;

  const taskEntries = buildTaskEntries(parsed.tasks, parsed.scenario.defaultEventCategory, weekDateSet);
  const habitEntries = buildHabitEntries(parsed.habits, parsed.scenario.defaultEventCategory, weekDates);
  const focusEntries = buildFocusEntries(parsed.focusBlocks, parsed.scenario.defaultEventCategory, weekDates);
  const anchoredEntries = [
    ...taskEntries.scheduledEntries,
    ...habitEntries,
    ...focusEntries.scheduledEntries
  ];
  const bufferEntries = buildBufferEntries(parsed.buffers, parsed.scenario.defaultEventCategory, anchoredEntries);
  const meetingEntries = buildMeetingCandidateEntries(meetingPreview);
  const scheduledEntries = [
    ...taskEntries.scheduledEntries,
    ...habitEntries,
    ...focusEntries.scheduledEntries,
    ...bufferEntries.scheduledEntries,
    ...meetingEntries
  ];
  const unscheduledEntries = [
    ...taskEntries.unscheduledEntries,
    ...focusEntries.unscheduledEntries,
    ...bufferEntries.unscheduledEntries
  ].sort((left, right) => entrySortKey(left).localeCompare(entrySortKey(right)));
  const temporalEdgeCases = listWeeklyScenarioTemporalEdgeCases(
    parsed.scenario.timezone,
    parsed.scenario.weekStartDate,
    meetingPreview
  );

  return {
    composer: "reclaim-weekly-scenario-preview",
    scenario: {
      title: parsed.scenario.title,
      weekStartDate: parsed.scenario.weekStartDate,
      weekEndDate: weekDates[weekDates.length - 1] ?? parsed.scenario.weekStartDate,
      timezone: parsed.scenario.timezone,
      surfacesIncluded: listIncludedSurfaces(parsed)
    },
    weeklySummary: {
      surfaceCounts: {
        tasks: taskPreview.taskCount,
        habits: habitPreview.habitCount,
        focusBlocks: focusPreview.focusBlockCount,
        buffers: bufferPreview.bufferCount,
        meetingCandidateSlots: meetingPreview?.returnedCandidateCount ?? 0
      },
      scheduledEntryCount: scheduledEntries.length,
      unscheduledEntryCount: unscheduledEntries.length,
      bufferAnchorIssueCount: bufferEntries.anchorIssues.length,
      busyMeetingCount: meetingPreview?.busyMeetingCount ?? 0
    },
    days: groupEntriesByDay(weekDates, scheduledEntries),
    unscheduledEntries,
    bufferAnchorIssues: bufferEntries.anchorIssues,
    ...(temporalEdgeCases.length > 0 ? { temporalEdgeCases } : {}),
    previews: {
      tasks: taskPreview,
      habits: habitPreview,
      focus: focusPreview,
      buffers: bufferPreview,
      meetingAvailability: meetingPreview
    },
    writeSafety: "preview_only",
    previewReceipt: createPreviewReceipt({
      operation: "scenario.weekly.preview",
      readinessStatus: "evidence_pending",
      readinessGate:
        "This weekly composer stays local-preview only because it aggregates synthetic task, habit, focus, buffer, and meeting evidence rather than a reviewed live scheduling contract."
    })
  };
}

export const weeklyScenarioComposer = {
  preview: previewWeeklyScenario
};
