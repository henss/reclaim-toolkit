# Time-Policy Conflict Explainer

Use the synthetic explainer when proposed task, focus-block, buffer, or hours-profile shapes need a read-only explanation before any live Reclaim write.

```bash
npm run reclaim:time-policies:explain-conflicts -- --input examples/time-policy-conflicts.example.json
```

The input file is a synthetic JSON fixture with:

- `tasks`: proposed task previews with `title`, `durationMinutes`, and optional `startAfter`, `due`, `timeSchemeId`, or `eventCategory`.
- `focusBlocks`: optional proposed focus previews with `title`, `durationMinutes`, optional `eventCategory`, `cadence`, `daysOfWeek`, `date`, `windowStart`, and `windowEnd`.
- `buffers`: optional proposed buffer previews with `title`, `durationMinutes`, optional `eventCategory`, `placement`, `anchor`, `windowStart`, and `windowEnd`.
- `hoursProfiles`: optional hours-preview presets with `id`, `title`, `eventCategory`, and optional `preferredTimePolicyId` or `preferredTimePolicyTitle`.
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
    },
    {
      "id": "policy-personal",
      "title": "Personal Hours",
      "taskCategory": "PERSONAL",
      "features": ["TASK_ASSIGNMENT"],
      "windows": []
    }
  ],
  "tasks": [
    {
      "title": "Draft launch checklist",
      "durationMinutes": 90,
      "startAfter": "2026-05-11T09:00:00.000Z",
      "due": "2026-05-11T12:00:00.000Z"
    }
  ],
  "focusBlocks": [
    {
      "title": "Weekly writing block",
      "durationMinutes": 60,
      "cadence": "weekly",
      "daysOfWeek": ["monday", "wednesday"],
      "windowStart": "09:00",
      "windowEnd": "10:00"
    }
  ],
  "buffers": [
    {
      "title": "Post-review notes buffer",
      "durationMinutes": 15,
      "placement": "after",
      "anchor": "Prototype review block",
      "windowStart": "12:00",
      "windowEnd": "12:30"
    }
  ],
  "hoursProfiles": [
    {
      "id": "profile-deep-work",
      "title": "Deep Work Sprint",
      "eventCategory": "WORK",
      "preferredTimePolicyTitle": "Deep Work"
    },
    {
      "id": "profile-weekend-personal",
      "title": "Weekend Personal",
      "eventCategory": "PERSONAL",
      "preferredTimePolicyTitle": "Personal Hours"
    }
  ]
}
```

The command returns parseable JSON with `readSafety: "read_only"` plus `tasks`, `focusBlocks`, `buffers`, and `hoursProfiles` result arrays. Each explanation includes the selected policy, why that policy was chosen, whether the proposal is a `fit` or `conflict`, and any concrete conflict reasons such as:

- no matching policy
- task category mismatch
- missing `TASK_ASSIGNMENT` policy feature
- `due` earlier than `startAfter`
- insufficient policy-window minutes between `startAfter` and `due`
- insufficient overlap between a focus preview window and one or more requested weekdays
- insufficient overlap between a buffer preview window and all configured policy days
- hours profiles resolving to a policy with no configured hours windows

Task results keep the existing bounded-window check between `startAfter` and `due`. Focus results check the requested preview window against the selected policy on the requested cadence days when that information is available. Buffer results check whether the preview window fits on at least one configured policy day. Hours-profile results explain how a synthetic hours preset resolves its preferred policy hints and flag missing or windowless policy matches before a local profile-switch review.

This explainer is intentionally narrow. It does not reschedule proposals, inspect live calendar fallback behavior, or model private personal policy.
