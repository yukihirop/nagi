---
name: add-agent-hooks-claude-code
description: Add agent-hooks-claude-code plugin for sending tool execution and session start notifications to chat channels. Triggers on "add agent hooks", "enable hooks", "setup agent hooks", "add hooks".
---

# Add Agent Hooks (Claude Code)

Enable PostToolUse and SessionStart hooks that send real-time notifications to the chat channel when the agent executes tools or starts a session.

## What it does

- **PostToolUse** — Sends a message like `` 🔧 `Bash: ls -la /workspace/group` `` to the chat channel after each tool execution
- **SessionStart** — Sends `💭 Thinking...` when a new session begins

## Steps

### 1. Check prerequisites

```bash
test -f container/plugins/agent-hooks-claude-code/index.mjs && echo "PLUGIN_EXISTS" || echo "PLUGIN_MISSING"
test -f entry.ts && echo "ENTRY_EXISTS" || echo "ENTRY_MISSING"
test -f container/entry.ts && echo "CONTAINER_ENTRY_EXISTS" || echo "CONTAINER_ENTRY_MISSING"
```

If plugin is missing, something is wrong — the plugin ships with the repo.

If `entry.ts` is missing, run `/setup` first.

If `container/entry.ts` is missing:
```bash
cp container/entry.template.ts container/entry.ts
```

### 2. Enable hooks in entry.ts (host side)

Read `entry.ts` and check if `registerHooksPlugin` is already called.

If not present, add after the MCP plugin registrations:

```typescript
// Register agent hooks (PostToolUse / SessionStart notifications to chat)
orchestrator.registerHooksPlugin({
  postToolUse: true,
  sessionStart: true,
});
```

### 3. Enable hooks in container/entry.ts (container side)

Read `container/entry.ts` and check if the `agent-hooks-claude-code` plugin is loaded.

If not present, ensure the plugin import block exists:

```typescript
try {
  const pluginPath = "/app/plugins/agent-hooks-claude-code/index.mjs";
  const agentHooks = await import(/* webpackIgnore: true */ pluginPath);

  plugins.push({
    name: "agent-hooks-claude-code",
    createHooks: (
      chatJid: string,
      groupFolder: string,
      hooksConfig: { postToolUse?: boolean; sessionStart?: boolean; skipTools?: string[] } | undefined,
      log: (msg: string) => void,
    ) => ({
      ...(hooksConfig?.postToolUse !== false ? {
        PostToolUse: [{ hooks: [agentHooks.createPostToolUseHook(chatJid, groupFolder, hooksConfig?.skipTools, log)] }],
      } : {}),
      ...(hooksConfig?.sessionStart !== false ? {
        SessionStart: [{ hooks: [agentHooks.createSessionStartHook(chatJid, groupFolder, log)] }],
      } : {}),
    }),
  });
} catch {
  // Plugin not available, skip
}
```

### 4. Verify

```bash
pnpm exec tsc --noEmit
```

TypeScript must compile without errors.

### 5. Restart nagi

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi
sleep 2
launchctl list | grep com.nagi
```

### 6. Test

Tell user to send a message in Slack/Discord that triggers tool use (e.g. `@ai /workspace/group の中身を教えて`).

Expected: tool execution notifications appear in the chat channel as code-formatted messages.

## Configuration options

In `entry.ts`, the hooks can be customized:

```typescript
orchestrator.registerHooksPlugin({
  postToolUse: true,      // Enable/disable tool use notifications
  sessionStart: true,     // Enable/disable "Thinking..." message
  skipTools: [            // Additional tools to skip (mcp__nagi__send_message is always skipped)
    "mcp__nagi__list_tasks",
  ],
});
```

Set `postToolUse: false` or `sessionStart: false` to disable individual hooks.
