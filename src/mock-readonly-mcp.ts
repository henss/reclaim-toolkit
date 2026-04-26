import fs from "node:fs";
import { z } from "zod";
import { meetingsHours } from "./meetings-hours.js";
import { tasks, type TaskExportResult, type TaskListFilters, type TaskListResult } from "./tasks.js";
import { previewTimePolicySelection, type TimePolicySelectionPreview } from "./time-policy-selection.js";
import type {
  ReclaimMeetingRecord,
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskEventCategory,
  ReclaimTaskRecord
} from "./types.js";

const MCP_PROTOCOL_VERSION = "2024-11-05";
const MCP_SERVER_NAME = "reclaim-toolkit-mock-readonly";
const MCP_SERVER_VERSION = "0.1.0";

const ReclaimTaskRecordFixtureSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string().min(1),
  notes: z.string().optional(),
  eventCategory: z.string().default("PERSONAL"),
  timeSchemeId: z.string().min(1),
  due: z.string().optional(),
  startAfter: z.string().optional(),
  snoozeUntil: z.string().optional()
});

const ReclaimMeetingFixtureSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  title: z.string().min(1),
  start: z.string().optional(),
  end: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  attendeeCount: z.number().int().nonnegative().optional()
});

const ReclaimTimeSchemeFixtureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  taskCategory: z.string().default("PERSONAL"),
  description: z.string().optional(),
  timezone: z.string().optional(),
  features: z.array(z.string()).default([]),
  windows: z.array(z.object({
    dayOfWeek: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional()
  })).default([])
});

const TaskListFiltersSchema = z.object({
  titleContains: z.string().optional(),
  eventCategory: z.string().optional(),
  timeSchemeId: z.string().optional(),
  dueAfter: z.string().optional(),
  dueBefore: z.string().optional(),
  startAfterAfter: z.string().optional(),
  startAfterBefore: z.string().optional()
});

const TaskExportArgumentsSchema = z.object({
  format: z.enum(["json", "csv"]).optional(),
  filters: TaskListFiltersSchema.optional()
});

const MockReadonlyMcpFixtureSchema = z.object({
  fixture: z.literal("reclaim-toolkit-mock-readonly-mcp").default("reclaim-toolkit-mock-readonly-mcp"),
  defaultTaskEventCategory: z.enum(["PERSONAL", "WORK"]).default("WORK"),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional(),
  tasks: z.array(ReclaimTaskRecordFixtureSchema).default([]),
  meetings: z.array(ReclaimMeetingFixtureSchema).default([]),
  timeSchemes: z.array(ReclaimTimeSchemeFixtureSchema).default([])
});

