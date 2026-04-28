# CLI Command Catalog

The CLI is npm-first in this repository. Use `npm run reclaim:help` for the current default command index, and add `-- --include-optional` to include preview-only and optional read-only surfaces.

For machine parsing, use npm scripts with `--silent` and follow the [agent-safe JSON CLI profile](cli-json-profile.md). The committed [command safety manifest](command-safety-manifest.json) is the canonical machine-readable inventory.

## Quick Start

Credential-free commands:

```bash
npm run reclaim:help
npm run reclaim:help -- --include-optional
npm run reclaim:onboarding
npm run reclaim:config:status -- --config config/reclaim.local.json
npm run reclaim:tasks:preview-create -- --input examples/tasks.example.json
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
```

Authenticated reads:

```bash
npm run reclaim:health -- --config config/reclaim.local.json
npm run reclaim:time-policies:list -- --config config/reclaim.local.json
npm run reclaim:tasks:list -- --config config/reclaim.local.json
npm run reclaim:tasks:filter -- --config config/reclaim.local.json --title-contains notes --event-category WORK
npm run reclaim:tasks:export -- --config config/reclaim.local.json --event-category WORK --format csv
```

Confirmed writes require explicit review flags:

```bash
npm run reclaim:tasks:create -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-write
npm run reclaim:tasks:update -- --config config/reclaim.local.json --input examples/task-updates.example.json --confirm-write
npm run reclaim:tasks:cleanup-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-reviewed-delete
```

## Safety Classes

| Safety class | Meaning | Examples |
| --- | --- | --- |
| `public_metadata` | Reads only package metadata, local files, or public API contract information. | `reclaim:help`, `reclaim:onboarding`, `reclaim:config:status` |
| `local_preview` | Uses local synthetic fixtures or redacted inputs without live Reclaim writes. | `reclaim:tasks:preview-create`, `reclaim:demo:mock-api`, `reclaim:support:bundle` |
| `authenticated_read` | Reads account data through the configured Reclaim API key. | `reclaim:health`, `reclaim:tasks:list`, `reclaim:tasks:export` |
| `confirmed_write` | Performs live task writes only when an explicit confirmation flag is present. | `reclaim:tasks:create`, `reclaim:tasks:update`, `reclaim:tasks:cleanup-duplicates` |

## Core Commands

```bash
npm run reclaim:help
npm run reclaim:help -- --include-optional
npm run reclaim:onboarding
npm run reclaim:config:status -- --config config/reclaim.local.json
npm run reclaim:support:bundle -- --input examples/support-bundle-preview.example.json
npm run reclaim:health -- --config config/reclaim.local.json
npm run reclaim:openapi:capability-matrix
npm run reclaim:openapi:capability-matrix -- --input generated/reclaim-openapi/reclaim-api-0.1.raw.yml
npm run reclaim:time-policies:list -- --config config/reclaim.local.json
npm run reclaim:time-policies:explain-conflicts -- --input examples/time-policy-conflicts.example.json
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
npm run reclaim:demo:mock-api -- --profile failure-modes
```

Notes:

- `reclaim:help` prints the npm-first command index.
- `reclaim:onboarding` is credential-free and writes no files.
- `reclaim:config:status` checks local config-file presence and parse status without validating credentials.
- `reclaim:health`, `reclaim:time-policies:list`, and task read commands require a private local config.
- `reclaim:openapi:capability-matrix` compares the published Reclaim API document with shipped and roadmap surfaces.
- `reclaim:support:bundle` creates a redacted troubleshooting bundle for preview or config incidents.

## Task Commands

```bash
npm run reclaim:tasks:preview-create -- --input examples/tasks.example.json
npm run reclaim:tasks:preview-create -- --input examples/scheduling-recipes.example.json
npm run reclaim:tasks:preview-create -- --input examples/shopping-errand-windows.example.json
npm run reclaim:tasks:preview-create -- --input examples/event-prep-block-example-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json
npm run reclaim:tasks:preview-update -- --input examples/task-updates.example.json
npm run reclaim:tasks:list -- --config config/reclaim.local.json
npm run reclaim:tasks:filter -- --config config/reclaim.local.json --title-contains notes --event-category WORK
npm run reclaim:tasks:export -- --config config/reclaim.local.json --event-category WORK --format csv
npm run reclaim:tasks:inspect-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json
npm run reclaim:tasks:validate-write-receipts -- --config config/reclaim.local.json --input examples/task-write-receipts.example.json
npm run reclaim:tasks:create -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-write
npm run reclaim:tasks:update -- --config config/reclaim.local.json --input examples/task-updates.example.json --confirm-write
npm run reclaim:tasks:cleanup-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-reviewed-delete
```

Task create, update, and duplicate-delete writes return `writeReceipts` for post-run audit. See [tasks.md](tasks.md) for the input shape, read filters, duplicate behavior, and receipt validation.

## Scheduling And Preview Commands

```bash
npm run reclaim:scenarios:preview-weekly -- --input examples/compound-weekly-preview.example.json
npm run reclaim:habits:preview-create -- --input examples/habits.example.json
npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:buffers:preview-rule -- --input examples/buffer-rules.example.json
npm run reclaim:buffers:preview-template -- --input examples/buffer-templates.example.json
npm run reclaim:meetings:preview-availability -- --input examples/meeting-availability.example.json
npm run reclaim:meetings:preview-recurring-reschedule -- --input examples/recurring-meeting-reschedule.example.json
npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json
npm run reclaim:meetings-hours:preview-switch -- --input examples/meetings-hours-profile-switch.example.json
npm run reclaim:hours-config:preview-audit -- --input examples/hours-config.example.json
npm run reclaim:hours-config:preview-diff -- --input examples/hours-config-diff.example.json
npm run reclaim:account-audit:preview-inspect -- --input examples/account-audit.example.json
npm run reclaim:account-audit:preview-drift -- --input examples/account-audit-drift.example.json
```

These commands use synthetic fixture inputs and do not create live habits, focus blocks, buffers, meetings, or hours changes. See the [documentation index](README.md) for the guide that matches each preview surface.

## Account Inspection Commands

```bash
npm run reclaim:meetings-hours:inspect -- --config config/reclaim.local.json
npm run reclaim:hours-config:audit -- --config config/reclaim.local.json
npm run reclaim:account-audit:inspect -- --config config/reclaim.local.json
```

These are authenticated read commands. Their outputs are summary-only where practical, avoiding task titles, meeting titles, policy ids, policy titles, and user identifiers in committed examples.

## Optional Agent Surface

```bash
npm run reclaim:mcp:mock-readonly -- --input examples/mock-readonly-mcp.example.json
```

`reclaim:mcp:mock-readonly` is a fixture-backed stdio MCP prototype for local agent experiments. It exposes read-only task, time-policy, and meetings-hours tools without live Reclaim account access.

## OpenAPI Client

The repo also exposes a thin typed OpenAPI client wrapper:

```ts
import { createReclaimOpenApiClient, loadReclaimConfig } from "reclaim-toolkit";

const config = loadReclaimConfig("config/reclaim.local.json");
if (!config) {
  throw new Error("Missing Reclaim config.");
}

const client = createReclaimOpenApiClient(config);
const currentUser = await client.GET("/api/users/current");
console.log(currentUser.data);
```

This wrapper uses the generated `paths` contract from the published Reclaim OpenAPI document and applies the existing auth and timeout defaults. Run `npm run reclaim:openapi:generate` when refreshing the underlying contract. See [openapi-client-generation.md](openapi-client-generation.md).
