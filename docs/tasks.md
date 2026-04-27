# Task Inputs

Task commands accept either an array of task inputs or an object with a `tasks` array.
For preview-only task review, the same object may also include synthetic `timeSchemes`, `defaultTaskEventCategory`, and optional `preferredTimePolicyId` or `preferredTimePolicyTitle` so the preview can attach the same public-safe time-policy explanation used by the dedicated explainer command.

```json
{
  "tasks": [
    {
      "title": "Draft planning notes",
      "notes": "Capture the open questions before the weekly review.",
      "durationMinutes": 45,
      "due": "2026-05-06T17:00:00+02:00",
      "startAfter": "2026-05-06T09:00:00+02:00",
      "eventCategory": "WORK",
      "splitAllowed": true
    }
  ]
}
```

Fields:

- `title`: task title.
- `notes`: optional task notes.
- `durationMinutes`: total task duration.
- `due`: optional ISO date-time deadline.
- `startAfter`: optional ISO date-time before which Reclaim should not schedule the task.
- `timeSchemeId`: optional Reclaim task-assignment time policy id.
- `eventCategory`: `PERSONAL` or `WORK`.
- `splitAllowed`: whether Reclaim may split the task into smaller chunks.
- `alwaysPrivate`: whether the created Reclaim task should be private. Defaults to `true`.

## Time Policy Discovery

Task creation uses a Reclaim task-assignment time policy. You can discover the policies available to the configured Reclaim account with:

```bash
npm run reclaim:time-policies:list -- --config config/reclaim.local.json
```

The command returns the task-assignment policies exposed by Reclaim, marks which policies match `defaultTaskEventCategory`, and includes the policy the toolkit would select from the local config. Configure `preferredTimePolicyId` for exact id selection, or `preferredTimePolicyTitle` for exact or unique partial title selection. If neither is set, task creation selects the first policy matching `defaultTaskEventCategory`, then falls back to the first returned policy.

Use synthetic task input files for previews and keep local config files out of version control.

When a reviewer needs to know why a proposed task fits or conflicts before any live write, use the synthetic explainer described in [time-policy-conflicts.md](time-policy-conflicts.md). It stays read-only and explains policy selection, category mismatches, and bounded window conflicts instead of silently picking a policy. The preview command now also emits a per-task `timePolicyExplanation` field when the preview input includes synthetic policy context, so a normal preview can carry the same reasoning without switching commands.

## Read-Only Task Listing

List configured-account tasks without writing to Reclaim:

```bash
npm run reclaim:tasks:list -- --config config/reclaim.local.json
```

Filter the listing with public-safe field filters:

```bash
npm run reclaim:tasks:filter -- --config config/reclaim.local.json --title-contains notes --event-category WORK
```

Supported filter flags are:

- `--title-contains`: case-insensitive title substring.
- `--event-category`: Reclaim task event category, such as `WORK` or `PERSONAL`.
- `--time-scheme-id`: exact Reclaim task-assignment time policy id.
- `--due-after` and `--due-before`: ISO date-time bounds for task deadlines.
- `--start-after-after` and `--start-after-before`: ISO date-time bounds for the task start-after value.

Both commands return JSON with `readSafety: "read_only"`, the applied `filters`, and normalized task rows containing `id`, `title`, `notes`, `eventCategory`, `timeSchemeId`, `due`, and `startAfter`.

## Read-Only Task Export

Export the same normalized task rows as JSON:

```bash
npm run reclaim:tasks:export -- --config config/reclaim.local.json --event-category WORK
```

Or request CSV content while keeping the command output itself parseable JSON:

```bash
npm run reclaim:tasks:export -- --config config/reclaim.local.json --event-category WORK --format csv
```

CSV export returns `format: "csv"`, the exported `fields`, and a `content` string. The command does not write files, create tasks, update tasks, or delete tasks.

## Task Update Preview And Confirmed Apply

Preview task updates from a synthetic local fixture before any authenticated write:

