# Package Consumer Smoke Matrix

This repo runs a small consumer smoke matrix to keep the public package surface conventional for npm-first TypeScript consumers without implying a broader compatibility promise than the tested shapes.

## Covered shapes

| Consumer shape | Install source | Status | Notes |
| --- | --- | --- | --- |
| ESM JavaScript library import | workspace path and packed tarball | pass | Imports from `"reclaim-toolkit"` and runs a preview-only task helper. |
| TypeScript compile with `moduleResolution: "NodeNext"` | workspace path and packed tarball | pass | Verifies value imports, type-only imports, and config/client helpers. |
| TypeScript compile with `moduleResolution: "Bundler"` | workspace path and packed tarball | pass | Verifies the same public entrypoint works in bundler-oriented projects. |
| Installed CLI command | workspace path and packed tarball | pass | Runs `reclaim:onboarding` and confirms the conventional `config/reclaim.local.json` default. |

## Intentionally unsupported shapes

| Consumer shape | Status | Why |
| --- | --- | --- |
| CommonJS `require("reclaim-toolkit")` | unsupported | The published package is ESM-only (`"type": "module"`) and only advertises the ESM import entry in `exports`. |
| Deep imports such as `reclaim-toolkit/dist/...` | unsupported | The public contract is the package root export plus the installed CLI, not internal file paths. |

## Scope note

This matrix is a bounded ergonomics check, not a publication or compatibility policy. It is meant to catch obvious regressions in the package root export, generated types, and CLI install surface before any broader API commitment is made.
