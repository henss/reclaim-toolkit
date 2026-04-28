# reclaim-toolkit Documentation

This directory contains the detailed guides behind the short project README. Start with the user task that matches what you are trying to do.

## Getting Started And CLI Behavior

- [CLI command catalog](cli-commands.md): representative and full command lists, grouped by safety class.
- [Agent-safe JSON CLI profile](cli-json-profile.md): stdout/stderr contract, parsing rules, and safety classes for scripts and agents.
- [Package consumer smoke matrix](package-consumer-smoke-matrix.md): supported package import and TypeScript compile shapes.
- [Related work](related-work.md): other unofficial Reclaim.ai SDKs, CLIs, automation nodes, and agent-facing tools.

## Tasks And Write Safety

- [Task inputs and task commands](tasks.md): task input shape, previews, authenticated reads, confirmed writes, receipts, exports, duplicate checks, and the mock API lab.
- [Time-policy conflict explainer](time-policy-conflicts.md): synthetic policy-fit review before task, Focus, or Buffer changes.
- [Redacted support bundles](support-bundles.md): troubleshooting bundles for preview and config incidents.
- [Command safety manifest](command-safety-manifest.json): machine-readable inventory of command safety classes, confirmation flags, visibility, and readiness gates.

## Scheduling Previews

- [Habit inputs](habits.md): preview-only Habit input shape.
- [Focus and Buffer inputs](focus-and-buffers.md): preview-only Focus and Buffer shapes.
- [Buffer rule preview](buffer-rules.md): preview-only Buffer rule diff receipts.
- [Buffer template preview](buffer-templates.md): preview-only Buffer template helper.
- [Meeting availability preview](meeting-availability.md): synthetic availability windows, candidate slots, and exclusion reasons.
- [Recurring meeting reschedule simulator](recurring-meeting-reschedule.md): synthetic recurring keep, move, and blocked outcomes.
- [Weekly scenario composer](weekly-scenario-composer.md): compound weekly preview from multiple local surfaces.

## Account And Config Inspection

- [Meetings and hours inspector](meetings-and-hours.md): read-only meeting and time-policy summaries.
- [Hours config audit](hours-config.md): summary-only hours coverage and drift digest.
- [Account audit snapshot](account-audit.md): summary-only account capability and drift output.
- [Sanitized fixture recording](reclaim-fixture-recording.md): raw-to-scrubbed fixture recorder prototype and leak-check rules.

## Synthetic Examples And Scenario Packs

- [Examples index](../examples/README.md): public-safe fixtures and how to preview them.
- [Integration starter packs](integration-starter-packs.md): Todoist, Linear, GitHub, and agent-ops packs after upstream transformation.
- [Synthetic event-prep block pack](event-prep-block-example-pack.md): guest-visit preparation example on the task preview surface.
- [Synthetic agent-ops week pack](agent-ops-week-scenario-pack.md): Monday-through-Friday agent-ops task pack.

## Maintainer And API Contract References

- [OpenAPI client generation](openapi-client-generation.md): published Reclaim OpenAPI surface, local sanitizing step, and generator commands.
- [Mock read-only MCP](mock-readonly-mcp.md): fixture-backed read-only MCP prototype.
- [Build-vs-buy workflows](build-vs-buy-workflows.md): public-safe comparison across workflow categories.
- [Safe write expansion program](safe-write-expansion-program.md): current write-expansion gates and deferrals.
- [Write expansion routing](write-expansion-routing.md): review gates before adding live writes beyond tasks.
- [Write expansion first proof](write-expansion-first-proof.md): current candidate ranking for expanding writes.
- [Scheduling surface first proof](scheduling-surface-first-proof.md): why scheduling helpers remain preview-only or read-only.
- [Scheduling surface discovery brief](scheduling-surface-expansion-discovery-brief.md): scheduling expansion options and governing choice.
- [Freshness signals spike](freshness-signals-spike.md): webhook-versus-snapshot freshness notes and scenario matrix.
- [Roadmap](roadmap.md): high-level future direction.
- [Agent-surface pre-edit check](agent-surface-preedit.md): local guard for keeping TypeScript surfaces small.
