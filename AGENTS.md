<!-- [MANAGED_BY_PORTFOLIO_GUIDANCE_SYNC] -->

# AGENTS.md

This file is the repo-local agent entrypoint. It is generated from the shared portfolio guidance standard, with repo-specific instructions preserved in the local block below.

## Required Agent Behavior

- Before non-trivial implementation, read this file and `.codex/portfolio-guidance.md`.
- Prefer repo-local conventions and verification commands over generic assumptions.
- Before non-trivial TypeScript edits, run `pnpm check:agent-surface:preedit -- <candidate files>` when that script exists.
- Prefer named exports and type-only imports, and run repo-local lint/typecheck/test or `pnpm verify:session` before stopping.
- Promote repeated workflows into reusable skills, scripts, or local automation; promote repeated mistakes or ambiguity into evals or the appropriate durable guidance surface.
- Use scoped autonomy envelopes to let bounded public, paid, creative, venture, tool, distribution, or ad experiments proceed when downside is capped and recoverable; stop for hard-to-recover legal, financial, reputation, security, client/company, credential, or safety risk.
- Keep TypeScript files small and single-purpose, expose clear feature/package APIs, validate external boundaries with schemas or generated types, exclude generated API output from source-size budgets, inject IO/time/randomness seams, keep high-signal tests near code, and avoid broad barrels, ambient globals, dynamic import magic, shared mutable state, grab-bag utils, hidden build magic, and mock-heavy tests.
- Before non-trivial code edits, use this repo's agent-surface or size guard when present; if a touched file is near-limit or structurally busy, extract a focused seam before adding feature weight.
- Prefer repo-local current state, generated status, or live tool output before older notes or historical ledgers when deciding what is true now.
- Prefer explicit fields, frontmatter, typed records, YAML/JSON blocks, and schema-backed artifacts over parsing free-form prose to infer workflow state. If the needed field does not exist, add or repair the structured source instead of extending regex heuristics.
- Prefer structural fixes over patch stacks. If repeated exceptions, guards, or caveats exist only to compensate for a bad abstraction or stale authority source, remove or reshape that seam instead of adding one more workaround.
- Before broad searches or new reusable capability work, run this repo's capability route/export path when present; use it as a generated navigation index, then verify against the source registry, policy, runtime state, or code it points to.
- Record unresolved design questions, repeated confusion, token waste, compatibility ambiguity, or follow-up work in the repo's canonical tracker, decision log, evals, or outcome artifact instead of leaving it only in chat.
- At the close of non-trivial work, note concrete efficiency waste when present and fix the root cause in the cheapest safe way, such as a clearer seam, smaller file, focused script, skill, or eval.
- Stop and surface the blocker when work crosses trust boundaries, requires real-world or external effects, changes authority assumptions, has conflicting goals, or remains low-confidence after limited retries.
- Before creating a local preview/no-op path for an external tool, check whether an owning portfolio repo already has an approved adapter or CLI. If it does and the packet is inside delegated bounds, bridge to that adapter and record readback instead of stopping conservatively.
- Before stopping on a human preference or approval choice, reduce decision load by preparing a small concrete option set, tradeoffs, and a recommended default when doing so is safe, reversible, and inside the current authority boundary.
- When a coherent increment lands, commit and push it after validation passes; stage only task-owned files unless the task intentionally overlaps already-dirty files.
- Work on this repo's current default/shared branch unless local instructions explicitly request another flow; do not create branches, worktrees, or PR-only flows for routine work.
- Treat dirty or untracked files outside the current task as active parallel work; do not delete, revert, format, normalize, or stage them unless explicitly authorized.
- Record durable decisions only for changes to architecture, authority boundaries, trust boundaries, or repo-wide operating conventions; keep routine implementation rationale in code, tests, issues, or the local canonical artifact.
- For repo-internal generated artifacts primarily consumed by agents, prefer sparse structured retrieval over human-oriented narrative, keep stable headings used by tooling, and omit empty or non-material sections.
- For reusable tooling, automation, parser/renderers, integration glue, dependency tooling, or repeated workflow support, treat the best-of-breed registry as the first shared read path and then check the repo-local adoption overlay before building locally.
- Before adding non-trivial reusable tooling or package-like infrastructure, check maintained third-party options that fit this repo's trust, license, and integration boundary, or record why the work is one-off or local ownership is cheaper.
- Run the narrowest repo-local verification command that defends the change before stopping, or record the exact command and blocker if verification cannot pass safely.

<!-- [LOCAL_START] -->

<!-- [LOCAL_END] -->

Managed by the portfolio guidance sync. Do not edit outside the local block.
