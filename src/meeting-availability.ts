import { z } from "zod";
import { ReclaimTimeSchemeSnapshotSchema, previewTimePolicySelection } from "./time-policy-selection.js";
import type { TimePolicyDiscoveryItem } from "./time-policy-selection.js";
import type { ReclaimTaskEventCategory, ReclaimTimeSchemeRecord } from "./types.js";

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
] as const;

type DayName = (typeof DAY_NAMES)[number];

const DayOfWeekSchema = z.enum(DAY_NAMES);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format.");
const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Expected time in HH:MM format.");

const BusyMeetingSchema = z.object({
  title: z.string().min(1),
  date: DateSchema,
  startTime: TimeSchema,
  endTime: TimeSchema
}).superRefine((meeting, context) => {
  const startMinutes = parseClockMinutes(meeting.startTime);
  const endMinutes = parseClockMinutes(meeting.endTime);
  if (endMinutes <= startMinutes) {
    context.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "endTime must be later than startTime."
    });
  }
});

const MeetingAvailabilityRequestSchema = z.object({
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).default("WORK"),
  dateRangeStart: DateSchema,
  dateRangeEnd: DateSchema,
  windowStart: TimeSchema.optional(),
  windowEnd: TimeSchema.optional(),
  slotIntervalMinutes: z.number().int().positive().default(30),
  maxSuggestions: z.number().int().positive().default(10),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
}).superRefine((request, context) => {
  const startDate = parseDateValue(request.dateRangeStart);
  const endDate = parseDateValue(request.dateRangeEnd);

  if (startDate > endDate) {
    context.addIssue({
      code: "custom",
      path: ["dateRangeEnd"],
      message: "dateRangeEnd must be on or after dateRangeStart."
    });
  }

  if (request.windowStart && request.windowEnd) {
    const startMinutes = parseClockMinutes(request.windowStart);
    const endMinutes = parseClockMinutes(request.windowEnd);
    if (endMinutes <= startMinutes) {
      context.addIssue({
        code: "custom",
        path: ["windowEnd"],
        message: "windowEnd must be later than windowStart."
      });
    }
  }
});

export const ReclaimMeetingAvailabilityPreviewInputSchema = z.object({
  request: MeetingAvailabilityRequestSchema,
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([]),
  busyMeetings: z.array(BusyMeetingSchema).default([])
});

export type ReclaimMeetingAvailabilityPreviewInput = z.infer<typeof ReclaimMeetingAvailabilityPreviewInputSchema>;

export interface MeetingAvailabilityRequestSummary {
  title: string;
  durationMinutes: number;
  eventCategory: ReclaimTaskEventCategory;
  dateRangeStart: string;
  dateRangeEnd: string;
  windowStart?: string;
  windowEnd?: string;
  slotIntervalMinutes: number;
  maxSuggestions: number;
}

export interface MeetingAvailabilityCandidateSlot {
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  policyId: string;
  policyTitle: string;
  timezone?: string;
  policyWindowStart: string;
  policyWindowEnd: string;
}

export interface MeetingAvailabilityDaySummary {
  date: string;
  dayOfWeek: string;
  policyWindowCount: number;
  candidateSlotCount: number;
  blockedSlotCount: number;
  notes: string[];
}

export interface MeetingAvailabilityPreview {
  request: MeetingAvailabilityRequestSummary;
  busyMeetingCount: number;
  selectedPolicy?: TimePolicyDiscoveryItem;
  selectionReason: string;
  totalCandidateCount: number;
  returnedCandidateCount: number;
  candidateSlots: MeetingAvailabilityCandidateSlot[];
  daySummaries: MeetingAvailabilityDaySummary[];
  writeSafety: "preview_only";
}

