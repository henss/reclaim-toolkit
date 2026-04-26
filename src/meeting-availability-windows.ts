import type { ReclaimTimeSchemeRecord } from "./types.js";
import type { ReclaimMeetingAvailabilityPreviewInput } from "./meeting-availability.js";

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

export interface MeetingAvailabilityCandidateWindow {
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  availableMinutes: number;
  durationMinutes: number;
  slotCount: number;
  policyId: string;
  policyTitle: string;
  timezone?: string;
  policyWindowStart: string;
  policyWindowEnd: string;
}

export interface MeetingAvailabilityExcludedWindow {
  date: string;
  dayOfWeek: string;
  policyWindowStart: string;
  policyWindowEnd: string;
  requestedWindowStart: string;
  requestedWindowEnd: string;
  availableMinutes: number;
  reason: string;
  blockingMeetingTitles: string[];
}

export interface MeetingAvailabilityDaySummary {
  date: string;
  dayOfWeek: string;
  policyWindowCount: number;
  candidateWindowCount: number;
  candidateSlotCount: number;
  excludedWindowCount: number;
  blockedSlotCount: number;
  notes: string[];
}

interface BusyMeetingWindow {
  title: string;
  startMinutes: number;
  endMinutes: number;
}

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

function overlaps(startMinutes: number, endMinutes: number, busyStartMinutes: number, busyEndMinutes: number): boolean {
  return startMinutes < busyEndMinutes && busyStartMinutes < endMinutes;
}

function mergeBusyMeetings(busyMeetings: BusyMeetingWindow[]): BusyMeetingWindow[] {
  if (busyMeetings.length === 0) {
    return [];
  }

  const sorted = [...busyMeetings].sort((left, right) => left.startMinutes - right.startMinutes);
  const merged: BusyMeetingWindow[] = [sorted[0]!];

  for (const meeting of sorted.slice(1)) {
    const previous = merged.at(-1)!;
    if (meeting.startMinutes <= previous.endMinutes) {
      previous.endMinutes = Math.max(previous.endMinutes, meeting.endMinutes);
      if (!previous.title.includes(meeting.title)) {
        previous.title = `${previous.title}, ${meeting.title}`;
      }
      continue;
    }

    merged.push({ ...meeting });
  }

  return merged;
}

function buildAvailabilityWindowReason(
  availableMinutes: number,
  durationMinutes: number,
  blockingMeetingTitles: string[]
): string {
  if (blockingMeetingTitles.length === 0) {
    return `The overlapping policy window exposed only ${availableMinutes} minute(s), below the requested ${durationMinutes} minute duration.`;
  }

  return `Synthetic busy meetings (${blockingMeetingTitles.join(", ")}) left only ${availableMinutes} minute(s), below the requested ${durationMinutes} minute duration.`;
}

function createBusyMeetingWindows(
  input: ReclaimMeetingAvailabilityPreviewInput,
  date: string
): BusyMeetingWindow[] {
  return input.busyMeetings
    .filter((meeting) => meeting.date === date)
    .map((meeting) => ({
      title: meeting.title,
      startMinutes: parseClockMinutes(meeting.startTime),
      endMinutes: parseClockMinutes(meeting.endTime)
    }));
}

function appendSlotsForAvailabilityWindow(
  candidateSlots: MeetingAvailabilityCandidateSlot[],
  selectedScheme: ReclaimTimeSchemeRecord,
  input: ReclaimMeetingAvailabilityPreviewInput,
  date: string,
  dayOfWeek: string,
  policyWindowStart: string,
  policyWindowEnd: string,
  availableStart: number,
  availableEnd: number
): number {
  let slotCount = 0;

  for (
    let slotStart = availableStart;
    slotStart + input.request.durationMinutes <= availableEnd;
    slotStart += input.request.slotIntervalMinutes
  ) {
    slotCount += 1;
    candidateSlots.push({
      date,
      dayOfWeek,
      startTime: formatClockMinutes(slotStart),
      endTime: formatClockMinutes(slotStart + input.request.durationMinutes),
      durationMinutes: input.request.durationMinutes,
      policyId: selectedScheme.id,
      policyTitle: selectedScheme.title,
      ...(selectedScheme.timezone ? { timezone: selectedScheme.timezone } : {}),
      policyWindowStart,
      policyWindowEnd
    });
  }

  return slotCount;
}

