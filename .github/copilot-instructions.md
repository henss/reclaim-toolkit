<!-- [MANAGED_BY_PORTFOLIO_GUIDANCE_SYNC] -->

# GitHub Copilot Instructions

- Follow this repo's checked-in guidance and conventions. These instructions are intentionally self-contained for direct repo-started agents.
- Start with `AGENTS.md`; open `.codex/portfolio-guidance.md` only when you need the detailed shared rules.
- Prefer named exports, type-only imports, small files, and repo-local verification before completion.
- Do not suppress useful agent judgment or bounded experiments solely because they may fail; use caps, stop conditions, and audit trails to keep recoverable risks manageable.
- Keep TypeScript modules small, explicit, and testable; put new multi-file CLI-backed features in feature-owned packages with ./cli exports and no package "." API unless non-CLI consumers need it; exclude generated API output from source-size budgets, and avoid broad barrels, ambient globals, dynamic import magic, shared mutable state, grab-bag utils, hidden build magic, and tests that only prove mocks.
- Keep generated or agent-created code small, typed, and easy to verify; split busy files before adding more feature weight.
- Use simple, direct language in UI text, docs, comments, and names. Prefer concrete terms over internal metaphors, and keep only the detail the reader needs to understand or act.
- Use Agent Atlas MCP, repo scripts, or CLI surfaces before broad search when present, record Atlas usage evidence for non-trivial work when the CLI or receipt path is available, and only expand atlas metadata for concrete repo navigation needs.
- Prefer repo-local current state, generated status, or live tool output before older notes when deciding what is true now.
- When current code or state proves repo text is stale or misleading, clean up the obsolete TODO, status note, example, or duplicate guidance in the same scoped task when safe; update the canonical source before generated copies.
- Prefer explicit fields and schema-backed records over regex or keyword parsing of prose when inferring workflow state; add the structured field instead of growing heuristics.
- Prefer structural fixes over local workaround stacks. If an internal abstraction is wrong, rename, remove, or reshape it instead of layering more exceptions around it.
- Before broad searches or new reusable capability work, use the repo capability route/export path when present, then verify against the source artifacts it points to.
- Keep README short; put detailed docs under docs/ and run the repo docs lint when documentation changes.
- Use `agent-workloops` for long-running or multi-increment agent work when adopted; feed generic workflow gaps back into the owned `agent-workloops` repo.
- Reuse approved owning-repo adapters for external tools before adding local placeholders; keep the owner repo as the execution boundary and record readback.
- Do not hand off a preference blocker empty-handed; propose safe concrete options and a recommended default before escalating.
- Reclaim task due dates are reminders, not protected execution time; deadline-sensitive personal planning needs a Calendar block before the real cutoff or a blocker.
- Work on this repo's current default/shared branch unless local instructions explicitly request another flow; do not create branches or worktrees for routine work.
- Preserve unrelated dirty or untracked files; do not delete, revert, format, normalize, or stage work outside the current task.
- For standard reusable problems, use Solution Scout when available; otherwise consult the shared best-of-breed registry and repo-local adoption status before adding new local infrastructure.
- Prefer maintained third-party tools over new reusable local infrastructure when they fit this repo's trust, license, and integration boundary; use Solution Scout when available and otherwise record equivalent package/repo search evidence.
- Keep operational UI surfaces low-noise: avoid adjacent labels, badges, metadata, or provenance lines that repeat the same concept.

<!-- [LOCAL_START] -->

<!-- [LOCAL_END] -->
