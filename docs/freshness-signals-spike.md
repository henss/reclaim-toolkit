# Freshness Signals Spike

This document is a proposal artifact, not a release plan or API commitment. It compares documented Reclaim freshness signals and recommends the first bounded public-safe slice for the public-safe freshness-signal scenario.

## Scope

The goal of this spike is to decide whether the toolkit should start with webhook support or with an event-snapshot read surface when downstream automation needs a synthetic notion of freshness.

The current toolkit does not ship a public event freshness module. Tasks are the only confirmed live-write surface. Meetings and hours are read-only, and no public webhook adapter or inbound receiver is exposed today.

## Documented Upstream Signals

The tracked OpenAPI contract already shows two distinct freshness signal families:

- Webhook administration and delivery-history paths under `/api/team/current/webhooks`, including config CRUD, version discovery, message history, and retries.
- Snapshot-style reads under `/api/moment`, `/api/moment/next`, `/api/events`, `/api/events/v2`, and individual event read paths.

The `Moment` schema is especially relevant because it describes a current-time snapshot with:

- one primary active event
- zero or more additional overlapping events
- the server's `now` timestamp

That shape is a better freshness primitive than a generic event list when the consumer only needs "what changed around now?"

The webhook surface is narrower than it first appears. The documented `WebhookEventType` enum currently covers:

- `SCHEDULING_LINK_MEETING_CREATED`
- `SCHEDULING_LINK_MEETING_UPDATED`
- `SCHEDULING_LINK_MEETING_CANCELLED`

That is useful evidence, but it does not prove a broad task, habit, focus, or personal-event freshness stream.

## Comparative Read

| Candidate | OpenAPI evidence | Public-toolkit fit | Main risk |
| --- | --- | --- | --- |
| `moment` snapshot polling | Strong: dedicated `/api/moment` and `/api/moment/next` reads plus a documented `Moment` schema | Strongest first fit because it stays inside the current npm-first authenticated read model | Polling semantics still need a repo-owned freshness policy |
| event snapshot polling | Strong: `/api/events`, `/api/events/v2`, and individual event lookups are documented | Useful as a secondary detail surface after a coarser freshness signal exists | Event endpoints are broader and may tempt the toolkit into exposing unnecessary scheduling detail |
| webhook support | Medium: config CRUD and message history are documented, but the documented event types are narrow | Weaker first fit because a public toolkit would need inbound delivery guidance, secret handling, retry semantics, and a receiver contract | Broadening into webhook infrastructure too early would create a bigger API promise than this repo currently needs |

## Recommendation

The first bounded public-safe slice should be a synthetic freshness proposal built around `moment` polling, not a live webhook adapter.

That recommendation is based on four facts:

1. The toolkit already has an established authenticated read pattern and does not yet expose inbound network receiver infrastructure.
2. `/api/moment` gives a purpose-built "what is active now?" snapshot, which maps directly to freshness scenarios without requiring raw calendar ledgers.
3. The documented webhook enum currently appears limited to scheduling-link meeting events, which is too narrow to justify a generalized freshness module.
4. A synthetic snapshot evaluator can be tested entirely with local fixtures and public-safe timestamps.

## Synthetic Freshness Scenarios

The example fixture at [examples/freshness-scenarios.example.json](../examples/freshness-scenarios.example.json) records the recommended proof cases:

- stable snapshot with unchanged primary event should classify as a no-op
- primary-event transition should classify as a freshness advance
- overlap changes should preserve one primary event and record secondary-event churn
- event-detail polling can enrich a moment transition without becoming the primary freshness source
- webhook deliveries should be treated as optional secondary evidence and ignored when they arrive out of order relative to a newer snapshot

Those scenarios keep examples synthetic while still proving the ordering and freshness rules a future implementation would need.

## Proposed Public Shape

If the toolkit graduates this spike into code, start with a read-only normalized freshness envelope:

```ts
type FreshnessSignalSource = "moment_poll" | "event_snapshot" | "webhook_history";

interface ReclaimFreshnessSignal {
  source: FreshnessSignalSource;
  observedAt: string;
  effectiveAt: string;
  kind: "no_change" | "primary_changed" | "overlap_changed" | "detail_enriched" | "cancelled" | "out_of_order";
  subjectKey: string;
  summary: string;
}
```

This stays intentionally smaller than any future raw event or webhook payload surface. A first implementation should emit this normalized shape from synthetic fixtures before any live polling helper or webhook tooling is considered.

## Explicit Deferrals

Do not add the following in the first freshness slice:

- an inbound webhook receiver
- secret generation or storage helpers
- retry daemons or long-running processes
- real account-backed freshness fixtures
- public docs that imply all Reclaim event types are available through webhooks

Those items are valid future review points, but they are larger than the current evidence supports.

## Recommended Next Slice

The next coherent bounded increment should be a read-only synthetic evaluator that accepts two `moment` snapshots plus optional event-detail lookups and emits normalized freshness classifications.

The value is that the repo would gain a testable freshness contract without committing to webhook infrastructure. The downside of waiting is low, but delaying too long keeps future event work framed as a vague webhook question instead of a bounded read-model decision.