function appendWindowOutcome(
  outcomes: {
    candidateWindows: MeetingAvailabilityCandidateWindow[];
    excludedWindows: MeetingAvailabilityExcludedWindow[];
    candidateSlots: MeetingAvailabilityCandidateSlot[];
    notes: string[];
    blockedSlotCount: number;
  },
  context: {
    date: string;
    dayOfWeek: string;
    selectedScheme: ReclaimTimeSchemeRecord;
    input: ReclaimMeetingAvailabilityPreviewInput;
    policyWindowStart: string;
    policyWindowEnd: string;
    requestedWindowStart: string;
    requestedWindowEnd: string;
    availableStart: number;
    availableEnd: number;
    overlappingBusyMeetings: BusyMeetingWindow[];
  }
): void {
  const availableMinutes = context.availableEnd - context.availableStart;
  if (availableMinutes <= 0) {
    return;
  }

  if (availableMinutes >= context.input.request.durationMinutes) {
    const slotCount = appendSlotsForAvailabilityWindow(
      outcomes.candidateSlots,
      context.selectedScheme,
      context.input,
      context.date,
      context.dayOfWeek,
      context.policyWindowStart,
      context.policyWindowEnd,
      context.availableStart,
      context.availableEnd
    );
    outcomes.candidateWindows.push({
      date: context.date,
      dayOfWeek: context.dayOfWeek,
      startTime: formatClockMinutes(context.availableStart),
      endTime: formatClockMinutes(context.availableEnd),
      availableMinutes,
      durationMinutes: context.input.request.durationMinutes,
      slotCount,
      policyId: context.selectedScheme.id,
      policyTitle: context.selectedScheme.title,
      ...(context.selectedScheme.timezone ? { timezone: context.selectedScheme.timezone } : {}),
      policyWindowStart: context.policyWindowStart,
      policyWindowEnd: context.policyWindowEnd
    });
    return;
  }

  const blockingMeetingTitles = context.overlappingBusyMeetings
    .filter((meeting) => meeting.startMinutes < context.availableEnd && meeting.endMinutes > context.availableStart)
    .map((meeting) => meeting.title);

  outcomes.excludedWindows.push({
    date: context.date,
    dayOfWeek: context.dayOfWeek,
    policyWindowStart: context.policyWindowStart,
    policyWindowEnd: context.policyWindowEnd,
    requestedWindowStart: context.requestedWindowStart,
    requestedWindowEnd: context.requestedWindowEnd,
    availableMinutes,
    reason: buildAvailabilityWindowReason(
      availableMinutes,
      context.input.request.durationMinutes,
      blockingMeetingTitles
    ),
    blockingMeetingTitles
  });
  outcomes.blockedSlotCount += 1;
}

