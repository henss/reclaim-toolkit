import { z } from "zod";
import {
  createRedactionCounters,
  type RedactionContext,
  type RedactionCounters
} from "./support-bundle-redaction.js";

const SAFE_ROUTE_SEGMENTS = new Set([
  "api",
  "tasks",
  "users",
  "current",
  "timeschemes",
  "meetings",
  "assist",
  "habits",
  "daily",
  "smart-habits"
]);

const SAFE_REQUEST_HEADERS = new Set(["content-type"]);
const SAFE_RESPONSE_HEADERS = new Set(["content-type", "retry-after"]);
const SAFE_STRING_ENUMS = new Set([
  "WORK",
  "PERSONAL",
  "TASK_ASSIGNMENT",
  "AVAILABILITY",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "TASK_ASSIGNMENT_TIME_SCHEME_ID_REQUIRED"
]);

const fixtureRecorderSafeDefaults = [
  "request methods, route templates, status codes, booleans, and numbers are preserved",
  "query parameter names are preserved but query values are discarded",
  "ISO-like dates, HH:mm times, and IANA timezone names are preserved",
  "authorization headers, ids, emails, titles, notes, and free-text strings are redacted"
] as const;

const ReclaimRecordedHeadersSchema = z.record(z.string(), z.string());

const ReclaimRecordedRequestSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  headers: ReclaimRecordedHeadersSchema.optional(),
  body: z.unknown().optional()
});

const ReclaimRecordedResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  headers: ReclaimRecordedHeadersSchema.optional(),
  body: z.unknown().optional()
});

const ReclaimRecordedInteractionSchema = z.object({
  label: z.string().min(1),
  request: ReclaimRecordedRequestSchema,
  response: ReclaimRecordedResponseSchema
});

export const ReclaimFixtureRecordingSchema = z.object({
  fixture: z.literal("reclaim-recorded-interaction-fixture"),
  capturedAt: z.string().optional(),
  interactions: z.array(ReclaimRecordedInteractionSchema).min(1)
});

export interface ReclaimRecordedRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ReclaimRecordedResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ReclaimRecordedInteraction {
  label: string;
  request: ReclaimRecordedRequest;
  response: ReclaimRecordedResponse;
}

export interface ReclaimFixtureRecording {
  fixture: "reclaim-recorded-interaction-fixture";
  capturedAt?: string;
  interactions: ReclaimRecordedInteraction[];
}

export interface ReclaimSanitizedFixtureHeaders {
  "content-type"?: string;
  "retry-after"?: string;
}

export interface ReclaimSanitizedRecordedRequest {
  method: string;
  pathTemplate: string;
  queryKeys: string[];
  headers?: ReclaimSanitizedFixtureHeaders;
  body?: unknown;
}

export interface ReclaimSanitizedRecordedResponse {
  status: number;
  headers?: ReclaimSanitizedFixtureHeaders;
  body?: unknown;
}

export interface ReclaimSanitizedInteraction {
  label: string;
  request: ReclaimSanitizedRecordedRequest;
  response: ReclaimSanitizedRecordedResponse;
}

export interface ReclaimFixtureLeakCheck {
  passed: boolean;
  findingCount: number;
  findings: string[];
}

export interface ReclaimSanitizedFixtureRecording {
  fixture: "reclaim-sanitized-recording-fixture";
  sourceFixture: ReclaimFixtureRecording["fixture"];
  capturedAt?: string;
  scrubbedAt: string;
  interactionCount: number;
  interactions: ReclaimSanitizedInteraction[];
  redactionPolicy: {
    mode: "strict_public_safe";
    safeDefaults: readonly string[];
    counters: RedactionCounters;
  };
  leakCheck: ReclaimFixtureLeakCheck;
}

interface FixtureRedactionContext extends RedactionContext {
  redactedStrings: Set<string>;
}

function rememberRedactedValue(value: string, context: FixtureRedactionContext): void {
  if (value.length > 0) {
    context.redactedStrings.add(value);
  }
}

function isIsoLikeDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value);
}

function isClockTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function isIanaTimezone(value: string): boolean {
  return /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value);
}

function isSafeFixtureLabel(value: string): boolean {
  return /^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/i.test(value);
}

function isSafeMimeType(value: string): boolean {
  return /^(application|text)\/[a-z0-9.+-]+$/i.test(value);
}

function looksLikePath(value: string): boolean {
  return /[A-Z]:\\|^\\\\|\/Users\/|\/home\/|\/tmp\/|\/var\/|\/private\//.test(value);
}

function looksLikeEmail(value: string): boolean {
  return /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(value);
}

function looksLikeSecret(value: string): boolean {
  return /^Bearer\s+/i.test(value) || /(token|secret|apikey|api_key)/i.test(value);
}

function normalizeMethod(value: string): string {
  return value.toUpperCase();
}

