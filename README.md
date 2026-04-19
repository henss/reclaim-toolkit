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
npm run reclaim:tasks:create -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-write
npm run reclaim:tasks:inspect-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json
npm run reclaim:tasks:cleanup-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-reviewed-delete
```

Task creation and duplicate deletion require explicit confirmation flags.
Confirmed task writes return `writeReceipts` in the command JSON. Each receipt records the task id, write operation, confirmation timestamp, and a manual rollback hint for post-run audit.

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

Wave 1 includes config, client, health, and task utilities. Future modules can add support for Focus, Habits, Buffers, Meetings, Hours, and broader configuration helpers when those APIs are implemented.

## Related Work

See [docs/related-work.md](docs/related-work.md) for other unofficial Reclaim.ai SDKs, CLIs, automation nodes, MCP servers, and agent-facing tools.
