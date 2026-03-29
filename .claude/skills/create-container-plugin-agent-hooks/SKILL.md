---
name: create-container-plugin-agent-hooks
description: Scaffold a new agent-hooks plugin for nagi containers. Generates index.mjs with hook factories and container/claude-code/entry.template.ts registration. Triggers on "create agent hooks plugin", "new agent hooks", "scaffold agent hooks".
---

# Create Agent-Hooks Plugin

Scaffold a new agent-hooks plugin that runs inside agent containers and sends notifications to chat channels via IPC, following the established pattern (agent-hooks-claude-code).

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Step 1: Gather information

AskUserQuestion:
1. Plugin name (lowercase — e.g., "open-code", "cursor", "windsurf")
2. One-line description (e.g., "Tool execution and session notifications for Open Code")
3. Which hook types to support? (PostToolUse, SessionStart, or both)

The full plugin name will be `agent-hooks-{name}`.

## Step 2: Generate plugin

Create `container/plugins/agent-hooks-{name}/` with a single file:

### index.mjs

Agent-hooks plugins are pure JavaScript ES Modules — no TypeScript, no build step, no package.json.

Generate from this template:

```javascript
/**
 * Agent Hooks: {Name}
 * {description}
 */

import fs from "node:fs";
import path from "node:path";

const MESSAGES_DIR = "/workspace/ipc/messages";

function writeIpcMessage(chatJid, groupFolder, text) {
  fs.mkdirSync(MESSAGES_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(MESSAGES_DIR, filename);
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify({
    type: "message",
    chatJid,
    text,
    groupFolder,
    timestamp: new Date().toISOString(),
  }));
  fs.renameSync(tempPath, filepath);
}
```

**If PostToolUse is supported**, add:

```javascript
const DEFAULT_SKIP_TOOLS = ["mcp__nagi__send_message", "mcp__nagi__list_tasks"];

export function createPostToolUseHook(chatJid, groupFolder, extraSkipTools, log) {
  const skipTools = new Set([...DEFAULT_SKIP_TOOLS, ...(extraSkipTools ?? [])]);
  return async (input) => {
    try {
      const name = input.tool_name;
      log(`[hook:PostToolUse] tool=${name} chatJid=${chatJid}`);
      if (!name || !chatJid || skipTools.has(name)) return {};
      // TODO: Customize tool display format for {name}
      const text = `\u{2699}\uFE0F \`${name}\``;
      writeIpcMessage(chatJid, groupFolder, text);
      log(`[hook:PostToolUse] sent: ${text}`);
    } catch (err) {
      log(`[hook:PostToolUse] error: ${err}`);
    }
    return {};
  };
}
```

**If SessionStart is supported**, add:

```javascript
export function createSessionStartHook(chatJid, groupFolder, log) {
  return async (input) => {
    try {
      log(`[hook:SessionStart] chatJid=${chatJid} source=${input?.source}`);
      if (!chatJid) return {};
      writeIpcMessage(chatJid, groupFolder, "\u{1F4AD} Thinking...");
      log("[hook:SessionStart] sent thinking message");
    } catch (err) {
      log(`[hook:SessionStart] error: ${err}`);
    }
    return {};
  };
}
```

Replace `{name}`, `{Name}`, `{description}` placeholders.

## Step 3: Add to container/claude-code/entry.template.ts

Add a new try/catch block after the existing agent-hooks-claude-code block:

```typescript
try {
  const pluginPath = "/app/plugins/agent-hooks-{name}/index.mjs";
  const agentHooks = await import(/* webpackIgnore: true */ pluginPath);

  plugins.push({
    name: "agent-hooks-{name}",
    createHooks: (
      chatJid: string,
      groupFolder: string,
      hooksConfig: { postToolUse?: boolean; sessionStart?: boolean; skipTools?: string[] } | undefined,
      log: (msg: string) => void,
    ) => ({
      // Include PostToolUse if supported:
      ...(hooksConfig?.postToolUse !== false ? {
        PostToolUse: [{ hooks: [agentHooks.createPostToolUseHook(chatJid, groupFolder, hooksConfig?.skipTools, log)] }],
      } : {}),
      // Include SessionStart if supported:
      ...(hooksConfig?.sessionStart !== false ? {
        SessionStart: [{ hooks: [agentHooks.createSessionStartHook(chatJid, groupFolder, log)] }],
      } : {}),
    }),
  });
} catch {
  // Plugin not available, skip
}
```

Remove hook type entries that were not selected in Step 1.

## Step 4: Verify

No build step needed — agent-hooks plugins are pure `.mjs` files loaded at runtime.

The plugin directory is automatically mounted into containers at `/app/plugins/` by the orchestrator (via `container/plugins/` → `/app/plugins/` bind mount).

Verify TypeScript still compiles:

```bash
pnpm exec tsc --noEmit
```

## Step 5: Next steps

Tell the user:

1. **Implement hooks** — Edit `container/plugins/agent-hooks-{name}/index.mjs` to customize notification format and behavior
2. **Sync container entry** — Run `/update-container-entry` to add the plugin to your local container/claude-code/entry.ts
3. **Rebuild Docker image** — `./container/claude-code/build.sh` (needed if this is the first plugin using new dependencies)
4. **Restart nagi** — Run `/nagi-restart`
5. **Test** — Send a message in Slack/Discord that triggers tool use

## Key design rules

- **Pure JavaScript** — No TypeScript, no build step. Single `index.mjs` file
- **IPC messaging** — Write JSON files to `/workspace/ipc/messages/` for the host to consume
- **Atomic writes** — Always write to `.tmp` then rename (prevents partial reads)
- **Never throw** — Wrap hook logic in try/catch, log errors and return `{}`
- **Skip internal tools** — Always skip `mcp__nagi__send_message` to avoid notification loops
- **Export factory functions** — `createPostToolUseHook()` and/or `createSessionStartHook()` that return async hook callbacks

## Reference

Existing agent-hooks plugins to study:
- `container/plugins/agent-hooks-claude-code/` — PostToolUse (tool icons, summary) + SessionStart ("Thinking...")
