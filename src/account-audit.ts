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

export type AccountAuditDriftGroup = "identity" | "activity" | "coverage";
export type AccountAuditDriftDirection = "increase" | "decrease" | "unchanged";
export type AccountAuditDriftBand = "no_change" | "incremental" | "material";
export type AccountAuditChangeClass =
  | "no_change"
  | "activity_drift"
  | "coverage_drift"
  | "identity_drift"
  | "mixed_drift";

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

export interface AccountAuditDriftMetricChange {
  metric: string;
  group: Exclude<AccountAuditDriftGroup, "identity">;
  baseline: number;
  current: number;
  delta: number;
  direction: AccountAuditDriftDirection;
  driftBand: AccountAuditDriftBand;
}

export interface AccountAuditDriftFlagChange {
  flag: "authenticated" | "hasDisplayName";
  group: "identity";
  baseline: boolean;
  current: boolean;
  changed: boolean;
}

export interface AccountAuditDriftSnapshotReference {
  handle: string;
  snapshot: AccountAuditSnapshot;
}

export interface AccountAuditDriftInput {
  baseline: AccountAuditDriftSnapshotReference;
  current: AccountAuditDriftSnapshotReference;
}

export interface AccountAuditDriftDigest {
  sourceHandles: {
    baseline: string;
    current: string;
  };
  baseline: AccountAuditInspection;
  current: AccountAuditInspection;
  overallChangeClass: AccountAuditChangeClass;
  summary: string;
  changedSignalCount: number;
  driftBandCounts: {
    incremental: number;
    material: number;
  };
  metricChanges: AccountAuditDriftMetricChange[];
  flagChanges: AccountAuditDriftFlagChange[];
  readSafety: "read_only";
}

const ReclaimAccountAuditDriftSnapshotReferenceSchema = z.object({
  handle: z.string().min(1),
  snapshot: ReclaimAccountAuditSnapshotSchema
});

export const ReclaimAccountAuditDriftInputSchema = z.object({
  baseline: ReclaimAccountAuditDriftSnapshotReferenceSchema,
  current: ReclaimAccountAuditDriftSnapshotReferenceSchema
});

const ACCOUNT_AUDIT_NUMERIC_METRICS: Array<{
  metric: Exclude<keyof AccountAuditInspection, "identity" | "taskCategoryBreakdown" | "timeSchemeFeatureCoverage" | "readSafety">;
  group: Exclude<AccountAuditDriftGroup, "identity">;
}> = [
  { metric: "taskCount", group: "activity" },
  { metric: "dueTaskCount", group: "activity" },
  { metric: "snoozedTaskCount", group: "activity" },
  { metric: "meetingCount", group: "activity" },
  { metric: "meetingsWithAttendeesCount", group: "activity" },
  { metric: "totalMeetingDurationMinutes", group: "activity" },
  { metric: "hourPolicyCount", group: "coverage" },
  { metric: "taskAssignmentPolicyCount", group: "coverage" },
  { metric: "windowedHourPolicyCount", group: "coverage" },
  { metric: "timezoneCount", group: "coverage" }
];

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

