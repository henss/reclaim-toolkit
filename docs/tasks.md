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

## Synthetic Scheduling Recipes

`examples/scheduling-recipes.example.json` contains a public-safe recipe pack for common task shapes:

- Kickoff prep with a workday start window and flexible splitting.
- Short review work that should stay in one block.
- Release checklist drafting with a deadline but no start-after window.
- Personal admin with an afternoon start window.
- Learning-session preparation that can be split across blocks.
- Weekly planning review with a bounded morning window.

The recipes use invented titles, generic notes, placeholder project language, and conventional `WORK` or `PERSONAL` categories. They are intended for local preview and schema regression tests, not as a recommendation for any private scheduling workflow.
