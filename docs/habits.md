# Habit Inputs

Habit helpers are preview-only. They parse public-safe habit intent files and return the request shape the toolkit would prepare, but they do not call a live Reclaim Habit API or create habits.

```json
{
  "habits": [
    {
      "title": "Morning project review",
      "notes": "Review a generic project board and choose one next action.",
      "durationMinutes": 20,
      "eventCategory": "WORK",
      "cadence": "daily",
      "windowStart": "09:00",
      "windowEnd": "11:00"
    }
  ]
}
```

Fields:

- `title`: habit title.
- `notes`: optional habit notes.
- `durationMinutes`: target duration for the habit block.
- `eventCategory`: `PERSONAL` or `WORK`.
- `cadence`: `daily` or `weekly`. Defaults to `daily`.
- `daysOfWeek`: required for weekly habits and omitted for daily habits.
- `windowStart`: optional preferred start time as `HH:MM`.
- `windowEnd`: optional preferred end time as `HH:MM`; when both window fields are present, this must be later than `windowStart`.
- `startDate`: optional ISO date for when the habit should begin.
- `endDate`: optional ISO date for when the habit should stop.
- `alwaysPrivate`: whether the previewed habit should be private. Defaults to `true`.

Preview a synthetic habit file with:

```bash
npm run reclaim:habits:preview-create -- --input examples/habits.example.json
```

The command returns JSON with `writeSafety: "preview_only"` to make the no-write boundary explicit.

## Public-Safe Fixtures

`examples/habits.example.json` uses invented titles, generic notes, placeholder windows, and conventional `WORK` or `PERSONAL` categories. It is intended for schema regression tests and local previews only.

Do not commit habit files copied from a live account, private scheduling ledger, calendar export, household routine, health-support policy, or personal operating policy.
