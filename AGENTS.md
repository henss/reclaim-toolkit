<!-- [MANAGED_BY_PORTFOLIO_GUIDANCE_SYNC] -->

# AGENTS.md

This file is the repo-local agent entrypoint. It is generated from the shared portfolio guidance standard, with repo-specific instructions preserved in the local block below.

## Required Agent Behavior

- Before non-trivial implementation, read this file; open `.codex/portfolio-guidance.md` only when this file or the local task points you to the detailed shared rules.
- Prefer repo-local conventions and verification commands over generic assumptions.
- Before non-trivial TypeScript edits, run `pnpm check:agent-surface:preedit -- <candidate files>` when that script exists.
- Prefer named exports and type-only imports, and run the narrowest repo-local lint/typecheck/test command before stopping.
- Promote repeated workflows into reusable skills, scripts, or local automation; promote repeated mistakes or ambiguity into evals or the appropriate durable guidance surface.
- Default to high agency inside recoverable bounds; let agents make useful private decisions and advance planning, tooling, creative, venture, or quality-of-life work when downside is capped and recoverable. Public, paid, distribution, or publishing work needs a recorded approved envelope or first-time approval. Stop for hard-to-recover legal, financial, reputation, security, client/company, credential, irreversible, or safety risk.
- Keep TypeScript files small and single-purpose, expose only deliberate feature/package APIs, put new multi-file CLI-backed features in feature-owned packages with ./cli exports and no package "." API unless non-CLI consumers need it, validate external boundaries with schemas or generated types, exclude generated API output from source-size budgets, inject IO/time/randomness seams, keep high-signal tests near code, and avoid broad barrels, ambient globals, dynamic import magic, shared mutable state, grab-bag utils, hidden build magic, and mock-heavy tests.
- Before non-trivial code edits, use this repo's agent-surface or size guard when present; if a touched file is near-limit or structurally busy, extract a focused seam before adding feature weight.
- Use simple, direct language. Write for the reader who must act on the text. Prefer concrete nouns and verbs such as issue, packet, command, file, refresh, review, approval, and blocker. Avoid internal metaphors or abstract labels when plain words carry the same meaning.
- When this repo exposes Agent Atlas surfaces or rollout guidance, use read-only Atlas MCP tools when configured; otherwise use repo-advertised Atlas scripts or CLI commands before broad or multi-seam search and use `docs/agents/atlas.md` as fallback orientation when tooling is unavailable or stale. After non-trivial work, record an `atlas usage-note` receipt when the CLI is available, including broad-search fallback and missing or misleading cards. Add or expand atlas metadata only when concrete work exposes repeated navigation waste or cross-repo context ambiguity; create a Linear issue for significant Atlas bugs, gaps, or feature requests instead of leaving them only in notes.
- Prefer repo-local current state, generated status, or live tool output before older notes or historical ledgers when deciding what is true now.
- When you prove repo text is outdated, redundant, misleading, or contradicted by current code or state, repair it in the same scoped task when safe. Prefer deleting obsolete TODOs, stale status notes, duplicate guidance, and wrong examples over adding caveats. Update canonical sources before generated copies, and record a blocker or follow-up when immediate cleanup is unsafe.
- Prefer explicit fields, frontmatter, typed records, YAML/JSON blocks, and schema-backed artifacts over parsing free-form prose to infer workflow state. If the needed field does not exist, add or repair the structured source instead of extending regex heuristics.
- Prefer structural fixes over patch stacks. If repeated exceptions, guards, or caveats exist only to compensate for a bad abstraction or stale authority source, remove or reshape that seam instead of adding one more workaround.
- Before broad searches or new reusable capability work, run this repo's capability route/export path when present; use it as a generated navigation index, then verify against the source registry, policy, runtime state, or code it points to.
- Record unresolved design questions, repeated confusion, token waste, compatibility ambiguity, or follow-up work in the repo's canonical tracker, decision log, evals, or outcome artifact instead of leaving it only in chat.
- Keep README as a short entrypoint. Put detailed feature, API, CLI, configuration, and architecture documentation under docs/, update the repo docs entrypoint when adding pages, and run repo-local docs lint when it exists.
- At the close of non-trivial work, note concrete efficiency waste when present and fix the root cause in the cheapest safe way, such as a clearer seam, smaller file, focused script, skill, or eval.
- Stop and surface the blocker when work crosses trust boundaries, requires real-world or external effects, changes authority assumptions, has conflicting goals, or remains low-confidence after limited retries.
- Use `agent-workloops` for long-running, multi-step, cross-package, or commit-per-increment agent implementation work when the repo has adopted it or the capability catalog routes to it. If the workflow is missing, stale, confusing, or inefficient, improve the owned `agent-workloops` repo when the fix is safe and generic, or record a concrete follow-up there.
- Before creating a local preview/no-op path for an external tool, check whether an owning portfolio repo already has an approved adapter or CLI. If it does and the packet is inside delegated bounds, bridge to that adapter and record readback instead of stopping conservatively.
- Before stopping on a human preference or approval choice, reduce decision load by preparing a small concrete option set, tradeoffs, and a recommended default when doing so is safe, reversible, and inside the current authority boundary.
- Do not treat a Reclaim due date or snooze/start-after as a guarantee that deadline-sensitive work will happen on time. For gifts, ordering/shipping windows, bookings, event-prep cutoffs, or purchase-candidate finalization, use an explicit private Calendar block that ends before the true completion deadline, or stop with a blocker if no safe slot exists.
- When a coherent increment lands, commit and push it after validation passes; stage only task-owned files unless the task intentionally overlaps already-dirty files.
- Work on this repo's current default/shared branch unless local instructions explicitly request another flow; do not create branches, worktrees, or PR-only flows for routine work.
- Treat dirty or untracked files outside the current task as active parallel work; do not delete, revert, format, normalize, or stage them unless explicitly authorized.
- Record durable decisions only for changes to architecture, authority boundaries, trust boundaries, or repo-wide operating conventions; keep routine implementation rationale in code, tests, issues, or the local canonical artifact.
- High health or recovery load is a priority and work-shaping signal. Prefer recovery-supporting, low-friction, deadline-protective, and stability work, but do not treat health load alone as a blocker or generic stop reason for bounded useful work.
- Capture significant new understanding in the cheapest canonical memory surface: policy, registry, outcome, lesson, eval, skill, current-state artifact, decision, or approved personal knowledge-base target. Do not leave important learning only in chat.
- For non-trivial work, state the plausible benefit path to Stefan or a recorded objective, check likely Stefan objections, and stop for protected outcomes, authority changes, public trust, money, safety, or cross-domain tradeoffs.
- Use existing repo commands, skills, Atlas surfaces, adapters, and approved tools before broad manual work. When repeated complexity or fragile execution appears, add the thinnest useful reusable tool after respecting build-vs-buy guidance.
- Artifact minimization means no redundant prose, not no learning capture. If no session handoff is needed, still record required Principle Check or equivalent closeout evidence and any operator-context learning, tooling lesson, or reusable workflow insight in the outcome, changed canonical artifact, policy, lesson, eval, skill, or approved knowledge-base target that owns it.
- For repo-internal generated artifacts primarily consumed by agents, prefer sparse structured retrieval over human-oriented narrative, keep stable headings used by tooling, and omit empty or non-material sections.
- For reusable tooling, automation, parser/renderers, integration glue, dependency tooling, or repeated workflow support, use Solution Scout when available; otherwise treat the best-of-breed registry as the first shared read path and then check the repo-local adoption overlay before building locally.
- Before adding non-trivial reusable tooling or package-like infrastructure, use the Solution Scout MCP when available; otherwise check maintained third-party options through repo/registry/package search. Record a portable scout receipt, or record why the work is one-off or local ownership is cheaper.
- In operational UIs and agent review surfaces, avoid adjacent duplicate labels, badges, metadata, or provenance that repeat the same concept. Keep visible text focused on attention, action boundaries, and distinct evidence.
- Run the narrowest repo-local verification command that defends the change before stopping, or record the exact command and blocker if verification cannot pass safely.

<!-- [LOCAL_START] -->

<!-- [LOCAL_END] -->

Managed by the portfolio guidance sync. Do not edit outside the local block.
