import type { ReclaimConfig } from "./types.js";

const RATE_LIMIT_STATUS = 429;
const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_COLLECTION_PAGES = 25;

export interface ReclaimRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

interface ReclaimCollectionPage {
  items: unknown[];
  nextRelativePath?: string;
}

function createAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

function waitFor(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });
}

function parseRetryAfterMs(value: string | null): number {
  if (!value) {
    return 0;
  }

  const retryAfterSeconds = Number(value);
  if (!Number.isNaN(retryAfterSeconds)) {
    return Math.max(0, Math.ceil(retryAfterSeconds * 1000));
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return 0;
  }

  return Math.max(0, retryAt - Date.now());
}

export async function performReclaimRequest(
  config: ReclaimConfig,
  relativePath: string,
  fetchImpl: typeof fetch,
  options?: ReclaimRequestOptions
): Promise<Response> {
  let attempts = 0;

  while (true) {
    const response = await fetchImpl(`${config.apiUrl}${relativePath}`, {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: createAbortSignal(config.timeoutMs)
    });

    if (response.status !== RATE_LIMIT_STATUS || attempts >= MAX_RATE_LIMIT_RETRIES) {
      return response;
    }

    attempts += 1;
    await waitFor(parseRetryAfterMs(response.headers.get("Retry-After")));
  }
}

export async function fetchReclaimJson<T>(
  config: ReclaimConfig,
  relativePath: string,
  fetchImpl: typeof fetch,
  options?: ReclaimRequestOptions
): Promise<T> {
  const response = await performReclaimRequest(config, relativePath, fetchImpl, options);

  if (!response.ok) {
    throw new Error(`Reclaim request failed: ${response.status} ${response.statusText} for ${relativePath}`);
  }

  return (await response.json()) as T;
}

function getFirstArray(record: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  return undefined;
}

function normalizeRelativePath(value: string, fallbackPath: string): string {
  if (!value) {
    return fallbackPath;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  }
  if (value.startsWith("/")) {
    return value;
  }
  if (value.startsWith("?")) {
    const [pathOnly] = fallbackPath.split("?");
    return `${pathOnly}${value}`;
  }

  const [pathOnly] = fallbackPath.split("?");
  return `${pathOnly}?cursor=${encodeURIComponent(value)}`;
}

function getNextCollectionPath(
  relativePath: string,
  record: Record<string, unknown>,
): string | undefined {
  const paginationRecord = typeof record.pagination === "object" && record.pagination !== null
    ? record.pagination as Record<string, unknown>
    : undefined;
  const metaRecord = typeof record.meta === "object" && record.meta !== null
    ? record.meta as Record<string, unknown>
    : undefined;
  const pageRecord = paginationRecord ?? metaRecord;

  const nextPathValue = [record.next, record.nextPath, pageRecord?.next, pageRecord?.nextPath]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  if (nextPathValue) {
    return normalizeRelativePath(nextPathValue, relativePath);
  }

  const nextPageValue = [
    record.nextPage,
    record.next_page,
    pageRecord?.nextPage,
    pageRecord?.next_page
  ].find((value): value is string | number => typeof value === "string" || typeof value === "number");
  if (nextPageValue !== undefined) {
    const nextUrl = new URL(relativePath, "https://reclaim.local");
    nextUrl.searchParams.set("page", String(nextPageValue));
    return `${nextUrl.pathname}${nextUrl.search}`;
  }

  const nextCursorValue = [
    record.nextCursor,
    record.next_cursor,
    record.cursor,
    record.nextToken,
    pageRecord?.nextCursor,
    pageRecord?.next_cursor,
    pageRecord?.cursor,
    pageRecord?.nextToken
  ].find((value): value is string => typeof value === "string" && value.length > 0);
  if (nextCursorValue) {
    const nextUrl = new URL(relativePath, "https://reclaim.local");
    nextUrl.searchParams.set("cursor", nextCursorValue);
    return `${nextUrl.pathname}${nextUrl.search}`;
  }

  const currentPage = [record.page, pageRecord?.page]
    .find((value): value is number => typeof value === "number" && Number.isFinite(value));
  const totalPages = [record.totalPages, record.total_pages, pageRecord?.totalPages, pageRecord?.total_pages]
    .find((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (currentPage !== undefined && totalPages !== undefined && currentPage < totalPages) {
    const nextUrl = new URL(relativePath, "https://reclaim.local");
    nextUrl.searchParams.set("page", String(currentPage + 1));
    return `${nextUrl.pathname}${nextUrl.search}`;
  }

  return undefined;
}

function parseCollectionPage(
  payload: unknown,
  relativePath: string,
  itemKeys: string[]
): ReclaimCollectionPage {
  if (Array.isArray(payload)) {
    return { items: payload };
  }

  const record = (payload ?? {}) as Record<string, unknown>;
  const items = getFirstArray(record, [...itemKeys, "items", "results", "data"]);
  if (!items) {
    throw new Error(`Reclaim collection response for ${relativePath} did not contain an array payload.`);
  }

  const nextRelativePath = getNextCollectionPath(relativePath, record);
  const hasMore = [record.hasMore, record.has_more, record.paginationHasMore]
    .some((value) => value === true);
  if (hasMore && !nextRelativePath) {
    throw new Error(`Reclaim pagination indicated more results for ${relativePath} without a next page token.`);
  }

  return { items, nextRelativePath };
}

export async function collectReclaimJson<T>(
  config: ReclaimConfig,
  relativePath: string,
  fetchImpl: typeof fetch,
  itemKeys: string[]
): Promise<T[]> {
  const collected: T[] = [];
  const visitedPaths = new Set<string>();
  let nextRelativePath: string | undefined = relativePath;
  let pagesRead = 0;

  while (nextRelativePath) {
    if (visitedPaths.has(nextRelativePath)) {
      throw new Error(`Reclaim pagination loop detected for ${relativePath}.`);
    }
    if (pagesRead >= MAX_COLLECTION_PAGES) {
      throw new Error(`Reclaim pagination exceeded ${MAX_COLLECTION_PAGES} pages for ${relativePath}.`);
    }

    visitedPaths.add(nextRelativePath);
    const payload = await fetchReclaimJson<unknown>(config, nextRelativePath, fetchImpl);
    const page = parseCollectionPage(payload, nextRelativePath, itemKeys);
    collected.push(...page.items as T[]);
    nextRelativePath = page.nextRelativePath;
    pagesRead += 1;
  }

  return collected;
}
