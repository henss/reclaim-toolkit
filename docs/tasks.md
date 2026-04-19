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

## Synthetic Scheduling Recipes

`examples/scheduling-recipes.example.json` contains a public-safe recipe pack for common task shapes:

- Kickoff prep with a workday start window and flexible splitting.
- Short review work that should stay in one block.
- Release checklist drafting with a deadline but no start-after window.
- Personal admin with an afternoon start window.
- Learning-session preparation that can be split across blocks.
- Weekly planning review with a bounded morning window.

The recipes use invented titles, generic notes, placeholder project language, and conventional `WORK` or `PERSONAL` categories. They are intended for local preview and schema regression tests, not as a recommendation for any private scheduling workflow.
