# Architecture

## System Overview

```mermaid
graph TB
    subgraph Host["Host (macOS / Linux)"]
        Entry["deploy/default/host/entry.ts"]
        Orch["Orchestrator"]
        Proxy["Credential Proxy<br/>:3002"]
        DB["SQLite DB"]
        Queue["GroupQueue"]

        subgraph Channels["Channel Plugins"]
            Slack["Slack<br/>(Socket Mode)"]
            Discord["Discord<br/>(Gateway)"]
        end
    end

    subgraph Docker["Docker Container"]
        Agent["Agent Runner<br/>Claude Agent SDK"]
        IPC_MCP["Nagi MCP<br/>(tasks, messaging)"]

        subgraph MCP["MCP Plugins"]
            Ollama["Ollama<br/>(Local LLM)"]
            Vercel["Vercel<br/>(Deploy)"]
        end
    end

    User["User"] -->|message| Slack & Discord
    Slack & Discord -->|onMessage| Orch
    Orch -->|store| DB
    Orch -->|enqueue| Queue
    Queue -->|docker run| Agent
    Agent -->|stdin JSON| IPC_MCP
    Agent <-->|stdout markers| Orch
    Agent --> Ollama & Vercel
    Agent -->|API calls| Proxy
    Proxy -->|inject credentials| API["Anthropic API"]
    Orch -->|sendMessage| Slack & Discord
    Entry -->|configure| Orch

    style Host fill:#1a1a2e,color:#fff
    style Docker fill:#0d1117,color:#fff
    style Channels fill:#2d3748,color:#fff
    style MCP fill:#2d3748,color:#fff
```

## Message Flow

```mermaid
sequenceDiagram
    participant U as User (Slack)
    participant O as Orchestrator
    participant Q as GroupQueue
    participant C as Container
    participant A as Anthropic API
    participant P as Credential Proxy

    U->>O: @Andy hello
    O->>O: Store message in DB
    O->>Q: enqueueMessageCheck
    Q->>C: docker run nagi-agent
    C->>P: API request (placeholder token)
    P->>A: API request (real token)
    A->>P: Response
    P->>C: Response
    C->>O: ---NAGI_OUTPUT_START---
    O->>U: Reply via Slack
```

## Package Dependencies

```mermaid
graph TD
    Entry["deploy/default/host/entry.ts"] --> Orchestrator
    Entry --> ChannelSlack["channel-slack"]
    Entry --> ChannelDiscord["channel-discord"]

    Orchestrator --> ChannelCore["channel-core"]
    Orchestrator --> DB["db"]
    Orchestrator --> Queue["queue"]
    Orchestrator --> Scheduler["scheduler"]
    Orchestrator --> IPC["ipc"]
    Orchestrator --> Router["router"]
    Orchestrator --> Auth["auth"]
    Orchestrator --> Config["config"]
    Orchestrator --> Logger["logger"]
    Orchestrator --> CredProxy["credential-proxy"]

    ChannelSlack --> ChannelCore
    ChannelDiscord --> ChannelCore
    ChannelCore --> Types["types"]

    DB --> Types
    Router --> Types
    Router --> ChannelCore
    Scheduler --> Types
    IPC --> Types
    Auth --> Logger
    Config -.->|Zod| Types

    style Entry fill:#e2725b,color:#fff
    style Orchestrator fill:#4a9eff,color:#fff
    style Types fill:#50c878,color:#fff
```

## Plugin System

### Channel Plugins (Host-side)

Channel plugins run on the host and connect to messaging platforms. They implement the `Channel` interface from `@nagi/channel-core`.

```
deploy/default/host/entry.ts → registry.register("slack", createSlackFactory({ ... }))
                             → Orchestrator connects all registered channels on start
```

### MCP Plugins (Container-side)

MCP plugins run inside Docker containers as stdio MCP servers. They provide tools to the Claude Agent SDK.

```
deploy/default/host/entry.ts → orchestrator.registerMcpPlugin("ollama", { entryPoint: "..." })
         → ContainerInput.mcpPlugins passed to agent-runner via stdin
         → agent-runner dynamically registers them as mcpServers
```

## Data Flow

| Directory | Purpose | Git |
|---|---|---|
| `deploy/templates/` | Entry point templates | Tracked |
| `deploy/default/` | Local entry points (generated) | Ignored |
| `groups/` | Group templates (CLAUDE.md) | Tracked |
| `__data/store/` | SQLite database | Ignored |
| `__data/groups/` | Runtime group data | Ignored |
| `__data/sessions/` | Claude sessions per group | Ignored |
| `__data/ipc/` | Container IPC files | Ignored |
| `__data/logs/` | Service logs | Ignored |
