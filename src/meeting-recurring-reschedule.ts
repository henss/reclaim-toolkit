import { z } from "zod";
import {
  BusyMeetingSchema,
  ReclaimMeetingAvailabilityPreviewInputSchema,
  previewMeetingAvailability,
  type MeetingAvailabilityCandidateSlot
} from "./meeting-availability.js";
import { ReclaimTimeSchemeSnapshotSchema } from "./time-policy-selection.js";
import type { TimePolicyDiscoveryItem } from "./time-policy-selection.js";
import type { ReclaimTaskEventCategory } from "./types.js";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format.");
const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Expected time in HH:MM format.");

const RecurringMeetingSeriesSchema = z.object({
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).default("WORK"),
  searchDaysBefore: z.number().int().min(0).default(0),
  searchDaysAfter: z.number().int().min(0).default(1),
  windowStart: TimeSchema.optional(),
  windowEnd: TimeSchema.optional(),
  slotIntervalMinutes: z.number().int().positive().default(30),
  maxSuggestionsPerOccurrence: z.number().int().positive().default(3),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
}).superRefine((series, context) => {
  if (series.windowStart && series.windowEnd) {
    const startMinutes = parseClockMinutes(series.windowStart);
    const endMinutes = parseClockMinutes(series.windowEnd);
    if (endMinutes <= startMinutes) {
      context.addIssue({
        code: "custom",
        path: ["windowEnd"],
        message: "windowEnd must be later than windowStart."
      });
    }
  }
});

const RecurringMeetingOccurrenceSchema = z.object({
  date: DateSchema,
  startTime: TimeSchema,
  endTime: TimeSchema
}).superRefine((occurrence, context) => {
  const startMinutes = parseClockMinutes(occurrence.startTime);
  const endMinutes = parseClockMinutes(occurrence.endTime);
  if (endMinutes <= startMinutes) {
    context.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "endTime must be later than startTime."
    });
  }
});

export const ReclaimRecurringMeetingReschedulePreviewInputSchema = z.object({
  series: RecurringMeetingSeriesSchema,
  occurrences: z.array(RecurringMeetingOccurrenceSchema).min(1),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([]),
  busyMeetings: z.array(BusyMeetingSchema).default([])
}).superRefine((input, context) => {
  for (const [index, occurrence] of input.occurrences.entries()) {
    const occurrenceDurationMinutes =
      parseClockMinutes(occurrence.endTime) - parseClockMinutes(occurrence.startTime);
    if (occurrenceDurationMinutes !== input.series.durationMinutes) {
      context.addIssue({
        code: "custom",
        path: ["occurrences", index, "endTime"],
        message: `Occurrence duration must match series.durationMinutes (${input.series.durationMinutes}).`
      });
    }
  }
});

export type ReclaimRecurringMeetingReschedulePreviewInput =
  z.infer<typeof ReclaimRecurringMeetingReschedulePreviewInputSchema>;

export interface RecurringMeetingSeriesSummary {
  title: string;
  durationMinutes: number;
  eventCategory: ReclaimTaskEventCategory;
  searchDaysBefore: number;
  searchDaysAfter: number;
  windowStart?: string;
  windowEnd?: string;
  slotIntervalMinutes: number;
  maxSuggestionsPerOccurrence: number;
}

export interface RecurringMeetingOriginalSlotAssessment {
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason: string;
  blockingMeetingTitles: string[];
}

export interface RecurringMeetingSuggestedSlot extends MeetingAvailabilityCandidateSlot {
  daysFromOriginal: number;
}

export interface RecurringMeetingOccurrenceOutcome {
  occurrenceDate: string;
  action: "keep" | "move" | "blocked";
  searchRangeStart: string;
  searchRangeEnd: string;
  originalSlot: RecurringMeetingOriginalSlotAssessment;
  suggestedSlots: RecurringMeetingSuggestedSlot[];
  notes: string[];
}

export interface RecurringMeetingReschedulePreview {
  series: RecurringMeetingSeriesSummary;
  selectedPolicy?: TimePolicyDiscoveryItem;
  selectionReason: string;
  occurrenceCount: number;
  keptOccurrenceCount: number;
  movedOccurrenceCount: number;
  blockedOccurrenceCount: number;
  outcomes: RecurringMeetingOccurrenceOutcome[];
  writeSafety: "preview_only";
}

