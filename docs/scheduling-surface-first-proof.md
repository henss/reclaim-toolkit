# Scheduling Surface Expansion: First Proof

This document is the first public-safe proof for expanding the toolkit's scheduling surfaces. It is a proposal artifact, not a release plan or API contract.

## Scope

The toolkit already exposes three scheduling-adjacent surfaces:

- `reclaim:meetings:preview-availability`
- `reclaim:meetings:preview-recurring-reschedule`
- `reclaim:meetings-hours:preview-inspect`
- `reclaim:meetings-hours:preview-switch`
- `reclaim:meetings-hours:inspect`

Those helpers are intentionally split between preview-only and read-only behavior. This proof evaluates whether any of them should move toward confirmed scheduling writes or live schedule mutation.

## Existing Baseline

The current public scheduling baseline is intentionally narrow:

- Meeting Availability is a synthetic local preview that derives windows, slots, and exclusion reasons from synthetic policy windows and synthetic busy meetings.
- Recurring Meeting Reschedule is a synthetic local what-if simulator that classifies occurrences as `keep`, `move`, or `blocked`.
- Meetings and Hours inspection is read-only and summary-oriented, with a separate local profile-switch preview for comparing synthetic preset outcomes.

That baseline is the only public-safe scheduling pattern this document treats as proven.

## Candidate Comparison

| Candidate | Current surface | Complexity | Gate status | First-proof judgment |
| --- | --- | --- | --- | --- |
| Meeting Availability | Preview-only synthetic slot finder with explicit exclusion reasons | Medium because a future live form would need API evidence for actual availability or booking behavior, plus boundaries around private schedule interpretation | Synthetic fixtures and docs exist; live endpoint evidence, receipt semantics, and booking boundaries are still missing | Keep preview-only |
| Recurring Meeting Reschedule | Preview-only occurrence classifier with bounded alternative slots | High because a future live form would imply mutation of real meeting series state and safe reschedule semantics | Synthetic fixtures and docs exist; live endpoint evidence, mutation semantics, and rollback-friendly receipts are still missing | Keep preview-only |
| Meetings and Hours Inspector | Read-only meeting and time-policy summary plus local profile-switch preview | High because moving beyond read-only would imply account-level policy switching or hours updates | Read collectors and summary docs exist; safe public write boundaries and receipt semantics are not approved | Keep read-only |

## Why Scheduling Stays Narrow

Scheduling helpers are not equivalent to self-contained object writes like tasks or even potential Habit writes. They interact with real schedule shape, hour presets, recurrence behavior, and planner state. A public toolkit can model previews and summaries safely because those can stay synthetic or bounded to counts.

Moving any scheduling helper toward confirmed writes would require stronger evidence than the current repo exposes publicly:

- generated request-field evidence for the exact Reclaim scheduling endpoint
- generated response-shape evidence showing stable identifiers and receipt fields
- proof that the helper can stay independent from private fallback rules, personal operating policy, and account-specific routing decisions
- synthetic success, refusal, and rollback-oriented fixtures that cover the planned CLI behavior without copying real schedule data

Without that evidence, the public-safe result is to keep scheduling helpers preview-only or read-only.

## Decision

Do not add scheduling write commands in this slice.

Do not add meeting booking, meeting mutation, hours switching, or fallback-routing helpers in this slice.

Keep the existing scheduling helpers in their current public-safe modes:

- Meeting Availability: preview-only
- Recurring Meeting Reschedule: preview-only
- Meetings and Hours inspection: read-only
- Meetings and Hours profile switching: local preview-only

## Recommended Next Slice

If future work revisits scheduling expansion, the next bounded step should be a scheduling contract evidence review rather than implementation.

A useful follow-up should answer all of the following with public-safe evidence:

1. Which published Reclaim scheduling endpoints are stable enough to model as a narrow public helper?
2. Which request and response fields can be exposed without implying private fallback logic or account-specific routing?
3. What receipt contract, if any, would let a scheduling mutation stay auditable and rollback-friendly?
4. Which synthetic fixtures are required before any scheduling write surface is safe to add?

Until that review exists, the lowest-risk public path is to improve preview docs, synthetic fixtures, and read-only summaries only.
