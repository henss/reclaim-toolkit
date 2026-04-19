# Related Work

These projects are useful references for people building with Reclaim.ai and for agents that need to compare API shapes before implementing new features. They are independent projects; inclusion here does not imply endorsement or compatibility.

## API And SDK References

- [labiso-gmbh/reclaim-sdk](https://github.com/labiso-gmbh/reclaim-sdk): Python SDK for Reclaim.ai task management. Useful for task resource modeling, Pydantic-style validation, and notes about the unofficial API surface.
- [DRFR0ST/reclaim-unofficial-api](https://github.com/DRFR0ST/reclaim-unofficial-api): TypeScript/Node API wrapper. Useful for comparing module boundaries for tasks, habits, users, calendars, and analytics.

## Automation And Agent Integrations

- [labiso-gmbh/n8n-nodes-reclaim-ai](https://github.com/labiso-gmbh/n8n-nodes-reclaim-ai): n8n community node for automating Reclaim.ai task workflows. Useful for workflow-oriented task fields and operation coverage.
- [universalamateur/reclaim-mcp-server](https://github.com/universalamateur/reclaim-mcp-server): MCP server for Reclaim.ai tasks, calendar, habits, focus time, and analytics. Useful when designing agent-facing tool profiles and safety boundaries.
- [benjaminjackson/reclaim-skills](https://github.com/benjaminjackson/reclaim-skills): Claude Code skills for Reclaim.ai task management. Useful for confirmation-workflow patterns and agent instructions around write safety.

## CLI Implementations

- [rieck/reclaim-cli](https://github.com/rieck/reclaim-cli): Python CLI covering tasks, events, habits, workload, and work logging. Useful for command vocabulary and configuration conventions.
- [cruzluna/reclaim-cli](https://github.com/cruzluna/reclaim-cli): Rust CLI with task and event operations plus a terminal dashboard. Useful for CLI/API separation and actionable error patterns.
- [petetanton/reclaim-cli](https://github.com/petetanton/reclaim-cli): Small Go CLI. Useful as a minimal reference, but currently less documented than the other CLI implementations.
