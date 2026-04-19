# Domain Execution Outcome: Define an agent-safe JSON CLI profile

## Summary

Output classification: artifact.

Defined the public agent-safe JSON CLI profile for OPS-1195 and defended it with narrow CLI tests. The profile documents npm-first `--silent` usage, stdout/stderr parsing rules, exit-code behavior, safety classes, confirmation flags, write receipts, and synthetic-example boundaries.

## What changed

- Added `docs/cli-json-profile.md` with the machine-facing CLI contract.
- Linked the profile from `README.md`.
- Added Vitest coverage that verifies `npm run --silent reclaim:tasks:preview-create` emits parseable JSON on stdout for success and emits a stderr diagnostic with no JSON stdout for failure.

## Why it mattered

Agents now have a public-safe contract for parsing CLI output without relying on private operating context or undocumented stream behavior. The profile keeps live writes behind existing explicit confirmation flags and avoids broader package publication, release automation, license, or public-positioning changes.

## Structured Outcome Data

- Output classification: artifact
- Tracker source: Linear issue OPS-1195
- Scout check: not applicable; this was a one-off docs and test change with no reusable tooling, dependency, adapter, workflow automation, or package-like infrastructure added.
- Validation:
  - `npm run typecheck`: passed
  - `npm run build`: passed
  - `npm test`: passed
- Verification note: npm printed environment-config warnings during top-level commands, but all packet-required commands exited successfully.

## Continuation Decision

Action: complete

The bounded slice is complete. A future review can decide whether to formalize the JSON result shapes as generated schemas, but that would be a broader API-commitment review point and was intentionally not included here.

## Session Efficiency

The main waste signal was one initial failing test pass caused by Windows child-process handling for npm scripts; it was repaired in the scoped test helper. No durable workflow cleanup was warranted beyond capturing the npm `--silent` parsing rule in the new profile.
