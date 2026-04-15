# Introduction

Nagi is an agent orchestration platform that routes messages from chat services — Slack, Discord, Asana, and more — to AI agents running in isolated Docker containers. It handles the full lifecycle: receiving a user message, queuing it, spinning up a container, streaming the agent's response back, and posting the reply to the originating channel.

Nagi is designed for self-hosted, always-on operation. A single instance can serve multiple assistants, each with its own channels, groups, and prompt configurations, managed as a macOS launchd service or a standard process.

## Key Features

### Multi-Channel Integration

Connect multiple messaging platforms through a unified channel plugin system. Each channel plugin runs on the host and translates platform-specific events into a common message format that the orchestrator understands.

Currently supported channels:

- **Slack** — Socket Mode connection (no public URL or ingress required)
- **Discord** — Gateway Intents bot connection
- **Asana** — Polls task comments for trigger-pattern matches

Rich display variants are also available. For example, Slack channels can use **Block Kit** or **Block Kit Embed** for formatted tool-notification messages, and Discord channels can use **Embed** for similar rich output.

### Container Isolation

Every agent invocation runs inside its own Docker container. This provides:

- **Session isolation** — each request gets a clean environment; no state leaks between sessions
- **Dynamic MCP plugin registration** — tools like Ollama (local LLM) and Vercel (deployment) are registered at container startup and made available to the agent via the Model Context Protocol
- **Secure credential handling** — a Credential Proxy running on the host intercepts API calls from the container and injects real tokens, so containers never hold actual secrets

### Plugin System

Nagi's functionality is extended through two categories of plugins:

| Type | Runs On | Purpose | Examples |
|------|---------|---------|----------|
| Channel Plugins | Host | Connect to messaging platforms and translate events | `channel-slack`, `channel-discord`, `channel-asana` |
| MCP Plugins | Container | Provide tools to the AI agent inside the container | `mcp-ollama`, `mcp-vercel` |

Channel plugins implement the `Channel` interface from `@nagi/channel-core`. MCP plugins run as stdio-based MCP servers inside the Docker container and are dynamically registered with the agent runner (Claude Code or Open Code) at startup.

### Group-Based Routing

Messages are routed into **groups**, each of which can have its own system prompt, identity, and behavioral instructions. This lets a single assistant behave differently depending on the channel or context — for example, one group might handle technical support questions while another handles deployment requests.

Group prompts are organized under `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/` and can include files like `CLAUDE.md`, `AGENTS.md`, and `IDENTITY.md`.

### Multiple Agent Backends

Nagi supports more than one agent runtime:

- **Claude Code** — Anthropic's official CLI agent (default)
- **Open Code** — an alternative runtime supporting OpenRouter, Gemini, and OpenAI providers

Each assistant can be configured to use either backend independently.

## Project Structure

Nagi is organized as a pnpm workspace monorepo, built with Turbo:

```
nagi/
├── host/                    # Host-side services
│   ├── orchestrator/        #   Core orchestrator (message routing, container lifecycle)
│   ├── agent-runner-*/      #   Agent runners (claude-code, open-code)
│   ├── credential-proxy/    #   Credential Proxy for secure API key injection
│   └── plugins/             #   Channel plugins (slack, discord, asana, etc.)
├── libs/                    # Shared libraries
│   ├── channel-core/        #   Channel interface and base types
│   ├── db/                  #   SQLite persistence
│   ├── queue/               #   Group-based message queue
│   ├── router/              #   Message routing logic
│   ├── ipc/                 #   Host-container IPC
│   ├── config/              #   Configuration (Zod-validated)
│   ├── logger/              #   Structured logging
│   ├── scheduler/           #   Scheduled tasks
│   ├── auth/                #   Authentication
│   └── types/               #   Shared TypeScript types
├── container/               # Container-side code
│   ├── claude-code/         #   Claude Code agent
│   ├── open-code/           #   Open Code agent
│   ├── plugins/             #   MCP plugins (ollama, vercel)
│   └── skills/              #   Agent skills
├── tools/                   # Developer and operator tools
│   ├── cli/                 #   Nagi CLI
│   ├── ui/                  #   Web dashboard (frontend)
│   ├── ui-server/           #   Web dashboard (backend)
│   └── website/             #   Documentation site
└── deploy/                  # Deployment layer
    ├── templates/           #   Pristine templates (tracked in git)
    └── {ASSISTANT_NAME}/    #   Materialized per-assistant config (git-ignored)
```
