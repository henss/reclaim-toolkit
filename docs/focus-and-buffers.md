# Focus And Buffer Inputs

Focus and Buffer helpers are preview-only. They parse public-safe intent files and return the request shapes the toolkit would prepare, but they do not call a live Reclaim Focus or Buffer API.

```json
{
  "focusBlocks": [
    {
      "title": "Prototype review block",
      "notes": "Review a generic prototype and capture follow-up questions.",
      "durationMinutes": 90,
      "eventCategory": "WORK",
      "cadence": "weekly",
      "daysOfWeek": ["tuesday"],
      "windowStart": "09:00",
      "windowEnd": "12:00"
    }
  ],
  "buffers": [
    {
      "title": "Post-review notes buffer",
      "notes": "Capture decisions and next steps after a generic review.",
      "durationMinutes": 15,
      "eventCategory": "WORK",
      "placement": "after",
      "anchor": "Prototype review block",
      "windowStart": "12:00",
      "windowEnd": "13:00"
    }
  ]
}
```

Focus fields:

- `title`: focus block title.
- `notes`: optional focus notes.
- `durationMinutes`: target duration for the focus block.
- `eventCategory`: `PERSONAL` or `WORK`. Defaults to `WORK`.
- `cadence`: `once`, `daily`, or `weekly`. Defaults to `once`.
- `daysOfWeek`: required for weekly focus blocks and omitted for one-time or daily focus blocks.
- `date`: optional ISO date for one-time focus blocks.
- `windowStart`: optional preferred start time as `HH:MM`.
- `windowEnd`: optional preferred end time as `HH:MM`; when both window fields are present, this must be later than `windowStart`.
- `alwaysPrivate`: whether the previewed focus block should be private. Defaults to `true`.

Buffer fields:

- `title`: buffer title.
- `notes`: optional buffer notes.
- `durationMinutes`: target duration for the buffer.
- `eventCategory`: `PERSONAL` or `WORK`. Defaults to `PERSONAL`.
- `placement`: `before`, `after`, or `between`. Defaults to `after`.
- `anchor`: public-safe label for the generic item the buffer is associated with.
- `windowStart`: optional preferred start time as `HH:MM`.
- `windowEnd`: optional preferred end time as `HH:MM`; when both window fields are present, this must be later than `windowStart`.
- `alwaysPrivate`: whether the previewed buffer should be private. Defaults to `true`.

Preview synthetic files with:

```bash
npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json
```

Both commands return JSON with `writeSafety: "preview_only"` plus a top-level `previewReceipt` that records when the preview was generated and why the helper remains preview-only.
Focus preview fixtures can also include an optional `currentFocusBlocks` array. When present, each previewed focus block includes a `planDiff` receipt with a create/update/unchanged action plus explicit `diffLines`, and the top-level output adds `currentFocusBlockCount`, `removedFocusBlocks`, and `planDiffSummary` so callers can review synthetic add/update/remove decisions before any live scheduling work exists.
When the preview input also includes synthetic `timeSchemes` plus optional default or preferred policy hints, each preview item includes a `timePolicyExplanation` object with the selected policy, selection reason, fit/conflict status, and any bounded window checks that were possible from the supplied fixture.

## Public-Safe Fixtures

`examples/focus-and-buffers.example.json` uses invented titles, generic notes, placeholder windows, and conventional `WORK` or `PERSONAL` categories. Its optional `currentFocusBlocks` baseline is also synthetic and exists only to exercise diff-style preview receipts for planner review.

Do not commit focus or buffer files copied from a live account, private scheduling ledger, calendar export, household routine, health-support policy, or personal operating policy.
