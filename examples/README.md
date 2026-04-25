# Synthetic Examples For reclaim-toolkit

Examples in this directory are placeholders for public-safe fixtures.

Rules:

- Prefer invented project names and generic identifiers.
- Keep examples small enough to audit in one pass.
- Do not copy real fixtures and then redact them later.
- Add a short note when an example intentionally models an advanced behavior shape.

## Files

- `reclaim.config.example.json`: synthetic config shape reference for a private local config file.
- `tasks.example.json`: minimal task-create fixture for smoke testing task commands.
- `scheduling-recipes.example.json`: synthetic recipe pack for common scheduling shapes such as kickoff prep, review windows, release checklists, personal admin, learning blocks, and weekly planning.
- `shopping-errand-windows.example.json`: synthetic personal task pack for bounded shopping-assistance and errand-window previews.
- `event-prep-block-example-pack.example.json`: synthetic guest-visit preparation pack for placeholder event-prep block previews.
- `todoist-starter-pack.example.json`: transformed Todoist-style starter pack for Reclaim task previews.
- `linear-starter-pack.example.json`: transformed Linear-style starter pack for Reclaim task previews.
- `github-starter-pack.example.json`: transformed GitHub-style starter pack for Reclaim task previews.
- `agent-ops-week-scenario-pack.example.json`: transformed synthetic agent-ops week pack for a bounded Monday-through-Friday preview scenario.
- `compound-weekly-preview.example.json`: synthetic compound weekly pack that combines tasks, habits, focus, buffers, and meeting availability into one preview agenda.
- `habits.example.json`: preview-only Habit fixture with synthetic daily and weekly examples.
- `focus-and-buffers.example.json`: preview-only Focus and Buffer fixture with synthetic focus windows and transition buffers.
- `time-policy-conflicts.example.json`: synthetic task, focus, buffer, and hours-profile conflict fixture for the read-only time-policy explainer.
- `buffer-rules.example.json`: preview-only Buffer rule fixture with a synthetic baseline buffer and diff-style preview receipts.
- `buffer-templates.example.json`: preview-only Buffer template fixture with generic meeting-recovery and transition-time templates.
- `meeting-availability.example.json`: preview-only Meeting Availability fixture with synthetic busy meetings and generic policy windows.
- `recurring-meeting-reschedule.example.json`: preview-only recurring series fixture with synthetic keep, move, and blocked outcomes.
- `meetings-and-hours.example.json`: synthetic Meetings and Hours inspector fixture with placeholder meeting and time-policy summaries.
- `account-audit.example.json`: synthetic Account Audit inspector fixture with placeholder task, meeting, and time-policy summaries.
- `account-audit-drift.example.json`: synthetic Account Audit comparison fixture keyed by source handles for summary-only drift classification.
- `support-bundle-preview.example.json`: synthetic support-bundle incident request for local preview troubleshooting.
- `support-bundle-replay.expected.json`: committed redacted support-bundle replay snapshot with a normalized `generatedAt` placeholder for stable diffs.
- `task-write-receipts.example.json`: synthetic task write-receipt fixture for read-only remote-state validation.

Run the public-boundary lint before committing example changes:

```bash
npm run lint:public-boundary
```

To see a credential-free onboarding checklist before configuring anything, run:

```bash
npm run reclaim:onboarding
```

The recipe pack is still a task input file, so it can be previewed with:

```bash
npm run reclaim:tasks:preview-create -- --input examples/scheduling-recipes.example.json
```

For a public-safe shopping and errand-window variant on the same preview surface, use:

```bash
npm run reclaim:tasks:preview-create -- --input examples/shopping-errand-windows.example.json
```

For a public-safe guest-visit preparation variant with conventional event-prep blocks, use:

```bash
npm run reclaim:tasks:preview-create -- --input examples/event-prep-block-example-pack.example.json
```

The integration starter packs use the same Reclaim task preview surface after an upstream transform has already normalized the data:

```bash
npm run reclaim:tasks:preview-create -- --input examples/todoist-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/linear-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/github-starter-pack.example.json
npm run reclaim:tasks:preview-create -- --input examples/agent-ops-week-scenario-pack.example.json
```

