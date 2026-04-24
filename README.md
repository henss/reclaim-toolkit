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
npm run reclaim:tasks:preview-create -- --input examples/tasks.example.json
npm run reclaim:tasks:preview-create -- --input examples/scheduling-recipes.example.json
npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json
npm run reclaim:habits:preview-create -- --input examples/habits.example.json
npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:buffers:preview-rule -- --input examples/buffer-rules.example.json
npm run reclaim:buffers:preview-template -- --input examples/buffer-templates.example.json
npm run reclaim:meetings:preview-availability -- --input examples/meeting-availability.example.json
npm run reclaim:meetings:preview-recurring-reschedule -- --input examples/recurring-meeting-reschedule.example.json
npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json
npm run reclaim:account-audit:preview-inspect -- --input examples/account-audit.example.json
npm run reclaim:meetings-hours:inspect -- --config config/reclaim.local.json
npm run reclaim:account-audit:inspect -- --config config/reclaim.local.json
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
npm run reclaim:tasks:list -- --config config/reclaim.local.json
npm run reclaim:tasks:filter -- --config config/reclaim.local.json --title-contains notes --event-category WORK
npm run reclaim:tasks:export -- --config config/reclaim.local.json --event-category WORK --format csv
npm run reclaim:tasks:create -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-write
npm run reclaim:tasks:inspect-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json
npm run reclaim:tasks:cleanup-duplicates -- --config config/reclaim.local.json --input examples/tasks.example.json --confirm-reviewed-delete
```

`reclaim:help` prints a parseable npm-first command index. By default it stays focused on the conventional public baseline, and `--include-optional` reveals preview-only and read-only optional surfaces with explicit readiness gates.
`reclaim:onboarding` is a credential-free wizard that reports local config readiness, safe synthetic fixture commands, and write-guard reminders without contacting Reclaim or writing files.
`reclaim:openapi:capability-matrix` is a credential-free public-metadata command that compares the published Reclaim API document with the toolkit's shipped and roadmap surfaces so future module bets can start from auditable contract evidence.
`reclaim:support:bundle` is a redacted troubleshooting command for preview or config incidents. It preserves structural JSON signals, dates, times, and safety enums while redacting task titles, ids, emails, secrets, free-text notes, and absolute paths.
Task list, filter, export, duplicate-inspection, meetings-and-hours inspection, health, and time-policy discovery commands are read-only authenticated commands. `reclaim:tasks:export` keeps the CLI profile parseable by returning JSON; CSV exports are placed in the JSON `content` field.
`reclaim:account-audit:inspect` is a summary-only authenticated read command that collapses account state into counts and capability coverage instead of returning task titles, meeting titles, ids, or user identifiers.
`reclaim:time-policies:explain-conflicts` is a synthetic local preview command that explains policy fit and conflict reasons from fixture-backed task, focus, buffer, and policy inputs.
`reclaim:meetings:preview-availability` is a synthetic local preview command that derives public-safe availability windows, candidate meeting slots, and exclusion reasons from synthetic time-policy windows and synthetic busy meetings.
`reclaim:meetings:preview-recurring-reschedule` is a synthetic local preview command that classifies recurring occurrences as keep, move, or blocked and suggests bounded alternative slots without touching a live calendar.
Read collectors follow common paginated Reclaim response envelopes for tasks, meetings, and time schemes, and they retry bounded `429 Too Many Requests` responses when `Retry-After` is present.
Task creation and duplicate deletion require explicit confirmation flags. `reclaim:tasks:create` also returns a warning-only `duplicatePlan` when it sees exact existing duplicates before attempting new task writes.
Confirmed task writes return `writeReceipts` in the command JSON. Each receipt records the task id, write operation, confirmation timestamp, and a manual rollback hint for post-run audit.
For machine parsing, use the npm scripts with `--silent` and follow the [agent-safe JSON CLI profile](docs/cli-json-profile.md).

## Agent-Safe JSON CLI Profile

Agent and script callers should use the npm script surface with `--silent`, for example:

```bash
npm run --silent reclaim:onboarding
npm run --silent reclaim:tasks:preview-create -- --input examples/tasks.example.json
```

On success, commands emit one pretty-printed JSON document to stdout, write no normal-status text to stderr, and exit with code `0`. On failure, commands emit a concise diagnostic to stderr, leave stdout empty for profile-covered errors, and exit with code `1`.

Local preview commands are safe for credential-free practice when paired with synthetic fixtures. Authenticated read commands require a local config and may return account-specific values. Confirmed write commands require their explicit confirmation flags and should be reviewed before use.

To practice the task flow without Reclaim credentials, run `npm run reclaim:demo:mock-api -- --input examples/tasks.example.json`. The demo uses an in-memory synthetic API surface with placeholder policies and tasks, then prints health, time-policy, preview, duplicate-cleanup, and create results. It is not a complete Reclaim emulator.
`createMockReclaimApiFetch` also accepts synthetic pagination and rate-limit fixtures for test-only read-collector coverage.

## Library

```ts
import { createReclaimClient, loadReclaimConfig, tasks, timePolicies } from "reclaim-toolkit";

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
const policyConflicts = timePolicies.explainConflicts({
  tasks: input,
  focusBlocks: [],
  buffers: [],
  timeSchemes: await client.listTaskAssignmentTimeSchemes(),
  defaultTaskEventCategory: config.defaultTaskEventCategory,
  preferredTimePolicyTitle: config.preferredTimePolicyTitle
});
const readOnlyTasks = tasks.listExistingTasks(await client.listTasks(), { eventCategory: "WORK" });
const result = await tasks.create(client, input, { confirmWrite: true });
console.log({ policyPreview, policyConflicts, readOnlyTasks, writeReceipts: result.writeReceipts });
```

## Modules

Wave 1 includes config, client, health, task utilities, preview-only Habit, Focus, Buffer, Meeting Availability, and recurring meeting reschedule helpers, a Buffer rule preview helper with diff-style receipts, a Buffer template preview helper, a summary-only Account Audit snapshot, and a read-only Meetings and Hours inspector prototype. Future modules can add write support only after an approved API contract.

See [docs/habits.md](docs/habits.md) for the public-safe Habit input shape.
See [docs/focus-and-buffers.md](docs/focus-and-buffers.md) for the public-safe Focus and Buffer input shapes.
See [docs/buffer-rules.md](docs/buffer-rules.md) for the preview-only Buffer rule diff receipt helper.
See [docs/buffer-templates.md](docs/buffer-templates.md) for the preview-only Buffer template helper.
See [docs/meeting-availability.md](docs/meeting-availability.md) for the preview-only Meeting Availability helper.
See [docs/recurring-meeting-reschedule.md](docs/recurring-meeting-reschedule.md) for the preview-only recurring meeting reschedule simulator.
See [docs/account-audit.md](docs/account-audit.md) for the summary-only Account Audit snapshot output.
See [docs/meetings-and-hours.md](docs/meetings-and-hours.md) for the read-only Meetings and Hours inspector output.
See [docs/time-policy-conflicts.md](docs/time-policy-conflicts.md) for the synthetic time-policy conflict explainer input and output.
See [docs/integration-starter-packs.md](docs/integration-starter-packs.md) for the Todoist, Linear, and GitHub starter packs that already fit the task preview contract.
See [docs/support-bundles.md](docs/support-bundles.md) for the redacted support-bundle generator used for preview and config incidents.
See [docs/write-expansion-routing.md](docs/write-expansion-routing.md) for the proposed review gates before adding live writes beyond tasks.
See [docs/write-expansion-first-proof.md](docs/write-expansion-first-proof.md) for the current public-safe candidate ranking and next proof slice for expanding writes beyond tasks.
See [docs/scheduling-surface-first-proof.md](docs/scheduling-surface-first-proof.md) for the current public-safe judgment on why scheduling helpers stay preview-only or read-only.
See [docs/freshness-signals-spike.md](docs/freshness-signals-spike.md) for the public-safe webhook-versus-snapshot freshness spike and synthetic scenario matrix for `OPS-1743`.
See [docs/openapi-client-generation.md](docs/openapi-client-generation.md) for the published Reclaim OpenAPI surface, the local spec-sanitizing step, and the generator commands future client work should start from.

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

This wrapper uses the generated `paths` contract from the published Reclaim OpenAPI document and applies the existing auth and timeout defaults. Run `npm run reclaim:openapi:generate` when refreshing the underlying contract.

## Related Work

See [docs/related-work.md](docs/related-work.md) for other unofficial Reclaim.ai SDKs, CLIs, automation nodes, MCP servers, and agent-facing tools.
