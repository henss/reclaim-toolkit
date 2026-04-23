# Task Inputs

Task commands accept either an array of task inputs or an object with a `tasks` array.

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

When a reviewer needs to know why a proposed task fits or conflicts before any live write, use the synthetic explainer described in [time-policy-conflicts.md](time-policy-conflicts.md). It stays read-only and explains policy selection, category mismatches, and bounded window conflicts instead of silently picking a policy.

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

This lab is intentionally narrow: it covers the toolkit task flow only, uses invented task and policy data, does not contact Reclaim, and is not a complete emulator or API compatibility promise.

The ordered synthetic route and response contract for the lab is recorded in `docs/mock-api-response-matrix.example.json`. Use it as a small auditable reference for seeded reads, task CRUD, and error-path behavior without treating it as a broader API surface commitment.

Design note: the lab stays inside this repository as a small in-memory test double rather than adopting a broader SDK, CLI, agent server, or workflow runner. Existing related projects are useful API references, but this demo needs only deterministic task CRUD, time-policy selection, duplicate cleanup, and write-receipt exercise for synthetic fixtures. Keeping that behavior local avoids new credentials, background services, public API commitments, or package-manager surface while preserving a credential-free dogfood path for the npm CLI commands.

## Write Receipts

Confirmed task creation and duplicate cleanup return a `writeReceipts` array alongside the existing result fields. Confirmed task creation also returns `duplicatePlan`, a warning-only snapshot of any exact existing duplicates found before the toolkit attempted new task writes. The toolkit does not delete those duplicates during `reclaim:tasks:create`; use `reclaim:tasks:inspect-duplicates` and `reclaim:tasks:cleanup-duplicates` when duplicate cleanup is explicitly intended.

Each receipt includes:

- `operation`: `task.create` or `task.delete`.
- `taskId`: the Reclaim task id that was written.
- `title`: the input or duplicate-group title when available.
- `confirmedAt`: the ISO timestamp when the toolkit observed the confirmed write.
- `rollbackHint`: a manual instruction for reviewing or undoing the write outside the toolkit.

The toolkit records rollback hints for auditability only. It does not automatically roll back confirmed creates or deletions.

## Synthetic Scheduling Recipes

`examples/scheduling-recipes.example.json` contains a public-safe recipe pack for common task shapes:

- Kickoff prep with a workday start window and flexible splitting.
- Short review work that should stay in one block.
- Release checklist drafting with a deadline but no start-after window.
- Personal admin with an afternoon start window.
- Learning-session preparation that can be split across blocks.
- Weekly planning review with a bounded morning window.

The recipes use invented titles, generic notes, placeholder project language, and conventional `WORK` or `PERSONAL` categories. They are intended for local preview and schema regression tests, not as a recommendation for any private scheduling workflow.
