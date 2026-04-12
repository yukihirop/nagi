---
name: add-channel-discord-embed
description: Switch Discord channel to Embed rich display for tool notifications. Triggers on "add discord embed", "enable discord embed", "discord embed", "rich discord", "discord rich display".
---

# Switch to Discord Embed Display

Switch from plain text Discord notifications to Embed rich display. Tool notifications and thinking indicators will be shown as colored Discord Embeds instead of plain text.

## Prerequisites

Discord must already be configured. If not, set up the Discord bot first.

## Steps

### 1. Check current state

Read `deploy/{ASSISTANT_NAME}/host/entry.ts` and check which Discord import is used:

```typescript
// Plain text (current default)
const { createDiscordFactory } = await import("@nagi/channel-discord");

// Embed (rich display)
const { createDiscordFactory } = await import("@nagi/channel-discord-embed");
```

If already using `@nagi/channel-discord-embed`, tell the user it's already enabled.

### 2. Switch import

In `deploy/{ASSISTANT_NAME}/host/entry.ts`, replace the Discord import:

```typescript
// Before
const { createDiscordFactory } = await import("@nagi/channel-discord");

// After
const { createDiscordFactory } = await import("@nagi/channel-discord-embed");
```

No other changes needed — the factory function, config, and registration are identical.

**Note:** Do NOT change `deploy/templates/host/entry.template.ts`. The template should keep the default `@nagi/channel-discord`. Embed is a local customization in `deploy/{ASSISTANT_NAME}/host/entry.ts` only.

### 3. Verify

```bash
pnpm exec tsc --noEmit
```

### 4. Restart nagi

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}
sleep 2
launchctl list | grep com.nagi.{ASSISTANT_NAME}
```

### 5. Test

Tell user:

> Send a message in Discord that triggers tool use.
> Tool notifications should now appear as colored Embeds instead of plain text.

## Reverting to plain text

To switch back, reverse the import in `deploy/{ASSISTANT_NAME}/host/entry.ts`:

```typescript
const { createDiscordFactory } = await import("@nagi/channel-discord");
```

Then restart nagi.
