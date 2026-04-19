# Synthetic Examples For reclaim-toolkit

Examples in this directory are placeholders for public-safe fixtures.

Rules:

- Prefer invented project names and generic identifiers.
- Keep examples small enough to audit in one pass.
- Do not copy real fixtures and then redact them later.
- Add a short note when an example intentionally models an advanced behavior shape.

## Files

- `tasks.example.json`: minimal task-create fixture for smoke testing task commands.
- `scheduling-recipes.example.json`: synthetic recipe pack for common scheduling shapes such as kickoff prep, review windows, release checklists, personal admin, learning blocks, and weekly planning.
- `habits.example.json`: preview-only Habit fixture with synthetic daily and weekly examples.
- `focus-and-buffers.example.json`: preview-only Focus and Buffer fixture with synthetic focus windows and transition buffers.

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

To run the same task flow against a local synthetic mock instead of a Reclaim account, use:

```bash
npm run reclaim:demo:mock-api -- --input examples/tasks.example.json
```

The mock demo is an in-memory lab for CLI practice. It includes placeholder task-assignment policies, a duplicate synthetic task, and no live credentials or account data. It is intentionally smaller than the Reclaim API and should not be treated as an emulator.

To inspect available task-assignment time policies for a local account, use a private local config file and run:

```bash
npm run reclaim:time-policies:list -- --config config/reclaim.local.json
```

Do not commit local config files or command output containing account-specific policy ids.