function parseDateValue(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function parseClockMinutes(value: string): number {
  const match = /^(?<hours>\d{2}):(?<minutes>\d{2})$/.exec(value);
  if (!match?.groups) {
    throw new Error(`Expected time in HH:MM format, received ${value}.`);
  }

  const hours = Number(match.groups.hours);
  const minutes = Number(match.groups.minutes);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Expected time in HH:MM format, received ${value}.`);
  }

  return (hours * 60) + minutes;
}

function formatClockMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getDayName(date: string): DayName {
  return DAY_NAMES[new Date(`${date}T12:00:00.000Z`).getUTCDay()]!;
}

function listDatesInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);

  while (cursor <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  return dates;
}

function overlaps(startMinutes: number, endMinutes: number, busyStartMinutes: number, busyEndMinutes: number): boolean {
  return startMinutes < busyEndMinutes && busyStartMinutes < endMinutes;
}

function buildRequestSummary(
  request: ReclaimMeetingAvailabilityPreviewInput["request"]
): MeetingAvailabilityRequestSummary {
  return {
    title: request.title,
    durationMinutes: request.durationMinutes,
    eventCategory: request.eventCategory,
    dateRangeStart: request.dateRangeStart,
    dateRangeEnd: request.dateRangeEnd,
    windowStart: request.windowStart,
    windowEnd: request.windowEnd,
    slotIntervalMinutes: request.slotIntervalMinutes,
    maxSuggestions: request.maxSuggestions
  };
}

function buildSelectedPolicy(
  timeSchemes: ReclaimTimeSchemeRecord[],
  request: ReclaimMeetingAvailabilityPreviewInput["request"]
): { selectedScheme?: ReclaimTimeSchemeRecord; selectedPolicy?: TimePolicyDiscoveryItem; selectionReason: string } {
  const selectionPreview = previewTimePolicySelection(timeSchemes, {
    preferredTimePolicyId: request.preferredTimePolicyId,
    preferredTimePolicyTitle: request.preferredTimePolicyTitle,
    eventCategory: request.eventCategory
  });

  return {
    selectedScheme: timeSchemes.find((scheme) => scheme.id === selectionPreview.selectedPolicy?.id),
    selectedPolicy: selectionPreview.selectedPolicy,
    selectionReason: selectionPreview.selectionReason
  };
}

export function parseReclaimMeetingAvailabilityPreviewInput(raw: unknown): ReclaimMeetingAvailabilityPreviewInput {
  return ReclaimMeetingAvailabilityPreviewInputSchema.parse(raw);
}

export function previewMeetingAvailability(
  input: ReclaimMeetingAvailabilityPreviewInput
): MeetingAvailabilityPreview {
  const parsed = ReclaimMeetingAvailabilityPreviewInputSchema.parse(input);
  const requestSummary = buildRequestSummary(parsed.request);
  const selection = buildSelectedPolicy(parsed.timeSchemes, parsed.request);

  if (!selection.selectedScheme) {
    return {
      request: requestSummary,
      busyMeetingCount: parsed.busyMeetings.length,
      selectedPolicy: selection.selectedPolicy,
      selectionReason: selection.selectionReason,
      totalCandidateCount: 0,
      returnedCandidateCount: 0,
      candidateSlots: [],
      daySummaries: listDatesInclusive(parsed.request.dateRangeStart, parsed.request.dateRangeEnd).map((date) => ({
        date,
        dayOfWeek: getDayName(date),
        policyWindowCount: 0,
        candidateSlotCount: 0,
        blockedSlotCount: 0,
        notes: ["No matching time policy was selected for this preview request."]
      })),
      writeSafety: "preview_only"
    };
  }

  const requestWindowStart = parsed.request.windowStart ? parseClockMinutes(parsed.request.windowStart) : undefined;
  const requestWindowEnd = parsed.request.windowEnd ? parseClockMinutes(parsed.request.windowEnd) : undefined;
  const candidateSlots: MeetingAvailabilityCandidateSlot[] = [];
  const daySummaries: MeetingAvailabilityDaySummary[] = [];

  for (const date of listDatesInclusive(parsed.request.dateRangeStart, parsed.request.dateRangeEnd)) {
    const dayOfWeek = getDayName(date);
    const matchingWindows = (selection.selectedScheme.windows ?? []).filter((window) => {
      if (!window.start || !window.end) {
        return false;
      }
      return !window.dayOfWeek || window.dayOfWeek.toLowerCase() === dayOfWeek;
    });

    const busyMeetings = parsed.busyMeetings.filter((meeting) => meeting.date === date);
    let candidateSlotCount = 0;
    let blockedSlotCount = 0;
    const notes: string[] = [];

    if (matchingWindows.length === 0) {
      notes.push("The selected time policy does not expose a matching window for this day.");
    }

    for (const window of matchingWindows) {
      const windowStartMinutes = parseClockMinutes(window.start!);
      const windowEndMinutes = parseClockMinutes(window.end!);
      const effectiveStart = requestWindowStart === undefined
        ? windowStartMinutes
        : Math.max(windowStartMinutes, requestWindowStart);
      const effectiveEnd = requestWindowEnd === undefined
        ? windowEndMinutes
        : Math.min(windowEndMinutes, requestWindowEnd);

      if ((effectiveEnd - effectiveStart) < parsed.request.durationMinutes) {
        blockedSlotCount += 1;
        notes.push("The requested preview window is shorter than the selected policy window on this day.");
        continue;
      }

      for (
        let slotStart = effectiveStart;
        slotStart + parsed.request.durationMinutes <= effectiveEnd;
        slotStart += parsed.request.slotIntervalMinutes
      ) {
        const slotEnd = slotStart + parsed.request.durationMinutes;
        const blocked = busyMeetings.some((meeting) => overlaps(
          slotStart,
          slotEnd,
          parseClockMinutes(meeting.startTime),
          parseClockMinutes(meeting.endTime)
        ));

        if (blocked) {
          blockedSlotCount += 1;
          continue;
        }

        candidateSlotCount += 1;
        candidateSlots.push({
          date,
          dayOfWeek,
          startTime: formatClockMinutes(slotStart),
          endTime: formatClockMinutes(slotEnd),
          durationMinutes: parsed.request.durationMinutes,
          policyId: selection.selectedScheme.id,
          policyTitle: selection.selectedScheme.title,
          timezone: selection.selectedScheme.timezone,
          policyWindowStart: window.start!,
          policyWindowEnd: window.end!
        });
      }
    }

    if (candidateSlotCount === 0 && blockedSlotCount > 0 && matchingWindows.length > 0) {
      notes.push("Candidate slots were blocked by synthetic busy meetings or by the requested preview window.");
    }

    daySummaries.push({
      date,
      dayOfWeek,
      policyWindowCount: matchingWindows.length,
      candidateSlotCount,
      blockedSlotCount,
      notes
    });
  }

  return {
    request: requestSummary,
    busyMeetingCount: parsed.busyMeetings.length,
    selectedPolicy: selection.selectedPolicy,
    selectionReason: selection.selectionReason,
    totalCandidateCount: candidateSlots.length,
    returnedCandidateCount: Math.min(candidateSlots.length, parsed.request.maxSuggestions),
    candidateSlots: candidateSlots.slice(0, parsed.request.maxSuggestions),
    daySummaries,
    writeSafety: "preview_only"
  };
}

export const meetingAvailability = {
  preview: previewMeetingAvailability
};
