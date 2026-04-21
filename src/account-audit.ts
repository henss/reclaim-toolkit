import { z } from "zod";
import type { ReclaimClient } from "./client.js";
import type {
  ReclaimCurrentUser,
  ReclaimMeetingRecord,
  ReclaimTaskRecord,
  ReclaimTimeSchemeRecord
} from "./types.js";

const ReclaimCurrentUserSnapshotSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  email: z.string(),
  name: z.string().optional()
});

const ReclaimTaskSnapshotSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => Number(value)),
  title: z.string().min(1),
  notes: z.string().optional(),
  eventCategory: z.string().default("PERSONAL"),
  timeSchemeId: z.string().default(""),
  due: z.string().optional(),
  snoozeUntil: z.string().optional()
});

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
  taskCategory: z.string().default("PERSONAL"),
  title: z.string().min(1),
  description: z.string().optional(),
  timezone: z.string().optional(),
  features: z.array(z.string()).default([]),
  windows: z.array(ReclaimTimeSchemeWindowSnapshotSchema).default([])
});

export const ReclaimAccountAuditSnapshotSchema = z.object({
  currentUser: ReclaimCurrentUserSnapshotSchema.optional(),
  tasks: z.array(ReclaimTaskSnapshotSchema).default([]),
  meetings: z.array(ReclaimMeetingSnapshotSchema).default([]),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([])
});

export interface AccountAuditSnapshot {
  currentUser?: ReclaimCurrentUser;
  tasks: ReclaimTaskRecord[];
  meetings: ReclaimMeetingRecord[];
  timeSchemes: ReclaimTimeSchemeRecord[];
}

export interface AccountAuditCountItem {
  label: string;
  count: number;
}

export interface AccountAuditInspection {
  identity: {
    authenticated: boolean;
    hasDisplayName: boolean;
  };
  taskCount: number;
  taskCategoryBreakdown: AccountAuditCountItem[];
  dueTaskCount: number;
  snoozedTaskCount: number;
  meetingCount: number;
  meetingsWithAttendeesCount: number;
  totalMeetingDurationMinutes: number;
  hourPolicyCount: number;
  taskAssignmentPolicyCount: number;
  windowedHourPolicyCount: number;
  timezoneCount: number;
  timeSchemeFeatureCoverage: AccountAuditCountItem[];
  readSafety: "read_only";
}

function countByLabel(values: string[]): AccountAuditCountItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function parseReclaimAccountAuditSnapshot(raw: unknown): AccountAuditSnapshot {
  return ReclaimAccountAuditSnapshotSchema.parse(raw);
}

export function inspectAccountAuditSnapshot(snapshot: AccountAuditSnapshot): AccountAuditInspection {
  const timeSchemeFeatureCoverage = countByLabel(snapshot.timeSchemes.flatMap((scheme) => scheme.features));

  return {
    identity: {
      authenticated: snapshot.currentUser !== undefined,
      hasDisplayName: Boolean(snapshot.currentUser?.name)
    },
    taskCount: snapshot.tasks.length,
    taskCategoryBreakdown: countByLabel(snapshot.tasks.map((task) => task.eventCategory || "PERSONAL")),
    dueTaskCount: snapshot.tasks.filter((task) => task.due !== undefined).length,
    snoozedTaskCount: snapshot.tasks.filter((task) => task.snoozeUntil !== undefined).length,
    meetingCount: snapshot.meetings.length,
    meetingsWithAttendeesCount: snapshot.meetings.filter((meeting) => (meeting.attendeeCount ?? 0) > 0).length,
    totalMeetingDurationMinutes: snapshot.meetings.reduce(
      (total, meeting) => total + (meeting.durationMinutes ?? 0),
      0
    ),
    hourPolicyCount: snapshot.timeSchemes.length,
    taskAssignmentPolicyCount: snapshot.timeSchemes.filter((scheme) => scheme.features.includes("TASK_ASSIGNMENT"))
      .length,
    windowedHourPolicyCount: snapshot.timeSchemes.filter((scheme) => (scheme.windows?.length ?? 0) > 0).length,
    timezoneCount: new Set(
      snapshot.timeSchemes
        .map((scheme) => scheme.timezone)
        .filter((timezone): timezone is string => Boolean(timezone))
    ).size,
    timeSchemeFeatureCoverage,
    readSafety: "read_only"
  };
}

export async function inspectAccountAudit(client: ReclaimClient): Promise<AccountAuditInspection> {
  const [currentUser, tasks, meetings, timeSchemes] = await Promise.all([
    client.getCurrentUser(),
    client.listTasks(),
    client.listMeetings(),
    client.listTimeSchemes()
  ]);

  return inspectAccountAuditSnapshot({ currentUser, tasks, meetings, timeSchemes });
}

export const accountAudit = {
  inspect: inspectAccountAudit,
  inspectSnapshot: inspectAccountAuditSnapshot
};