type MockReadonlyMcpFixture = z.infer<typeof MockReadonlyMcpFixtureSchema>;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "reclaim_tasks_list",
    description: "List synthetic Reclaim tasks from the loaded fixture using read-only filters.",
    inputSchema: {
      type: "object",
      properties: {
        titleContains: { type: "string" },
        eventCategory: { type: "string" },
        timeSchemeId: { type: "string" },
        dueAfter: { type: "string" },
        dueBefore: { type: "string" },
        startAfterAfter: { type: "string" },
        startAfterBefore: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "reclaim_tasks_export",
    description: "Export synthetic Reclaim tasks as JSON rows or CSV content inside a JSON envelope.",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["json", "csv"] },
        filters: {
          type: "object",
          properties: {
            titleContains: { type: "string" },
            eventCategory: { type: "string" },
            timeSchemeId: { type: "string" },
            dueAfter: { type: "string" },
            dueBefore: { type: "string" },
            startAfterAfter: { type: "string" },
            startAfterBefore: { type: "string" }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "reclaim_time_policies_list",
    description: "List synthetic task-assignment time policies and the fixture-backed selection reason.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "reclaim_meetings_hours_inspect",
    description: "Inspect synthetic meetings and hours-policy summaries from the loaded fixture.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  }
];

function toTaskRecord(task: z.infer<typeof ReclaimTaskRecordFixtureSchema>): ReclaimTaskRecord {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    eventCategory: task.eventCategory,
    timeSchemeId: task.timeSchemeId,
    due: task.due,
    snoozeUntil: task.snoozeUntil ?? task.startAfter
  };
}

function toMeetingRecord(meeting: z.infer<typeof ReclaimMeetingFixtureSchema>): ReclaimMeetingRecord {
  return {
    id: meeting.id,
    title: meeting.title,
    start: meeting.start,
    end: meeting.end,
    durationMinutes: meeting.durationMinutes,
    attendeeCount: meeting.attendeeCount
  };
}

function toTimeSchemeRecord(
  scheme: z.infer<typeof ReclaimTimeSchemeFixtureSchema>
): ReclaimTaskAssignmentTimeScheme {
  return {
    id: scheme.id,
    title: scheme.title,
    taskCategory: scheme.taskCategory,
    description: scheme.description,
    timezone: scheme.timezone,
    features: scheme.features,
    windows: scheme.windows
  };
}

function readFixture(inputPath: string): MockReadonlyMcpFixture {
  return MockReadonlyMcpFixtureSchema.parse(JSON.parse(fs.readFileSync(inputPath, "utf8")) as unknown);
}

function buildTimePolicyPreview(fixture: MockReadonlyMcpFixture): TimePolicySelectionPreview {
  return previewTimePolicySelection(
    fixture.timeSchemes
      .map(toTimeSchemeRecord)
      .filter((scheme) => scheme.features.includes("TASK_ASSIGNMENT")),
    {
      preferredTimePolicyId: fixture.preferredTimePolicyId,
      preferredTimePolicyTitle: fixture.preferredTimePolicyTitle,
      eventCategory: fixture.defaultTaskEventCategory
    }
  );
}

function buildTaskList(fixture: MockReadonlyMcpFixture, filters: TaskListFilters = {}): TaskListResult {
  return tasks.listExistingTasks(fixture.tasks.map(toTaskRecord), filters);
}

function buildTaskExport(
  fixture: MockReadonlyMcpFixture,
  options: { format?: "json" | "csv"; filters?: TaskListFilters } = {}
): TaskExportResult {
  return tasks.exportExistingTasks(fixture.tasks.map(toTaskRecord), options);
}

function buildMeetingsInspection(fixture: MockReadonlyMcpFixture) {
  return meetingsHours.inspectSnapshot({
    meetings: fixture.meetings.map(toMeetingRecord),
    timeSchemes: fixture.timeSchemes.map(toTimeSchemeRecord)
  });
}

function writeMessage(stream: NodeJS.WritableStream, message: JsonRpcResponse): void {
  const body = JSON.stringify(message);
  stream.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function writeError(stream: NodeJS.WritableStream, id: number | string | null, code: number, message: string): void {
  writeMessage(stream, {
    jsonrpc: "2.0",
    id,
    error: { code, message }
  });
}

function buildToolCallResult(payload: unknown): { content: Array<{ type: "text"; text: string }>; structuredContent: unknown } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

function handleToolCall(
  fixture: MockReadonlyMcpFixture,
  params: Record<string, unknown> | undefined
): { content: Array<{ type: "text"; text: string }>; structuredContent: unknown } {
  const name = typeof params?.name === "string" ? params.name : "";
  const rawArguments = (params?.arguments ?? {}) as Record<string, unknown>;

  switch (name) {
    case "reclaim_tasks_list":
      return buildToolCallResult(buildTaskList(fixture, TaskListFiltersSchema.parse(rawArguments)));
    case "reclaim_tasks_export": {
      const parsed = TaskExportArgumentsSchema.parse(rawArguments);
      return buildToolCallResult(buildTaskExport(fixture, parsed));
    }
    case "reclaim_time_policies_list":
      return buildToolCallResult(buildTimePolicyPreview(fixture));
    case "reclaim_meetings_hours_inspect":
      return buildToolCallResult(buildMeetingsInspection(fixture));
    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

function handleRequest(
  fixture: MockReadonlyMcpFixture,
  request: JsonRpcRequest,
  output: NodeJS.WritableStream
): void {
  const id = request.id ?? null;

  if (request.method === "notifications/initialized") {
    return;
  }

  try {
    switch (request.method) {
      case "initialize":
        writeMessage(output, {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: MCP_SERVER_NAME,
              version: MCP_SERVER_VERSION
            }
          }
        });
        return;
      case "ping":
        writeMessage(output, {
          jsonrpc: "2.0",
          id,
          result: {}
        });
        return;
      case "tools/list":
        writeMessage(output, {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOL_DEFINITIONS
          }
        });
        return;
      case "tools/call":
        writeMessage(output, {
          jsonrpc: "2.0",
          id,
          result: handleToolCall(fixture, request.params)
        });
        return;
      default:
        writeError(output, id, -32601, `Method not found: ${request.method}`);
    }
  } catch (error) {
    writeError(output, id, -32602, error instanceof Error ? error.message : String(error));
  }
}

export interface MockReadonlyMcpServerOptions {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

export function startMockReadonlyReclaimMcpServer(
  fixture: MockReadonlyMcpFixture,
  options: MockReadonlyMcpServerOptions
): void {
  let buffer = Buffer.alloc(0);

  options.input.on("data", (chunk: Buffer | string) => {
    const nextChunk = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    buffer = Buffer.concat([buffer, nextChunk]);

    while (true) {
      const separatorIndex = buffer.indexOf("\r\n\r\n");
      if (separatorIndex < 0) {
        return;
      }

      const headerText = buffer.subarray(0, separatorIndex).toString("utf8");
      const contentLengthLine = headerText
        .split("\r\n")
        .find((line) => line.toLowerCase().startsWith("content-length:"));
      if (!contentLengthLine) {
        throw new Error("Missing Content-Length header.");
      }

      const contentLength = Number(contentLengthLine.split(":")[1]?.trim() ?? "");
      if (!Number.isFinite(contentLength) || contentLength < 0) {
        throw new Error(`Invalid Content-Length header: ${contentLengthLine}`);
      }

      const messageStart = separatorIndex + 4;
      const messageEnd = messageStart + contentLength;
      if (buffer.length < messageEnd) {
        return;
      }

      const messageBody = buffer.subarray(messageStart, messageEnd).toString("utf8");
      buffer = buffer.subarray(messageEnd);
      handleRequest(fixture, JSON.parse(messageBody) as JsonRpcRequest, options.output);
    }
  });
}

export function runMockReadonlyReclaimMcpServer(inputPath: string): void {
  const fixture = readFixture(inputPath);
  startMockReadonlyReclaimMcpServer(fixture, {
    input: process.stdin,
    output: process.stdout
  });
}
