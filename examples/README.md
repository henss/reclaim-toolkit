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

The recipe pack is still a task input file, so it can be previewed with:

```bash
npm run reclaim:tasks:preview-create -- --input examples/scheduling-recipes.example.json
```

To inspect available task-assignment time policies for a local account, use a private local config file and run:

```bash
npm run reclaim:time-policies:list -- --config config/reclaim.local.json
```

Do not commit local config files or command output containing account-specific policy ids.
