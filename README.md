# reclaim-toolkit

TypeScript utilities for working with Reclaim.ai APIs.

## Install

```bash
npm install reclaim-toolkit
```

## Configuration

Create a local config file, usually `config/reclaim.local.json`:

```json
{
  "apiUrl": "https://api.app.reclaim.ai",
  "apiKey": "reclaim_api_key_example",
  "timeoutMs": 20000,
  "defaultTaskEventCategory": "PERSONAL",
  "preferredTimePolicyTitle": "Personal Hours"
}
```

`apiUrl` is normalized to include `/api`, so either `https://api.app.reclaim.ai` or `https://api.app.reclaim.ai/api` works.
Set either `preferredTimePolicyId` or `preferredTimePolicyTitle` when task creation should use a specific Reclaim task-assignment time policy. If neither is set, task creation selects the first policy matching `defaultTaskEventCategory`, then falls back to the first returned policy.

## CLI

```bash
npm run reclaim:config:status -- --config config/reclaim.local.json
npm run reclaim:health -- --config config/reclaim.local.json
npm run reclaim:time-policies:list -- --config config/reclaim.local.json
npm run reclaim:tasks:preview-create -- --input examples/tasks.example.json
npm run reclaim:tasks:preview-create -- --input examples/scheduling-recipes.example.json
npm run reclaim:habits:preview-create -- --input examples/habits.example.json
npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json
npm run reclaim:meetings-hours:inspect -- --config config/reclaim.local.json
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
npm run reclaim:tasks:create -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-write
npm run reclaim:tasks:inspect-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json
npm run reclaim:tasks:cleanup-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-reviewed-delete
```

Task creation and duplicate deletion require explicit confirmation flags.
Confirmed task writes return `writeReceipts` in the command JSON. Each receipt records the task id, write operation, confirmation timestamp, and a manual rollback hint for post-run audit.
For machine parsing, use the npm scripts with `--silent` and follow the [agent-safe JSON CLI profile](docs/cli-json-profile.md).

## Agent-Safe JSON CLI Profile

Agent and script callers should use the npm script surface with `--silent`, for example:

```bash
npm run --silent reclaim:tasks:preview-create -- --input examples/tasks.example.json
```

On success, commands emit one pretty-printed JSON document to stdout, write no normal-status text to stderr, and exit with code `0`. On failure, commands emit a concise diagnostic to stderr, leave stdout empty for profile-covered errors, and exit with code `1`.

Local preview commands are safe for credential-free practice when paired with synthetic fixtures. Authenticated read commands require a local config and may return account-specific values. Confirmed write commands require their explicit confirmation flags and should be reviewed before use.

To practice the task flow without Reclaim credentials, run `npm run reclaim:demo:mock-api -- --input examples/tasks.example.json`. The demo uses an in-memory synthetic API surface with placeholder policies and tasks, then prints health, time-policy, preview, duplicate-cleanup, and create results. It is not a complete Reclaim emulator.

## Library

```ts
import { createReclaimClient, loadReclaimConfig, tasks } from "reclaim-toolkit";

const config = loadReclaimConfig("config/reclaim.local.json");
if (!config) {
  throw new Error("Missing Reclaim config.");
}

const client = createReclaimClient(config);
const input = [{ title: "Review pull request", durationMinutes: 30 }];
const preview = tasks.previewCreates(input, { timeSchemeId: "policy-work" });
const policyPreview = tasks.previewTimePolicySelection(await client.listTaskAssignmentTimeSchemes(), {
  preferredTimePolicyTitle: config.preferredTimePolicyTitle,
  eventCategory: config.defaultTaskEventCategory
});
const result = await tasks.create(client, input, { confirmWrite: true });
console.log(result.writeReceipts);
```

## Modules

Wave 1 includes config, client, health, task utilities, preview-only Habit, Focus, and Buffer helpers, and a read-only Meetings and Hours inspector prototype. Future modules can add write support only after an approved API contract.

See [docs/habits.md](docs/habits.md) for the public-safe Habit input shape.
See [docs/focus-and-buffers.md](docs/focus-and-buffers.md) for the public-safe Focus and Buffer input shapes.
See [docs/meetings-and-hours.md](docs/meetings-and-hours.md) for the read-only Meetings and Hours inspector output.

## Related Work

See [docs/related-work.md](docs/related-work.md) for other unofficial Reclaim.ai SDKs, CLIs, automation nodes, MCP servers, and agent-facing tools.
