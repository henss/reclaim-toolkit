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
| Public subpath export smoke | workspace path and packed tarball | pass | Verifies `reclaim-toolkit/core`, `reclaim-toolkit/cli`, and `reclaim-toolkit/mock` expose their intended surfaces without cross-exporting each other. |

## Intentionally unsupported shapes

| Consumer shape | Status | Why |
| --- | --- | --- |
| CommonJS `require("reclaim-toolkit")` | unsupported | The published package is ESM-only (`"type": "module"`) and only advertises the ESM import entry in `exports`. |
| Deep imports such as `reclaim-toolkit/dist/...` | unsupported | The public contract is the package root export, documented subpath exports, and the installed CLI, not internal file paths. |

## Scope note

This matrix is a bounded ergonomics check, not a publication or compatibility policy. It is meant to catch obvious regressions in the package root export, generated types, and CLI install surface before any broader API commitment is made.
