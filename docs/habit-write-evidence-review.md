# Habit Write Evidence Review

This document records the current public-safe evidence review for Habit writes. It is a proposal artifact, not an API commitment or release plan.

## Outcome

Keep Habit helpers preview-only for now.

The current repo should no longer describe Habit API support as undocumented. The published Reclaim OpenAPI document includes Habit paths, but the repo still needs a safe generated-contract workflow and a bounded write-integration slice before adding confirmed Habit writes.

## What Was Checked

- The existing public toolkit preview shape in [Habit inputs](habits.md).
- The current write-expansion gates in [write expansion routing](write-expansion-routing.md) and [safe write expansion: first proof](write-expansion-first-proof.md).
- Public Reclaim product/help documentation for Habits:
  - [Overview: How to use Reclaim Habits to get time for your routines](https://help.reclaim.ai/en/articles/4129152-habits-overview)
  - [Time Defense settings for Habits](https://help.reclaim.ai/en/articles/4129290-time-defense-settings-for-habits)
  - [Disabling, snoozing or deleting Habits from Reclaim](https://help.reclaim.ai/en/articles/4196133-disabling-snoozing-or-deleting-habits-from-reclaim)
- Published Reclaim OpenAPI document:
  - `https://api.app.reclaim.ai/swagger/reclaim-api-0.1.yml`
  - Habit paths visible there include `/api/assist/habits/daily`, `/api/assist/habits/daily/{id}`, and `/api/smart-habits`
- Local OpenAPI generation workflow:
  - [OpenAPI client generation](openapi-client-generation.md)
- Public ecosystem references already tracked in [related work](related-work.md).

## Evidence Assessment

The public Reclaim Habit documentation clearly shows that Habits exist as a product surface. The published OpenAPI document goes further and provides API-shape evidence for Habit-related endpoints.

What is still missing for a safe public toolkit write surface:

- a generated, repo-local contract source future agents can start from instead of writing ad hoc client shapes
- a bounded mapping review for which generated Habit request fields belong in the public toolkit input surface
- response/receipt semantics chosen for this repo's write-audit contract
- synthetic success and refusal fixtures covering the planned Habit write flow

The related-work references remain useful for comparison and research, but they are no longer the strongest contract surface. The published OpenAPI file should be treated as the first contract source, with the local generation workflow handling its currently broken analytics refs.

## Preview Shape Status

The current Habit preview helper remains useful because its input is self-contained and public-safe:

- `title`
- `notes`
- `durationMinutes`
- `eventCategory`
- `cadence`
- `daysOfWeek`
- `windowStart`
- `windowEnd`
- `startDate`
- `endDate`
- `alwaysPrivate`

However, the toolkit should keep treating that shape as a local preview contract until there is direct evidence that a public Habit write endpoint accepts the same fields, or a clearly documented translation layer can be justified without hidden account-specific assumptions.

## Decision

Do not add `reclaim:habits:create`, Habit write receipts, or Habit write fixtures in this slice.

Keep Habit helpers preview-only and treat any future Habit write work as blocked on one bounded integration slice that starts from the generated OpenAPI contract rather than from a hand-written client.

## Recommended Next Slice

If future work revisits Habit writes, the next bounded step should be a source-backed API evidence review that can answer all of the following without relying on private account traffic:

1. Which generated Habit request/response shapes from the sanitized OpenAPI contract map cleanly onto the current preview helper?
2. Which generated fields should stay out of the public toolkit because they depend on account-specific, planner-specific, or unsafe assumptions?
3. What identifier and response fields should become write receipts for this repo?
4. Which synthetic fixtures are required before a confirmed Habit write command is safe to add?

Until that review can be completed cleanly, the lowest-risk public path is to improve preview docs and fixtures only.