function sanitizeFixtureLabel(value: string, context: FixtureRedactionContext): string {
  if (isSafeFixtureLabel(value)) {
    return value;
  }

  context.counters.text += 1;
  rememberRedactedValue(value, context);
  return "sanitized-interaction";
}

function sanitizeHeaderValue(
  headerName: string,
  value: string,
  context: FixtureRedactionContext
): string | undefined {
  const normalizedHeader = headerName.toLowerCase();
  if (normalizedHeader === "content-type") {
    const mimeType = value.split(";")[0]?.trim().toLowerCase();
    return mimeType && isSafeMimeType(mimeType) ? mimeType : undefined;
  }

  if (normalizedHeader === "retry-after") {
    return /^\d+$/.test(value) ? value : undefined;
  }

  if (SAFE_REQUEST_HEADERS.has(normalizedHeader) || SAFE_RESPONSE_HEADERS.has(normalizedHeader)) {
    return value;
  }

  if (looksLikeSecret(value)) {
    context.counters.apiKeys += 1;
  } else {
    context.counters.text += 1;
  }
  rememberRedactedValue(value, context);
  return undefined;
}

function sanitizeHeaders(
  headers: Record<string, string> | undefined,
  allowedHeaders: Set<string>,
  context: FixtureRedactionContext
): ReclaimSanitizedFixtureHeaders | undefined {
  if (!headers) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(headers)
    .flatMap(([headerName, value]) => {
      const normalizedHeader = headerName.toLowerCase();
      if (!allowedHeaders.has(normalizedHeader)) {
        if (looksLikeSecret(value)) {
          context.counters.apiKeys += 1;
        } else {
          context.counters.text += 1;
        }
        rememberRedactedValue(value, context);
        return [];
      }

      const sanitizedValue = sanitizeHeaderValue(normalizedHeader, value, context);
      return sanitizedValue ? [[normalizedHeader, sanitizedValue] as const] : [];
    });

  return sanitizedEntries.length > 0 ? Object.fromEntries(sanitizedEntries) : undefined;
}

function sanitizeRouteSegment(segment: string, context: FixtureRedactionContext): string {
  const normalized = segment.toLowerCase();
  if (SAFE_ROUTE_SEGMENTS.has(normalized) || /^[a-z-]+$/.test(normalized)) {
    return normalized;
  }

  context.counters.ids += 1;
  rememberRedactedValue(segment, context);
  return "<redacted-id>";
}

function sanitizeRequestPath(
  rawPath: string,
  context: FixtureRedactionContext
): Pick<ReclaimSanitizedRecordedRequest, "pathTemplate" | "queryKeys"> {
  const parsed = new URL(rawPath, "https://reclaim.local");
  const pathTemplate = `/${parsed.pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => sanitizeRouteSegment(segment, context))
    .join("/")}`;

  for (const [queryKey, queryValue] of parsed.searchParams.entries()) {
    if (queryValue.length === 0) {
      continue;
    }

    if (/(^|[A-Z_])id$/i.test(queryKey)) {
      context.counters.ids += 1;
    } else {
      context.counters.text += 1;
    }
    rememberRedactedValue(queryValue, context);
  }

  return {
    pathTemplate,
    queryKeys: [...new Set(parsed.searchParams.keys())].sort((left, right) => left.localeCompare(right))
  };
}

function sanitizeStringValue(value: string, key: string | undefined, context: FixtureRedactionContext): string {
  if (
    value === ""
    || SAFE_STRING_ENUMS.has(value)
    || isIsoLikeDate(value)
    || isClockTime(value)
    || isIanaTimezone(value)
  ) {
    return value;
  }

  if (key === "label" && isSafeFixtureLabel(value)) {
    return value;
  }

  if (key !== undefined && /(authorization|token|secret|apikey|api_key)/i.test(key)) {
    context.counters.apiKeys += 1;
    rememberRedactedValue(value, context);
    return "<redacted-secret>";
  }

  if (key !== undefined && /email/i.test(key)) {
    context.counters.emails += 1;
    rememberRedactedValue(value, context);
    return "<redacted-email>";
  }

  if (key !== undefined && /(^|[A-Z_])id$/i.test(key)) {
    context.counters.ids += 1;
    rememberRedactedValue(value, context);
    return "<redacted-id>";
  }

  if (key !== undefined && /path/i.test(key)) {
    context.counters.paths += 1;
    rememberRedactedValue(value, context);
    return "<redacted-path>";
  }

  if (
    key !== undefined
    && /^(title|name|notes|description|message|selectionReason|body|text|anchor|rollbackHint)$/i.test(key)
  ) {
    context.counters.text += 1;
    rememberRedactedValue(value, context);
    return "<redacted-text>";
  }

  if (looksLikeEmail(value)) {
    context.counters.emails += 1;
    rememberRedactedValue(value, context);
    return "<redacted-email>";
  }

  if (looksLikePath(value)) {
    context.counters.paths += 1;
    rememberRedactedValue(value, context);
    return "<redacted-path>";
  }

  if (looksLikeSecret(value)) {
    context.counters.apiKeys += 1;
    rememberRedactedValue(value, context);
    return "<redacted-secret>";
  }

  context.counters.text += 1;
  rememberRedactedValue(value, context);
  return "<redacted-text>";
}

