# Weekly Scenario Composer

`examples/compound-weekly-preview.example.json` is a public-safe weekly scenario fixture that combines several existing preview surfaces into one read-only agenda:

- tasks;
- habits;
- focus blocks;
- buffers;
- meeting-availability candidates.

Preview it with:

```bash
npm run reclaim:scenarios:preview-weekly -- --input examples/compound-weekly-preview.example.json
```

The command returns:

- a seven-day agenda grouped by date;
- weekly summary counts for each included surface;
- unscheduled entries and unresolved buffer anchors when a fixture cannot be placed inside the week;
- the underlying preview payloads for each surface so the composed view stays auditable.

The fixture stays inside the public boundary:

- It uses synthetic titles, notes, and placeholder meeting names only.
- It does not include real Reclaim tasks, private scheduling ledgers, household details, health-support policy, Calendar fallback rules, or Stefan-specific operating policy.
- It does not imply live meeting creation, task writes, habit writes, focus writes, or buffer writes.

Use it for:

- docs or screenshots that need a fuller weekly story than a task-only pack;
- regression tests that need multiple preview surfaces composed together;
- public-safe review of anchor placement, daily cadence expansion, and candidate meeting slots in one result.

Keep future variants synthetic and week-shaped. If a scenario needs private approval logic, live calendar routing, or non-public scheduling heuristics, keep that reasoning in orchestrator-owned surfaces instead of this repo.
