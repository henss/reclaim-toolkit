# Agent-Surface Pre-Edit Check

Before adding non-trivial TypeScript or JavaScript code to known candidate
files, run:

```bash
pnpm check:agent-surface:preedit -- src/foo.ts src/foo.test.ts
```

If the output shows a near-limit or oversize file, extract a focused module or
fixture helper first instead of adding more feature weight to that file.
