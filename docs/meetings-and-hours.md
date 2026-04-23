# Meetings And Hours Inspector

The Meetings and Hours inspector is a read-only prototype for summarizing existing Reclaim meeting records and time-scheme records. It does not create meetings, update hours, recommend availability, or write scheduling changes.

## CLI

Preview the output shape with the synthetic fixture:

```bash
npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json
```

Inspect a configured Reclaim account:

```bash
npm run reclaim:meetings-hours:inspect -- --config config/reclaim.local.json
```

The live command reads `/meetings` and `/timeschemes` through the configured API key. The read collector follows common paginated response envelopes and retries bounded `429` responses when `Retry-After` is present. Keep command output local because account meeting titles, policy ids, and hour names can be private.

## Output

The command returns one JSON document:

```json
{
  "meetingCount": 2,
  "meetings": [
    {
      "id": "meeting-demo-1",
      "title": "Project sync",
      "start": "2026-05-06T10:00:00.000Z",
      "end": "2026-05-06T10:30:00.000Z",
      "durationMinutes": 30,
      "attendeeCount": 3
    }
  ],
  "hourPolicyCount": 2,
  "hourPolicies": [
    {
      "id": "policy-work",
      "title": "Work Hours",
      "taskCategory": "WORK",
      "features": ["TASK_ASSIGNMENT"],
      "timezone": "Europe/Berlin",
      "windowCount": 2
    }
  ],
  "readSafety": "read_only"
}
```

The shape is intentionally summary-oriented. It keeps hour windows as counts and attendee details as counts so downstream scripts can audit scheduling shape without copying participant lists or private ledger details.
