import { z } from "zod";
import {
  buildMeetingAvailabilityDayPreview,
  type MeetingAvailabilityCandidateSlot,
  type MeetingAvailabilityCandidateWindow,
  type MeetingAvailabilityDaySummary,
  type MeetingAvailabilityExcludedWindow
} from "./meeting-availability-windows.js";
import { ReclaimTimeSchemeSnapshotSchema, previewTimePolicySelection } from "./time-policy-selection.js";
import type { TimePolicyDiscoveryItem } from "./time-policy-selection.js";
import type { ReclaimTaskEventCategory, ReclaimTimeSchemeRecord } from "./types.js";

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

export type {
  MeetingAvailabilityCandidateSlot,
  MeetingAvailabilityCandidateWindow,
  MeetingAvailabilityExcludedWindow,
  MeetingAvailabilityDaySummary
} from "./meeting-availability-windows.js";

export interface MeetingAvailabilityPreview {
  request: MeetingAvailabilityRequestSummary;
  busyMeetingCount: number;
  selectedPolicy?: TimePolicyDiscoveryItem;
  selectionReason: string;
  totalCandidateWindowCount: number;
  returnedCandidateWindowCount: number;
  candidateWindows: MeetingAvailabilityCandidateWindow[];
  excludedWindows: MeetingAvailabilityExcludedWindow[];
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
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
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

function buildNoPolicyPreview(
  parsed: ReclaimMeetingAvailabilityPreviewInput,
  requestSummary: MeetingAvailabilityRequestSummary,
  selection: { selectedPolicy?: TimePolicyDiscoveryItem; selectionReason: string }
): MeetingAvailabilityPreview {
  return {
    request: requestSummary,
    busyMeetingCount: parsed.busyMeetings.length,
    selectedPolicy: selection.selectedPolicy,
    selectionReason: selection.selectionReason,
    totalCandidateWindowCount: 0,
    returnedCandidateWindowCount: 0,
    candidateWindows: [],
    excludedWindows: [],
    totalCandidateCount: 0,
    returnedCandidateCount: 0,
    candidateSlots: [],
    daySummaries: listDatesInclusive(parsed.request.dateRangeStart, parsed.request.dateRangeEnd).map((date) => ({
      date,
      dayOfWeek: new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase(),
      policyWindowCount: 0,
      candidateWindowCount: 0,
      candidateSlotCount: 0,
      excludedWindowCount: 0,
      blockedSlotCount: 0,
      notes: ["No matching time policy was selected for this preview request."]
    })),
    writeSafety: "preview_only"
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
    return buildNoPolicyPreview(parsed, requestSummary, selection);
  }

  const requestWindowStart = parsed.request.windowStart ? parseClockMinutes(parsed.request.windowStart) : undefined;
  const requestWindowEnd = parsed.request.windowEnd ? parseClockMinutes(parsed.request.windowEnd) : undefined;
  const candidateWindows: MeetingAvailabilityCandidateWindow[] = [];
  const excludedWindows: MeetingAvailabilityExcludedWindow[] = [];
  const candidateSlots: MeetingAvailabilityCandidateSlot[] = [];
  const daySummaries: MeetingAvailabilityDaySummary[] = [];

  for (const date of listDatesInclusive(parsed.request.dateRangeStart, parsed.request.dateRangeEnd)) {
    const dayPreview = buildMeetingAvailabilityDayPreview(
      date,
      selection.selectedScheme,
      parsed,
      requestWindowStart,
      requestWindowEnd
    );
    candidateWindows.push(...dayPreview.candidateWindows);
    excludedWindows.push(...dayPreview.excludedWindows);
    candidateSlots.push(...dayPreview.candidateSlots);
    daySummaries.push(dayPreview.daySummary);
  }

  return {
    request: requestSummary,
    busyMeetingCount: parsed.busyMeetings.length,
    selectedPolicy: selection.selectedPolicy,
    selectionReason: selection.selectionReason,
    totalCandidateWindowCount: candidateWindows.length,
    returnedCandidateWindowCount: Math.min(candidateWindows.length, parsed.request.maxSuggestions),
    candidateWindows: candidateWindows.slice(0, parsed.request.maxSuggestions),
    excludedWindows,
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
