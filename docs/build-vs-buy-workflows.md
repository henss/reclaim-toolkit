# Build Vs Buy For Reclaim Toolkit Workflows

This document is a proposal artifact for OPS-1742. It compares the current public-safe workflow surfaces in `reclaim-toolkit` against existing external options and recommends where this repo should keep building, where it should adopt an external path, and where it should explicitly not advance a public workflow.

The goal is not to create a standalone product roadmap for this repo. The goal is to keep `reclaim-toolkit` useful as thin support infrastructure for higher-priority Stefan-owned tools and initiatives.

## Decision Summary

| Workflow candidate | Current toolkit surface | Strongest external buy/adopt path | Recommendation |
| --- | --- | --- | --- |
| Upstream task intake into Reclaim-ready task payloads | Synthetic starter packs plus `reclaim:tasks:preview-create` and duplicate preflight | Reclaim native task integrations for Todoist, Asana, ClickUp, Linear, Jira, and Google Tasks; Zapier for broader app coverage; n8n node for self-hosted automation | Buy for live ingestion, keep this repo thin for transform-proof and preview |
| Scheduling what-if analysis and recurring meeting triage | `reclaim:meetings:preview-availability`, `reclaim:meetings:preview-recurring-reschedule`, `reclaim:meetings-hours:preview-inspect`, `reclaim:meetings-hours:inspect` | Reclaim product-native scheduling surfaces plus external agent/automation tools such as MCP servers when a private operator chooses to accept that risk | Drop public live-scheduling expansion from this repo for now; keep preview/read-only only |
| Support triage, config health, and redacted incident replay | `reclaim:onboarding`, `reclaim:config:status`, `reclaim:health`, `reclaim:support:bundle` | No strong buy fit; external CLIs and automation tools are not opinionated about this repo's redaction and replay contract | Keep building locally in this repo |
| Typed API contract evidence for thin TypeScript helpers | Generated OpenAPI client path plus narrow repo-owned helpers | Unofficial SDKs and CLIs can inform field discovery, but they should not become the primary public contract | Keep building thin adapters here; do not expand into a broad cross-language SDK strategy |

## Comparison

### 1. Upstream Task Intake

The repo already has the right public-safe boundary for this workflow. [`docs/integration-starter-packs.md`](integration-starter-packs.md) keeps upstream systems outside the repo and treats the toolkit as the transform-proof and preview layer. That matches the current task surface well because the committed examples already normalize into one task-input contract and the preview flow exposes duplicate preflight without touching a live account.

For real ingestion, external options are already stronger than anything this repo should build next. Reclaim documents native integrations for Todoist, Asana, ClickUp, Linear, Jira, and Google Tasks, and it documents Zapier for broader app coverage. The n8n community node adds another route for self-hosted workflow automation, but it introduces node-installation and runtime-management overhead that is not justified for the public toolkit's default path.

Recommendation: buy for live ingestion, keep this repo thin for public-safe transform review. Do not add first-party Todoist, Linear, GitHub, or Jira connector clients here unless a named workflow gap remains after native integrations or Zapier are proven insufficient.

### 2. Scheduling What-If Analysis

The repo's current scheduling stance is already conservative and correct. [`docs/scheduling-surface-first-proof.md`](scheduling-surface-first-proof.md) keeps scheduling helpers preview-only or read-only because public-safe evidence for live schedule mutation is not strong enough. That keeps the repo away from private fallback logic, personal schedule interpretation, and harder rollback semantics.

External alternatives exist, but they reinforce the same conclusion rather than weakening it. Reclaim already ships product-native scheduling features across Scheduling Links, Smart Meetings, Calendar Sync, Slack, and the Raycast extension. Unofficial agent-facing tools such as `reclaim-mcp-server` expose a much broader live surface, including calendar, task, habit, focus-time, and analytics operations, but that is precisely the kind of private-operator choice that should stay outside this public toolkit.

