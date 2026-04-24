# Integration Starter Packs

These starter packs are public-safe transformed task fixtures for common upstream tools:

- `examples/todoist-starter-pack.example.json`
- `examples/linear-starter-pack.example.json`
- `examples/github-starter-pack.example.json`
- `examples/agent-ops-week-scenario-pack.example.json`

Each file already matches the existing Reclaim task preview input contract, so the same preview command works for all three:

```bash
npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json
```

The prototype boundary is intentionally narrow:

- The toolkit does not ingest Todoist, Linear, or GitHub payloads directly.
- The files model the transformed handoff into `tasks.previewCreates`, not connector clients, workflow runners, or sync automation.
- The examples stay synthetic and omit real Reclaim tasks, private schedules, household details, account data, and personal operating policy.

The agent-ops week pack follows the same rule set. It models a week-shaped transformed backlog for public-safe previews and docs, not live lead routing, checkout automation, or private operating policy. See [agent-ops-week-scenario-pack.md](agent-ops-week-scenario-pack.md) for the focused boundary notes.

## Expected Transform Shape

Each upstream item should be normalized into the public task input fields already documented in [tasks.md](tasks.md):

- `title`: short actionable summary from the source item.
- `notes`: optional synthetic carry-over context such as project, team, labels, or review state.
- `durationMinutes`: explicit estimate chosen by the transform layer.
- `due`: optional ISO date-time when the source has a usable deadline or target date.
- `startAfter`: optional ISO date-time when the source should not schedule before a review window or workday boundary.
- `eventCategory`: `WORK` or `PERSONAL`.
- `splitAllowed`: whether the Reclaim preview may split the block.

## Starter-Pack Intent

Use these files for:

- preview screenshots or CLI smoke runs;
- fixture-backed tests around upstream-to-Reclaim planning assumptions;
- early discussion of how a private transform layer could hand off generic work into this toolkit.

Do not treat these files as a commitment to direct Todoist, Linear, or GitHub API support, release automation, or package publication.
