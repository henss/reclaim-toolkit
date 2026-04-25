# Agent-Surface Pre-Edit Check

Before adding non-trivial TypeScript or JavaScript code to known candidate
files, run:

```bash
pnpm check:agent-surface:preedit -- src/foo.ts src/foo.test.ts
```

If the output shows a near-limit or oversize file, extract a focused module or
fixture helper first instead of adding more feature weight to that file.

## Agent-safe TypeScript target

Prefer:
- small files and single-purpose modules
- clear public APIs per package or feature
- explicit schemas at external boundaries
- injectable seams for IO, time, randomness, network clients, and filesystem access
- generated types or checked schemas for external APIs
- source-size and lint budget exclusions for generated external API outputs
- high-signal tests near the changed code
- clear package scripts and ordinary build flow

Avoid:
- barrel files that export everything from everywhere
- ambient globals and shared mutable state
- dynamic require/import magic
- large UI components with business logic inside
- grab-bag `utils` folders
- implicit framework conventions without tests
- mock-heavy tests that can pass while behavior is broken
- hidden build magic

Enforcement:
- Dependency-cruiser blocks new architecture dependency violations while keeping existing violations in a baseline file.
- ESLint hard-blocks default exports, type-only import violations, CommonJS `require` in TypeScript, and `var`.
- ESLint warns on direct `Date.now`, direct `Math.random`, and missed `prefer-const` opportunities.
- The agent-surface guard blocks changed-file growth in `export *` barrels, dynamic imports, `require` calls, ambient declarations, and new grab-bag `utils` paths.
