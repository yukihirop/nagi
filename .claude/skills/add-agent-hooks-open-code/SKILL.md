---
name: add-agent-hooks-open-code
description: Add agent-hooks plugin for Open Code containers. Sends tool execution and session start notifications to chat channels. Triggers on "add open code hooks", "enable open code hooks", "setup open code hooks".
---

# Add Agent Hooks (Open Code)

Enable PostToolUse and SessionStart hooks for Open Code containers that send real-time notifications to the chat channel.

## What it does

- **PostToolUse** — Sends a message like `` 🔧 `Bash: ls -la /workspace/group` `` to the chat channel after each tool execution
- **SessionStart** — Sends `💭 Thinking...` when a new session begins

## Steps

### 1. Check prerequisites

```bash
test -f apps/entry.ts && echo "ENTRY_EXISTS" || echo "ENTRY_MISSING"
test -f container/open-code/entry.template.ts && echo "TEMPLATE_EXISTS" || echo "TEMPLATE_MISSING"
```

If `apps/entry.ts` is missing, run `/setup` first.

### 2. Create agent-hooks plugin for Open Code

Check if plugin already exists:
```bash
test -d container/open-code/plugins/agent-hooks && echo "EXISTS" || echo "MISSING"
```

If missing, copy from Claude Code's plugin (they share the same IPC-based logic):
```bash
mkdir -p container/open-code/plugins/agent-hooks
cp container/claude-code/plugins/agent-hooks/index.mjs container/open-code/plugins/agent-hooks/index.mjs
```

### 3. Enable hooks in apps/entry.ts (host side)

Read `apps/entry.ts` and check if `registerHooksPlugin` is already called.

If not present, add after the MCP plugin registrations:

```typescript
// Register agent hooks (PostToolUse / SessionStart notifications to chat)
orchestrator.registerHooksPlugin({
  postToolUse: true,
  sessionStart: true,
});
```

### 4. Enable hooks in container/open-code/entry.template.ts (container side)

Read `container/open-code/entry.template.ts` and check if the `agent-hooks` plugin is loaded.

If not present, ensure the plugin import block exists:

```typescript
try {
  const pluginPath = "/app/plugins/agent-hooks/index.mjs";
  const agentHooks = await import(/* webpackIgnore: true */ pluginPath);

  plugins.push({
    name: "agent-hooks",
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

### 5. Sync local entry.ts

```bash
cp container/open-code/entry.template.ts container/open-code/entry.ts
```

Or run `/update-container-entry` and select Open Code.

### 6. Rebuild and restart

```bash
./container/open-code/build.sh
launchctl kickstart -k gui/$(id -u)/com.nagi
sleep 2
launchctl list | grep com.nagi
```

### 7. Test

Tell user to send a message in Slack/Discord that triggers tool use.

Expected: tool execution notifications appear in the chat channel.