export function parseReclaimAccountAuditDriftInput(raw: unknown): AccountAuditDriftInput {
  return ReclaimAccountAuditDriftInputSchema.parse(raw);
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

function toCountMap(items: AccountAuditCountItem[]): Map<string, number> {
  return new Map(items.map((item) => [item.label, item.count]));
}

function toDriftDirection(delta: number): AccountAuditDriftDirection {
  if (delta === 0) {
    return "unchanged";
  }

  return delta > 0 ? "increase" : "decrease";
}

function toDriftBand(delta: number): AccountAuditDriftBand {
  const magnitude = Math.abs(delta);
  if (magnitude === 0) {
    return "no_change";
  }

  return magnitude === 1 ? "incremental" : "material";
}

function compareInspectionMetric(
  metric: string,
  group: Exclude<AccountAuditDriftGroup, "identity">,
  baseline: number,
  current: number
): AccountAuditDriftMetricChange | undefined {
  const delta = current - baseline;
  if (delta === 0) {
    return undefined;
  }

  return {
    metric,
    group,
    baseline,
    current,
    delta,
    direction: toDriftDirection(delta),
    driftBand: toDriftBand(delta)
  };
}

function compareCountBreakdowns(
  metricPrefix: string,
  group: Exclude<AccountAuditDriftGroup, "identity">,
  baseline: AccountAuditCountItem[],
  current: AccountAuditCountItem[]
): AccountAuditDriftMetricChange[] {
  const baselineCounts = toCountMap(baseline);
  const currentCounts = toCountMap(current);
  const labels = [...new Set([...baselineCounts.keys(), ...currentCounts.keys()])].sort((left, right) =>
    left.localeCompare(right)
  );

  return labels.flatMap((label) => {
    const change = compareInspectionMetric(
      `${metricPrefix}:${label}`,
      group,
      baselineCounts.get(label) ?? 0,
      currentCounts.get(label) ?? 0
    );
    return change ? [change] : [];
  });
}

function classifyAccountAuditDrift(
  metricChanges: AccountAuditDriftMetricChange[],
  flagChanges: AccountAuditDriftFlagChange[]
): AccountAuditChangeClass {
  const groups = new Set<AccountAuditDriftGroup>([
    ...metricChanges.map((change) => change.group),
    ...flagChanges.map((change) => change.group)
  ]);

  if (groups.size === 0) {
    return "no_change";
  }

  if (groups.size > 1) {
    return "mixed_drift";
  }

  const [group] = [...groups];
  if (group === "identity") {
    return "identity_drift";
  }

  return group === "activity" ? "activity_drift" : "coverage_drift";
}

function summarizeAccountAuditDrift(
  baselineHandle: string,
  currentHandle: string,
  overallChangeClass: AccountAuditChangeClass,
  metricChanges: AccountAuditDriftMetricChange[],
  flagChanges: AccountAuditDriftFlagChange[]
): string {
  if (overallChangeClass === "no_change") {
    return `No account-audit drift detected between ${baselineHandle} and ${currentHandle}.`;
  }

  const changedMetricCount = metricChanges.length;
  const changedFlagCount = flagChanges.length;
  const changedMetricLabel =
    changedMetricCount === 1 ? "1 numeric or coverage signal" : `${changedMetricCount} numeric or coverage signals`;
  const changedFlagLabel =
    changedFlagCount === 0
      ? "no identity flag changes"
      : changedFlagCount === 1
        ? "1 identity flag change"
        : `${changedFlagCount} identity flag changes`;

  return `Detected ${overallChangeClass} between ${baselineHandle} and ${currentHandle} across ${changedMetricLabel} and ${changedFlagLabel}.`;
}

export function createAccountAuditDriftDigest(input: AccountAuditDriftInput): AccountAuditDriftDigest {
  const baselineInspection = inspectAccountAuditSnapshot(input.baseline.snapshot);
  const currentInspection = inspectAccountAuditSnapshot(input.current.snapshot);

  const numericMetricChanges = ACCOUNT_AUDIT_NUMERIC_METRICS.flatMap(({ metric, group }) => {
    const change = compareInspectionMetric(metric, group, baselineInspection[metric], currentInspection[metric]);
    return change ? [change] : [];
  });
  const breakdownMetricChanges = [
    ...compareCountBreakdowns(
      "taskCategory",
      "activity",
      baselineInspection.taskCategoryBreakdown,
      currentInspection.taskCategoryBreakdown
    ),
    ...compareCountBreakdowns(
      "timeSchemeFeature",
      "coverage",
      baselineInspection.timeSchemeFeatureCoverage,
      currentInspection.timeSchemeFeatureCoverage
    )
  ];
  const metricChanges = [...numericMetricChanges, ...breakdownMetricChanges];
  const flagChanges = [
    {
      flag: "authenticated" as const,
      group: "identity" as const,
      baseline: baselineInspection.identity.authenticated,
      current: currentInspection.identity.authenticated,
      changed: baselineInspection.identity.authenticated !== currentInspection.identity.authenticated
    },
    {
      flag: "hasDisplayName" as const,
      group: "identity" as const,
      baseline: baselineInspection.identity.hasDisplayName,
      current: currentInspection.identity.hasDisplayName,
      changed: baselineInspection.identity.hasDisplayName !== currentInspection.identity.hasDisplayName
    }
  ].filter((change) => change.changed);

  const overallChangeClass = classifyAccountAuditDrift(metricChanges, flagChanges);

  return {
    sourceHandles: {
      baseline: input.baseline.handle,
      current: input.current.handle
    },
    baseline: baselineInspection,
    current: currentInspection,
    overallChangeClass,
    summary: summarizeAccountAuditDrift(
      input.baseline.handle,
      input.current.handle,
      overallChangeClass,
      metricChanges,
      flagChanges
    ),
    changedSignalCount: metricChanges.length + flagChanges.length,
    driftBandCounts: {
      incremental: metricChanges.filter((change) => change.driftBand === "incremental").length,
      material: metricChanges.filter((change) => change.driftBand === "material").length
    },
    metricChanges,
    flagChanges,
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
  inspectSnapshot: inspectAccountAuditSnapshot,
  createDriftDigest: createAccountAuditDriftDigest
};
