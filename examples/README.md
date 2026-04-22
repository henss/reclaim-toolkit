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
- `habits.example.json`: preview-only Habit fixture with synthetic daily and weekly examples.
- `focus-and-buffers.example.json`: preview-only Focus and Buffer fixture with synthetic focus windows and transition buffers.
- `buffer-rules.example.json`: preview-only Buffer rule fixture with a synthetic baseline buffer and diff-style preview receipts.
- `buffer-templates.example.json`: preview-only Buffer template fixture with generic meeting-recovery and transition-time templates.
- `meetings-and-hours.example.json`: synthetic Meetings and Hours inspector fixture with placeholder meeting and time-policy summaries.

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

The Habit fixture is preview-only and does not create live habits:

```bash
npm run reclaim:habits:preview-create -- --input examples/habits.example.json
```

The Focus and Buffer fixture is preview-only and does not create live focus blocks or buffers:

```bash
npm run reclaim:focus:preview-create -- --input examples/focus-and-buffers.example.json
npm run reclaim:buffers:preview-create -- --input examples/focus-and-buffers.example.json
```

The Buffer rule fixture is preview-only and returns synthetic diff-style receipts for create/update review:

```bash
npm run reclaim:buffers:preview-rule -- --input examples/buffer-rules.example.json
```

The Buffer template fixture is preview-only and returns synthetic mock responses plus receipt-style metadata:

```bash
npm run reclaim:buffers:preview-template -- --input examples/buffer-templates.example.json
```

The Meetings and Hours fixture is read-only and does not create meetings or update hours:

```bash
npm run reclaim:meetings-hours:preview-inspect -- --input examples/meetings-and-hours.example.json
```

To run the same task flow against a local synthetic mock instead of a Reclaim account, use:

```bash
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
```

The mock demo is an in-memory lab for CLI practice. It includes placeholder task-assignment policies, a duplicate synthetic task, and no live credentials or account data. It is intentionally smaller than the Reclaim API and should not be treated as an emulator.

The documented route matrix for that lab lives in `docs/mock-api-response-matrix.example.json`. Keep it synthetic, ordered, and small enough to audit alongside the matching test.

To inspect available task-assignment time policies for a local account, use a private local config file and run:

```bash
npm run reclaim:time-policies:list -- --config config/reclaim.local.json
```

Do not commit local config files or command output containing account-specific policy ids.

For a summary-only account audit shape that avoids exporting task titles, meeting titles, or user identifiers, use:

```bash
npm run reclaim:account-audit:preview-inspect -- --input examples/account-audit.example.json
```
