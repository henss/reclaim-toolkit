# Sanitized Fixture Recording

The fixture recorder prototype turns a synthetic raw Reclaim interaction log into a public-safe replay artifact. It is intentionally library-only for now: the goal is to prove the scrub rules, fixture shape, and leak checks without adding a live account recorder or another CLI surface.

## What It Records

The input shape is a synthetic JSON object with:

- a `fixture` marker set to `reclaim-recorded-interaction-fixture`
- an optional `capturedAt`
- one or more `interactions` containing a request summary and response payload

The committed example lives at `examples/reclaim-fixture-recording.example.json`. It intentionally contains placeholder ids, titles, notes, and an email so the scrubber can prove that those values do not survive into the sanitized output.

## What The Scrubber Preserves

The scrubber keeps only the structure that is useful for fixture-backed tests:

- request method
- route template and query parameter names
- status codes
- booleans and numbers
- ISO-like dates, `HH:mm` times, and IANA timezone names

It redacts authorization headers, ids, emails, titles, notes, and generic free text. Query parameter values are dropped entirely.

## TypeScript Usage

```ts
import { scrubReclaimFixtureRecording, assertReclaimFixturePrivacy } from "reclaim-toolkit";

const scrubbed = scrubReclaimFixtureRecording(rawRecording);
assertReclaimFixturePrivacy(scrubbed);
```

The resulting object includes:

- `interactions`: sanitized request and response summaries
- `redactionPolicy.counters`: counts for redacted ids, emails, paths, secrets, and text
- `leakCheck`: a built-in post-scrub inspection that fails if the sanitized artifact still looks private

## Public Boundary

Keep the raw recording synthetic and small enough to audit in one pass. Do not copy live Reclaim traffic, private scheduling ledgers, household details, health-support policy, Calendar fallback rules, or operator-specific policy into this fixture format. If a future private repo needs live recording, it should bridge to a private capture path there and only move the sanitized artifact across the public boundary.
