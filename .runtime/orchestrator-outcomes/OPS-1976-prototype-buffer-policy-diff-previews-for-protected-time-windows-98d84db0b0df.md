# Domain Execution Outcome: Prototype Buffer policy diff previews for protected-time windows

## Summary
Implemented the OPS-1976 bounded prototype on the existing `reclaim:buffers:preview-rule` surface. Buffer rule previews can now optionally compare bounded synthetic buffer windows against synthetic protected-time policy windows and emit additive `protectedTimeWindowDiff` output without introducing a new command or any live-account behavior.

## What changed
- Extended [`src/buffer-rules.ts`](/D:/workspace/reclaim-toolkit/src/buffer-rules.ts) so preview input can accept synthetic `timeSchemes`, default/preferred policy hints, and produce `previewReceipt.protectedTimeWindowDiff` when a rule includes `windowStart` and `windowEnd`.
- Extracted the protected-window comparison logic into [`src/buffer-rule-protected-time-diff.ts`](/D:/workspace/reclaim-toolkit/src/buffer-rule-protected-time-diff.ts) so the new prototype stays inside the repo's staged agent-surface guard.
- Added protected-window overlap coverage to [`test/buffer-rule-preview.test.ts`](/D:/workspace/reclaim-toolkit/test/buffer-rule-preview.test.ts) and updated the synthetic fixture in [`examples/buffer-rules.example.json`](/D:/workspace/reclaim-toolkit/examples/buffer-rules.example.json).
- Updated the public-safe command docs in [`docs/buffer-rules.md`](/D:/workspace/reclaim-toolkit/docs/buffer-rules.md) and [`docs/cli-json-profile.md`](/D:/workspace/reclaim-toolkit/docs/cli-json-profile.md).

## Why it mattered
The repo already had create-vs-update buffer diffs, but it did not expose any named comparison between a bounded buffer rule window and protected-time policy windows. This prototype fills that missing audit seam while staying inside the repo’s existing preview-only/public-safe contract.

## Structured Outcome Data
- Output classification: code
- Tracker issue: OPS-1976
- Verification:
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
- Efficiency note: one deterministic `typecheck` failure surfaced after the initial edit because `windows` is optional in the shared time-scheme type, and the first draft also tripped the staged agent-surface guard. Repaired the type seam and extracted the protected-window diff logic into its own module before rerunning broader verification.
- Uncertainty: this remains a synthetic policy-window comparison on the rule preview surface, not a broader policy-drift or template-level diff model.

## Continuation Decision
- Action: complete
- Recommended next step: if OPS-1976 needs a second increment, keep it equally narrow by deciding whether template previews should reuse this protected-window diff envelope or whether rule preview is the intended terminal surface.
