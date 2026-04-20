# Agent-Safe JSON CLI Profile

This profile defines the machine-facing command behavior for agents and scripts that call `reclaim-toolkit` through the public CLI.

Use the npm script surface with `--silent` when another program needs to parse command output:

```bash
npm run --silent reclaim:tasks:preview-create -- --input examples/tasks.example.json
```

Successful commands write one pretty-printed JSON document to stdout and exit with code `0`. They do not require stderr for normal status details. Commands that fail write a concise human-readable error message to stderr and exit with code `1`; failed commands should not be parsed as JSON.

## Safety Classes

| Class | Commands | Write behavior |
| --- | --- | --- |
| Local preview | `reclaim:onboarding`, `reclaim:tasks:preview-create`, `reclaim:habits:preview-create`, `reclaim:focus:preview-create`, `reclaim:buffers:preview-create`, `reclaim:meetings-hours:preview-inspect`, `reclaim:demo:mock-api`, `reclaim:config:status` | No live Reclaim writes. |
| Authenticated read | `reclaim:health`, `reclaim:time-policies:list`, `reclaim:tasks:list`, `reclaim:tasks:filter`, `reclaim:tasks:export`, `reclaim:tasks:inspect-duplicates`, `reclaim:meetings-hours:inspect` | Reads account data through the configured Reclaim API key. |
| Confirmed write | `reclaim:tasks:create`, `reclaim:tasks:cleanup-duplicates` | Requires an explicit confirmation flag before live writes. |

`reclaim:tasks:create` refuses to write unless `--confirm-write` is present. `reclaim:tasks:cleanup-duplicates` refuses to delete unless `--confirm-reviewed-delete` is present. Confirmed write results include `writeReceipts` with the operation, task id, confirmation timestamp, and manual rollback hint for audit.

Preview-only Habit, Focus, and Buffer commands include `writeSafety: "preview_only"` in their JSON result. Task preview commands include the request payloads that would be sent by a later confirmed task create, but they do not contact Reclaim or create tasks.
The Meetings and Hours inspector includes `readSafety: "read_only"` and does not create meetings, update hours, or recommend availability.

## Parsing Rules

Agents should parse stdout only after a zero exit code. Treat any non-zero exit as a failed command and read stderr as the diagnostic.

Do not parse account-specific ids, emails, task titles, policy titles, or configured paths into committed examples, docs, or fixtures. Public examples should stay synthetic and small enough to audit in one pass.

The JSON shapes are intended to be additive. Consumers should tolerate unknown fields and key order changes while relying on the documented confirmation flags, success/failure streams, and top-level result fields used by the current commands.

## Command Notes

- `reclaim:onboarding` reports local config readiness, safe synthetic fixture commands, and confirmed-write review reminders without contacting Reclaim or writing files.
- `reclaim:config:status` reports config-file presence and parse status without validating credentials.
- `reclaim:health` validates authenticated reachability and may include the configured API URL, user email, task-assignment policy count, and task count.
- `reclaim:time-policies:list` returns policy-discovery JSON and the selected policy reasoning for the current config.
- `reclaim:tasks:list` reads existing tasks and returns normalized task rows with `readSafety: "read_only"`.
- `reclaim:tasks:filter` requires at least one filter flag and returns the same normalized read-only task rows plus the applied filters.
- `reclaim:tasks:export` returns filtered task rows as JSON by default; `--format csv` returns CSV text in the JSON `content` field so stdout still contains one parseable JSON document.
- `reclaim:meetings-hours:preview-inspect` returns the Meetings and Hours inspector shape from a synthetic local fixture.
- `reclaim:meetings-hours:inspect` reads existing meetings and time schemes from the configured account and returns a summary.
- `reclaim:tasks:inspect-duplicates` returns a duplicate plan and does not delete tasks.
- `reclaim:demo:mock-api` uses only synthetic in-memory data and is suitable for credential-free CLI practice.
