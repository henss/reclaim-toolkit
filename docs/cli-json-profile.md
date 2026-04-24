# Agent-Safe JSON CLI Profile

This profile defines the machine-facing command behavior for agents and scripts that call `reclaim-toolkit` through the public CLI.

The committed [command safety manifest](command-safety-manifest.json) is the canonical machine-readable inventory for command-level safety classes, confirmation flags, default visibility, and readiness gates.

Use the npm script surface with `--silent` when another program needs to parse command output:

```bash
npm run --silent reclaim:tasks:preview-create -- --input examples/tasks.example.json
```

Successful commands write one pretty-printed JSON document to stdout and exit with code `0`. They do not require stderr for normal status details. Commands that fail write a concise human-readable error message to stderr and exit with code `1`; failed commands should not be parsed as JSON.

## Safety Classes

| Class | Commands | Write behavior |
| --- | --- | --- |
| Local preview | `reclaim:onboarding`, `reclaim:tasks:preview-create`, `reclaim:habits:preview-create`, `reclaim:focus:preview-create`, `reclaim:buffers:preview-create`, `reclaim:buffers:preview-template`, `reclaim:meetings:preview-recurring-reschedule`, `reclaim:meetings-hours:preview-inspect`, `reclaim:meetings-hours:preview-switch`, `reclaim:account-audit:preview-inspect`, `reclaim:time-policies:explain-conflicts`, `reclaim:support:bundle`, `reclaim:demo:mock-api`, `reclaim:config:status` | No live Reclaim writes. |
| Authenticated read | `reclaim:health`, `reclaim:time-policies:list`, `reclaim:tasks:list`, `reclaim:tasks:filter`, `reclaim:tasks:export`, `reclaim:tasks:validate-write-receipts`, `reclaim:tasks:inspect-duplicates`, `reclaim:meetings-hours:inspect`, `reclaim:account-audit:inspect` | Reads account data through the configured Reclaim API key. |
| Confirmed write | `reclaim:tasks:create`, `reclaim:tasks:cleanup-duplicates` | Requires an explicit confirmation flag before live writes. |

`reclaim:tasks:create` refuses to write unless `--confirm-write` is present. `reclaim:tasks:cleanup-duplicates` refuses to delete unless `--confirm-reviewed-delete` is present. Confirmed write results include `writeReceipts` with the operation, task id, confirmation timestamp, and manual rollback hint for audit.

Task, Habit, Focus, and Buffer preview commands now include a top-level `previewReceipt` with the operation name, preview timestamp, readiness status, readiness gate, and rollback hint. Habit, Focus, and Buffer still include `writeSafety: "preview_only"`, while task preview keeps the exact request payloads that would be sent by a later confirmed task create without contacting Reclaim or creating tasks. `reclaim:buffers:preview-rule` includes synthetic `mockResponse` metadata plus `previewReceipt.diffLines` and `previewReceipt.diffSummary` so callers can inspect create-vs-update diffs without contacting Reclaim. `reclaim:buffers:preview-template` also includes synthetic `mockResponse` and `previewReceipt` fields so template evaluation can inspect receipt-style output without contacting Reclaim.
The Meetings and Hours preview commands include `readSafety: "read_only"` plus a top-level `previewReceipt`, while the authenticated inspector remains read-only and does not create meetings, update hours, or recommend availability.
The account audit snapshot includes only counts and capability coverage, plus `readSafety: "read_only"`, so downstream consumers can audit account shape without relying on task titles, meeting titles, ids, or user identifiers.

## Parsing Rules

Agents should parse stdout only after a zero exit code. Treat any non-zero exit as a failed command and read stderr as the diagnostic.

Do not parse account-specific ids, emails, task titles, policy titles, or configured paths into committed examples, docs, or fixtures. Public examples should stay synthetic and small enough to audit in one pass.

The JSON shapes are intended to be additive. Consumers should tolerate unknown fields and key order changes while relying on the documented confirmation flags, success/failure streams, and top-level result fields used by the current commands.

## Command Notes

- `reclaim:onboarding` reports local config readiness, safe synthetic fixture commands, and confirmed-write review reminders without contacting Reclaim or writing files.
- `reclaim:config:status` reports config-file presence and parse status without validating credentials.
- `reclaim:support:bundle` creates a redacted incident bundle for local preview or config troubleshooting and can optionally attach a sanitized health-check summary.
- `reclaim:health` validates authenticated reachability and may include the configured API URL, user email, task-assignment policy count, and task count.
- `reclaim:time-policies:list` returns policy-discovery JSON and the selected policy reasoning for the current config.
- `reclaim:time-policies:explain-conflicts` reads a synthetic local JSON fixture and returns fit or conflict explanations for proposed tasks, focus blocks, and buffers against known time-policy inputs.
- `reclaim:tasks:list` reads existing tasks and returns normalized task rows with `readSafety: "read_only"`.
- `reclaim:tasks:filter` requires at least one filter flag and returns the same normalized read-only task rows plus the applied filters.
- `reclaim:tasks:export` returns filtered task rows as JSON by default; `--format csv` returns CSV text in the JSON `content` field so stdout still contains one parseable JSON document.
- `reclaim:tasks:validate-write-receipts` reads the current task list, compares it against a receipt array or `{ "writeReceipts": [...] }` input document, and returns read-only validation JSON with per-receipt status and mismatch details.
- `reclaim:tasks:preview-create` returns the prepared task payloads plus a `previewReceipt` showing that the surface is ready for a later confirmed write.
- `reclaim:meetings:preview-recurring-reschedule` returns recurring keep-vs-move-vs-blocked outcomes plus bounded suggestion slots for each synthetic occurrence in the series.
- `reclaim:habits:preview-create`, `reclaim:focus:preview-create`, and `reclaim:buffers:preview-create` return preview payloads plus a `previewReceipt` that explains why each surface remains preview-only.
- `reclaim:meetings-hours:preview-inspect` returns the Meetings and Hours inspector shape from a synthetic local fixture plus a `previewReceipt` marking it as a local read-only preview.
- `reclaim:meetings-hours:preview-switch` returns read-only profile-switch comparisons for synthetic hours presets and local profile hints plus a `previewReceipt`.
- `reclaim:meetings-hours:inspect` reads existing meetings and time schemes from the configured account and returns a summary.
- `reclaim:account-audit:preview-inspect` returns the account audit snapshot shape from a synthetic local fixture.
- `reclaim:account-audit:inspect` reads the current user, tasks, meetings, and time schemes from the configured account and returns summary-only counts.
- `reclaim:tasks:inspect-duplicates` returns a duplicate plan and does not delete tasks.
- `reclaim:demo:mock-api` uses only synthetic in-memory data and is suitable for credential-free CLI practice.
