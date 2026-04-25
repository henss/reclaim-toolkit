# Account Audit Snapshot

The account audit snapshot is a read-only summary of a configured Reclaim account. It is designed for account-shape checks and automation handoffs that need counts and capability coverage without copying task titles, meeting titles, user identifiers, or time-policy ids into downstream artifacts.

## CLI

Preview the output shape with the synthetic fixture:

```bash
npm run reclaim:account-audit:preview-inspect -- --input examples/account-audit.example.json
```

Preview a drift digest between two synthetic snapshots:

```bash
npm run reclaim:account-audit:preview-drift -- --input examples/account-audit-drift.example.json
```

Inspect a configured Reclaim account:

```bash
npm run reclaim:account-audit:inspect -- --config config/reclaim.local.json
```

The live command reads `/users/current`, `/tasks`, `/meetings`, and `/timeschemes` through the configured API key. The read collectors follow common paginated response envelopes and retry bounded `429` responses when `Retry-After` is present. Keep command output local because even a summary run is derived from account data.

## Output

The command returns one JSON document:

```json
{
  "identity": {
    "authenticated": true,
    "hasDisplayName": true
  },
  "taskCount": 2,
  "taskCategoryBreakdown": [
    {
      "label": "PERSONAL",
      "count": 1
    },
    {
      "label": "WORK",
      "count": 1
    }
  ],
  "dueTaskCount": 1,
  "snoozedTaskCount": 1,
  "meetingCount": 2,
  "meetingsWithAttendeesCount": 1,
  "totalMeetingDurationMinutes": 75,
  "hourPolicyCount": 2,
  "taskAssignmentPolicyCount": 2,
  "windowedHourPolicyCount": 2,
  "timezoneCount": 1,
  "timeSchemeFeatureCoverage": [
    {
      "label": "AVAILABILITY",
      "count": 1
    },
    {
      "label": "TASK_ASSIGNMENT",
      "count": 2
    }
  ],
  "readSafety": "read_only"
}
```

The shape is intentionally summary-oriented. It keeps identity at presence/absence level and collapses tasks, meetings, and time-policy data into counts so downstream scripts can audit account posture without copying private schedule content.

## Drift Digest

The preview drift command compares two synthetic account snapshots using source handles only. It emits the same summary-only inspection shapes for `baseline` and `current`, then adds a normalized `overallChangeClass`, changed-signal counts, and per-metric drift bands.

```json
{
  "sourceHandles": {
    "baseline": "account-audit-baseline-v1",
    "current": "account-audit-current-v2"
  },
  "overallChangeClass": "mixed_drift",
  "summary": "Detected mixed_drift between account-audit-baseline-v1 and account-audit-current-v2 across 12 numeric or coverage signals and no identity flag changes.",
  "changedSignalCount": 12,
  "driftBandCounts": {
    "incremental": 11,
    "material": 1
  },
  "readSafety": "read_only"
}
```

This comparison output stays public-safe because it preserves only source handles, summary counts, and normalized change classes. It does not echo task titles, meeting titles, user identifiers, time-policy ids, balances, account identifiers, or transaction details from either snapshot.
