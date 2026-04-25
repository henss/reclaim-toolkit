# Hours Config Audit

The Hours Config audit is a read-only summary of Reclaim time-scheme configuration. It is designed for hours-policy coverage checks and bounded drift review without copying policy ids, policy titles, or meeting details into downstream artifacts.

## CLI

Preview the output shape with the synthetic fixture:

```bash
npm run reclaim:hours-config:preview-audit -- --input examples/hours-config.example.json
```

Preview a drift digest between two synthetic hours-config snapshots:

```bash
npm run reclaim:hours-config:preview-diff -- --input examples/hours-config-diff.example.json
```

Audit a configured Reclaim account:

```bash
npm run reclaim:hours-config:audit -- --config config/reclaim.local.json
```

The live command reads `/timeschemes` through the configured API key. Keep command output local because even a summary-only run is derived from account hours configuration.

## Output

The audit command returns one JSON document:

```json
{
  "hourPolicyCount": 3,
  "taskCategoryBreakdown": [
    {
      "label": "PERSONAL",
      "count": 1
    },
    {
      "label": "WORK",
      "count": 2
    }
  ],
  "taskAssignmentPolicyCount": 2,
  "availabilityPolicyCount": 2,
  "totalWindowCount": 3,
  "windowedHourPolicyCount": 2,
  "policyWithoutWindowsCount": 1,
  "timezoneCount": 1,
  "weekdayCoverage": [
    {
      "label": "monday",
      "count": 1
    }
  ],
  "readSafety": "read_only"
}
```

The shape is intentionally summary-oriented. It keeps policy identity out of the output and focuses on category coverage, feature coverage, timezone spread, and configured window counts so downstream scripts can audit hours posture without replaying private schedule details.

## Diff Digest

The preview diff command compares two synthetic hours-config snapshots using source handles only. It emits the same summary-only inspection shapes for `baseline` and `current`, then adds a normalized `overallChangeClass`, changed-signal counts, and per-metric drift bands.

```json
{
  "sourceHandles": {
    "baseline": "hours-config-baseline-v1",
    "current": "hours-config-current-v2"
  },
  "overallChangeClass": "mixed_drift",
  "summary": "Detected mixed_drift between hours-config-baseline-v1 and hours-config-current-v2 across 7 configuration signals.",
  "changedSignalCount": 7,
  "driftBandCounts": {
    "incremental": 7,
    "material": 0
  },
  "readSafety": "read_only"
}
```

This comparison output stays public-safe because it preserves only source handles, summary counts, and normalized change classes. It does not echo policy ids, policy titles, meeting details, user identifiers, or configured local paths from either snapshot.
