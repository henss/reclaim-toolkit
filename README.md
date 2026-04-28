# reclaim-toolkit

TypeScript utilities and an npm-first CLI for working with Reclaim.ai APIs.

The toolkit is designed for cautious automation: local preview commands work with synthetic fixtures, authenticated read commands require a private config file, and live task writes require explicit confirmation flags.

## Install

```bash
npm install reclaim-toolkit
```

When working from this repository, install dependencies first and use the checked-in npm scripts:

```bash
npm install
npm run reclaim:onboarding
```

`reclaim:onboarding` is credential-free. It reports local config readiness, safe synthetic fixture commands, and write-guard reminders without contacting Reclaim or writing files.

## Configure

Create a private local config file, usually `config/reclaim.local.json`:

```json
{
  "apiUrl": "https://api.app.reclaim.ai",
  "apiKey": "reclaim_api_key_example",
  "timeoutMs": 20000,
  "defaultTaskEventCategory": "PERSONAL",
  "preferredTimePolicyTitle": "Personal Hours"
}
```

Do not commit local config files or command output containing account-specific ids, emails, task titles, policy titles, or secrets.

`apiUrl` is normalized to include `/api`, so either `https://api.app.reclaim.ai` or `https://api.app.reclaim.ai/api` works. Set either `preferredTimePolicyId` or `preferredTimePolicyTitle` when task creation should use a specific Reclaim task-assignment time policy.

## Try The CLI

Start with credential-free commands:

```bash
npm run reclaim:help
npm run reclaim:tasks:preview-create -- --input examples/tasks.example.json
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
```

Use authenticated read commands only after creating a private config:

```bash
npm run reclaim:health -- --config config/reclaim.local.json
npm run reclaim:tasks:list -- --config config/reclaim.local.json
```

Confirmed task writes are available, but they require explicit confirmation flags such as `--confirm-write`. Review previews and duplicate warnings before running live writes.

For the full command catalog, safety classes, and parseable JSON rules, see [docs/cli-commands.md](docs/cli-commands.md) and [docs/cli-json-profile.md](docs/cli-json-profile.md).

## Use As A Library

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

console.log({ preview, writeReceipts: result.writeReceipts });
```

The package also exposes narrower subpaths:

```ts
import { createReclaimClient, loadReclaimConfig } from "reclaim-toolkit/core";
import { getReclaimCliHelp } from "reclaim-toolkit/cli";
import { runMockReclaimApiDemo } from "reclaim-toolkit/mock";
```

For the currently exercised consumer install and TypeScript compile shapes, see [docs/package-consumer-smoke-matrix.md](docs/package-consumer-smoke-matrix.md).

## Capabilities

| Capability | Safety level | Start here |
| --- | --- | --- |
| CLI output and command safety | Public metadata, local preview, authenticated read, confirmed write | [docs/cli-commands.md](docs/cli-commands.md) |
| Task preview, reads, writes, receipts, and duplicate checks | Local preview through confirmed write | [docs/tasks.md](docs/tasks.md) |
| Time-policy fit and conflict explanations | Local preview and authenticated read | [docs/time-policy-conflicts.md](docs/time-policy-conflicts.md) |
| Habit, Focus, Buffer, and scheduling previews | Local preview | [docs/focus-and-buffers.md](docs/focus-and-buffers.md) |
| Meeting availability and recurring reschedule previews | Local preview | [docs/meeting-availability.md](docs/meeting-availability.md) |
| Meetings, hours, and account inspection | Authenticated read with summary-only outputs | [docs/meetings-and-hours.md](docs/meetings-and-hours.md) |
| OpenAPI client and generated contract refresh | Public metadata and library API | [docs/openapi-client-generation.md](docs/openapi-client-generation.md) |
| Synthetic fixtures and examples | Public-safe local examples | [examples/README.md](examples/README.md) |

## Documentation

[docs/README.md](docs/README.md) is the documentation index. It groups the existing guides by user task, including getting started, write safety, scheduling previews, account inspection, examples, support workflows, and maintainer references.

## Related Work

See [docs/related-work.md](docs/related-work.md) for other unofficial Reclaim.ai SDKs, CLIs, automation nodes, MCP servers, and agent-facing tools.
