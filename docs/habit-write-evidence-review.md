# Habit Write Evidence Review

This document records the current public-safe evidence review for Habit writes. It is a proposal artifact, not an API commitment or release plan.

## Outcome

Keep Habit helpers preview-only for now.

The current public evidence is not clean enough to justify a confirmed Habit write command in this toolkit.

## What Was Checked

- The existing public toolkit preview shape in [Habit inputs](habits.md).
- The current write-expansion gates in [write expansion routing](write-expansion-routing.md) and [safe write expansion: first proof](write-expansion-first-proof.md).
- Public Reclaim product/help documentation for Habits:
  - [Overview: How to use Reclaim Habits to get time for your routines](https://help.reclaim.ai/en/articles/4129152-habits-overview)
  - [Time Defense settings for Habits](https://help.reclaim.ai/en/articles/4129290-time-defense-settings-for-habits)
  - [Disabling, snoozing or deleting Habits from Reclaim](https://help.reclaim.ai/en/articles/4196133-disabling-snoozing-or-deleting-habits-from-reclaim)
- Public ecosystem references already tracked in [related work](related-work.md).

## Evidence Assessment

The public Reclaim Habit documentation clearly shows that Habits exist as a product surface and that users can create, edit, snooze, disable, and delete them in the app. That is product evidence, not API-shape evidence.

What is still missing for a safe public toolkit write surface:

- a public Habit create endpoint reference
- request-field documentation for that endpoint
- response-shape documentation with a stable identifier suitable for write receipts
- enough identifier and update semantics to support follow-on write operations safely

The related-work references are useful for comparison and research, but they do not meet the clean-evidence bar for this repo's public write expansion policy. They are independent projects, some appear to rely on unofficial or reverse-engineered behavior, and they are not sufficient on their own to justify a broader API commitment here.

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

Keep Habit helpers preview-only and treat any future Habit write work as blocked on direct API-shape evidence.

## Recommended Next Slice

If future work revisits Habit writes, the next bounded step should be a source-backed API evidence review that can answer all of the following without relying on private account traffic:

1. What is the documented Habit create endpoint?
2. What are the exact request fields and validation rules?
3. What identifier and response fields are available for receipts and follow-on operations?
4. Which current preview fields map through unchanged, and which ones should stay outside the public toolkit?

Until that review can be completed cleanly, the lowest-risk public path is to improve preview docs and fixtures only.
