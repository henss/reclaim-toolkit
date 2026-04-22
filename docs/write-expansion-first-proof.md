# Safe Write Expansion: First Proof

This document is the first public-safe proof for expanding confirmed Reclaim writes beyond tasks. It is a proposal artifact, not a release plan or API contract.

## Scope

The toolkit already has one confirmed write surface:

- `reclaim:tasks:create`
- `reclaim:tasks:cleanup-duplicates`

Habit, Focus, and Buffer helpers are intentionally preview-only. This proof compares those preview surfaces against the write gates in [write expansion routing](write-expansion-routing.md) and recommends the next bounded slice.

## Existing Baseline

The task flow already demonstrates the minimum public pattern for a safe write surface:

- a preview command that emits the exact request shape before any live write
- an explicit confirmation flag for the live operation
- write receipts with object id, operation name, confirmation timestamp, and rollback guidance
- synthetic fixture coverage and CLI profile tests

That baseline is the only pattern this document treats as proven.

## Candidate Comparison

| Candidate | Current preview shape | Write-surface complexity | Gate status | First-proof judgment |
| --- | --- | --- | --- | --- |
| Habit | Self-contained recurring block with cadence, optional days, optional date bounds, and simple privacy/category fields | Lowest of the preview-only candidates because it does not depend on another object id or placement anchor | Preview shape and fixtures exist; live endpoint evidence and receipt identifiers are still missing | Best first candidate once public API-shape evidence is available |
| Focus | Self-contained block with one-time, daily, and weekly cadence modes | Medium because cadence variants widen validation and receipt expectations | Preview shape and fixtures exist; live endpoint evidence and identifier semantics are still missing | Reasonable second candidate after Habit |
| Buffer | Placement-driven helper with an anchor label and before/after/between semantics | Highest because a safe write likely depends on stronger anchor semantics than the preview surface can prove today | Preview shape and fixtures exist; live endpoint evidence, anchor semantics, and receipt identifiers are still missing | Defer until anchor behavior is proven |

## Why Habit Leads

Habit is the strongest first candidate because the current public preview shape is the closest match to the existing task write model. It is self-contained, already uses synthetic fixture coverage, and does not require the toolkit to publicly model cross-object placement rules.

Focus is still viable, but its cadence variants increase the number of validation and receipt cases that would need proof at the same time. Buffer is the least suitable first step because its preview input uses a free-form `anchor` label rather than a proven Reclaim identifier or placement contract.

## Required Proof Before Code

Do not add Habit live writes until the following evidence exists in public-safe form:

- generated request-field evidence for the actual Reclaim Habit create endpoint
- generated response-shape evidence showing the identifier and fields needed for a write receipt
- proof that the current preview payload is either already aligned or can be translated without hidden account-specific assumptions
- a synthetic success fixture and at least one synthetic refusal or validation fixture for the planned CLI/test flow

The repo now has an OpenAPI-backed generation path recorded in [openapi client generation](openapi-client-generation.md). The remaining blocker is safe write integration, not lack of any documented API surface.

Without those artifacts, the safe result is to keep Habit preview-only.

## Recommended Next Slice

The next bounded slice should be a Habit write evidence review, not a write implementation.

A useful follow-up should:

1. Compare the current Habit preview request shape to verified public API-shape evidence.
2. Record the exact fields that can pass through unchanged, the fields that need translation, and any fields that should stay out of the public toolkit.
3. Decide whether Habit can graduate to a confirmed write path or should remain preview-only.

That follow-up keeps the toolkit aligned with the current safety model while avoiding premature public API commitments.

The current evidence review is recorded in [habit write evidence review](habit-write-evidence-review.md).
