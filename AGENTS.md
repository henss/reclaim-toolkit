# AGENTS.md

Repo-local agent entrypoint for `reclaim-toolkit`.

## What this repo is

A TypeScript SDK and CLI for safe automation against Reclaim.ai, built around a preview → apply pattern with explicit write guards, safety classification, and duplicate detection.

## Working in this repo

- Read this file and the README before non-trivial work; prefer repo-local conventions and verification commands over generic assumptions.
- Treat external writes as consequential: preview before apply and require explicit confirmation for confirmed writes.
- Run the narrowest repo-local lint/typecheck/test command before stopping.
- Commit and push a coherent increment once it passes verification; stage only task-owned files.
