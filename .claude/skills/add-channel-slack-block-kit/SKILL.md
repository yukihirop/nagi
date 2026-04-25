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

Switch the Slack channel to plain Block Kit rich display. Tool notifications and thinking indicators are shown as formatted Slack blocks, but without the colored left-border `attachments` wrapper that the Embed variant adds.

**Note:** The shipped default is `@nagi/channel-slack-block-kit-embed` (Block Kit + colored left border). This skill is mostly used to switch *down* from Embed to plain Block Kit if you don't want the colored bar, or to switch *up* from `@nagi/channel-slack` (plain text). To restore the default Embed display, use `/add-channel-slack-block-kit-embed`.

**Plain text:** `🔧 \`Bash: ls -la\``
**Block Kit:** Rich card with tool name header, code block, and divider (no colored bar)
**Block Kit Embed (default):** Same Block Kit content with a colored left border per message

## Prerequisites

Slack must already be configured. If not, run `/add-channel-slack` first.

## Steps

### 1. Check current state

Read `deploy/{ASSISTANT_NAME}/host/entry.ts` and check which Slack import is used:

```typescript
// Plain text
const { createSlackFactory } = await import("@nagi/channel-slack");

// Block Kit (rich display, no colored bar — this skill)
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit");

// Block Kit Embed (default — colored left bar)
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit-embed");
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
