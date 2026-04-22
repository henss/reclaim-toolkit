import { describe, expect, test } from "vitest";
import { createReclaimOpenApiClient } from "../src/openapi-client.js";
import type { ReclaimConfig } from "../src/types.js";

const TEST_CONFIG: ReclaimConfig = {
  apiUrl: "https://api.app.reclaim.ai/api",
  apiKey: "test-key",
  timeoutMs: 20_000,
  defaultTaskEventCategory: "PERSONAL",
};

describe("createReclaimOpenApiClient", () => {
  test("uses the published OpenAPI paths with auth headers and normalized base url", async () => {
    let capturedRequest: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedRequest = input instanceof Request ? input : new Request(input, init);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = createReclaimOpenApiClient(TEST_CONFIG, fetchImpl);
    await client.GET("/api/users/current");

    expect(capturedRequest).toBeDefined();
    expect(capturedRequest?.url).toBe("https://api.app.reclaim.ai/api/users/current");
    expect(capturedRequest?.headers.get("Authorization")).toBe("Bearer test-key");
    expect(capturedRequest?.headers.get("Accept")).toBe("application/json");
  });
});
