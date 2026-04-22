import createClient, { type Client } from "openapi-fetch";
import type { paths } from "../generated/reclaim-openapi/reclaim-openapi.js";
import type { ReclaimConfig } from "./types.js";

export type ReclaimOpenApiPaths = paths;
export type ReclaimOpenApiClient = Client<ReclaimOpenApiPaths>;

function createAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

function getOpenApiBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/api$/i, "");
}

function createAuthenticatedFetch(
  config: ReclaimConfig,
  fetchImpl: typeof fetch,
): (input: Request) => Promise<Response> {
  return async (input: Request): Promise<Response> => {
    const headers = new Headers(input.headers);
    headers.set("Authorization", `Bearer ${config.apiKey}`);
    headers.set("Accept", "application/json");
    if (!headers.has("Content-Type") && input.method !== "GET" && input.method !== "HEAD") {
      headers.set("Content-Type", "application/json");
    }

    const request = new Request(input, {
      headers,
      signal: createAbortSignal(config.timeoutMs),
    });

    return fetchImpl(request);
  };
}

export function createReclaimOpenApiClient(
  config: ReclaimConfig,
  fetchImpl: typeof fetch = fetch,
): ReclaimOpenApiClient {
  return createClient<ReclaimOpenApiPaths>({
    baseUrl: getOpenApiBaseUrl(config.apiUrl),
    fetch: createAuthenticatedFetch(config, fetchImpl),
  });
}
