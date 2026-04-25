import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createMockReclaimApiFetch,
  runMockReclaimFailureModeLab
} from "../src/mock-lab.js";

interface MockMatrixRequest {
  method: string;
  path: string;
  json?: unknown;
}

interface MockMatrixExpected {
  status: number;
  json?: unknown;
  body?: string;
}

interface MockMatrixEntry {
  name: string;
  request: MockMatrixRequest;
  expected: MockMatrixExpected;
}

interface MockMatrixFixture {
  lab: string;
  version: number;
  executionOrderMatters: boolean;
  responses: MockMatrixEntry[];
}

interface MockFailureModeScenarioFixture {
  name: string;
  category: string;
  outcome: string;
  details: Record<string, unknown>;
}

interface MockFailureModeFixture {
  lab: string;
  version: number;
  profile: string;
  executionOrderMatters: boolean;
  notes: string[];
  scenarios: MockFailureModeScenarioFixture[];
}

function readMockMatrixFixture(): MockMatrixFixture {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "docs", "mock-api-response-matrix.example.json"), "utf8")
  ) as MockMatrixFixture;
}

function readFailureModeFixture(): MockFailureModeFixture {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "docs", "mock-api-failure-mode-matrix.example.json"), "utf8")
  ) as MockFailureModeFixture;
}

function createRequestInit(request: MockMatrixRequest): RequestInit | undefined {
  if (request.method === "GET" && request.json === undefined) {
    return undefined;
  }

  return {
    method: request.method,
    headers: request.json === undefined ? undefined : { "Content-Type": "application/json" },
    body: request.json === undefined ? undefined : JSON.stringify(request.json)
  };
}

describe("mock API response matrix", () => {
  test("matches the documented synthetic route matrix", async () => {
    const fixture = readMockMatrixFixture();
    const fetchImpl = createMockReclaimApiFetch();

    expect(fixture.lab).toBe("mock-api-response-matrix");
    expect(fixture.executionOrderMatters).toBe(true);

    for (const entry of fixture.responses) {
      const response = await fetchImpl(
        `https://mock.reclaim.local/api${entry.request.path}`,
        createRequestInit(entry.request)
      );

      expect(response.status, entry.name).toBe(entry.expected.status);

      if (entry.expected.json !== undefined) {
        expect(await response.json(), entry.name).toEqual(entry.expected.json);
        continue;
      }

      expect(await response.text(), entry.name).toBe(entry.expected.body ?? "");
    }
  });

  test("matches the documented synthetic failure-mode matrix", async () => {
    const fixture = readFailureModeFixture();

    expect(await runMockReclaimFailureModeLab()).toEqual(fixture);
  });
});
