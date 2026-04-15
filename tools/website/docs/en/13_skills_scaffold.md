# Plugin Scaffolding Skills

Developer skills for generating new plugin boilerplate. Each skill interactively gathers configuration, generates a complete package, registers it in the deploy templates, and tells you what to implement next.

All three skills use `AskUserQuestion` prompts to collect the information they need — you just invoke the slash command and answer the questions.

## `/create-plugin-channel` — Create Channel Plugin {#create-plugin-channel}

Scaffold a new channel plugin that connects nagi to a messaging platform (following the pattern of the existing `channel-slack` and `channel-discord` plugins).

**Triggers:** `create channel plugin`, `new channel`, `scaffold channel`, `add channel plugin`

### What it asks you

| Question | Example |
|----------|---------|
| Channel name (lowercase) | `telegram`, `line` |
| One-line description | "Telegram bot channel via grammy library" |
| SDK / library | `grammy`, `whatsapp-web.js` |
| Required credentials (env var) | `TELEGRAM_BOT_TOKEN` |
| JID prefix | `tg:` for Telegram, `wa:` for WhatsApp |

### Generated file structure

```
host/plugins/channel-{name}/
├── package.json            # @nagi/channel-{name}, deps on channel-core / types / logger
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts            # Re-exports channel class + factory + config type
    ├── {name}-channel.ts   # Channel interface implementation with TODO stubs
    └── __tests__/
        └── {name}-channel.test.ts   # Basic unit tests (name, ownsJid, factory)
```

The skill also:

- Adds `@nagi/channel-{name}` to the root `package.json` workspace dependencies.
- Appends a registration block to `deploy/templates/host/entry.template.ts` that conditionally imports the channel when its env var is set.

### Customizing after scaffolding

The generated `{name}-channel.ts` contains TODO comments at every method that needs real logic:

| Method | What to implement |
|--------|-------------------|
| `constructor` | Initialize the SDK client |
| `connect()` | Start the SDK, register message handlers, call `opts.onChatMetadata()` for all incoming messages and `opts.onMessage()` for registered groups |
| `sendMessage()` | Extract the channel ID from the JID and send text (must never throw) |
| `setTyping()` | Send a typing indicator, or leave as no-op |
| `syncGroups()` | Discover available groups/channels and call `opts.onChatMetadata()` for each |

### Key design rules

- **JID format:** `{prefix}:{platformId}` — must be unique across all channels.
- **`ownsJid`:** Must match the JID prefix exactly.
- **`sendMessage`:** Must never throw — log errors and return.
- **`onMessage`:** Only call for registered groups (`opts.registeredGroups()[jid]`).
- **`onChatMetadata`:** Call for ALL messages (enables group discovery).
- **Mention translation:** Convert platform-specific mentions (e.g., `<@BOT_ID>`) to trigger pattern format (`@AssistantName`).

### Development workflow

```bash
# 1. Install dependencies
pnpm install

# 2. Implement the Channel interface in src/{name}-channel.ts

# 3. Add the SDK dependency
pnpm --filter @nagi/channel-{name} add grammy   # (or whichever SDK)

# 4. Build & test
pnpm build
pnpm --filter @nagi/channel-{name} test

# 5. Sync entry.ts and add credentials
#    Run /deploy (select Host), then add the token to .env

# 6. Restart
#    Run /nagi-restart
```

### Reference implementations

- `host/plugins/channel-slack/` — Socket Mode, thread replies, message queueing, user name cache
- `host/plugins/channel-discord/` — Gateway intents, thread creation, attachment handling, 2000-char splitting

---

## `/create-container-plugin-mcp` — Create MCP Plugin {#create-container-plugin-mcp}

Scaffold a new MCP plugin that runs as a stdio MCP server inside agent containers (following the pattern of `mcp-ollama` and `mcp-vercel`).

**Triggers:** `create mcp plugin`, `new mcp plugin`, `add mcp`, `scaffold mcp`

### What it asks you

| Question | Example |
|----------|---------|
| Plugin name (lowercase, no `mcp-` prefix) | `youtube`, `github` |
| One-line description | "YouTube analytics and video search" |
| API token env var (if any) | `YOUTUBE_API_KEY` |
| Target Dockerfile (Claude Code / Open Code / Both) | Claude Code |

### Generated file structure

```
container/plugins/mcp-{name}/
├── package.json     # @nagi/mcp-{name}, deps on @modelcontextprotocol/sdk + zod
├── tsconfig.json
└── src/
    └── index.ts     # Starter MCP server with a placeholder tool
```

