# Buffer Rule Preview

The Buffer rule helper is preview-only. It compares a synthetic desired rule against an optional synthetic current buffer set, then emits a diff-style receipt that shows whether the rule would create a new buffer or update an existing preview shape.

```json
{
  "currentBuffers": [
    {
      "title": "Weekly project sync recovery",
      "durationMinutes": 10,
      "eventCategory": "WORK",
      "placement": "after",
      "anchor": "Weekly project sync",
      "windowStart": "11:30",
      "windowEnd": "12:00"
    }
  ],
  "rules": [
    {
      "ruleId": "meeting-recovery-default",
      "title": "Weekly project sync recovery",
      "durationMinutes": 15,
      "eventCategory": "WORK",
      "placement": "after",
      "anchor": "Weekly project sync",
      "windowStart": "11:30",
      "windowEnd": "12:00"
    }
  ]
}
```

Top-level fields:

- `rules`: required list of desired buffer rules to preview.
- `currentBuffers`: optional synthetic baseline used to decide whether each rule is a `create` or `update` preview.

Rule fields:

- `ruleId`: stable preview identifier for the synthetic rule.
- `title`: buffer title the rule would produce.
- `notes`: optional notes for the previewed buffer.
- `durationMinutes`: target duration for the buffer.
- `eventCategory`: optional `PERSONAL` or `WORK`. Defaults to `PERSONAL`.
- `placement`: `before`, `after`, or `between`. Defaults to `after`.
- `anchor`: public-safe label for the generic item the buffer is associated with.
- `windowStart`: optional preferred start time as `HH:MM`.
- `windowEnd`: optional preferred end time as `HH:MM`; when both window fields are present, this must be later than `windowStart`.
- `alwaysPrivate`: whether the previewed buffer should be private. Defaults to `true`.

Preview a synthetic rule file with:

```bash
npm run reclaim:buffers:preview-rule -- --input examples/buffer-rules.example.json
```

The command returns JSON with:

- `request`: the desired preview payload for the rule.
- `currentBuffer`: the matched synthetic baseline, when the rule resolves to an update preview.
- `mockResponse`: preview metadata showing whether the synthetic action is `create` or `update`.
- `previewReceipt.diffLines`: a diff-style list using `+`, `-`, and leading-space lines for added, changed, removed, and unchanged fields.
- `previewReceipt.diffSummary`: aggregate counts for the emitted diff.
- `writeSafety: "preview_only"` to keep the no-write boundary explicit.

## Public-Safe Fixture

`examples/buffer-rules.example.json` uses invented anchors, placeholder windows, and generic work patterns. It is intended for preview regression tests and local review of the diff-style receipt shape only.

Do not commit rule files copied from a live account, private scheduling ledger, household routine, health-support policy, calendar fallback logic, or personal operating policy.
