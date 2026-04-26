# Mock Read-Only MCP

`reclaim:mcp:mock-readonly` exposes a narrow Model Context Protocol server over stdio using only synthetic fixture data. It is meant for local agent experiments that need Reclaim-shaped read tools without any live credentials, calendar access, or write path.

```bash
npm run reclaim:mcp:mock-readonly -- --input examples/mock-readonly-mcp.example.json
```

The fixture format stays public-safe by carrying only invented tasks, meetings, and time policies:

- `tasks` powers the same read-only task list and export helpers used by the npm CLI.
- `timeSchemes` powers task-assignment policy discovery and selection reasoning.
- `meetings` plus `timeSchemes` power the existing meetings-and-hours inspection summary.

The server currently exposes four tools:

- `reclaim_tasks_list`
- `reclaim_tasks_export`
- `reclaim_time_policies_list`
- `reclaim_meetings_hours_inspect`

Each tool returns JSON-compatible structured content plus a text copy for generic MCP clients. The surface intentionally avoids resources, prompts, write operations, config files, and live account reads so this prototype can stay inside the repo's public-safe boundary.
