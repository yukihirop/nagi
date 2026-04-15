# Agent Hooks Skills

Skills for setting up real-time notifications to chat channels (Slack, Discord, Asana) when agents execute tools or start sessions inside containers.

## What Are Agent Hooks?

When a Nagi agent processes a request, it calls various tools behind the scenes -- reading files, running shell commands, searching code, and so on. By default, the user who sent the request sees only the final reply. Agent hooks change that by streaming **live progress notifications** into the chat channel as the agent works.

This gives you visibility into what the agent is actually doing, how far along it is, and whether it has taken an unexpected path -- all without waiting for the final answer.

### Hook Types

| Hook | When it fires | Example notification |
|---|---|---|
| **PostToolUse** | After each tool execution | `🔧 Bash: ls -la /workspace/group` |
| **SessionStart** | When the agent begins processing | `💭 Thinking...` (or a truncated summary of the agent's initial reasoning) |
| **PromptComplete** | After a prompt finishes | `💰 claude-sonnet-4-20250514 \| $0.0123 \| 1,200 in / 350 out` |

### Notification Details

**PostToolUse** notifications include an icon that varies by tool type:

| Icon | Tools |
|---|---|
| 🔧 | Bash |
| 📖 | Read |
| 📝 | Write |
| ✏️ | Edit |
| 📂 | Glob |
| 🔍 | Grep |
| ⚡ | Skill |
| 🤖 | Agent |
| 🌐 | WebSearch, WebFetch |
| 🔌 | Any MCP tool (`mcp__*`) |
| ⏰ | Task |
| 📋 | TodoWrite |

Each notification shows the tool name followed by a brief summary of its input -- for example, the file path for Read/Write/Edit, the shell command for Bash (truncated to 80 characters), or the search pattern for Grep.

Some tools are **skipped by default** to avoid noise: `mcp__nagi__send_message` and `mcp__nagi__list_tasks`. You can add more tools to the skip list via configuration (see below).

**SessionStart** notifications include the agent's initial thinking text when available, truncated to 200 characters.

**PromptComplete** notifications show the model name, cost, and token usage when available.

### When to Enable Hooks

Enable agent hooks when you want to:

- **Monitor agent progress** -- See what the agent is doing in real time instead of waiting for a final reply.
- **Debug unexpected behavior** -- If an agent's answer seems wrong, the tool trace shows exactly what files it read and what commands it ran.
- **Build trust with users** -- In shared channels, visible tool activity reassures people that the agent is actively working on their request.

You can enable just one hook type if the others are too noisy. For instance, enabling only `sessionStart` gives a lightweight "the agent is working" indicator without the per-tool detail.

---

## `/add-agent-hooks-claude-code` — Claude Code Hooks {#add-agent-hooks-claude-code}

Adds PostToolUse, SessionStart, and PromptComplete hooks to **Claude Code** containers. The plugin ships with the repository under `container/claude-code/plugins/agent-hooks/index.mjs` -- this skill wires it into your assistant's host and container entry files.

**Triggers:** `add agent hooks`, `enable hooks`, `setup agent hooks`, `add hooks`

### What the skill does

1. Verifies the plugin file and entry files exist (prompts you to run `/setup` if they do not).
2. Registers `registerHooksPlugin()` in the host-side `deploy/{ASSISTANT_NAME}/host/entry.ts`.
3. Adds the plugin import block in the container-side `deploy/{ASSISTANT_NAME}/container/claude-code/entry.ts`.
4. Runs a TypeScript compilation check.
5. Restarts the launchd service and asks you to test.

---

## `/add-agent-hooks-open-code` — Open Code Hooks {#add-agent-hooks-open-code}

Adds the same hooks to **Open Code** containers. Because the plugin uses the same IPC-based mechanism, the skill copies the plugin from `container/claude-code/plugins/agent-hooks/` if the Open Code copy does not already exist.

**Triggers:** `add open code hooks`, `enable open code hooks`, `setup open code hooks`

### What the skill does

1. Verifies the host entry file exists (prompts you to run `/setup` if it does not).
2. Copies the plugin to `container/open-code/plugins/agent-hooks/` if missing.
3. Registers `registerHooksPlugin()` in the host-side entry file.
4. Adds the plugin import block in the container-side entry template.
5. Rebuilds the Open Code container image and restarts the service.

---

## Configuration

After running either skill, you can fine-tune hooks in `deploy/{ASSISTANT_NAME}/host/entry.ts`:

```typescript
orchestrator.registerHooksPlugin({
  postToolUse: true,      // Send a notification after each tool call
  sessionStart: true,     // Send "Thinking..." when a session begins
  promptComplete: true,   // Send cost/token summary when a prompt completes
  skipTools: [            // Tools to silence (in addition to the defaults)
    "mcp__nagi__list_tasks",
  ],
});
```

Set any flag to `false` to disable that hook type. The `skipTools` array is merged with the built-in skip list (`mcp__nagi__send_message`, `mcp__nagi__list_tasks`), so you only need to add extras.
