# Time-Policy Conflict Explainer

Use the synthetic explainer when a proposed task shape needs a read-only explanation before any live Reclaim write.

```bash
npm run reclaim:time-policies:explain-conflicts -- --input time-policy-conflicts.json
```

The input file is a synthetic JSON fixture with:

- `tasks`: proposed task previews with `title`, `durationMinutes`, and optional `startAfter`, `due`, `timeSchemeId`, or `eventCategory`.
- `timeSchemes`: known Reclaim time-policy or hours inputs, including `id`, `title`, `taskCategory`, `features`, and optional `windows`.
- `defaultTaskEventCategory`: fallback task category when a task does not set `eventCategory`.
- `preferredTimePolicyId` or `preferredTimePolicyTitle`: optional default policy-selection hints.

Example:

```json
{
  "defaultTaskEventCategory": "WORK",
  "preferredTimePolicyTitle": "Deep Work",
  "timeSchemes": [
    {
      "id": "policy-work",
      "title": "Deep Work",
      "taskCategory": "WORK",
      "features": ["TASK_ASSIGNMENT"],
      "windows": [
        { "dayOfWeek": "monday", "start": "09:00", "end": "12:00" }
      ]
    }
  ],
  "tasks": [
    {
      "title": "Draft launch checklist",
      "durationMinutes": 90,
      "startAfter": "2026-05-11T09:00:00.000Z",
      "due": "2026-05-11T12:00:00.000Z"
    }
  ]
}
```

The command returns parseable JSON with `readSafety: "read_only"` and one explanation per task. Each explanation includes the selected policy, why that policy was chosen, whether the task is a `fit` or `conflict`, and any concrete conflict reasons such as:

- no matching policy
- task category mismatch
- missing `TASK_ASSIGNMENT` policy feature
- `due` earlier than `startAfter`
- insufficient policy-window minutes between `startAfter` and `due`

This explainer is intentionally narrow. It does not reschedule tasks, inspect live calendar fallback behavior, or model private personal policy.
