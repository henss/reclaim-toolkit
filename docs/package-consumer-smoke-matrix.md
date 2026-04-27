# Package Consumer Smoke Matrix

This repo runs a small consumer smoke matrix to keep the public package surface conventional for npm-first TypeScript consumers without implying a broader compatibility promise than the tested shapes.

## Covered shapes

| Consumer shape | Install source | Status | Notes |
| --- | --- | --- | --- |
| ESM JavaScript library import | workspace path and packed tarball | pass | Imports from `"reclaim-toolkit"` and runs a preview-only task helper. |
| TypeScript compile with `moduleResolution: "NodeNext"` | workspace path and packed tarball | pass | Verifies value imports, type-only imports, and config/client helpers. |
| TypeScript compile with `moduleResolution: "Bundler"` | workspace path and packed tarball | pass | Verifies the same public entrypoint works in bundler-oriented projects. |
| TypeScript compile from `reclaim-toolkit/core` | workspace path and packed tarball | pass | Verifies the core client subpath can be imported without relying on CLI or mock utility exports. |
| Installed CLI command | workspace path and packed tarball | pass | Runs `reclaim:onboarding` and confirms the conventional `config/reclaim.local.json` default. |
| Public entrypoint export smoke | workspace path and packed tarball | pass | Verifies the root entrypoint, `reclaim-toolkit/core`, `reclaim-toolkit/cli`, and `reclaim-toolkit/mock` expose their intended surfaces without cross-exporting each other. |
| Built core dependency graph | packed build output | pass | Verifies `dist/core.js` reaches only config, client, health, OpenAPI client, and request-collector modules, not CLI or mock modules. |

## Package export contract

The package `exports` map is intentionally small:

| Import path | Built entry | Intended surface |
| --- | --- | --- |
| `reclaim-toolkit` | `dist/index.js` | Main library helpers for ordinary toolkit use. |
| `reclaim-toolkit/core` | `dist/core.js` | Config, typed Reclaim clients, health checks, and shared public types. |
| `reclaim-toolkit/cli` | `dist/cli-api.js` | CLI metadata helpers for command indexes, onboarding, and safety manifests without running the installed binary. |
| `reclaim-toolkit/mock` | `dist/mock.js` | Synthetic fixture recording, mock API lab, and read-only MCP mock utilities. |

This split uses the native npm package `exports` field and TypeScript declaration output instead of adding a routing or packaging dependency. That keeps the public package conventional, avoids a broader compatibility promise, and lets the smoke matrix verify the actual packed tarball consumed by downstream projects.

## Intentionally unsupported shapes

| Consumer shape | Status | Why |
| --- | --- | --- |
| CommonJS `require("reclaim-toolkit")` | unsupported | The published package is ESM-only (`"type": "module"`) and only advertises the ESM import entry in `exports`. |
| Deep imports such as `reclaim-toolkit/dist/...` | unsupported | The public contract is the package root export, documented subpath exports, and the installed CLI, not internal file paths. |

## Scope note

This matrix is a bounded ergonomics check, not a publication or compatibility policy. It is meant to catch obvious regressions in the package root export, generated types, and CLI install surface before any broader API commitment is made.
