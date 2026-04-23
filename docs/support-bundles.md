# Redacted Support Bundles

`reclaim:support:bundle` creates one public-safe JSON document for local preview or config incidents. The bundle is meant for reproducible troubleshooting without copying live task titles, policy ids, emails, API keys, absolute paths, or other account-specific details into shared artifacts.

## CLI

Generate a preview incident bundle from a synthetic fixture:

```bash
npm run reclaim:support:bundle -- --input examples/support-bundle-preview.example.json
```

Generate a config incident bundle with an optional health check:

```json
{
  "incidentType": "config",
  "configPath": "config/reclaim.local.json",
  "includeHealthCheck": true
}
```

The command writes one JSON document to stdout and exits with code `0` on success. It follows the same CLI profile as the other toolkit commands: parse stdout only after a zero exit code, and treat stderr as the diagnostic surface for failures.

## Incident Types

- `preview`: runs one supported local preview or read-only helper in-process, then stores a redacted copy of the input and the resulting JSON shape.
- `config`: records sanitized config-status details and, when requested, a sanitized health-check summary.

Supported preview commands:

- `reclaim:onboarding`
- `reclaim:tasks:preview-create`
- `reclaim:habits:preview-create`
- `reclaim:focus:preview-create`
- `reclaim:buffers:preview-create`
- `reclaim:buffers:preview-rule`
- `reclaim:buffers:preview-template`
- `reclaim:meetings:preview-availability`
- `reclaim:meetings-hours:preview-inspect`
- `reclaim:meetings-hours:preview-switch`
- `reclaim:account-audit:preview-inspect`
- `reclaim:time-policies:explain-conflicts`

## Output

The bundle includes:

- `config`: sanitized config-path display, parse status, API-url classification, and preference-presence booleans.
- `preview`: the requested command, execution status, structural summary, plus redacted input and result fields.
- `healthCheck`: optional sanitized reachability details without user email, task titles, or ids.
- `redactionPolicy.counters`: counts for the values redacted during bundle generation.

The generator preserves numbers, booleans, ISO-like dates, times, command ids, and safety enums. It redacts titles, names, notes, ids, emails, secrets, absolute paths, and generic free text.

## Public Boundary

Keep support-bundle inputs synthetic when possible. If a local incident came from a live account, run the generator locally and share only the resulting redacted bundle. Do not commit or paste raw Reclaim tasks, private scheduling ledgers, household details, health-support policy, Calendar fallback rules, or Stefan-specific operating policy into example files or issue notes.