To compose a synthetic work week from multiple preview-only surfaces in one pass, use:

```bash
npm run reclaim:scenarios:preview-weekly -- --input examples/compound-weekly-preview.example.json
```

The Habit fixture is preview-only and does not create live habits:

```bash
npm run reclaim:habits:preview-create -- --input examples/habits.example.json
```

The Focus and Buffer fixture is preview-only and does not create live focus blocks or buffers. Both commands now include a top-level `previewReceipt` describing the current no-write gate, and the committed fixture also carries synthetic policy context so each preview item includes `timePolicyExplanation`:

```bash
npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json
```

The Focus preview fixture also includes a synthetic `currentFocusBlocks` baseline so the CLI can emit `planDiff` receipts, `removedFocusBlocks`, and a top-level `planDiffSummary` without relying on any live Reclaim state.

The time-policy conflict fixture is read-only and explains fit or conflict reasons for synthetic task, focus, buffer, and hours-profile proposals:

```bash
npm run reclaim:time-policies:explain-conflicts -- --input examples/time-policy-conflicts.example.json
```

The Buffer rule fixture is preview-only and returns synthetic diff-style receipts for create/update review:

```bash
npm run reclaim:buffers:preview-rule -- --input examples/buffer-rules.example.json
```

The Buffer template fixture is preview-only and returns synthetic mock responses plus receipt-style metadata:

```bash
npm run reclaim:buffers:preview-template -- --input examples/buffer-templates.example.json
```

The Meeting Availability fixture is preview-only and returns synthetic availability windows, candidate slots, exclusion reasons, and day-by-day fit summaries:

```bash
npm run reclaim:meetings:preview-availability -- --input examples/meeting-availability.example.json
```

The recurring meeting reschedule fixture is preview-only and classifies synthetic occurrences as keep, move, or blocked:

```bash
npm run reclaim:meetings:preview-recurring-reschedule -- --input examples/recurring-meeting-reschedule.example.json
```

The Meetings and Hours fixture is read-only and does not create meetings or update hours. The local preview command includes a top-level `previewReceipt` so scripts can recognize it as fixture-backed preview output:

```bash
npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json
```

For a synthetic profile-switch preview that compares how named local presets would resolve Reclaim hours policies, the CLI also returns a top-level `previewReceipt` because the comparison stays local and read-only. Each profile also includes `timePolicyExplanation` so the hours preview uses the same public-safe policy reasoning shape as task, Focus, and Buffer previews:

```bash
npm run reclaim:meetings-hours:preview-switch -- --input examples/meetings-hours-profile-switch.example.json
```

The task write-receipt fixture is also read-only. Pair it with a private local config when comparing saved receipts against the current remote task list:

```bash
npm run reclaim:tasks:validate-write-receipts -- --config config/reclaim.local.json --input examples/task-write-receipts.example.json
```

To run the same task flow against a local synthetic mock instead of a Reclaim account, use:

```bash
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
```

The mock demo is an in-memory lab for CLI practice. It includes placeholder task-assignment policies, a duplicate synthetic task, and no live credentials or account data. It is intentionally smaller than the Reclaim API and should not be treated as an emulator.

To inspect the lab's public-safe failure modes instead of the default happy path, run:

```bash
npm run reclaim:demo:mock-api -- --profile failure-modes
```

The documented route matrix for the baseline lab lives in `docs/mock-api-response-matrix.example.json`, and the failure-mode matrix lives in `docs/mock-api-failure-mode-matrix.example.json`. Keep both synthetic, ordered, and small enough to audit alongside the matching tests.

To inspect available task-assignment time policies for a local account, use a private local config file and run:

```bash
npm run reclaim:time-policies:list -- --config config/reclaim.local.json
```

Do not commit local config files or command output containing account-specific policy ids.

For a summary-only account audit shape that avoids exporting task titles, meeting titles, or user identifiers, use:

```bash
npm run reclaim:account-audit:preview-inspect -- --input examples/account-audit.example.json
```

For a source-handle drift digest that compares two synthetic account snapshots without replaying their private details, use:

```bash
npm run reclaim:account-audit:preview-drift -- --input examples/account-audit-drift.example.json
```
