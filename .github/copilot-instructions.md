<!-- [MANAGED_BY_PORTFOLIO_GUIDANCE_SYNC] -->

# GitHub Copilot Instructions

- Follow this repo's checked-in guidance and conventions. These instructions are intentionally self-contained for direct repo-started agents.
- Read `AGENTS.md` and `.codex/portfolio-guidance.md` before implementation.
- Prefer named exports, type-only imports, small files, and repo-local verification before completion.
- Do not suppress bounded experiments solely because they may fail; use caps, stop conditions, and audit trails to keep recoverable risks manageable.
- Keep TypeScript modules small, explicit, and testable; exclude generated API output from source-size budgets, and avoid broad barrels, ambient globals, dynamic import magic, shared mutable state, grab-bag utils, hidden build magic, and tests that only prove mocks.
- Keep generated or agent-created code small, typed, and easy to verify; split busy files before adding more feature weight.
- Use Agent Atlas MCP or CLI surfaces before broad search when present, and only expand atlas metadata for concrete repo navigation needs.
- Prefer repo-local current state, generated status, or live tool output before older notes when deciding what is true now.
- Prefer explicit fields and schema-backed records over regex or keyword parsing of prose when inferring workflow state; add the structured field instead of growing heuristics.
- Prefer structural fixes over local workaround stacks. If an internal abstraction is wrong, rename, remove, or reshape it instead of layering more exceptions around it.
- Before broad searches or new reusable capability work, use the repo capability route/export path when present, then verify against the source artifacts it points to.
- Keep README short; put detailed docs under docs/ and run the repo docs lint when documentation changes.
- Reuse approved owning-repo adapters for external tools before adding local placeholders; keep the owner repo as the execution boundary and record readback.
- Do not hand off a preference blocker empty-handed; propose safe concrete options and a recommended default before escalating.
- Work on this repo's current default/shared branch unless local instructions explicitly request another flow; do not create branches or worktrees for routine work.
- Preserve unrelated dirty or untracked files; do not delete, revert, format, normalize, or stage work outside the current task.
- For standard reusable problems, consult the shared best-of-breed registry and repo-local adoption status before adding new local infrastructure.
- Prefer maintained third-party tools over new reusable local infrastructure when they fit this repo's trust, license, and integration boundary.

<!-- [LOCAL_START] -->

<!-- [LOCAL_END] -->
