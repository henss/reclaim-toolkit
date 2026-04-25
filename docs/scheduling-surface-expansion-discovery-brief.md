# Public-Safe Scheduling Surface Expansion: Discovery Brief

This document is a discovery brief and proposal artifact for the overall public-safe expansion program. It is not a release plan, an API contract, or a scheduling implementation approval.

## What This Brief Covers

The toolkit currently has one confirmed write surface (tasks) and several preview-only surfaces (Habits, Focus, Buffers) plus read-only scheduling summaries (Meetings, Hours). Companion proofs have been recorded for individual scheduling surfaces:

- [Scheduling surface first proof](scheduling-surface-first-proof.md) — keeps Meetings, Recurring Reschedule, and Hours narrow.
- [Write expansion routing review](write-expansion-routing.md) — gates Habit, Focus, and Buffer behind evidence review.
- [Habit write evidence review](habit-write-evidence-review.md) — confirms Habit stays preview-only pending a bounded integration slice.

This brief synthesizes those proofs and answers one open question: **should Habit, Focus, and Buffer expansion be governed as a single bundled program or as separate sequential slices?**

## Current Surface Map

| Surface | Mode | Write gate status | Scheduling-adjacent? |
| --- | --- | --- | --- |
| Tasks | Live write | Proven | No |
| Habits | Preview-only | OpenAPI contract exists; field mapping review not done | Weakly (blocks time) |
| Focus | Preview-only | No public API-shape evidence reviewed | Directly (blocks calendar) |
| Buffers | Preview-only | No public API-shape evidence reviewed; anchor semantics unproven | Directly (buffers calendar events) |
| Meeting Availability | Preview-only | Keep narrow; no public write evidence | Yes |
| Recurring Reschedule | Preview-only | Keep narrow; no public write evidence | Yes |
| Meetings Inspector | Read-only | Keep read-only | Yes |
| Hours Inspector | Read-only | Keep read-only | Yes |

Focus and Buffer helpers are more scheduling-adjacent than Habit: they interact directly with calendar blocking rather than recurring personal time. That distinction matters for public-boundary decisions.

## Common Receipt Model Proposal

All preview-only helpers currently emit `writeSafety: "preview_only"` in their JSON output. That field communicates the boundary to consumers but does not explain what evidence is still missing or what the next step would be to unlock a live write.

A shared **explanation receipt** would add three fields to all preview-only command outputs without changing the no-write boundary:

```ts
interface PreviewExplanationReceipt {
  writeSafety: "preview_only";
  previewGeneratedAt: string;        // ISO timestamp, same pattern as write receipts
  readinessGate: string;             // Human-readable note on the blocking evidence
  readinessStatus: "evidence_pending" | "review_pending" | "blocked";
}
```

Concrete examples per surface:

- **Habit preview**: `readinessGate: "Habit field mapping review against generated OpenAPI contract is pending"`, `readinessStatus: "evidence_pending"`
- **Focus preview**: `readinessGate: "No reviewed public API-shape evidence for Focus create endpoint"`, `readinessStatus: "evidence_pending"`
- **Buffer preview**: `readinessGate: "Anchor semantics not proven against a public endpoint; placement behavior may differ from preview model"`, `readinessStatus: "evidence_pending"`

This is low-cost to add because it does not change behavior, does not require new API calls, and does not imply any write contract. It gives agents and automated consumers a stable signal they can act on programmatically instead of reading free-form docs.

## Bundled Wave vs. Sequential Slices

### Option A — Single approved expansion program

One approved program covers Habit + Focus + Buffer with a shared receipt contract. A common review gate, common fixture format, and a single governing approval decision control the entire wave.

Upside: consistent public surface, one decision, coherent docs.
Downside: larger decision surface; if any one candidate (e.g., Buffer anchor semantics) is not ready, it may delay the others. Also requires more upfront review work.

### Option B — One adjacent surface at a time

Habit is reviewed and potentially approved first. Focus follows once Habit proves the pattern. Buffer follows after Focus proves anchor safety.

Upside: narrower risk per slice; does not block Habit on Buffer's harder semantics.
Downside: three separate decisions; possible docs inconsistency between slices; Focus and Buffer might drift without a shared receipt model.

### Option C — Explanation receipts only, defer write expansion

Add the shared explanation receipt fields to all preview-only commands without deciding on any write expansion. Defer the Habit/Focus/Buffer write question until maintainers have attention for the governing choice.

Upside: lowest risk; immediately improves signal quality for agents; no write gate required.
Downside: does not advance any candidate toward live writes.

## Recommended Governing Choice

**Option C now, then Option B.** The explanation receipt is low-risk and immediately useful. The write expansion should proceed sequentially (Habit first) rather than as a full wave because Buffer is not ready to move together with Habit — its anchor semantics need separate evidence.

Specifically:

1. Add explanation receipt fields to Habit, Focus, and Buffer preview commands (one bounded implementation slice).
2. If Habit evidence review resolves cleanly, approve Habit as a standalone first write candidate. Do not bundle Focus or Buffer until Habit proves the expanded pattern.
3. Treat Focus as the second candidate only after a completed Habit write slice.
4. Keep Buffer deferred until Focus proves cross-object placement safety.
5. Keep Meetings, Hours, and all scheduling-surface helpers in their current narrow modes. Do not treat this program as approval for scheduling writes.

## Governing Question for Maintainers

The one decision this brief cannot resolve without maintainer input is:

> Is it acceptable to let Habit graduate to a confirmed write surface as a standalone first slice, or should any write expansion require a single joint approval for all three (Habit + Focus + Buffer) together?

A standalone Habit first slice is the lower-risk path because it does not make a public API commitment for Focus or Buffer anchor behavior. A joint approval is administratively simpler but delays the earliest write milestone behind Buffer readiness.

The toolkit can proceed with explanation receipt enrichment (Option C above) independently of this decision.

## Explicit Deferrals

Do not add in this discovery slice:

- Habit, Focus, or Buffer live write commands.
- Meeting booking, reschedule, hours switching, or fallback routing helpers.
- Real account fixtures, private calendar data, or operator-specific scheduling rules.
- A combined approval that treats Habit and Buffer as equivalent write candidates.

## Recommended Next Slice

Add explanation receipt fields to Habit, Focus, and Buffer preview commands. This is the smallest useful increment: it gives consumers a programmatic readiness signal, aligns the preview surface with the write-receipt pattern already used by tasks, and sets up a clean gate for the Habit evidence review without committing to any new write contract.

After that, run the Habit field-mapping review against the generated OpenAPI contract to decide whether Habit can advance to a confirmed write command.