function parseClockMinutes(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

function addDays(date: string, offset: number): string {
  const cursor = new Date(`${date}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() + offset);
  return cursor.toISOString().slice(0, 10);
}

function differenceInDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000
  );
}

function buildSeriesSummary(
  series: ReclaimRecurringMeetingReschedulePreviewInput["series"]
): RecurringMeetingSeriesSummary {
  return {
    title: series.title,
    durationMinutes: series.durationMinutes,
    eventCategory: series.eventCategory,
    searchDaysBefore: series.searchDaysBefore,
    searchDaysAfter: series.searchDaysAfter,
    windowStart: series.windowStart,
    windowEnd: series.windowEnd,
    slotIntervalMinutes: series.slotIntervalMinutes,
    maxSuggestionsPerOccurrence: series.maxSuggestionsPerOccurrence
  };
}

function buildExactSlotPreview(
  input: ReclaimRecurringMeetingReschedulePreviewInput,
  occurrence: ReclaimRecurringMeetingReschedulePreviewInput["occurrences"][number]
) {
  return previewMeetingAvailability(
    ReclaimMeetingAvailabilityPreviewInputSchema.parse({
      request: {
        title: input.series.title,
        durationMinutes: input.series.durationMinutes,
        eventCategory: input.series.eventCategory,
        dateRangeStart: occurrence.date,
        dateRangeEnd: occurrence.date,
        windowStart: occurrence.startTime,
        windowEnd: occurrence.endTime,
        slotIntervalMinutes: input.series.slotIntervalMinutes,
        maxSuggestions: 1,
        preferredTimePolicyId: input.series.preferredTimePolicyId,
        preferredTimePolicyTitle: input.series.preferredTimePolicyTitle
      },
      busyMeetings: input.busyMeetings,
      timeSchemes: input.timeSchemes
    })
  );
}

function buildSearchPreview(
  input: ReclaimRecurringMeetingReschedulePreviewInput,
  occurrence: ReclaimRecurringMeetingReschedulePreviewInput["occurrences"][number],
  searchRangeStart: string,
  searchRangeEnd: string
) {
  return previewMeetingAvailability(
    ReclaimMeetingAvailabilityPreviewInputSchema.parse({
      request: {
        title: input.series.title,
        durationMinutes: input.series.durationMinutes,
        eventCategory: input.series.eventCategory,
        dateRangeStart: searchRangeStart,
        dateRangeEnd: searchRangeEnd,
        windowStart: input.series.windowStart,
        windowEnd: input.series.windowEnd,
        slotIntervalMinutes: input.series.slotIntervalMinutes,
        maxSuggestions: 200,
        preferredTimePolicyId: input.series.preferredTimePolicyId,
        preferredTimePolicyTitle: input.series.preferredTimePolicyTitle
      },
      busyMeetings: input.busyMeetings,
      timeSchemes: input.timeSchemes
    })
  );
}

function buildOriginalSlotAssessment(
  input: ReclaimRecurringMeetingReschedulePreviewInput,
  exactPreview: ReturnType<typeof previewMeetingAvailability>,
  occurrence: ReclaimRecurringMeetingReschedulePreviewInput["occurrences"][number]
): RecurringMeetingOriginalSlotAssessment {
  const matchingCandidate = exactPreview.candidateSlots.find((candidate) => (
    candidate.date === occurrence.date &&
    candidate.startTime === occurrence.startTime &&
    candidate.endTime === occurrence.endTime
  ));
  const originalStartMinutes = parseClockMinutes(occurrence.startTime);
  const originalEndMinutes = parseClockMinutes(occurrence.endTime);
  const blockingTitles = Array.from(new Set(input.busyMeetings
    .filter((meeting) => meeting.date === occurrence.date)
    .filter((meeting) => (
      parseClockMinutes(meeting.startTime) < originalEndMinutes &&
      parseClockMinutes(meeting.endTime) > originalStartMinutes
    ))
    .map((meeting) => meeting.title)));

  return {
    date: occurrence.date,
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    isAvailable: Boolean(matchingCandidate),
    reason: matchingCandidate
      ? "The original recurring slot fit the selected time policy window and synthetic busy meetings."
      : exactPreview.excludedWindows[0]?.reason ?? exactPreview.daySummaries[0]?.notes[0] ??
          "The original recurring slot did not produce a viable preview slot.",
    blockingMeetingTitles: blockingTitles
  };
}

function buildSuggestedSlots(
  searchPreview: ReturnType<typeof previewMeetingAvailability>,
  occurrence: ReclaimRecurringMeetingReschedulePreviewInput["occurrences"][number],
  maxSuggestionsPerOccurrence: number
): RecurringMeetingSuggestedSlot[] {
  return searchPreview.candidateSlots
    .filter((candidate) => !(candidate.date === occurrence.date && candidate.startTime === occurrence.startTime))
    .slice(0, maxSuggestionsPerOccurrence)
    .map((candidate) => ({
      ...candidate,
      daysFromOriginal: differenceInDays(occurrence.date, candidate.date)
    }));
}

export function parseReclaimRecurringMeetingReschedulePreviewInput(
  raw: unknown
): ReclaimRecurringMeetingReschedulePreviewInput {
  return ReclaimRecurringMeetingReschedulePreviewInputSchema.parse(raw);
}

export function previewRecurringMeetingReschedule(
  input: ReclaimRecurringMeetingReschedulePreviewInput
): RecurringMeetingReschedulePreview {
  const parsed = ReclaimRecurringMeetingReschedulePreviewInputSchema.parse(input);
  const series = buildSeriesSummary(parsed.series);
  const outcomes: RecurringMeetingOccurrenceOutcome[] = [];
  let keptOccurrenceCount = 0;
  let movedOccurrenceCount = 0;
  let blockedOccurrenceCount = 0;
  let selectedPolicy: TimePolicyDiscoveryItem | undefined;
  let selectionReason = "No Reclaim task-assignment time policies were returned.";

  for (const occurrence of parsed.occurrences) {
    const searchRangeStart = addDays(occurrence.date, -parsed.series.searchDaysBefore);
    const searchRangeEnd = addDays(occurrence.date, parsed.series.searchDaysAfter);
    const exactPreview = buildExactSlotPreview(parsed, occurrence);
    const searchPreview = buildSearchPreview(parsed, occurrence, searchRangeStart, searchRangeEnd);
    selectedPolicy ??= searchPreview.selectedPolicy;
    selectionReason = searchPreview.selectionReason;

    const originalSlot = buildOriginalSlotAssessment(parsed, exactPreview, occurrence);
    const suggestedSlots = originalSlot.isAvailable
      ? []
      : buildSuggestedSlots(searchPreview, occurrence, parsed.series.maxSuggestionsPerOccurrence);
    const notes = originalSlot.isAvailable
      ? ["Original slot remains viable in the what-if simulation."]
      : suggestedSlots.length > 0
        ? [`Found ${suggestedSlots.length} reschedule option(s) inside the bounded preview search range.`]
        : ["No bounded reschedule options were available inside the preview search range."];
    const action = originalSlot.isAvailable
      ? "keep"
      : suggestedSlots.length > 0
        ? "move"
        : "blocked";

    if (action === "keep") {
      keptOccurrenceCount += 1;
    } else if (action === "move") {
      movedOccurrenceCount += 1;
    } else {
      blockedOccurrenceCount += 1;
    }

    outcomes.push({
      occurrenceDate: occurrence.date,
      action,
      searchRangeStart,
      searchRangeEnd,
      originalSlot,
      suggestedSlots,
      notes
    });
  }

  return {
    series,
    selectedPolicy,
    selectionReason,
    occurrenceCount: parsed.occurrences.length,
    keptOccurrenceCount,
    movedOccurrenceCount,
    blockedOccurrenceCount,
    outcomes,
    writeSafety: "preview_only"
  };
}

export const recurringMeetingReschedule = {
  preview: previewRecurringMeetingReschedule
};
