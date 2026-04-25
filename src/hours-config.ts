import { z } from "zod";
import type { ReclaimClient } from "./client.js";
import type { ReclaimTimeSchemeRecord } from "./types.js";

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

export const ReclaimHoursConfigSnapshotSchema = z.object({
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([])
});

const ReclaimHoursConfigDriftSnapshotReferenceSchema = z.object({
  handle: z.string().min(1),
  snapshot: ReclaimHoursConfigSnapshotSchema
});

export const ReclaimHoursConfigDiffInputSchema = z.object({
  baseline: ReclaimHoursConfigDriftSnapshotReferenceSchema,
  current: ReclaimHoursConfigDriftSnapshotReferenceSchema
});

export interface HoursConfigSnapshot {
  timeSchemes: ReclaimTimeSchemeRecord[];
}

export interface HoursConfigCountItem {
  label: string;
  count: number;
}

export interface HoursConfigAuditInspection {
  hourPolicyCount: number;
  taskCategoryBreakdown: HoursConfigCountItem[];
  taskAssignmentPolicyCount: number;
  availabilityPolicyCount: number;
  totalWindowCount: number;
  windowedHourPolicyCount: number;
  policyWithoutWindowsCount: number;
  timezoneCount: number;
  timeSchemeFeatureCoverage: HoursConfigCountItem[];
  weekdayCoverage: HoursConfigCountItem[];
  readSafety: "read_only";
}

export type HoursConfigDriftGroup = "coverage" | "windowing";
export type HoursConfigDriftDirection = "increase" | "decrease" | "unchanged";
export type HoursConfigDriftBand = "no_change" | "incremental" | "material";
export type HoursConfigChangeClass =
  | "no_change"
  | "coverage_drift"
  | "windowing_drift"
  | "mixed_drift";

export interface HoursConfigDiffMetricChange {
  metric: string;
  group: HoursConfigDriftGroup;
  baseline: number;
  current: number;
  delta: number;
  direction: HoursConfigDriftDirection;
  driftBand: HoursConfigDriftBand;
}

export interface HoursConfigDiffSnapshotReference {
  handle: string;
  snapshot: HoursConfigSnapshot;
}

export interface HoursConfigDiffInput {
  baseline: HoursConfigDiffSnapshotReference;
  current: HoursConfigDiffSnapshotReference;
}

export interface HoursConfigDiffDigest {
  sourceHandles: {
    baseline: string;
    current: string;
  };
  baseline: HoursConfigAuditInspection;
  current: HoursConfigAuditInspection;
  overallChangeClass: HoursConfigChangeClass;
  summary: string;
  changedSignalCount: number;
  driftBandCounts: {
    incremental: number;
    material: number;
  };
  metricChanges: HoursConfigDiffMetricChange[];
  readSafety: "read_only";
}

const HOURS_CONFIG_NUMERIC_METRICS: Array<{
  metric: Exclude<
    keyof HoursConfigAuditInspection,
    "taskCategoryBreakdown" | "timeSchemeFeatureCoverage" | "weekdayCoverage" | "readSafety"
  >;
  group: HoursConfigDriftGroup;
}> = [
  { metric: "hourPolicyCount", group: "coverage" },
  { metric: "taskAssignmentPolicyCount", group: "coverage" },
  { metric: "availabilityPolicyCount", group: "coverage" },
  { metric: "totalWindowCount", group: "windowing" },
  { metric: "windowedHourPolicyCount", group: "windowing" },
  { metric: "policyWithoutWindowsCount", group: "windowing" },
  { metric: "timezoneCount", group: "coverage" }
];

function countByLabel(values: string[]): HoursConfigCountItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function toCountMap(items: HoursConfigCountItem[]): Map<string, number> {
  return new Map(items.map((item) => [item.label, item.count]));
}

function toDriftDirection(delta: number): HoursConfigDriftDirection {
  if (delta === 0) {
    return "unchanged";
  }

  return delta > 0 ? "increase" : "decrease";
}

function toDriftBand(delta: number): HoursConfigDriftBand {
  const magnitude = Math.abs(delta);
  if (magnitude === 0) {
    return "no_change";
  }

  return magnitude === 1 ? "incremental" : "material";
}

