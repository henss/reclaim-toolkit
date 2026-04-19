import { createReclaimClient, type ReclaimClient } from "./client.js";
import { loadReclaimConfig } from "./config.js";
import type { ReclaimConfig, ReclaimHealthCheckResult } from "./types.js";

export async function runReclaimHealthCheck(
  configOrPath?: ReclaimConfig | string,
  fetchImpl: typeof fetch = fetch
): Promise<ReclaimHealthCheckResult> {
  const config =
    typeof configOrPath === "string" || configOrPath === undefined
      ? loadReclaimConfig(configOrPath)
      : configOrPath;

  if (!config) {
    return {
      reachable: false,
      notes: ["Reclaim config is missing."]
    };
  }

  return runReclaimHealthCheckWithClient(createReclaimClient(config, fetchImpl));
}

export async function runReclaimHealthCheckWithClient(client: ReclaimClient): Promise<ReclaimHealthCheckResult> {
  try {
    const [currentUser, timeSchemes, currentTasks] = await Promise.all([
      client.getCurrentUser(),
      client.listTaskAssignmentTimeSchemes(),
      client.listTasks()
    ]);

    return {
      reachable: true,
      notes: [
        `Reclaim API is reachable at ${client.config.apiUrl}.`,
        "Authenticated user, task-assignment time policies, and task listing responded successfully."
      ],
      userEmail: currentUser.email,
      taskAssignmentTimeSchemeCount: timeSchemes.length,
      taskCount: currentTasks.length
    };
  } catch (error) {
    return {
      reachable: false,
      notes: [
        `Reclaim API probe failed for ${client.config.apiUrl}.`,
        error instanceof Error ? error.message : String(error)
      ]
    };
  }
}
