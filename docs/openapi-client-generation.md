# OpenAPI Client Generation

The published Reclaim OpenAPI document is available at:

- `https://api.app.reclaim.ai/swagger/reclaim-api-0.1.yml`

That spec includes the current paths this repo already relies on for tasks, time schemes, meetings, and current-user reads, plus Habit endpoints such as:

- `/api/tasks`
- `/api/tasks/{id}`
- `/api/timeschemes`
- `/api/users/current`
- `/api/assist/habits/daily`
- `/api/smart-habits`

## Why This Repo Uses A Sanitizing Step

The published spec currently contains unresolved component references in analytics-related schemas. Maintained generators fail on the raw file because names such as `AbstractMetric_10` are referenced but not defined.

This repo does not hand-maintain a replacement schema. Instead it uses a thin local prep step that:

1. fetches the published spec,
2. detects missing `#/components/schemas/*` references,
3. injects placeholder object schemas only for those missing names,
4. writes both the raw and sanitized specs under `generated/reclaim-openapi/`.

The placeholders exist only to keep generation usable for the documented task, habit, meeting, timescheme, and current-user paths while the upstream analytics refs remain broken.

The generated declaration file at `generated/reclaim-openapi/reclaim-openapi.d.ts` is intentionally tracked so the repo can expose a typed OpenAPI client without requiring a network fetch during ordinary installs or builds.

## Commands

Prepare the raw and sanitized specs:

```bash
npm run reclaim:openapi:prepare-spec
```

Generate OpenAPI TypeScript paths from the sanitized spec:

```bash
npm run reclaim:openapi:generate
```

Emit a public-safe capability matrix for shipped and roadmap surfaces:

```bash
npm run reclaim:openapi:capability-matrix
```

Or point the matrix command at a local spec file when reviewing generated artifacts:

```bash
npm run reclaim:openapi:capability-matrix -- --input generated/reclaim-openapi/reclaim-api-0.1.raw.yml
```

Generated artifacts are written under:

- `generated/reclaim-openapi/reclaim-api-0.1.raw.yml`
- `generated/reclaim-openapi/reclaim-api-0.1.sanitized.yml`
- `generated/reclaim-openapi/sanitize-report.json`
- `generated/reclaim-openapi/reclaim-openapi.d.ts`

Only `generated/reclaim-openapi/reclaim-openapi.d.ts` is tracked. The raw spec, sanitized spec, and sanitize report stay untracked. Treat the tracked declaration file as generated contract output, not as a hand-edited source file.

## Guidance For Future Agents

- Use `reclaim:openapi:capability-matrix` before proposing a new public surface bet. It reports which roadmap candidates already have documented operations, which are only partially documented, which still lack contract evidence, and a ranked `nextSurfaceReport` that keeps the next bet focused on new public surface families rather than repo-internal task-helper expansion.
- Start new endpoint work from the sanitized OpenAPI generation path instead of writing another bespoke client surface by hand.
- Start from `createReclaimOpenApiClient` when you need a typed endpoint call instead of rebuilding request plumbing or hand-authoring another full client library.
- Use the generated `paths` types with a thin client such as `openapi-fetch`, or wrap them in a narrow repo-owned adapter for boundary-local naming, auth defaults, receipts, and safety checks.
- If generation fails again, inspect `sanitize-report.json` first and only widen the sanitizer enough to account for newly missing component refs.
