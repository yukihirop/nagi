# System Overview

Nagi operates in a two-layer architecture: **host-side** processes handle message routing, persistence, and credential management, while **container-side** processes run AI agents in isolated Docker containers.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Host (macOS / Linux)                                            │
│                                                                  │
│  deploy/{ASSISTANT_NAME}/host/entry.ts                           │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐    ┌──────────────────────────────────┐         │
│  │ Orchestrator │───▶│  Channel Plugins (host/plugins/) │         │
│  │              │    │  ├── Slack (Socket Mode)         │         │
│  │              │    │  ├── Slack Block Kit             │         │
│  │              │    │  ├── Slack Block Kit Embed       │         │
│  │              │    │  ├── Discord (Gateway)           │         │
│  │              │    │  ├── Discord Embed               │         │
│  │              │    │  └── Asana (Polling)             │         │
│  │              │    └──────────────────────────────────┘         │
│  │              │                                                 │
│  │              │───▶ Credential Proxy (:3002)                    │
│  │              │───▶ SQLite DB                                   │
│  │              │───▶ GroupQueue                                  │
│  │              │───▶ Scheduler                                   │
│  │              │───▶ Router                                      │
│  │              │───▶ Auth (allowlist)                             │
│  │              │◀──▶ IpcWatcher (IPC file monitoring)            │
│  └──────┬───────┘                                                 │
│         │ docker run                                              │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  Docker Container (claude-code or open-code)        │          │
│  │                                                     │          │
│  │  Agent Runner (Claude Code / Open Code)              │          │
│  │  ├── Nagi MCP Server (stdio)                        │          │
│  │  │    ├── send_message    (instant messaging)       │          │
│  │  │    ├── schedule_task   (task scheduling)         │          │
│  │  │    └── list_tasks      (task listing)            │          │
│  │  ├── Agent Hooks                                    │          │
│  │  │    ├── PostToolUse     (tool notifications)      │          │
│  │  │    ├── SessionStart    (session notifications)   │          │
│  │  │    └── PromptComplete  (completion callback)     │          │
│  │  ├── MCP Plugins                                    │          │
│  │  │    ├── Ollama  (local LLM)                       │          │
│  │  │    └── Vercel  (deployment)                      │          │
│  │  └── Container Skills (/workspace/group/skills)     │          │
│  │       ├── agent-browser      (browser automation)   │          │
│  │       ├── ai-changelog       (changelog generation) │          │
│  │       ├── capabilities       (feature intro)        │          │
│  │       ├── jupyter-deploy     (notebook execution)   │          │
│  │       ├── slack-formatting   (Slack formatting)     │          │
│  │       ├── status             (status reporting)     │          │
│  │       ├── ui-ux-pro-max     (UI/UX design)          │          │
│  │       ├── vercel-deploy      (Vercel deployment)    │          │
│  │       └── youtube-analytics  (YouTube analytics)    │          │
│  └─────────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

## Message Flow

```
User (Slack/Discord/Asana)
  │
  ▼
Channel Plugin ── onMessage ──▶ Orchestrator
                                    │
                          ┌─────────┼──────────┐
                          ▼         ▼          ▼
                     Store in    Enqueue    Route to
                     SQLite DB   GroupQueue  Group
                                    │
                                    ▼
                          docker run nagi-agent
                                    │
                          ┌─────────┼──────────┐
                          ▼         ▼          ▼
                     Agent uses  Calls APIs  Produces
                     MCP tools   via Cred.   stdout
                                 Proxy       markers
                                    │
                                    ▼
                          ---NAGI_OUTPUT_START---
                                    │
                          Orchestrator parses output
                                    │
                                    ▼
                          Channel Plugin ── reply ──▶ User
```

Step-by-step:

1. A user sends a message on Slack, Discord, or Asana.
2. The corresponding channel plugin receives the event and forwards it to the Orchestrator.
3. The Orchestrator stores the message in SQLite and routes it to the correct group.
4. GroupQueue enqueues the message; when a slot is available, it launches a Docker container.
5. The agent runner starts inside the container (Claude Code or Open Code).
6. The agent calls external APIs through the Credential Proxy, which injects real credentials in place of placeholder tokens.
7. When the agent produces a response, it writes `---NAGI_OUTPUT_START---` / `---NAGI_OUTPUT_END---` markers to stdout.
8. The Orchestrator reads the markers, extracts the response, and sends it back through the channel plugin.

## Plugin System

Nagi has four types of extensions, split across host and container:

### Channel Plugins (Host-side)

Channel plugins run on the host and bridge messaging platforms to the Orchestrator. Each implements the `Channel` interface from `@nagi/channel-core`.

