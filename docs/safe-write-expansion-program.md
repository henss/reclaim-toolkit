# Safe Reclaim Write Expansion Program

This document is the seed artifact for the Safe Reclaim Write Expansion Program. It records the program scope, current status, and governing gates. It is a discovery brief and program-level proposal, not a release plan or API commitment.

Program brief origin: Linear issue OPS-1228.

## Program Scope

The toolkit has one proven write surface (tasks) and three preview-only candidates (Habits, Focus, Buffers). This program governs how each preview-only candidate can graduate to a confirmed write surface, one at a time, under the same safety model already used for tasks.

Scheduling-adjacent surfaces (Meetings, Hours, Meeting Availability, Recurring Reschedule) are out of scope for this program. They are covered separately in [scheduling surface expansion: discovery brief](scheduling-surface-expansion-discovery-brief.md).

## Proven Baseline

The task write pattern is the reference model for all candidates. It requires:

- a preview command that emits the exact request payload before any live write
- an explicit confirmation flag for the live write operation
- write receipts with object id, operation name, confirmation timestamp, and rollback guidance
- synthetic fixture coverage and tests for preview output, refusal without confirmation, successful write against a fixture, and malformed input rejection
- documentation that states the object type's write boundary with generic examples only

See [write expansion routing](write-expansion-routing.md) for the full gate criteria.

## Candidate Status

| Candidate | Preview state | Explanation receipt | API evidence | Field mapping review | Write gate |
| --- | --- | --- | --- | --- | --- |
| Habit | `preview_only` | `evidence_pending` — OpenAPI paths exist, field mapping not reviewed | Public OpenAPI paths exist (`/api/assist/habits/daily`, `/api/smart-habits`) | Not done | Blocked on mapping review |
| Focus | `preview_only` | `evidence_pending` — no public endpoint evidence reviewed | Not reviewed | Not done | Blocked on API evidence |
| Buffer | `preview_only` | `evidence_pending` — anchor semantics unproven | Not reviewed | Not done | Blocked on anchor evidence |

All three candidates already emit `previewReceipt` with `readinessStatus: "evidence_pending"` and a human-readable `readinessGate`. This gives consumers a programmatic signal without implying any write commitment.

## Candidate Order

Advance candidates sequentially, not as a bundled wave:

1. **Habit first** — self-contained preview shape, no cross-object placement, public OpenAPI evidence is the closest to a complete contract
2. **Focus second** — self-contained but has cadence variants that require more fixture coverage; wait until Habit proves the expanded pattern
3. **Buffer last** — anchor placement semantics need stronger API evidence before a write surface is safe

Do not combine multiple candidates in one increment. A candidate that fails any gate stays preview-only.

## Required Evidence Before Any Write Slice

Before any candidate can proceed to a write implementation slice:

1. Generated request/response shapes from the sanitized local OpenAPI contract, not ad hoc client shapes
2. A field mapping review that identifies which generated fields belong in the public toolkit and which stay out
3. Response/receipt semantics chosen from documented API fields, not inferred from preview behavior
4. Synthetic success and refusal fixtures for the planned CLI flow

See [safe write expansion: first proof](write-expansion-first-proof.md) and [habit write evidence review](habit-write-evidence-review.md) for the current Habit evidence assessment.

## Program Status

**Backlog.** No active Stefan-approved write-expansion need exists. The explanation receipts already added to Habit, Focus, and Buffer preview commands satisfy the current signal requirement without requiring a live write gate decision.

The program should remain in backlog until:

- A concrete write use case is identified and approved
- The Habit field mapping review is completed as the first bounded slice
- Reduced weekly pacing allows a focused implementation increment

## Explicit Deferrals

This program does not cover:

- Live write commands for Habit, Focus, or Buffer in this slice
- Scheduling surface writes (Meetings, Hours, fallback routing)
- Real account fixtures, private calendar data, or operator-specific scheduling assumptions
- Package publication, release automation, or broader public API commitments

## Next Bounded Slice (When Activated)

If the program is activated, the first slice should be:

1. Run the Habit field mapping review against the locally generated OpenAPI contract
2. Record which fields pass through unchanged, which need translation, and which stay out
3. Decide whether Habit can graduate to a confirmed write command or stays preview-only

Do not add Habit write code until that evidence review is complete and approved.

See also:
- [Write expansion routing](write-expansion-routing.md)
- [Safe write expansion: first proof](write-expansion-first-proof.md)
- [Habit write evidence review](habit-write-evidence-review.md)
- [Scheduling surface expansion: discovery brief](scheduling-surface-expansion-discovery-brief.md)
