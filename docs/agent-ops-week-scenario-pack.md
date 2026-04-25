# Synthetic Agent-Ops Week Scenario Pack

`examples/agent-ops-week-scenario-pack.example.json` is a public-safe transformed task fixture for a bounded synthetic agent-ops week.

Preview it with the existing task command:

```bash
npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json
```

The file models a Monday-through-Friday experiment slice using only the current task preview contract:

- inbound opportunity triage;
- pricing-experiment planning;
- concierge workflow rehearsal;
- onboarding-doc gap review;
- end-of-week synthetic readout.

The pack is intentionally narrow:

- It does not include real Reclaim tasks, private scheduling ledgers, household details, health-support policy, Calendar fallback rules, or operator-specific operating policy.
- It does not imply direct CRM, inbox, billing, or workflow-runner integrations.
- It does not approve package publication, release automation, broader API commitments, or live business actions.

Use it for:

- fixture-backed preview runs;
- screenshots or docs showing a multi-day task plan;
- tests that need a richer work-week-shaped input than the smaller starter packs.

Keep future variants synthetic, auditable in one pass, and aligned to the existing `tasks.previewCreates` input shape rather than adding new orchestration or connector surfaces here.
