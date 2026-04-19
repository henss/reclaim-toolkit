import fs from "node:fs";
import { buffers, parseReclaimBufferInputs } from "./buffers.js";
import { createReclaimClient } from "./client.js";
import { getReclaimConfigStatus, loadReclaimConfig } from "./config.js";
import { focus, parseReclaimFocusInputs } from "./focus.js";
import { habits, parseReclaimHabitInputs } from "./habits.js";
import { runReclaimHealthCheck } from "./health.js";
import {
  meetingsHours,
  parseReclaimMeetingsAndHoursSnapshot
} from "./meetings-hours.js";
import { runMockReclaimApiDemo } from "./mock-lab.js";
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

  if (command === "reclaim:habits:preview-create") {
    const habitInputs = parseReclaimHabitInputs(readJsonInput());
    console.log(JSON.stringify(habits.previewCreates(habitInputs), null, 2));
    return;
  }

  if (command === "reclaim:focus:preview-create") {
    const focusInputs = parseReclaimFocusInputs(readJsonInput());
    console.log(JSON.stringify(focus.previewCreates(focusInputs), null, 2));
    return;
  }

  if (command === "reclaim:buffers:preview-create") {
    const bufferInputs = parseReclaimBufferInputs(readJsonInput());
    console.log(JSON.stringify(buffers.previewCreates(bufferInputs), null, 2));
    return;
  }

  if (command === "reclaim:meetings-hours:preview-inspect") {
    const snapshot = parseReclaimMeetingsAndHoursSnapshot(readJsonInput());
    console.log(JSON.stringify(meetingsHours.inspectSnapshot(snapshot), null, 2));
    return;
  }

  if (command === "reclaim:meetings-hours:inspect") {
    console.log(JSON.stringify(await meetingsHours.inspect(loadClient()), null, 2));
    return;
  }

  if (command === "reclaim:demo:mock-api") {
    console.log(JSON.stringify(await runMockReclaimApiDemo(parseFlag("--input")), null, 2));
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
