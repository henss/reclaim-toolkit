# Write Expansion Routing Review

This document records the public routing proposal for expanding live Reclaim writes beyond tasks. It is a proposal, not an API commitment or release plan.

## Current Routing

- Tasks are the only live-write surface. They require explicit confirmation flags and return write receipts for confirmed creates and duplicate cleanup.
- Habit, Focus, and Buffer helpers remain preview-only until each object type has direct API-shape evidence and reviewed write fixtures.
- Meetings and Hours remain read-only. They should not gain write helpers until the toolkit has stronger evidence that their write APIs are stable, narrow, and safe to model publicly.

## Expansion Gates

Add live writes for one object type at a time. Before a preview-only module can gain a confirmed write command, it should have:

- API-shape evidence for the target Reclaim endpoint, including the request fields, response shape, and identifier semantics needed for receipts.
- Synthetic fixtures that exercise the proposed write shape without copying account data or private scheduling records.
- A preview command that already emits the exact request payload the write command would send.
- A confirmation flag that is specific to the write operation.
- Write receipts with object id, operation name, confirmation timestamp, and manual rollback guidance.
- Tests that cover preview output, refusal without confirmation, successful writes against a synthetic fetch fixture, and malformed input rejection.
- Documentation that states the object type's write boundary and keeps examples generic.

## Candidate Order

The first candidate should be whichever of Habit, Focus, or Buffer has the clearest public API evidence and the smallest write surface. If the available evidence is comparable, prefer this order:

1. Habit writes, because the current preview shape is self-contained and does not depend on anchoring another object.
2. Focus writes, because the preview shape is self-contained but has more scheduling cadence variants.
3. Buffer writes, because the preview shape includes placement and anchor semantics that need stronger evidence before writes are safe.

Do not combine multiple new live-write object types in one increment. A module that fails any gate should stay preview-only.

## Review Points

Stop for explicit review before package publication, release automation, license changes, or any broader public API commitment. Also stop if the next write surface requires account-specific examples, private workflow assumptions, Calendar fallback behavior, or a policy decision about whether the workflow belongs outside this public toolkit.

## Suggested Next Slice

Gather public API-shape evidence for Habit writes and compare it to the existing preview request shape. The value is a clear adopt-or-defer decision before adding code; the downside of waiting is that Habit, Focus, and Buffer work may continue as disconnected preview-only tickets instead of one governed expansion track.
