import { describe, expect, test } from "vitest";
import { sanitizeReclaimOpenApiSpec } from "../scripts/generate-openapi-client.js";

describe("sanitizeReclaimOpenApiSpec", () => {
  test("injects placeholder schemas for missing component refs", () => {
    const rawSpec = [
      "openapi: 3.0.1",
      "components:",
      "  schemas:",
      "    DailyHabit:",
      "      type: object",
      "paths:",
      "  /api/smart-habits:",
      "    post:",
      "      requestBody:",
      "        content:",
      "          application/json:",
      "            schema:",
      "              $ref: \"#/components/schemas/CreateSmartHabitRequest\"",
      "    get:",
      "      responses:",
      "        \"200\":",
      "          description: ok",
      "          content:",
      "            application/json:",
      "              schema:",
      "                $ref: \"#/components/schemas/AbstractMetric_10\"",
    ].join("\n");

    const result = sanitizeReclaimOpenApiSpec(rawSpec);

    expect(result.missingSchemas).toEqual(["AbstractMetric_10", "CreateSmartHabitRequest"]);
    expect(result.sanitized).toContain("AbstractMetric_10:");
    expect(result.sanitized).toContain("CreateSmartHabitRequest:");
    expect(result.sanitized).toContain("Placeholder injected by reclaim-toolkit");
  });
});
