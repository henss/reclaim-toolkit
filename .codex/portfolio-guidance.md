<!-- [MANAGED_BY_PORTFOLIO_GUIDANCE_SYNC] -->

# Portfolio Guidance

This file is a self-contained shared standard for agents working directly in this repo. Keep repo-specific additions in the local block so sync can refresh the managed guidance safely.

## Coding Standard

- Prefer named exports and type-only imports.
- Keep files small, explicit, and easy to grep.
- Before non-trivial TypeScript edits, run `pnpm check:agent-surface:preedit -- <candidate files>` when available.
- Run the narrowest repo-local validation command before stopping.

## Catalog-Managed Rules

- Promote repeated workflows into reusable skills, scripts, or local automation; promote repeated mistakes or ambiguity into evals or the appropriate durable guidance surface.
- Treat recoverable venture, creative, quality-of-life, public, distribution, tool, or small ad tests as normal work when a scoped autonomy envelope records the cap, stop condition, measurement, and readout. Stop for life-changing or hard-to-recover downside.
- Keep TypeScript files small and single-purpose. Expose clear feature/package APIs, validate external boundaries, exclude generated API output from source-size budgets while testing the adapter seam, inject IO/time/randomness seams, keep business logic out of large UI components, place high-signal tests near code, and avoid broad barrels, ambient globals, dynamic import magic, shared mutable state, grab-bag utils, hidden build magic, and mock-heavy tests.
- Keep files small and single-purpose. Prefer explicit data shapes, boundary-local normalization, narrow helpers, and focused tests. If a touched file is already structurally busy, extract a clearer seam before adding feature weight.
- When a repo exposes Agent Atlas surfaces, prefer read-only Atlas MCP tools when configured. If MCP is unavailable, run `atlas context-pack` for broad or multi-seam tasks and `atlas resolve-path` for file-specific tasks before broad repository search; read `docs/agents/atlas.md` as the fallback orientation surface. Do not create or expand atlas metadata speculatively; add it only when a concrete task, measured navigation waste, or cross-repo ambiguity demonstrates the need.
- Prefer repo-local current state, generated status, or live tool output before older notes or historical ledgers when deciding what is true now.
- Prefer explicit fields, frontmatter, typed records, YAML/JSON blocks, and schema-backed artifacts over parsing free-form prose to infer workflow state. If the needed signal is missing, fix the writer or add the structured field instead of extending regex or keyword heuristics.
- Prefer structural fixes over patch stacks. If repeated exceptions, guards, comments, or prompt caveats exist only to compensate for a bad abstraction or stale authority source, remove or reshape that seam instead of adding one more workaround. Keep compatibility only for known external consumers or staged migrations.
- Before broad searches, planning or ideation loops, or new reusable capability work, run `pnpm orch capability:route -- --goal "<task>" [--repo <id>] [--task-class <coding|planning|research|workflow>] [--boundary <...>]` or inspect `pnpm orch capability:catalog:export [--repo <id>] --json`. Treat `.runtime/current/agent-capability-catalog.json` as a generated navigation index, not the source of record. When commands, skills, solution registry records, project registry boundaries, ContextWeave pack surfaces, package entrypoints, agent-surface warnings, or waste-signal writers change, update the catalog source aggregation and add or extend route-quality regression tests before closing.
- Record unresolved design questions, repeated confusion, token waste, compatibility ambiguity, or follow-up work in the repo's canonical tracker, decision log, evals, or outcome artifact instead of leaving it only in chat.
- Keep README as a short entrypoint. Put detailed feature, API, CLI, configuration, and architecture documentation under docs/, update the docs entrypoint when adding pages, and run repo-local docs lint when available.
- At the close of non-trivial work, note concrete efficiency waste when present and fix the root cause in the cheapest safe way, such as a clearer seam, smaller file, focused script, skill, or eval.
- Stop and surface the blocker when work crosses trust boundaries, requires real-world or external effects, changes authority assumptions, has conflicting goals, or remains low-confidence after limited retries.
- Before adding a conservative local placeholder for Reclaim, Calendar, task, shopping, household, or other external-tool work, check the owning portfolio repo for an approved adapter/CLI and bridge to it when the request is already inside delegated bounds. Preserve the owner repo as the execution boundary, run its health/readback path, and record the receipt.
- Before classifying work as blocked on Stefan's preference, prepare the safest decision-ready option set you can: concrete options, tradeoffs, and a recommended default. Stop before credentials, spend, public writes, account changes, or live side effects, but do not stop merely because Stefan must choose among safe options.
- When a coherent increment lands, commit and push it after validation passes. Stage only task-owned files unless the task intentionally overlaps already-dirty files.
- Work on this repo's current default/shared branch unless local instructions explicitly request another flow; do not create branches, worktrees, or PR-only flows for routine work.
- Treat dirty or untracked files outside the current task as active parallel work; do not delete, revert, format, normalize, or stage them unless explicitly authorized.
- Record durable decisions only for changes to architecture, authority boundaries, trust boundaries, or repo-wide operating conventions. Keep routine implementation rationale in code, tests, issues, or the local canonical artifact.
- For repo-internal generated artifacts primarily consumed by agents, prefer sparse structured retrieval over human-oriented narrative, keep stable headings used by tooling, and omit empty or non-material sections.
- For reusable tooling, automation, shared helpers, parser/renderers, integration glue, dependency tooling, or repeated workflow support, first check `registry/solutions/` plus the repo adoption overlay. Record exceptions explicitly instead of silently bypassing the shared candidate path.
- Before adding reusable tooling, shared helpers, workflow automation, connector clients, parser/renderers, supply-chain tooling, context packaging, or package-like code, check maintained third-party options or record why the work is one-off or local ownership is cheaper.
- Run the narrowest repo-local verification command that defends the change. If verification cannot pass because of unrelated dirty state, existing failures, or missing external access, record the exact command and blocker.

<!-- [LOCAL_START] -->

<!-- [LOCAL_END] -->