export function buildMeetingAvailabilityDayPreview(
  date: string,
  selectedScheme: ReclaimTimeSchemeRecord,
  input: ReclaimMeetingAvailabilityPreviewInput,
  requestWindowStart?: number,
  requestWindowEnd?: number
): {
  candidateWindows: MeetingAvailabilityCandidateWindow[];
  excludedWindows: MeetingAvailabilityExcludedWindow[];
  candidateSlots: MeetingAvailabilityCandidateSlot[];
  daySummary: MeetingAvailabilityDaySummary;
} {
  const dayOfWeek = getDayName(date);
  const matchingWindows = (selectedScheme.windows ?? []).filter((window) => {
    if (!window.start || !window.end) {
      return false;
    }
    return !window.dayOfWeek || window.dayOfWeek.toLowerCase() === dayOfWeek;
  });

  const outcomes = {
    candidateWindows: [] as MeetingAvailabilityCandidateWindow[],
    excludedWindows: [] as MeetingAvailabilityExcludedWindow[],
    candidateSlots: [] as MeetingAvailabilityCandidateSlot[],
    notes: [] as string[],
    blockedSlotCount: 0
  };

  if (matchingWindows.length === 0) {
    outcomes.notes.push("The selected time policy does not expose a matching window for this day.");
  }

  const busyMeetings = createBusyMeetingWindows(input, date);
  for (const window of matchingWindows) {
    const windowStartMinutes = parseClockMinutes(window.start!);
    const windowEndMinutes = parseClockMinutes(window.end!);
    const effectiveStart = requestWindowStart === undefined
      ? windowStartMinutes
      : Math.max(windowStartMinutes, requestWindowStart);
    const effectiveEnd = requestWindowEnd === undefined
      ? windowEndMinutes
      : Math.min(windowEndMinutes, requestWindowEnd);
    const requestedWindowStart = formatClockMinutes(effectiveStart);
    const requestedWindowEnd = formatClockMinutes(effectiveEnd);

    if ((effectiveEnd - effectiveStart) < input.request.durationMinutes) {
      outcomes.excludedWindows.push({
        date,
        dayOfWeek,
        policyWindowStart: window.start!,
        policyWindowEnd: window.end!,
        requestedWindowStart,
        requestedWindowEnd,
        availableMinutes: Math.max(0, effectiveEnd - effectiveStart),
        reason: "The overlapping policy window is shorter than the requested meeting duration.",
        blockingMeetingTitles: []
      });
      outcomes.blockedSlotCount += 1;
      continue;
    }

    const overlappingBusyMeetings = mergeBusyMeetings(
      busyMeetings
        .filter((meeting) => overlaps(effectiveStart, effectiveEnd, meeting.startMinutes, meeting.endMinutes))
        .map((meeting) => ({
          title: meeting.title,
          startMinutes: Math.max(meeting.startMinutes, effectiveStart),
          endMinutes: Math.min(meeting.endMinutes, effectiveEnd)
        }))
    );

    let cursor = effectiveStart;
    for (const busyMeeting of [...overlappingBusyMeetings, {
      title: "",
      startMinutes: effectiveEnd,
      endMinutes: effectiveEnd
    }]) {
      appendWindowOutcome(outcomes, {
        date,
        dayOfWeek,
        selectedScheme,
        input,
        policyWindowStart: window.start!,
        policyWindowEnd: window.end!,
        requestedWindowStart,
        requestedWindowEnd,
        availableStart: cursor,
        availableEnd: busyMeeting.startMinutes,
        overlappingBusyMeetings
      });
      cursor = Math.max(cursor, busyMeeting.endMinutes);
    }
  }

  if (outcomes.candidateWindows.length === 0 && outcomes.excludedWindows.length > 0 && matchingWindows.length > 0) {
    outcomes.notes.push("No viable availability windows remained after applying the synthetic busy meetings and requested preview bounds.");
  }

  if (outcomes.excludedWindows.length > 0) {
    outcomes.notes.push(...outcomes.excludedWindows.map((window) => window.reason));
  }

  return {
    candidateWindows: outcomes.candidateWindows,
    excludedWindows: outcomes.excludedWindows,
    candidateSlots: outcomes.candidateSlots,
    daySummary: {
      date,
      dayOfWeek,
      policyWindowCount: matchingWindows.length,
      candidateWindowCount: outcomes.candidateWindows.length,
      candidateSlotCount: outcomes.candidateSlots.length,
      excludedWindowCount: outcomes.excludedWindows.length,
      blockedSlotCount: outcomes.blockedSlotCount,
      notes: outcomes.notes
    }
  };
}
