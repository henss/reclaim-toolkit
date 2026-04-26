const TIME_PATTERN = /^(?<hours>\d{2}):(?<minutes>\d{2})$/;

export type PreviewTemporalEdgeCaseKind = "dst_gap" | "dst_overlap" | "timezone_mismatch";

export interface PreviewTemporalEdgeCase {
  kind: PreviewTemporalEdgeCaseKind;
  severity: "warning";
  date: string;
  timezone: string;
  referenceTimezone?: string;
  affectedInput: string;
  summary: string;
  localTimeRange?: {
    startTime: string;
    endTime: string;
  };
}

interface LocalTimeRangeInput {
  label: string;
  startTime: string;
  endTime: string;
}

interface LocalMinuteAnomaly {
  kind: "dst_gap" | "dst_overlap";
  date: string;
  startMinute: number;
  endMinute: number;
}

const anomalyCache = new Map<string, LocalMinuteAnomaly[]>();

function parseClockMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value);
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

function buildFormatter(timezone: string): Intl.DateTimeFormat | undefined {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
  } catch {
    return undefined;
  }
}

function readLocalDateMinute(
  formatter: Intl.DateTimeFormat,
  timestamp: number
): { date: string; minuteOfDay: number } {
  const partMap = new Map(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value] as const)
  );

  const year = partMap.get("year") ?? "0000";
  const month = partMap.get("month") ?? "01";
  const day = partMap.get("day") ?? "01";
  const hour = Number(partMap.get("hour") ?? "0");
  const minute = Number(partMap.get("minute") ?? "0");

  return {
    date: `${year}-${month}-${day}`,
    minuteOfDay: (hour * 60) + minute
  };
}

function collectLocalMinuteCounts(timezone: string, date: string): number[] {
  const formatter = buildFormatter(timezone);
  if (!formatter) {
    return [];
  }

  const counts = Array.from({ length: 1_440 }, () => 0);
  const scanStart = Date.parse(`${date}T00:00:00.000Z`) - (24 * 60 * 60 * 1_000);
  const scanEnd = scanStart + (72 * 60 * 60 * 1_000);

  for (let cursor = scanStart; cursor < scanEnd; cursor += 60_000) {
    const local = readLocalDateMinute(formatter, cursor);
    if (local.date !== date) {
      continue;
    }

    counts[local.minuteOfDay] += 1;
  }

  return counts;
}

function listLocalMinuteAnomalies(timezone: string, date: string): LocalMinuteAnomaly[] {
  const cacheKey = `${timezone}:${date}`;
  const cached = anomalyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const counts = collectLocalMinuteCounts(timezone, date);
  const anomalies: LocalMinuteAnomaly[] = [];

  for (let minute = 0; minute < counts.length; minute += 1) {
    const count = counts[minute];
    if (count === 1) {
      continue;
    }

    const kind = count === 0 ? "dst_gap" : "dst_overlap";
    let endMinute = minute + 1;
    while (endMinute < counts.length && counts[endMinute] === count) {
      endMinute += 1;
    }

    anomalies.push({
      kind,
      date,
      startMinute: minute,
      endMinute
    });
    minute = endMinute - 1;
  }

  anomalyCache.set(cacheKey, anomalies);
  return anomalies;
}

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function describeDstEdgeCase(
  timezone: string,
  date: string,
  range: LocalTimeRangeInput,
  anomaly: LocalMinuteAnomaly
): PreviewTemporalEdgeCase {
  const startTime = formatClockMinutes(anomaly.startMinute);
  const endTime = formatClockMinutes(anomaly.endMinute - 1);
  const summary = anomaly.kind === "dst_gap"
    ? `${range.label} intersects the skipped local hour ${startTime}-${endTime} in ${timezone} on ${date}. Treat this preview window as a DST spring-forward edge case.`
    : `${range.label} intersects the repeated local hour ${startTime}-${endTime} in ${timezone} on ${date}. Treat this preview window as a DST fall-back edge case.`;

  return {
    kind: anomaly.kind,
    severity: "warning",
    date,
    timezone,
    affectedInput: range.label,
    summary,
    localTimeRange: {
      startTime,
      endTime
    }
  };
}

export function listTimezoneRangeEdgeCases(input: {
  timezone?: string;
  date: string;
  ranges: LocalTimeRangeInput[];
}): PreviewTemporalEdgeCase[] {
  if (!input.timezone) {
    return [];
  }

  const anomalies = listLocalMinuteAnomalies(input.timezone, input.date);
  if (anomalies.length === 0) {
    return [];
  }

  return input.ranges.flatMap((range) => {
    const rangeStart = parseClockMinutes(range.startTime);
    const rangeEnd = parseClockMinutes(range.endTime);

    return anomalies
      .filter((anomaly) => rangesOverlap(rangeStart, rangeEnd, anomaly.startMinute, anomaly.endMinute))
      .map((anomaly) => describeDstEdgeCase(input.timezone!, input.date, range, anomaly));
  });
}

export function createTimezoneMismatchEdgeCase(input: {
  date: string;
  referenceTimezone: string;
  comparedTimezone: string;
  affectedInput: string;
}): PreviewTemporalEdgeCase | undefined {
  if (input.referenceTimezone === input.comparedTimezone) {
    return undefined;
  }

  return {
    kind: "timezone_mismatch",
    severity: "warning",
    date: input.date,
    timezone: input.comparedTimezone,
    referenceTimezone: input.referenceTimezone,
    affectedInput: input.affectedInput,
    summary: `${input.affectedInput} uses ${input.comparedTimezone} while the surrounding scenario is labeled ${input.referenceTimezone}. Review local-day screenshots and assertions against the policy-local timezone before treating the preview as canonical.`
  };
}