The skill also:

- Adds a `COPY` + `RUN` block to the selected agent Dockerfile(s) so the plugin is built into the container image.
- Appends an `orchestrator.registerMcpPlugin()` call to `deploy/templates/host/entry.template.ts`. If an API token is required, the registration is conditional on the env var being set.

### Customizing after scaffolding

The generated `src/index.ts` contains a single placeholder tool (`{name}_hello`). Replace it with real tools using the `@modelcontextprotocol/sdk` API:

```typescript
server.tool(
  "tool_name",
  "Description of what this tool does",
  {
    param: z.string().describe("Parameter description"),
  },
  async (args) => {
    // Implementation
    return {
      content: [{ type: "text" as const, text: "result" }],
    };
  },
);
```

Environment variables declared in the `registerMcpPlugin` `env` option are passed into the container process and accessible via `process.env`.

### Development workflow

```bash
# 1. Install dependencies
pnpm install

# 2. Implement tools in src/index.ts

# 3. Build
pnpm build

# 4. Rebuild the Docker image
./container/claude-code/build.sh    # and/or open-code

# 5. Sync entry.ts and add credentials
#    Run /deploy (select Host)
#    If API token needed, add it to .env

# 6. Restart and test
#    Run /nagi-restart, then send a message asking the agent to use the new tool
```

### Reference implementations

- `container/plugins/mcp-ollama/` — No API token, connects to local Ollama via `host.docker.internal`
- `container/plugins/mcp-vercel/` — Requires `VERCEL_API_TOKEN`, calls external REST API

---

## `/create-container-plugin-agent-hooks` — Create Agent Hooks Plugin {#create-container-plugin-agent-hooks}

Scaffold a new agent hooks plugin with hook factories and deploy template registration. Agent hooks send real-time notifications (tool execution, session start) back to chat channels via IPC.

**Triggers:** `create agent hooks plugin`, `new agent hooks`, `scaffold agent hooks`

### What it asks you

| Question | Example |
|----------|---------|
| Plugin name (lowercase) | `open-code`, `cursor` |
| One-line description | "Tool execution and session notifications for Open Code" |
| Hook types to support | PostToolUse, SessionStart, or both |
| Target agent (Claude Code / Open Code / Both) | Claude Code |
| Target entry.template.ts | `deploy/templates/container/claude-code/entry.template.ts` |

### Generated file structure

```
container/{agent}/plugins/agent-hooks-{name}/
└── index.mjs     # Pure JavaScript ES Module — no TypeScript, no build step
```

Unlike the other two plugin types, agent-hooks plugins are a **single `.mjs` file** with no `package.json` or build step. They are loaded at runtime via dynamic `import()`.

The skill also appends a `try/catch` registration block to the selected container `entry.template.ts` that imports the hook factories and wires them into the plugin system.

### Generated hook factories

Depending on your selection, the file exports one or both of:

| Export | Purpose |
|--------|---------|
| `createPostToolUseHook(chatJid, groupFolder, extraSkipTools, log)` | Called after every tool invocation. Sends a notification to the chat channel. Skips internal tools like `mcp__nagi__send_message` to avoid loops. |
| `createSessionStartHook(chatJid, groupFolder, log)` | Called when a new agent session begins. Sends a "Thinking..." message to the chat channel. |

Both factories return async hook callbacks. Notifications are delivered by writing JSON files to `/workspace/ipc/messages/` which the host process picks up.

### Key design rules

- **Pure JavaScript** — Single `index.mjs` file, no TypeScript, no build step.
- **IPC messaging** — Write JSON to `/workspace/ipc/messages/` for the host to consume.
- **Atomic writes** — Always write to a `.tmp` file first, then `fs.renameSync` (prevents partial reads).
- **Never throw** — Wrap all hook logic in try/catch; log errors and return `{}`.
- **Skip internal tools** — Always skip `mcp__nagi__send_message` to avoid notification loops.

### Development workflow

```bash
# 1. Edit the generated index.mjs to customize notification format

# 2. Verify TypeScript still compiles (entry template references the plugin)
pnpm exec tsc --noEmit

# 3. Sync container entry
#    Run /deploy and select the target agent

# 4. Rebuild Docker image
./container/claude-code/build.sh    # and/or open-code

# 5. Restart and test
#    Run /nagi-restart, then trigger tool use from chat
```

### Reference implementation

- `container/claude-code/plugins/agent-hooks/` — PostToolUse (tool icons + summary) and SessionStart ("Thinking..." message)