Recommendation: drop public live-scheduling expansion from the repo backlog for now. Keep only preview and read-only scheduling helpers here. When a real private workflow needs broader automation, route that decision through the owning private repo or operator environment instead of widening `reclaim-toolkit`.

### 3. Support Triage And Incident Replay

This is the area where local ownership is clearly better than buying. [`docs/support-bundles.md`](support-bundles.md) describes a redacted replay format that is specific to this repo's synthetic-preview commands, config probes, and public-boundary rules. Generic Reclaim CLIs and automation servers can execute account operations, but they do not provide the repo-specific incident artifact, structural replay contract, or redaction guarantees this toolkit already has.

That makes support tooling a good fit for continued local ownership as long as it remains narrow. The repo can keep improving bundle shape, replay fixtures, and config-health summaries without taking on broader public scheduling or account-management commitments.

Recommendation: keep building locally in the toolkit. This is support infrastructure, not a candidate for external replacement.

### 4. Typed API Contract Evidence

The repo already has a narrow OpenAPI-backed TypeScript path and should keep it that way. [`docs/openapi-client-generation.md`](openapi-client-generation.md) makes the public contract auditable and keeps the generated client subordinate to repo-owned helpers. That is a better fit for a TypeScript toolkit than adopting an unofficial external SDK as the main contract surface.

External SDKs and CLIs remain useful as comparison inputs. The current Python `reclaim-sdk` is still task-focused and explicitly warns that it is unofficial and reverse-engineered. The newer Python `reclaim-cli` exposes a broader task-centric command surface, including task creation, completion, work logging, and event listing, but it is still a Python-first user tool rather than a TypeScript contract source for this repo.

Recommendation: keep building thin adapters here. Use external SDKs and CLIs as comparison evidence only, not as the core dependency or product direction.

## Workflow Ranking

| Rank | Workflow | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Support triage and redacted replay | Keep building | High fit with repo-specific safety rules and low public-boundary risk |
| 2 | Typed API contract evidence | Keep building thin | Supports the existing TypeScript toolkit mission without expanding scope |
| 3 | Upstream task intake | Buy for live flows, keep thin preview locally | Strong native and automation options already exist outside the repo |
| 4 | Live scheduling expansion | Drop from this repo for now | Highest privacy, rollback, and public-boundary risk with the weakest need for a public toolkit path |

## Practical Follow-Through

The next useful bounded step is not a new connector or automation package. It is to keep the repo documentation and examples aligned with this split:

- keep support, preview, and contract-evidence surfaces in `reclaim-toolkit`
- prefer Reclaim native integrations or Zapier for live upstream task ingestion
- leave broader scheduling mutation and account-specific automation outside this public repo

If a future workflow proposal reopens one of the buy-or-drop areas, it should arrive with a named workflow, the exact gap in existing native or external options, and a public-safe reason that the repo must own that surface itself.

## Sources

- Internal: [integration starter packs](integration-starter-packs.md), [scheduling surface expansion: first proof](scheduling-surface-first-proof.md), [support bundles](support-bundles.md), [openapi client generation](openapi-client-generation.md), [related work](related-work.md)
- Reclaim Help Center: [task integrations overview](https://help.reclaim.ai/en/), [connect Reclaim on Zapier](https://help.reclaim.ai/en/articles/13620524-connect-reclaim-on-zapier), [Linear integration overview](https://help.reclaim.ai/en/articles/5705608-linear-integration-overview), [Raycast extension overview](https://help.reclaim.ai/en/articles/8136585-overview-raycast-extension-for-reclaim-ai)
- n8n: [install and manage community nodes](https://docs.n8n.io/integrations/community-nodes/installation/), [verified community node requirements](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/)
- Unofficial ecosystem references: [n8n-nodes-reclaim-ai](https://github.com/labiso-gmbh/n8n-nodes-reclaim-ai), [reclaim-mcp-server](https://pypi.org/project/reclaim-mcp-server/), [reclaim-sdk](https://github.com/llabusch93/reclaim-sdk), [reclaim-cli](https://pypi.org/project/reclaim-cli/)
