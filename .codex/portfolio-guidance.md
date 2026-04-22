<!-- [MANAGED_BY_PORTFOLIO_GUIDANCE_SYNC] -->

# Portfolio Guidance

This file is a self-contained shared standard for agents working directly in this repo. Keep repo-specific additions in the local block so sync can refresh the managed guidance safely.

## Coding Standard

- Prefer named exports and type-only imports.
- Keep files small, explicit, and easy to grep.
- Before non-trivial TypeScript edits, run `pnpm check:agent-surface:preedit -- <candidate files>` when available.
- Run the narrowest repo-local validation command before stopping, usually `pnpm verify:session` when present.

## Catalog-Managed Rules

- Promote repeated workflows into reusable skills, scripts, or local automation; promote repeated mistakes or ambiguity into evals or the appropriate durable guidance surface.
- Treat recoverable venture, creative, quality-of-life, public, distribution, tool, or small ad tests as normal work when a scoped autonomy envelope records the cap, stop condition, measurement, and readout. Stop for life-changing or hard-to-recover downside.
- Keep files small and single-purpose. Prefer explicit data shapes, boundary-local normalization, narrow helpers, and focused tests. If a touched file is already structurally busy, extract a clearer seam before adding feature weight.
- Prefer repo-local current state, generated status, or live tool output before older notes or historical ledgers when deciding what is true now.
- Prefer explicit fields, frontmatter, typed records, YAML/JSON blocks, and schema-backed artifacts over parsing free-form prose to infer workflow state. If the needed signal is missing, fix the writer or add the structured field instead of extending regex or keyword heuristics.
- Record unresolved design questions, repeated confusion, token waste, compatibility ambiguity, or follow-up work in the repo's canonical tracker, decision log, evals, or outcome artifact instead of leaving it only in chat.
- At the close of non-trivial work, note concrete efficiency waste when present and fix the root cause in the cheapest safe way, such as a clearer seam, smaller file, focused script, skill, or eval.
- Stop and surface the blocker when work crosses trust boundaries, requires real-world or external effects, changes authority assumptions, has conflicting goals, or remains low-confidence after limited retries.
- When a coherent increment lands, commit and push it after validation passes. Stage only task-owned files unless the task intentionally overlaps already-dirty files.
- Work on this repo's current default/shared branch unless local instructions explicitly request another flow; do not create branches, worktrees, or PR-only flows for routine work.
- Treat dirty or untracked files outside the current task as active parallel work; do not delete, revert, format, normalize, or stage them unless explicitly authorized.
- Record durable decisions only for changes to architecture, authority boundaries, trust boundaries, or repo-wide operating conventions. Keep routine implementation rationale in code, tests, issues, or the local canonical artifact.
- For repo-internal generated artifacts primarily consumed by agents, prefer sparse structured retrieval over human-oriented narrative, keep stable headings used by tooling, and omit empty or non-material sections.
- Before adding reusable tooling, shared helpers, workflow automation, connector clients, parser/renderers, supply-chain tooling, context packaging, or package-like code, check maintained third-party options or record why the work is one-off or local ownership is cheaper.
- Run the narrowest repo-local verification command that defends the change. If verification cannot pass because of unrelated dirty state, existing failures, or missing external access, record the exact command and blocker.

<!-- [LOCAL_START] -->

<!-- [LOCAL_END] -->
