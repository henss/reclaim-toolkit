export interface RedactionCounters {
  apiKeys: number;
  emails: number;
  ids: number;
  paths: number;
  text: number;
}

export interface RedactionContext {
  counters: RedactionCounters;
}

export interface PreviewIncidentSummary {
  inputTopLevelKeys: string[];
  inputArrayFieldSizes: Array<{ key: string; count: number }>;
  outputTopLevelKeys?: string[];
  outputSafety?: "preview_only" | "read_only" | "public_metadata" | "no_live_writes" | "unknown";
}

export const supportBundleSafeDefaults = [
  "numbers, booleans, and null values are preserved",
  "ISO-like dates and times are preserved",
  "command ids and safety enums are preserved",
  "titles, ids, notes, emails, secrets, absolute paths, and free text are redacted"
];

export function createRedactionCounters(): RedactionCounters {
  return {
    apiKeys: 0,
    emails: 0,
    ids: 0,
    paths: 0,
    text: 0
  };
}

export function sanitizeFreeText(value: string, context: RedactionContext): string {
  if (/[A-Z]:\\|^\\\\|\/Users\/|\/home\/|\/tmp\/|\/var\/|\/private\//.test(value)) {
    context.counters.paths += 1;
    return "<redacted-path>";
  }

  if (value.includes("@")) {
    context.counters.emails += 1;
    return "<redacted-email>";
  }

  context.counters.text += 1;
  return "<redacted-text>";
}

export function sanitizeErrorMessage(value: string, context: RedactionContext): string {
  return value
    .replace(/[A-Z]:\\[^ "'\n\r\t]+|\\\\[^ "'\n\r\t]+|\/(?:Users|home|tmp|var|private)\/[^ "'\n\r\t]+/g, () => {
      context.counters.paths += 1;
      return "<redacted-path>";
    })
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, () => {
      context.counters.emails += 1;
      return "<redacted-email>";
    });
}

function sanitizeStringByKey(value: string, key: string | undefined, context: RedactionContext): string {
  if (
    value === ""
    || /^reclaim:[a-z0-9:-]+$/i.test(value)
    || /^(preview_only|read_only|public_metadata|no_live_writes|unknown)$/i.test(value)
    || /^(PERSONAL|WORK|TASK_ASSIGNMENT|AVAILABILITY)$/i.test(value)
    || /^(daily|weekly|monthly|none|ready|needs_config|review_required|valid|invalid|missing)$/i.test(value)
    || /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(value)
    || /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)
    || /^\d{2}:\d{2}$/.test(value)
  ) {
    return value;
  }

  if (key !== undefined && /(apiKey|authorization|token|secret)/i.test(key)) {
    context.counters.apiKeys += 1;
    return "<redacted-secret>";
  }

  if (key !== undefined && /email/i.test(key)) {
    context.counters.emails += 1;
    return "<redacted-email>";
  }

  if (key !== undefined && /(^|[A-Z_])id$/i.test(key)) {
    context.counters.ids += 1;
    return "<redacted-id>";
  }

  if (key !== undefined && /path/i.test(key)) {
    context.counters.paths += 1;
    return "<redacted-path>";
  }

  if (key !== undefined && /^(title|name|notes|description|label|anchor|rollbackHint)$/i.test(key)) {
    context.counters.text += 1;
    return "<redacted-text>";
  }

  return sanitizeFreeText(value, context);
}

export function redactValue(value: unknown, context: RedactionContext, key?: string): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeStringByKey(value, key, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, context, key));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, redactValue(childValue, context, childKey)])
    );
  }

  return value;
}

export function summarizeInput(
  value: unknown
): Pick<PreviewIncidentSummary, "inputTopLevelKeys" | "inputArrayFieldSizes"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      inputTopLevelKeys: [],
      inputArrayFieldSizes: []
    };
  }

  const entries = Object.entries(value);
  return {
    inputTopLevelKeys: entries.map(([key]) => key).sort(),
    inputArrayFieldSizes: entries
      .filter(([, child]) => Array.isArray(child))
      .map(([key, child]) => ({ key, count: child.length }))
      .sort((left, right) => left.key.localeCompare(right.key))
  };
}

function inferOutputSafety(result: unknown): PreviewIncidentSummary["outputSafety"] {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return "unknown";
  }

  const candidate = result as Record<string, unknown>;
  if (candidate.writeSafety === "preview_only") {
    return "preview_only";
  }
  if (candidate.readSafety === "read_only") {
    return "read_only";
  }
  if (candidate.readSafety === "public_metadata") {
    return "public_metadata";
  }
  if (candidate.writeSafety === "no_live_writes") {
    return "no_live_writes";
  }
  return "unknown";
}

export function summarizeOutput(
  result: unknown
): Pick<PreviewIncidentSummary, "outputTopLevelKeys" | "outputSafety"> {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      outputTopLevelKeys: [],
      outputSafety: inferOutputSafety(result)
    };
  }

  return {
    outputTopLevelKeys: Object.keys(result).sort(),
    outputSafety: inferOutputSafety(result)
  };
}
