---
name: add-channel-slack-block-kit-embed
description: Switch Slack channel to Block Kit Embed rich display with colored left-border attachments. Triggers on "add slack embed", "enable slack embed", "slack block kit embed", "rich slack embed", "slack embed 表示".
---

# Switch to Slack Block Kit Embed Display

Switch Slack rendering to the Block Kit **Embed** variant, which wraps Block Kit blocks in Slack `attachments` with a `color` field. This renders a colored vertical bar on the left of each message — matching the look of the Discord Embed display mode.

**Before (plain Block Kit):** Formatted blocks without a colored side bar.
**After (Embed):** Same Block Kit content, but each message has a colored left border — blurple for agent replies, per-tool colors for tool notifications, gray for thinking / 💰 cost footer.

## Prerequisites

Slack must already be configured (either `@nagi/channel-slack` or `@nagi/channel-slack-block-kit`). If not, run `/add-channel-slack` first.

## Steps

### 1. Check current state

Read `deploy/{ASSISTANT_NAME}/host/entry.ts` and check which Slack import is used:

```typescript
// Plain text
const { createSlackFactory } = await import("@nagi/channel-slack");

// Block Kit (no colored bar)
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit");

// Block Kit Embed (colored left bar — this skill)
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit-embed");
```

If already using `@nagi/channel-slack-block-kit-embed`, tell the user it's already enabled.

### 2. Switch import

In `deploy/{ASSISTANT_NAME}/host/entry.ts`, replace the Slack import:

```typescript
// Before
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit");

// After
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit-embed");
```

No other changes needed — the factory function, config, and registration are identical.

**Note:** Do NOT change `deploy/templates/host/entry.template.ts`. The template should keep the default `@nagi/channel-slack`. Embed is a local customization in `deploy/{ASSISTANT_NAME}/host/entry.ts` only.

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

> Send a message in Slack (e.g. `@ai こんばんは`).
> The agent reply should now appear with a **blurple left border**, and the cost footer (`💰 ...`) should appear right after with a **gray left border**. Tool notifications during the response get per-tool colors (Bash blue, Read green, etc.).

## Reverting

To switch back to plain Block Kit (no colored bar):

```typescript
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit");
```

Or all the way back to plain text:

```typescript
const { createSlackFactory } = await import("@nagi/channel-slack");
```

Then restart nagi.
