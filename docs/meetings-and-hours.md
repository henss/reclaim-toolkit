# Meetings And Hours Inspector

The Meetings and Hours inspector is a read-only prototype for summarizing existing Reclaim meeting records and time-scheme records. It does not create meetings, update hours, recommend availability, or write scheduling changes.

## CLI

Preview the output shape with the synthetic fixture:

```bash
npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json
```

Preview how named local profiles would switch between known hours presets:

```bash
npm run reclaim:meetings-hours:preview-switch -- --input examples/meetings-hours-profile-switch.example.json
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

The profile-switch preview also returns one JSON document:

```json
{
  "profileCount": 3,
  "currentProfileId": "profile-workweek",
  "profiles": [
    {
      "id": "profile-workweek",
      "title": "Workweek",
      "eventCategory": "WORK",
      "preferredTimePolicyTitle": "Work Hours",
      "selectedPolicy": {
        "id": "policy-work",
        "title": "Work Hours",
        "taskCategory": "WORK",
        "features": ["TASK_ASSIGNMENT"],
        "matchesDefaultEventCategory": true
      },
      "selectionReason": "Matched preferred Reclaim time policy title \"Work Hours\".",
      "isCurrentProfile": true
    }
  ],
  "switchPreviews": [
    {
      "targetProfileId": "profile-deep-work",
      "targetProfileTitle": "Deep Work Sprint",
      "outcome": "different_policy",
      "currentPolicyId": "policy-work",
      "currentPolicyTitle": "Work Hours",
      "targetPolicyId": "policy-deep-work",
      "targetPolicyTitle": "Deep Work",
      "summary": "Switching to Deep Work Sprint changes the hours preset from Work Hours to Deep Work."
    }
  ],
  "readSafety": "read_only",
  "previewReceipt": {
    "operation": "hours.switch.preview",
    "previewGeneratedAt": "2026-04-24T08:00:00.000Z",
    "readinessStatus": "read_only_boundary",
    "readinessGate": "Hours profile switching remains a local comparison helper and does not change any Reclaim account setting.",
    "rollbackHint": "No rollback is required because this helper only emits local preview metadata."
  }
}
```

Use the switch preview when a local workflow keeps multiple synthetic profile presets and needs to compare which Reclaim hours preset each profile would select before touching any live config. The preview remains local-only and read-only: it evaluates profile hints against provided time-scheme inputs and does not inspect calendars, write hours, or switch any account setting.

The local preview commands also include a top-level `previewReceipt` so automated consumers can distinguish preview-generated read summaries from authenticated live reads without inferring it from the command name alone.
