import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ReclaimConfig, ReclaimConfigStatus } from "./types.js";

export const DEFAULT_RECLAIM_CONFIG_PATH = path.join("config", "reclaim.local.json");

const ReclaimConfigSchema = z.object({
  apiUrl: z.string().min(1),
  apiKey: z.string().min(1),
  timeoutMs: z.number().int().positive().default(20000),
  defaultTaskEventCategory: z.enum(["PERSONAL", "WORK"]).default("PERSONAL"),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
});

export function normalizeReclaimApiUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/+$/g, "");
  return trimmed.toLowerCase().endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export function parseReclaimConfig(raw: unknown): ReclaimConfig {
  const parsed = ReclaimConfigSchema.parse(raw);
  return {
    ...parsed,
    apiUrl: normalizeReclaimApiUrl(parsed.apiUrl),
    apiKey: parsed.apiKey.trim()
  };
}

export function loadReclaimConfig(
  configPath = DEFAULT_RECLAIM_CONFIG_PATH,
  baseDir = process.cwd()
): ReclaimConfig | undefined {
  const absolutePath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }

  return parseReclaimConfig(JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown);
}

export function getReclaimConfigStatus(
  configPath = DEFAULT_RECLAIM_CONFIG_PATH,
  baseDir = process.cwd()
): ReclaimConfigStatus {
  const absolutePath = path.resolve(baseDir, configPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      reachable: false,
      configPath: absolutePath,
      notes: [`No Reclaim config found at ${absolutePath}.`]
    };
  }

  try {
    const config = loadReclaimConfig(configPath, baseDir);
    return {
      reachable: false,
      configPath: absolutePath,
      notes: [
        `Reclaim config is present at ${absolutePath}.`,
        `Configured API URL: ${config?.apiUrl ?? "unknown"}.`,
        "Run reclaim:health to validate authenticated reachability."
      ]
    };
  } catch (error) {
    return {
      reachable: false,
      configPath: absolutePath,
      notes: [
        `Reclaim config exists at ${absolutePath} but could not be parsed.`,
        error instanceof Error ? error.message : String(error)
      ]
    };
  }
}
