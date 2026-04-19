import fs from "node:fs";
import { createReclaimClient } from "./client.js";
import { getReclaimConfigStatus, loadReclaimConfig } from "./config.js";
import { runReclaimHealthCheck } from "./health.js";
import { parseReclaimTaskInputs, tasks } from "./tasks.js";

function parseFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readJsonInput(): unknown {
  const inputPath = parseFlag("--input");
  if (!inputPath) {
    throw new Error("Expected --input <json>.");
  }
  return JSON.parse(fs.readFileSync(inputPath, "utf8")) as unknown;
}

function loadClient(): ReturnType<typeof createReclaimClient> {
  const config = loadReclaimConfig(parseFlag("--config"));
  if (!config) {
    throw new Error("Reclaim config is missing. Pass --config <path> or create config/reclaim.local.json.");
  }
  return createReclaimClient(config);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "reclaim:config:status") {
    console.log(JSON.stringify(getReclaimConfigStatus(parseFlag("--config")), null, 2));
    return;
  }

  if (command === "reclaim:health") {
    console.log(JSON.stringify(await runReclaimHealthCheck(parseFlag("--config")), null, 2));
    return;
  }

  if (command === "reclaim:time-policies:list") {
    const client = loadClient();
    console.log(JSON.stringify(tasks.previewTimePolicySelection(await client.listTaskAssignmentTimeSchemes(), {
      preferredTimePolicyId: client.config.preferredTimePolicyId,
      preferredTimePolicyTitle: client.config.preferredTimePolicyTitle,
      eventCategory: client.config.defaultTaskEventCategory
    }), null, 2));
    return;
  }

  if (command === "reclaim:tasks:preview-create") {
    const taskInputs = parseReclaimTaskInputs(readJsonInput());
    console.log(JSON.stringify(tasks.previewCreates(taskInputs), null, 2));
    return;
  }

  if (command === "reclaim:tasks:create") {
    const taskInputs = parseReclaimTaskInputs(readJsonInput());
    console.log(JSON.stringify(await tasks.create(loadClient(), taskInputs, {
      confirmWrite: hasFlag("--confirm-write")
    }), null, 2));
    return;
  }

  if (command === "reclaim:tasks:inspect-duplicates") {
    const taskInputs = parseReclaimTaskInputs(readJsonInput());
    const client = loadClient();
    console.log(JSON.stringify(tasks.inspectDuplicates(taskInputs, await client.listTasks(), {
      timeSchemeId: client.config.preferredTimePolicyId,
      eventCategory: client.config.defaultTaskEventCategory
    }), null, 2));
    return;
  }

  if (command === "reclaim:tasks:cleanup-duplicates") {
    const taskInputs = parseReclaimTaskInputs(readJsonInput());
    const client = loadClient();
    const plan = tasks.inspectDuplicates(taskInputs, await client.listTasks(), {
      timeSchemeId: client.config.preferredTimePolicyId,
      eventCategory: client.config.defaultTaskEventCategory
    });
    console.log(JSON.stringify(await tasks.cleanupDuplicates(client, plan, {
      confirmDelete: hasFlag("--confirm-reviewed-delete")
    }), null, 2));
    return;
  }

  throw new Error("Unknown command.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