```bash
npm run reclaim:tasks:preview-update -- --input examples/task-updates.example.json
```

The fixture accepts an `updates` array. Each update must include `taskId` plus at least one update field. Supported fields are `title`, `notes`, `durationMinutes`, `due`, `startAfter`, `timeSchemeId`, `eventCategory`, `splitAllowed`, and `alwaysPrivate`. When `durationMinutes` is present, the toolkit converts it into Reclaim time chunks; `splitAllowed` is accepted only with `durationMinutes` so chunk sizes are explicit.

Preview fixtures may include synthetic `currentTasks` so the output can show a local change summary. The preview command does not read a configured account and returns `writeSafety: "preview_only"` plus the exact `PATCH` payloads that a confirmed apply would send later.

Apply reviewed updates only with a local config and explicit confirmation:

```bash
npm run reclaim:tasks:update -- --config config/reclaim.local.json --input examples/task-updates.example.json --confirm-write
```

The confirmed command refuses to run without `--confirm-write`, sends one `PATCH /tasks/{taskId}` request per update, and returns `writeReceipts` for post-run audit. It does not complete, archive, delete, or bulk-update tasks.

## Mock API Demo Lab

For credential-free CLI practice, run:

```bash
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
```

The demo creates an in-memory synthetic Reclaim-like API surface, selects a placeholder task-assignment policy, previews the input file, removes one seeded duplicate task, and creates any missing synthetic tasks. It prints JSON so the result can be inspected like other toolkit commands.

The same lab can exercise the larger synthetic scheduling recipe pack:

```bash
npm run reclaim:demo:mock-api -- --input examples/scheduling-recipes.example.json
```

To inspect the lab's public-safe failure modes without any live credentials, run:

```bash
npm run reclaim:demo:mock-api -- --profile failure-modes
```

This lab is intentionally narrow: it covers the toolkit task flow only, uses invented task and policy data, does not contact Reclaim, and is not a complete emulator or API compatibility promise.

The ordered synthetic route and response contract for the baseline lab is recorded in `docs/mock-api-response-matrix.example.json`. The synthetic failure matrix for pagination, rate limits, and narrow route errors is recorded in `docs/mock-api-failure-mode-matrix.example.json`. Use both as small auditable references without treating them as broader API surface commitments.

Design note: the lab stays inside this repository as a small in-memory test double rather than adopting a broader SDK, CLI, agent server, or workflow runner. Existing related projects are useful API references, but this demo needs only deterministic task CRUD, time-policy selection, duplicate cleanup, and write-receipt exercise for synthetic fixtures. Keeping that behavior local avoids new credentials, background services, public API commitments, or package-manager surface while preserving a credential-free dogfood path for the npm CLI commands.

## Write Receipts

Confirmed task creation, task update, and duplicate cleanup return a `writeReceipts` array alongside the existing result fields. Task previews and confirmed task creation now also return `inputDuplicatePlan`, a local preflight snapshot of duplicate inputs inside the imported file. Confirmed task creation separately returns `duplicatePlan`, a warning-only snapshot of any exact existing duplicates found before the toolkit attempted new task writes. The toolkit does not delete either class of duplicates during `reclaim:tasks:create`; use `reclaim:tasks:inspect-duplicates` and `reclaim:tasks:cleanup-duplicates` when duplicate cleanup is explicitly intended.

When `inputDuplicatePlan.duplicateGroupCount` is greater than `0`, the preview receipt shifts to `readinessStatus: "evidence_pending"` so starter-pack imports can be reviewed before any confirmed write.

Each receipt includes:

- `operation`: `task.create`, `task.update`, or `task.delete`.
- `taskId`: the Reclaim task id that was written.
- `title`: the input or duplicate-group title when available.
- `confirmedAt`: the ISO timestamp when the toolkit observed the confirmed write.
- `rollbackHint`: a manual instruction for reviewing or undoing the write outside the toolkit.

