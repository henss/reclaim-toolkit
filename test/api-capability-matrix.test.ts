import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  buildReclaimApiCapabilityMatrix,
  loadReclaimApiCapabilityMatrix
} from "../src/api-capability-matrix.js";
import { runNpmCli } from "./cli-test-helpers.js";

const syntheticOpenApiSpec = [
  "openapi: 3.0.1",
  "paths:",
  "  /api/tasks:",
  "    get:",
  "      responses:",
  "        \"200\":",
  "          description: ok",
  "    post:",
  "      responses:",
  "        \"200\":",
  "          description: ok",
  "  /api/tasks/{id}:",
  "    patch:",
  "      responses:",
  "        \"200\":",
  "          description: ok",
  "    delete:",
  "      responses:",
  "        \"204\":",
  "          description: deleted",
  "  /api/smart-habits:",
  "    get:",
  "      responses:",
  "        \"200\":",
  "          description: ok",
  "    post:",
  "      responses:",
  "        \"200\":",
  "          description: ok",
  "  /api/assist/habits/daily:",
  "    post:",
  "      responses:",
  "        \"200\":",
  "          description: ok",
  "  /api/meetings:",
  "    get:",
  "      responses:",
  "        \"200\":",
  "          description: ok",
  "  /api/timeschemes:",
  "    get:",
  "      responses:",
  "        \"200\":",
  "          description: ok",
].join("\n");

describe("Reclaim API capability matrix", () => {
  test("classifies documented, partial, and missing roadmap bets from the OpenAPI paths", () => {
    const matrix = buildReclaimApiCapabilityMatrix(syntheticOpenApiSpec, {
      type: "file",
      location: "synthetic-openapi.yml"
    });

    expect(matrix).toMatchObject({
      matrix: "reclaim-openapi-capability-matrix",
      readSafety: "public_metadata",
      summary: {
        capabilityCount: 6,
        documentedCount: 3,
        partialCount: 2,
        notDocumentedCount: 1,
        recommendedNextBet: "habit-live-write"
      },
      nextSurfaceReport: {
        recommendedCandidateId: "habit-live-write"
      }
    });
    expect(matrix.nextSurfaceReport.candidates).toEqual([
      expect.objectContaining({
        id: "habit-live-write",
        mode: "ranked_candidate",
        rank: 1,
        openApiSupport: "documented",
        toolkitStatus: "preview_only"
      }),
      expect.objectContaining({
        id: "hours-write-and-config",
        mode: "needs_evidence",
        openApiSupport: "partial",
        toolkitStatus: "read_only"
      }),
      expect.objectContaining({
        id: "meeting-writes",
        mode: "needs_evidence",
        openApiSupport: "partial",
        toolkitStatus: "read_only"
      }),
      expect.objectContaining({
        id: "focus-and-buffers-live-write",
        mode: "out_of_scope",
        openApiSupport: "not_documented",
        toolkitStatus: "preview_only"
      })
    ]);
    expect(matrix.capabilities.find((capability) => capability.id === "tasks-crud")).toMatchObject({
      openApiSupport: "documented",
      toolkitStatus: "implemented",
      riskLevel: "low"
    });
    expect(matrix.capabilities.find((capability) => capability.id === "habit-live-write")).toMatchObject({
      openApiSupport: "documented",
      toolkitStatus: "preview_only",
      recommendation: expect.stringContaining("Best next public write bet")
    });
    expect(matrix.capabilities.find((capability) => capability.id === "meeting-writes")).toMatchObject({
      openApiSupport: "partial",
      missingRequiredMethods: ["POST", "PATCH", "DELETE"]
    });
    expect(matrix.capabilities.find((capability) => capability.id === "focus-and-buffers-live-write")).toMatchObject({
      openApiSupport: "not_documented",
      toolkitStatus: "preview_only",
      riskLevel: "high"
    });
  });

  test("loads the matrix from a local spec path for offline review", async () => {
    const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-reclaim-capability-matrix-"));
    const specPath = path.join(tempDir, "reclaim-openapi.yml");
    fs.writeFileSync(specPath, syntheticOpenApiSpec, "utf8");

    try {
      const matrix = await loadReclaimApiCapabilityMatrix({ inputPath: specPath });
      expect(matrix.source).toEqual({
        type: "file",
        location: specPath
      });
      expect(matrix.summary.recommendedNextBet).toBe("habit-live-write");
      expect(matrix.nextSurfaceReport.recommendedCandidateId).toBe("habit-live-write");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("emits parseable JSON for the CLI command with a local spec input", () => {
    const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-reclaim-capability-matrix-cli-"));
    const specPath = path.join(tempDir, "reclaim-openapi.yml");
    fs.writeFileSync(specPath, syntheticOpenApiSpec, "utf8");

    try {
      const result = runNpmCli(["reclaim:openapi:capability-matrix", "--", "--input", specPath]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const output = JSON.parse(result.stdout) as {
        readSafety: string;
        source: { type: string; location: string };
        summary: { recommendedNextBet?: string };
        nextSurfaceReport: {
          recommendedCandidateId?: string;
          candidates: Array<{ id: string; mode: string; rank?: number }>;
        };
      };
      expect(output.readSafety).toBe("public_metadata");
      expect(output.source).toEqual({
        type: "file",
        location: specPath
      });
      expect(output.summary.recommendedNextBet).toBe("habit-live-write");
      expect(output.nextSurfaceReport.recommendedCandidateId).toBe("habit-live-write");
      expect(output.nextSurfaceReport.candidates[0]).toMatchObject({
        id: "habit-live-write",
        mode: "ranked_candidate",
        rank: 1
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
