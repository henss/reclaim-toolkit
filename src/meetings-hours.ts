import { z } from "zod";
import type { ReclaimClient } from "./client.js";
import { createPreviewReceipt, type PreviewReceipt } from "./preview-receipts.js";
import { previewHoursPresetSwitches } from "./meetings-hours-profile-switch.js";
import type { ReclaimMeetingRecord, ReclaimTimeSchemeRecord } from "./types.js";

const ReclaimMeetingSnapshotSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  title: z.string().min(1),
  start: z.string().optional(),
  end: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  attendeeCount: z.number().int().nonnegative().optional()
});

const ReclaimTimeSchemeWindowSnapshotSchema = z.object({
  dayOfWeek: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional()
});

const ReclaimTimeSchemeSnapshotSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  taskCategory: z.string().default("PERSONAL"),
  description: z.string().optional(),
  timezone: z.string().optional(),
  features: z.array(z.string()).default([]),
  windows: z.array(ReclaimTimeSchemeWindowSnapshotSchema).default([])
});

export const ReclaimMeetingsAndHoursSnapshotSchema = z.object({
  meetings: z.array(ReclaimMeetingSnapshotSchema).default([]),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([])
});

export interface MeetingsAndHoursSnapshot {
  meetings: ReclaimMeetingRecord[];
  timeSchemes: ReclaimTimeSchemeRecord[];
}

export interface MeetingInspectionItem {
  id: string;
  title: string;
  start?: string;
  end?: string;
  durationMinutes?: number;
  attendeeCount?: number;
}

export interface HourPolicyInspectionItem {
  id: string;
  title: string;
  taskCategory: string;
  features: string[];
  timezone?: string;
  windowCount: number;
}

export interface MeetingsAndHoursInspection {
  meetingCount: number;
  meetings: MeetingInspectionItem[];
  hourPolicyCount: number;
  hourPolicies: HourPolicyInspectionItem[];
  readSafety: "read_only";
}

export interface MeetingsAndHoursInspectionPreview extends MeetingsAndHoursInspection {
  previewReceipt: PreviewReceipt;
}

export function parseReclaimMeetingsAndHoursSnapshot(raw: unknown): MeetingsAndHoursSnapshot {
  return ReclaimMeetingsAndHoursSnapshotSchema.parse(raw);
}

export function inspectMeetingsAndHoursSnapshot(
  snapshot: MeetingsAndHoursSnapshot
): MeetingsAndHoursInspection {
  return {
    meetingCount: snapshot.meetings.length,
    meetings: snapshot.meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      start: meeting.start,
      end: meeting.end,
      durationMinutes: meeting.durationMinutes,
      attendeeCount: meeting.attendeeCount
    })),
    hourPolicyCount: snapshot.timeSchemes.length,
    hourPolicies: snapshot.timeSchemes.map((scheme) => ({
      id: scheme.id,
      title: scheme.title,
      taskCategory: scheme.taskCategory,
      features: scheme.features,
      timezone: scheme.timezone,
      windowCount: scheme.windows?.length ?? 0
    })),
    readSafety: "read_only"
  };
}

export function previewMeetingsAndHoursSnapshot(
  snapshot: MeetingsAndHoursSnapshot
): MeetingsAndHoursInspectionPreview {
  return {
    ...inspectMeetingsAndHoursSnapshot(snapshot),
    previewReceipt: createPreviewReceipt({
      operation: "hours.inspect.preview",
      readinessStatus: "read_only_boundary",
      readinessGate:
        "Meetings and hours inspection remains read-only and does not create meetings or update hours."
    })
  };
}

export async function inspectMeetingsAndHours(
  client: ReclaimClient
): Promise<MeetingsAndHoursInspection> {
  const [meetings, timeSchemes] = await Promise.all([
    client.listMeetings(),
    client.listTimeSchemes()
  ]);
  return inspectMeetingsAndHoursSnapshot({ meetings, timeSchemes });
}

export const meetingsHours = {
  inspect: inspectMeetingsAndHours,
  inspectSnapshot: inspectMeetingsAndHoursSnapshot,
  previewInspectSnapshot: previewMeetingsAndHoursSnapshot,
  previewPresetSwitches: previewHoursPresetSwitches
};

export {
  parseReclaimHoursPresetSwitchPreviewInput,
  previewHoursPresetSwitches,
  type HoursPresetSwitchPreview,
  type HoursPresetSwitchPreviewTarget,
  type HoursProfilePreview
} from "./meetings-hours-profile-switch.js";
