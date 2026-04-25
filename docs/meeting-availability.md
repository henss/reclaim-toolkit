# Meeting Availability Preview Helper

The Meeting Availability helper is preview-only. It expands a synthetic meeting request into viable local availability windows, candidate slots inside those windows, and explicit exclusion reasons using synthetic time-policy windows and synthetic busy meetings. It does not call a live calendar, inspect a Reclaim account, or apply private fallback rules.

```json
{
  "request": {
    "title": "Prototype planning sync",
    "durationMinutes": 45,
    "eventCategory": "WORK",
    "dateRangeStart": "2026-05-11",
    "dateRangeEnd": "2026-05-13",
    "windowStart": "09:00",
    "windowEnd": "15:00",
    "slotIntervalMinutes": 30,
    "preferredTimePolicyTitle": "Work Hours"
  },
  "busyMeetings": [
    {
      "title": "Existing project sync",
      "date": "2026-05-11",
      "startTime": "09:30",
      "endTime": "10:00"
    }
  ],
  "timeSchemes": [
    {
      "id": "policy-work",
      "title": "Work Hours",
      "taskCategory": "WORK",
      "timezone": "Europe/Berlin",
      "features": ["TASK_ASSIGNMENT"],
      "windows": [
        {
          "dayOfWeek": "monday",
          "start": "09:00",
          "end": "15:00"
        }
      ]
    }
  ]
}
```

Request fields:

- `title`: public-safe label for the previewed meeting.
- `durationMinutes`: required slot length.
- `eventCategory`: optional `PERSONAL` or `WORK`; defaults to `WORK`.
- `dateRangeStart` and `dateRangeEnd`: inclusive local-date search range in `YYYY-MM-DD`.
- `windowStart` and `windowEnd`: optional daily bounds in `HH:MM`. When both are present, `windowEnd` must be later than `windowStart`.
- `slotIntervalMinutes`: optional interval between candidate starts. Defaults to `30`.
- `maxSuggestions`: optional cap for returned candidate slots. Defaults to `10`.
- `preferredTimePolicyId` or `preferredTimePolicyTitle`: optional policy-selection hints. The helper reuses the existing public-safe time-policy selection semantics.

Synthetic busy-meeting fields:

- `title`: public-safe label for the blocking meeting.
- `date`: local date in `YYYY-MM-DD`.
- `startTime` and `endTime`: local blocking window in `HH:MM`.

Preview a synthetic fixture with:

```bash
npm run reclaim:meetings:preview-availability -- --input examples/meeting-availability.example.json
```

The command returns JSON with:

- `selectedPolicy` and `selectionReason`: the chosen policy using the toolkit's existing public-safe selector.
- `candidateWindows`: contiguous synthetic-free windows that fit the requested duration.
- `excludedWindows`: overlapping policy windows or leftover gaps that did not fit the requested duration, plus explicit exclusion reasons.
- `candidateSlots`: synthetic local slots that fit within the chosen policy window and do not overlap synthetic busy meetings.
- `daySummaries`: per-day window and slot counts plus concise notes when a day has no matching policy window or all candidate windows were blocked.
- `writeSafety: "preview_only"` to keep the no-write boundary explicit.

## Public-Safe Fixture

`examples/meeting-availability.example.json` uses invented meeting labels, placeholder busy windows, and generic work hours. It is intended for preview regression tests and local planning experiments only.

Do not commit fixture files copied from a live account, private scheduling ledger, household routine, health-support policy, calendar fallback workflow, or operator-specific operating policy.