| Plugin | Transport | Location |
|--------|-----------|----------|
| `channel-slack` | Socket Mode | `host/plugins/channel-slack/` |
| `channel-slack-block-kit` | Socket Mode + Block Kit rich display | `host/plugins/channel-slack-block-kit/` |
| `channel-slack-block-kit-embed` | Socket Mode + embed attachments | `host/plugins/channel-slack-block-kit-embed/` |
| `channel-discord` | Gateway Intents | `host/plugins/channel-discord/` |
| `channel-discord-embed` | Gateway + embed display | `host/plugins/channel-discord-embed/` |
| `channel-asana` | Comment polling | `host/plugins/channel-asana/` |

Registration in `entry.ts`:

```
registry.register("slack", createSlackFactory({ ... }))
→ Orchestrator connects all registered channels on start
```

### MCP Plugins (Container-side)

MCP plugins run inside Docker containers as stdio MCP servers. They provide additional tools to the agent at runtime.

| Plugin | Purpose | Location |
|--------|---------|----------|
| `mcp-ollama` | Local LLM access via Ollama | `container/plugins/mcp-ollama/` |
| `mcp-vercel` | Vercel deployment | `container/plugins/mcp-vercel/` |

Registration in `entry.ts`:

```
orchestrator.registerMcpPlugin("ollama", { entryPoint: "..." })
→ ContainerInput.mcpPlugins passed to agent-runner via stdin
→ agent-runner dynamically registers them as mcpServers
```

### Agent Hooks (Container-side)

Agent hooks run inside containers and fire notifications on tool execution and session lifecycle events. They are available for both Claude Code and Open Code runners.

| Variant | Location |
|---------|----------|
| Claude Code hooks | `container/claude-code/plugins/agent-hooks/` |
| Open Code hooks | `container/open-code/plugins/agent-hooks/` |

### Container Skills

Skills are specialized prompt-based capabilities bundled into the container image. They give the agent domain-specific knowledge for particular tasks.

Examples: `vercel-deploy`, `jupyter-deploy`, `slack-formatting`, `ai-changelog`, `youtube-analytics`, `ui-ux-pro-max`, and more.

Location: `container/skills/`

## Package Dependencies

```
deploy/{ASSISTANT_NAME}/host/entry.ts
  │
  ├── @nagi/orchestrator
  │     ├── @nagi/channel-core
  │     ├── @nagi/db
  │     ├── @nagi/queue
  │     ├── @nagi/scheduler
  │     ├── @nagi/ipc
  │     ├── @nagi/router
  │     ├── @nagi/auth
  │     ├── @nagi/config
  │     ├── @nagi/credential-proxy
  │     └── @nagi/logger
  │
  ├── @nagi/channel-slack  ──▶ @nagi/channel-core ──▶ @nagi/types
  ├── @nagi/channel-discord ──▶ @nagi/channel-core ──▶ @nagi/types
  └── @nagi/channel-asana  ──▶ @nagi/channel-core ──▶ @nagi/types
```

The `@nagi/types` package provides shared type definitions consumed by most libraries.

## Multi-Assistant Support

Nagi supports running multiple assistant instances in parallel. Each assistant gets its own:

- Entry point: `deploy/{ASSISTANT_NAME}/host/entry.ts`
- Group prompts: `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/`
- Data directory: `__data/{ASSISTANT_NAME}/`
- launchd service (macOS): one plist per assistant

Templates in `deploy/templates/` are the canonical source; running the deploy skill materializes them into per-assistant directories.

## Data Directories

| Directory | Purpose | Git |
|---|---|---|
| `deploy/templates/` | Entry point and group prompt templates (pristine) | Tracked |
| `deploy/templates/groups/` | Group prompt templates (CLAUDE.md, AGENTS.md) | Tracked |
| `deploy/{ASSISTANT_NAME}/` | Materialized entry points and group prompts | Ignored |
| `deploy/{ASSISTANT_NAME}/groups/` | User-editable group prompt defaults | Ignored |
| `__data/{ASSISTANT_NAME}/store/nagi.db` | SQLite database (groups, chats, messages, scheduled tasks, sessions, state) | Ignored |
| `__data/{ASSISTANT_NAME}/groups/` | Runtime group data (mounted into containers) | Ignored |
| `__data/{ASSISTANT_NAME}/sessions/` | Claude sessions per group | Ignored |
| `__data/{ASSISTANT_NAME}/ipc/` | Container IPC files | Ignored |
| `__data/{ASSISTANT_NAME}/logs/` | Service logs | Ignored |
