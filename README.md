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
  "defaultTaskEventCategory": "PERSONAL"
}
```

`apiUrl` is normalized to include `/api`, so either `https://api.app.reclaim.ai` or `https://api.app.reclaim.ai/api` works.

## CLI

```bash
npm run reclaim:config:status -- --config config/reclaim.local.json
npm run reclaim:health -- --config config/reclaim.local.json
npm run reclaim:tasks:preview-create -- --input examples/tasks.example.json
npm run reclaim:tasks:create -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-write
npm run reclaim:tasks:inspect-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json
npm run reclaim:tasks:cleanup-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-reviewed-delete
```

Task creation and duplicate deletion require explicit confirmation flags.

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
const result = await tasks.create(client, input, { confirmWrite: true });
```

## Modules

Wave 1 includes config, client, health, and task utilities. Future modules can add support for Focus, Habits, Buffers, Meetings, Hours, and broader configuration helpers when those APIs are implemented.