function sanitizeRecordedValue(value: unknown, context: FixtureRedactionContext, key?: string): unknown {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (key !== undefined && /(^|[A-Z_])id$/i.test(key)) {
      context.counters.ids += 1;
      rememberRedactedValue(String(value), context);
      return "<redacted-id>";
    }

    return value;
  }

  if (typeof value === "string") {
    return sanitizeStringValue(value, key, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRecordedValue(item, context, key));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, sanitizeRecordedValue(childValue, context, childKey)])
    );
  }

  return value;
}

function buildLeakCheck(
  fixture: Omit<ReclaimSanitizedFixtureRecording, "leakCheck">,
  redactedStrings: ReadonlySet<string>
): ReclaimFixtureLeakCheck {
  const fixtureText = JSON.stringify(fixture);
  const findings = new Set<string>();

  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(fixtureText)) {
    findings.add("email-pattern");
  }

  if (/[A-Z]:\\+workspace\\+/i.test(fixtureText) || /llm-orchestrator/i.test(fixtureText)) {
    findings.add("private-workspace-marker");
  }

  if (looksLikePath(fixtureText)) {
    findings.add("absolute-path-pattern");
  }

  if (/Bearer\s+/i.test(fixtureText)) {
    findings.add("authorization-header-pattern");
  }

  if ([...redactedStrings].some((value) => value.length >= 3 && fixtureText.includes(value))) {
    findings.add("source-sensitive-string");
  }

  const findingList = [...findings].sort((left, right) => left.localeCompare(right));
  return {
    passed: findingList.length === 0,
    findingCount: findingList.length,
    findings: findingList
  };
}

export function parseReclaimFixtureRecording(raw: unknown): ReclaimFixtureRecording {
  return ReclaimFixtureRecordingSchema.parse(raw);
}

export function scrubReclaimFixtureRecording(
  raw: unknown,
  options: { scrubbedAt?: string } = {}
): ReclaimSanitizedFixtureRecording {
  const recording = parseReclaimFixtureRecording(raw);
  const context: FixtureRedactionContext = {
    counters: createRedactionCounters(),
    redactedStrings: new Set<string>()
  };

  const interactions = recording.interactions.map((interaction) => ({
    label: sanitizeFixtureLabel(interaction.label, context),
    request: {
      method: normalizeMethod(interaction.request.method),
      ...sanitizeRequestPath(interaction.request.path, context),
      headers: sanitizeHeaders(interaction.request.headers, SAFE_REQUEST_HEADERS, context),
      body: interaction.request.body === undefined ? undefined : sanitizeRecordedValue(interaction.request.body, context)
    },
    response: {
      status: interaction.response.status,
      headers: sanitizeHeaders(interaction.response.headers, SAFE_RESPONSE_HEADERS, context),
      body: interaction.response.body === undefined ? undefined : sanitizeRecordedValue(interaction.response.body, context)
    }
  }));

  const fixtureWithoutLeakCheck = {
    fixture: "reclaim-sanitized-recording-fixture" as const,
    sourceFixture: recording.fixture,
    capturedAt: recording.capturedAt,
    scrubbedAt: options.scrubbedAt ?? new Date().toISOString(),
    interactionCount: interactions.length,
    interactions,
    redactionPolicy: {
      mode: "strict_public_safe" as const,
      safeDefaults: fixtureRecorderSafeDefaults,
      counters: context.counters
    }
  };

  return {
    ...fixtureWithoutLeakCheck,
    leakCheck: buildLeakCheck(fixtureWithoutLeakCheck, context.redactedStrings)
  };
}

export function inspectReclaimFixturePrivacy(
  fixture: ReclaimSanitizedFixtureRecording
): ReclaimFixtureLeakCheck {
  const { leakCheck: _leakCheck, ...fixtureWithoutLeakCheck } = fixture;
  return buildLeakCheck(fixtureWithoutLeakCheck, new Set<string>());
}

export function assertReclaimFixturePrivacy(fixture: ReclaimSanitizedFixtureRecording): void {
  const leakCheck = inspectReclaimFixturePrivacy(fixture);
  if (!leakCheck.passed) {
    throw new Error(`Sanitized fixture still contains private-looking fields: ${leakCheck.findings.join(", ")}`);
  }
}

export const fixtureRecorder = {
  parseRecording: parseReclaimFixtureRecording,
  scrubRecording: scrubReclaimFixtureRecording,
  inspectPrivacy: inspectReclaimFixturePrivacy,
  assertPrivacy: assertReclaimFixturePrivacy
};
