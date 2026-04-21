# Buffer Template Preview Helper

The Buffer template helper is preview-only. It expands generic template inputs into Buffer preview payloads, plus synthetic mock responses and receipt-style metadata that can be reviewed without calling a live Reclaim Buffer API.

```json
{
  "templates": [
    {
      "template": "meeting_recovery",
      "anchor": "Weekly project sync",
      "eventCategory": "WORK"
    },
    {
      "template": "transition_time",
      "anchor": "Documentation drafting block",
      "title": "Mode switch buffer",
      "durationMinutes": 12,
      "windowStart": "15:00",
      "windowEnd": "16:00"
    }
  ]
}
```

Template fields:

- `template`: one of `meeting_recovery` or `transition_time`.
- `anchor`: public-safe label for the generic item the buffer is associated with.
- `title`: optional override for the template title.
- `notes`: optional override for the template notes.
- `durationMinutes`: optional override for the template duration.
- `eventCategory`: optional `PERSONAL` or `WORK` override. Template defaults stay conventional and public-safe.
- `windowStart`: optional preferred start time as `HH:MM`.
- `windowEnd`: optional preferred end time as `HH:MM`; when both window fields are present, this must be later than `windowStart`.
- `alwaysPrivate`: whether the previewed buffer should be private. Defaults to `true`.

Template defaults:

- `meeting_recovery`: 15-minute `after` buffer with generic meeting follow-up notes.
- `transition_time`: 10-minute `between` buffer with generic context-switch notes.

Preview a synthetic template file with:

```bash
npm run reclaim:buffers:preview-template -- --input examples/buffer-templates.example.json
```

The command returns JSON with:

- `request`: the preview payload the helper would prepare.
- `mockResponse`: a synthetic Reclaim-like acknowledgement for local evaluation.
- `previewReceipt`: receipt-style metadata for audit trails without any live write.
- `writeSafety: "preview_only"` to make the no-write boundary explicit.

## Public-Safe Fixture

`examples/buffer-templates.example.json` uses invented anchors, generic template names, and placeholder windows. It is intended for template regression tests and local previews only.

Do not commit template files copied from a live account, private scheduling ledger, household routine, health-support policy, real travel plans, or personal operating policy.
