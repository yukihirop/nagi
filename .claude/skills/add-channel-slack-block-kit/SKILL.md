---
name: add-channel-slack-block-kit
description: Switch Slack channel to Block Kit rich display for tool notifications. Triggers on "add block kit", "enable block kit", "slack block kit", "rich slack", "slack rich display".
---

# Switch to Slack Block Kit Display

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Switch from plain text Slack notifications to Block Kit rich display. Tool notifications and thinking indicators will be shown as formatted Slack blocks instead of plain text.

**Before:** `🔧 \`Bash: ls -la\``
**After:** Rich card with tool name header, code block, and divider

## Prerequisites

Slack must already be configured. If not, run `/add-channel-slack` first.

## Steps

### 1. Check current state

Read `deploy/{ASSISTANT_NAME}/host/entry.ts` and check which Slack import is used:

```typescript
// Plain text (current default)
const { createSlackFactory } = await import("@nagi/channel-slack");

// Block Kit (rich display)
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit");
```

If already using `@nagi/channel-slack-block-kit`, tell the user it's already enabled.

### 2. Switch import

In `deploy/{ASSISTANT_NAME}/host/entry.ts`, replace the Slack import:

```typescript
// Before
const { createSlackFactory } = await import("@nagi/channel-slack");

// After
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit");
```

No other changes needed — the factory function, config, and registration are identical.

**Note:** Do NOT change `deploy/templates/host/entry.template.ts`. The template should keep the default `@nagi/channel-slack`. Block Kit is a local customization in `deploy/{ASSISTANT_NAME}/host/entry.ts` only.

### 3. Verify

```bash
pnpm exec tsc --noEmit
```

TypeScript must compile without errors.

### 4. Restart nagi

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}
sleep 2
launchctl list | grep com.nagi.{ASSISTANT_NAME}
```

### 5. Test

Tell user:

> Send a message in Slack that triggers tool use (e.g. ask the bot to read a file).
> Tool notifications should now appear as formatted blocks with headers and dividers instead of plain text.

## Reverting to plain text

To switch back to plain text, reverse the import in `deploy/{ASSISTANT_NAME}/host/entry.ts`:

```typescript
const { createSlackFactory } = await import("@nagi/channel-slack");
```

Then restart nagi.