The toolkit records rollback hints for auditability only. It does not automatically roll back confirmed creates or deletions.

## Read-Only Receipt Validation

To compare saved task write receipts against the current remote task state without writing to Reclaim, run:

```bash
npm run reclaim:tasks:validate-write-receipts -- --config config/reclaim.local.json --input examples/task-write-receipts.example.json
```

The validator accepts either a top-level receipt array or an object with a `writeReceipts` array, so it can read a saved slice of prior command output directly.

Validation is read-only and returns:

- `readSafety: "read_only"`.
- `receiptCount`, `validReceiptCount`, and `invalidReceiptCount`.
- A `receipts` array with one validation item per receipt.
- `status: "valid"` when the remote task state still matches the receipt expectation.
- `issues` describing `remote_task_missing`, `remote_title_mismatch`, or `remote_task_still_present` mismatches.
- `remoteTask` details when the current Reclaim task still exists and helps explain the result.

For `task.create` and `task.update` receipts, the validator expects the task id to still exist and, when a receipt title is present, the current title to still match. For `task.delete` receipts, the validator expects the task id to be absent from the current remote task list.

## Synthetic Scheduling Recipes

`examples/scheduling-recipes.example.json` contains a public-safe recipe pack for common task shapes:

- Kickoff prep with a workday start window and flexible splitting.
- Short review work that should stay in one block.
- Release checklist drafting with a deadline but no start-after window.
- Personal admin with an afternoon start window.
- Learning-session preparation that can be split across blocks.
- Weekly planning review with a bounded morning window.

The recipes use invented titles, generic notes, placeholder project language, and conventional `WORK` or `PERSONAL` categories. They are intended for local preview and schema regression tests, not as a recommendation for any private scheduling workflow.

## Synthetic Shopping Errand Windows

`examples/shopping-errand-windows.example.json` adds a public-safe personal preview pack for shopping-assistance and errand-window scenarios:

- A short comparison step before a midday pickup window.
- A lunch-hour pickup errand that should stay in one block.
- A late-afternoon generic return window.
- A short follow-up planning task after the errand block.

Preview it with the standard task command:

```bash
npm run reclaim:tasks:preview-create -- --input examples/shopping-errand-windows.example.json
```

The fixture stays synthetic by using placeholder store language, conventional `PERSONAL` task categories, and bounded `startAfter`/`due` windows only. It is intended for preview examples and regression coverage, not as a recommendation for any private household or calendar workflow.

## Synthetic Event-Prep Blocks

`examples/event-prep-block-example-pack.example.json` adds a public-safe work preview pack for generic guest-visit preparation:

- run-of-show review ahead of the visit;
- signage and room-readiness checks;
- demo-environment reset work;
- host handoff notes for visit day;
- a post-visit summary shell.

Preview it with the standard task command:

```bash
npm run reclaim:tasks:preview-create -- --input examples/event-prep-block-example-pack.example.json
```

The fixture stays synthetic by using placeholder guest language, conventional `WORK` task categories, and bounded `startAfter`/`due` windows only. It is intended for preview examples and regression coverage, not as a recommendation for any private event ledger, household workflow, or calendar-routing policy.

## Integration Starter Packs

The repo also includes three public-safe starter packs that model already-transformed upstream work from common tools:

- `examples/todoist-starter-pack.example.json`
- `examples/linear-starter-pack.example.json`
- `examples/github-starter-pack.example.json`
- `examples/agent-ops-week-scenario-pack.example.json`

Each starter pack is still just a task input file, so it previews through the normal task command:

```bash
npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json
```

These files prototype the transform handoff only. They do not imply direct Todoist, Linear, GitHub, CRM, or workflow-runner support inside this toolkit. Keep source-specific extraction, approvals, and private-boundary reasoning outside this public repo.

Imported starter-pack previews should also keep `inputDuplicatePlan.duplicateGroupCount` at `0`. Treat any non-zero value as a transform-handoff bug to review before `reclaim:tasks:create`.
