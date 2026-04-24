# Synthetic Event-Prep Block Example Pack

`examples/event-prep-block-example-pack.example.json` is a public-safe transformed task fixture for a bounded synthetic guest-visit preparation flow.

Preview it with the existing task command:

```bash
npm run reclaim:tasks:preview-create -- --input examples/event-prep-block-example-pack.example.json
```

The file models a conventional placeholder visit-prep sequence using only the current task preview contract:

- run-of-show review before the visit window;
- signage and room-readiness checks;
- demo-environment reset work;
- host handoff notes for visit day;
- a prewritten post-visit summary shell.

The pack is intentionally narrow:

- It does not include real Reclaim tasks, private scheduling ledgers, household details, health-support policy, Calendar fallback rules, or Stefan-specific operating policy.
- It does not imply guest-management software, badge tooling, calendar routing, venue logistics automation, or private checklist extraction workflows.
- It does not approve package publication, release automation, broader API commitments, or live event execution.

Use it for:

- fixture-backed preview runs;
- docs or screenshots showing event-prep-shaped task blocks;
- tests that need a richer visit-prep scenario than the smaller task examples.

Keep future variants synthetic, auditable in one pass, and aligned to the existing `tasks.previewCreates` input shape rather than adding orchestration, connector, or private-ops surfaces here.
