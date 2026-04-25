# Recurring Meeting Reschedule What-If Simulator

The recurring meeting reschedule helper is preview-only. It evaluates a synthetic recurring series occurrence by occurrence, checks whether each original slot still fits the selected time policy, and returns bounded move suggestions when the original slot is blocked. It does not call a live calendar, inspect a Reclaim account, update meetings, or apply private fallback rules.

```json
{
  "series": {
    "title": "Weekly product sync",
    "durationMinutes": 45,
    "eventCategory": "WORK",
    "searchDaysBefore": 0,
    "searchDaysAfter": 1,
    "slotIntervalMinutes": 30,
    "maxSuggestionsPerOccurrence": 2,
    "preferredTimePolicyTitle": "Work Hours"
  },
  "occurrences": [
    {
      "date": "2026-06-08",
      "startTime": "10:00",
      "endTime": "10:45"
    }
  ],
  "busyMeetings": [
    {
      "title": "Quarterly planning block",
      "date": "2026-06-08",
      "startTime": "09:00",
      "endTime": "17:00"
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
          "end": "17:00"
        },
        {
          "dayOfWeek": "tuesday",
          "start": "09:00",
          "end": "17:00"
        }
      ]
    }
  ]
}
```

Series fields:

- `title`: public-safe label for the recurring series.
- `durationMinutes`: required occurrence length. Each occurrence must match it exactly.
- `eventCategory`: optional `PERSONAL` or `WORK`; defaults to `WORK`.
- `searchDaysBefore` and `searchDaysAfter`: bounded date offsets for move suggestions around each occurrence.
- `windowStart` and `windowEnd`: optional daily search bounds in `HH:MM`.
- `slotIntervalMinutes`: optional candidate interval between suggestion starts. Defaults to `30`.
- `maxSuggestionsPerOccurrence`: optional cap for returned move suggestions per occurrence. Defaults to `3`.
- `preferredTimePolicyId` or `preferredTimePolicyTitle`: optional policy-selection hints reused from the toolkit's public-safe selector.

Occurrence fields:

- `date`: local date in `YYYY-MM-DD`.
- `startTime` and `endTime`: original recurring slot in `HH:MM`.

Preview a synthetic fixture with:

```bash
npm run reclaim:meetings:preview-recurring-reschedule -- --input examples/recurring-meeting-reschedule.example.json
```

The command returns JSON with:

- `selectedPolicy` and `selectionReason`: the selected public-safe time policy for the series.
- `keptOccurrenceCount`, `movedOccurrenceCount`, and `blockedOccurrenceCount`: aggregate what-if totals.
- `outcomes`: one result per occurrence with `keep`, `move`, or `blocked`.
- `originalSlot`: whether the original slot still fits, plus the top blocking reason when it does not.
- `suggestedSlots`: bounded move suggestions with `daysFromOriginal` so a caller can prefer same-day versus next-day shifts.
- `writeSafety: "preview_only"` to keep the no-write boundary explicit.

## Public-Safe Fixture

`examples/recurring-meeting-reschedule.example.json` uses invented meeting labels, placeholder occurrences, and generic work hours. It is intended for preview regression tests and local what-if experiments only.

Do not commit fixtures copied from a live account, private scheduling ledger, household routine, health-support policy, calendar fallback workflow, or operator-specific operating policy.
