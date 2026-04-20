# Managed by llm-orchestrator TypeScript agent-surface standard.
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
git config core.hooksPath ".githooks"
Write-Output "Configured git core.hooksPath to .githooks"
