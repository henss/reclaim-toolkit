# Roadmap

This page is a conditional review queue, not a standalone product backlog. `reclaim-toolkit` stays thin support infrastructure for downstream tools that need public-safe Reclaim previews, summaries, fixtures, and typed helper seams.

Use this page to track candidate surfaces only when they still fit that contract:

- a downstream tool still needs the seam after native Reclaim or external options are considered
- the surface can be explained with synthetic examples and public contract evidence
- the change does not rely on private scheduling policy, fallback logic, or operator-specific workflow assumptions

Tasks remain the current mature live-write surface. Everything else below is conditional and still subject to separate review before it becomes a public commitment.

## Conditional Surface Candidates

- Habit live-write utilities, after the preview-only Habit helper prototype has an approved API contract.
- Focus and Buffer live-write utilities, after the preview-only helper prototypes have approved API contracts.
- Meeting write utilities only after a separate scheduling-surface routing review approves a public-safe contract.
- Hours write utilities and configuration helpers only after a separate scheduling-surface routing review approves a public-safe contract.
- Higher-level task search and completion helpers only when a named downstream workflow still needs them and the helper stays thinner than a broader workflow runtime.

New modules should ship only when they have a tested implementation, synthetic examples, and a public-safe reason for living in this repo instead of a private workflow layer or an existing external tool.

## Explicit Review Points

The following are intentionally outside the normal roadmap flow and require explicit review before work advances:

- package publication, release automation, license changes, repository moves, or new distribution commitments
- broader public API commitments or new package export paths
- reusable connector clients, workflow automation, or other infrastructure that would make this package the owner of a larger integration surface
- examples or defaults that require private account, task, calendar, household, health, or personal planning details to explain safely

## Related Guidance

See [safe write expansion program](safe-write-expansion-program.md) for the program scope, candidate status, and governing gates for Habit, Focus, and Buffer live writes.
See [write expansion routing](write-expansion-routing.md) for the proposed review gates before adding live writes beyond tasks.
See [scheduling surface expansion: first proof](scheduling-surface-first-proof.md) for the current public-safe judgment on why scheduling helpers stay preview-only or read-only.
See [scheduling surface expansion: discovery brief](scheduling-surface-expansion-discovery-brief.md) for the overall expansion program summary and the recommended governing choice on Habit, Focus, and Buffer sequencing.
See [build-vs-buy workflows](build-vs-buy-workflows.md) for the adopt-vs-build framing that keeps this repo narrow.
See [project contract](project-contract.md) for the governing public boundary, agent contract sources, and review gates.
