# Project Contract

`reclaim-toolkit` is a public TypeScript toolkit for cautious Reclaim.ai API work. It provides npm-first commands, typed helpers, synthetic fixtures, and public-safe documentation that help downstream tools preview, audit, and perform narrow Reclaim operations.

## Current Contract

- Keep setup conventional for a TypeScript package: `npm install`, `npm run ...` commands, no committed package-manager lockfile, and local config under `config/`.
- Prefer credential-free previews and synthetic examples before authenticated reads or confirmed writes.
- Treat task utilities as the mature live-write surface. Confirmed task writes require explicit confirmation flags and write receipts.
- Keep Habit, Focus, Buffer, meeting availability, recurring meeting reschedule, meetings, hours, and account-audit helpers preview-only or read-only unless a separate public review accepts a narrower write contract.
- Use the generated OpenAPI declaration and public Reclaim documentation as contract evidence before adding or widening helper APIs.
- Keep examples generic and synthetic. Do not commit account-specific ids, emails, task titles, policy titles, calendars, or private config.

## Agent Contract Sources

When an agent execution starts from a bounded runtime launch packet, that packet can be the authoritative task-detail surface for the active session even when no older project contract artifact exists in a private ledger. Treat the packet as the source for scope, deliverables, boundaries, and continuation rules, then verify any repo-local command or file path against this repository before acting on it.

Do not copy private launch-packet paths, tracker internals, operator-specific policy, account data, scheduling ledgers, or approval reasoning into this public repo. If the packet points to a public-safe repo change, record only the generic convention or artifact that future users of the toolkit need.

## What This Repo Is Not

This repo is not a standalone scheduling product, a private operations ledger, or a broad automation runtime. It should stay thin support infrastructure for downstream tools that need public-safe Reclaim previews, summaries, fixtures, and typed helper seams.

The public docs and examples should not encode private scheduling policies, household workflows, health-support rules, Calendar fallback behavior, account-specific routines, or operator-specific planning assumptions.

## Review Points

Stop for explicit review before:

- package publication, release automation, license changes, repository moves, or new distribution commitments
- new live-write surfaces beyond tasks
- broader public API commitments or new package export paths
- connector clients, parser frameworks, workflow automation, or other reusable infrastructure that would make this package the owner of a larger integration surface
- examples or defaults that require private account, task, calendar, household, health, or personal planning details to explain safely

## Useful Next Work

Prefer bounded increments that strengthen the existing contract:

- improve synthetic fixtures and preview receipts
- tighten redaction and support-bundle replay behavior
- compare candidate helper surfaces against the generated OpenAPI contract
- document public-safe review gates before implementing live writes

Avoid adding standalone backlog commitments here. A future workflow should name the exact gap, the public evidence for owning it in this repo, and the smallest reviewable surface that keeps private operator policy outside the package.