function compareInspectionMetric(
  metric: string,
  group: HoursConfigDriftGroup,
  baseline: number,
  current: number
): HoursConfigDiffMetricChange | undefined {
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
  group: HoursConfigDriftGroup,
  baseline: HoursConfigCountItem[],
  current: HoursConfigCountItem[]
): HoursConfigDiffMetricChange[] {
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

function classifyHoursConfigDiff(metricChanges: HoursConfigDiffMetricChange[]): HoursConfigChangeClass {
  const groups = new Set(metricChanges.map((change) => change.group));

  if (groups.size === 0) {
    return "no_change";
  }

  if (groups.size > 1) {
    return "mixed_drift";
  }

  return groups.has("coverage") ? "coverage_drift" : "windowing_drift";
}

function summarizeHoursConfigDiff(
  baselineHandle: string,
  currentHandle: string,
  overallChangeClass: HoursConfigChangeClass,
  metricChanges: HoursConfigDiffMetricChange[]
): string {
  if (overallChangeClass === "no_change") {
    return `No hours-config drift detected between ${baselineHandle} and ${currentHandle}.`;
  }

  const changedMetricLabel =
    metricChanges.length === 1 ? "1 configuration signal" : `${metricChanges.length} configuration signals`;

  return `Detected ${overallChangeClass} between ${baselineHandle} and ${currentHandle} across ${changedMetricLabel}.`;
}

export function parseReclaimHoursConfigSnapshot(raw: unknown): HoursConfigSnapshot {
  return ReclaimHoursConfigSnapshotSchema.parse(raw);
}

export function parseReclaimHoursConfigDiffInput(raw: unknown): HoursConfigDiffInput {
  return ReclaimHoursConfigDiffInputSchema.parse(raw);
}

export function inspectHoursConfigSnapshot(snapshot: HoursConfigSnapshot): HoursConfigAuditInspection {
  return {
    hourPolicyCount: snapshot.timeSchemes.length,
    taskCategoryBreakdown: countByLabel(snapshot.timeSchemes.map((scheme) => scheme.taskCategory || "PERSONAL")),
    taskAssignmentPolicyCount: snapshot.timeSchemes.filter((scheme) => scheme.features.includes("TASK_ASSIGNMENT"))
      .length,
    availabilityPolicyCount: snapshot.timeSchemes.filter((scheme) => scheme.features.includes("AVAILABILITY")).length,
    totalWindowCount: snapshot.timeSchemes.reduce((total, scheme) => total + (scheme.windows?.length ?? 0), 0),
    windowedHourPolicyCount: snapshot.timeSchemes.filter((scheme) => (scheme.windows?.length ?? 0) > 0).length,
    policyWithoutWindowsCount: snapshot.timeSchemes.filter((scheme) => (scheme.windows?.length ?? 0) === 0).length,
    timezoneCount: new Set(
      snapshot.timeSchemes
        .map((scheme) => scheme.timezone)
        .filter((timezone): timezone is string => Boolean(timezone))
    ).size,
    timeSchemeFeatureCoverage: countByLabel(snapshot.timeSchemes.flatMap((scheme) => scheme.features)),
    weekdayCoverage: countByLabel(
      snapshot.timeSchemes.flatMap((scheme) =>
        (scheme.windows ?? [])
          .map((window) => window.dayOfWeek)
          .filter((dayOfWeek): dayOfWeek is string => Boolean(dayOfWeek))
      )
    ),
    readSafety: "read_only"
  };
}

export function createHoursConfigDiffDigest(input: HoursConfigDiffInput): HoursConfigDiffDigest {
  const baselineInspection = inspectHoursConfigSnapshot(input.baseline.snapshot);
  const currentInspection = inspectHoursConfigSnapshot(input.current.snapshot);

  const numericMetricChanges = HOURS_CONFIG_NUMERIC_METRICS.flatMap(({ metric, group }) => {
    const change = compareInspectionMetric(metric, group, baselineInspection[metric], currentInspection[metric]);
    return change ? [change] : [];
  });
  const breakdownMetricChanges = [
    ...compareCountBreakdowns(
      "taskCategory",
      "coverage",
      baselineInspection.taskCategoryBreakdown,
      currentInspection.taskCategoryBreakdown
    ),
    ...compareCountBreakdowns(
      "timeSchemeFeature",
      "coverage",
      baselineInspection.timeSchemeFeatureCoverage,
      currentInspection.timeSchemeFeatureCoverage
    ),
    ...compareCountBreakdowns(
      "weekdayCoverage",
      "windowing",
      baselineInspection.weekdayCoverage,
      currentInspection.weekdayCoverage
    )
  ];
  const metricChanges = [...numericMetricChanges, ...breakdownMetricChanges];
  const overallChangeClass = classifyHoursConfigDiff(metricChanges);

  return {
    sourceHandles: {
      baseline: input.baseline.handle,
      current: input.current.handle
    },
    baseline: baselineInspection,
    current: currentInspection,
    overallChangeClass,
    summary: summarizeHoursConfigDiff(
      input.baseline.handle,
      input.current.handle,
      overallChangeClass,
      metricChanges
    ),
    changedSignalCount: metricChanges.length,
    driftBandCounts: {
      incremental: metricChanges.filter((change) => change.driftBand === "incremental").length,
      material: metricChanges.filter((change) => change.driftBand === "material").length
    },
    metricChanges,
    readSafety: "read_only"
  };
}

export async function auditHoursConfig(client: ReclaimClient): Promise<HoursConfigAuditInspection> {
  return inspectHoursConfigSnapshot({
    timeSchemes: await client.listTimeSchemes()
  });
}

export const hoursConfig = {
  audit: auditHoursConfig,
  inspectSnapshot: inspectHoursConfigSnapshot,
  createDiffDigest: createHoursConfigDiffDigest
};
