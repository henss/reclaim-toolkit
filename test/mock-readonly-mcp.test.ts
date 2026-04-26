import { spawn } from "node:child_process";
import { describe, expect, test } from "vitest";

interface JsonRpcEnvelope {
  jsonrpc: "2.0";
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

function npmCommand(): { command: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        "npm run --silent reclaim:mcp:mock-readonly -- --input examples/mock-readonly-mcp.example.json"
      ]
    };
  }

  return {
    command: "npm",
    args: ["run", "--silent", "reclaim:mcp:mock-readonly", "--", "--input", "examples/mock-readonly-mcp.example.json"]
  };
}

function requireChildPipe<T>(value: T | null, label: string): T {
  if (value === null) {
    throw new Error(`Expected child ${label} pipe.`);
  }
  return value;
}

function encodeMessage(message: Record<string, unknown>): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function tryReadMessages(buffer: string): { envelopes: JsonRpcEnvelope[]; rest: string } {
  const envelopes: JsonRpcEnvelope[] = [];
  let remaining = buffer;

  while (true) {
    const separatorIndex = remaining.indexOf("\r\n\r\n");
    if (separatorIndex < 0) {
      return { envelopes, rest: remaining };
    }

    const headerText = remaining.slice(0, separatorIndex);
    const contentLengthLine = headerText
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-length:"));
    if (!contentLengthLine) {
      throw new Error("Missing Content-Length header in MCP response.");
    }

    const contentLength = Number(contentLengthLine.split(":")[1]?.trim() ?? "");
    const bodyStart = separatorIndex + 4;
    const bodyEnd = bodyStart + contentLength;
    if (remaining.length < bodyEnd) {
      return { envelopes, rest: remaining };
    }

    envelopes.push(JSON.parse(remaining.slice(bodyStart, bodyEnd)) as JsonRpcEnvelope);
    remaining = remaining.slice(bodyEnd);
  }
}

async function sendAndRead(
  child: ReturnType<typeof spawn>,
  request: Record<string, unknown>,
  state: { stdoutBuffer: string; stderrBuffer: string }
): Promise<JsonRpcEnvelope> {
  const childStdout = requireChildPipe(child.stdout, "stdout");
  const childStderr = requireChildPipe(child.stderr, "stderr");
  const childStdin = requireChildPipe(child.stdin, "stdin");

  return new Promise((resolve, reject) => {
    const onStdout = (chunk: string | Buffer) => {
      state.stdoutBuffer += chunk.toString();
      const parsed = tryReadMessages(state.stdoutBuffer);
      state.stdoutBuffer = parsed.rest;
      if (parsed.envelopes.length === 0) {
        return;
      }

      cleanup();
      resolve(parsed.envelopes[0]!);
    };

    const onStderr = (chunk: string | Buffer) => {
      state.stderrBuffer += chunk.toString();
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`MCP child exited before replying. code=${code} stderr=${state.stderrBuffer}`));
    };

    function cleanup(): void {
      childStdout.off("data", onStdout);
      childStderr.off("data", onStderr);
      child.off("exit", onExit);
    }

    childStdout.on("data", onStdout);
    childStderr.on("data", onStderr);
    child.on("exit", onExit);
    childStdin.write(encodeMessage(request));
  });
}

describe("mock readonly MCP server", () => {
  test("answers fixture-backed read-only MCP tool calls", async () => {
    const command = npmCommand();
    const child = spawn(command.command, command.args, { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
    const childStdout = requireChildPipe(child.stdout, "stdout");
    const childStderr = requireChildPipe(child.stderr, "stderr");
    const childStdin = requireChildPipe(child.stdin, "stdin");
    childStdout.setEncoding("utf8");
    childStderr.setEncoding("utf8");

    const state = { stdoutBuffer: "", stderrBuffer: "" };

    try {
      const initialize = await sendAndRead(child, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "vitest", version: "0.0.0" }
        }
      }, state);

      expect(initialize.result).toMatchObject({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "reclaim-toolkit-mock-readonly" }
      });

      childStdin.write(encodeMessage({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      }));

      const toolsList = await sendAndRead(child, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list"
      }, state);
      expect(toolsList.result).toMatchObject({
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "reclaim_tasks_list" }),
          expect.objectContaining({ name: "reclaim_tasks_export" }),
          expect.objectContaining({ name: "reclaim_time_policies_list" }),
          expect.objectContaining({ name: "reclaim_meetings_hours_inspect" })
        ])
      });

      const filteredTasks = await sendAndRead(child, {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "reclaim_tasks_list",
          arguments: {
            titleContains: "notes",
            eventCategory: "WORK"
          }
        }
      }, state);

      expect(filteredTasks.result).toMatchObject({
        structuredContent: {
          taskCount: 1,
          readSafety: "read_only",
          tasks: [
            expect.objectContaining({
              id: 41,
              title: "Draft planning notes",
              startAfter: "2026-05-06T07:00:00.000Z"
            })
          ]
        }
      });

      const policies = await sendAndRead(child, {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "reclaim_time_policies_list",
          arguments: {}
        }
      }, state);
      expect(policies.result).toMatchObject({
        structuredContent: {
          selectedPolicy: {
            id: "policy-deep-work",
            title: "Deep Work",
            matchesDefaultEventCategory: true
          },
          selectionReason: 'Matched preferred Reclaim time policy title "deep".'
        }
      });

      const exportResult = await sendAndRead(child, {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "reclaim_tasks_export",
          arguments: {
            format: "csv"
          }
        }
      }, state);
      expect(exportResult.result).toMatchObject({
        structuredContent: {
          format: "csv",
          taskCount: 2,
          readSafety: "read_only",
          content: expect.stringContaining("Draft planning notes")
        }
      });

      const meetings = await sendAndRead(child, {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "reclaim_meetings_hours_inspect",
          arguments: {}
        }
      }, state);
      expect(meetings.result).toMatchObject({
        structuredContent: {
          meetingCount: 1,
          hourPolicyCount: 2,
          readSafety: "read_only"
        }
      });
    } finally {
      child.kill();
    }
  });
});
