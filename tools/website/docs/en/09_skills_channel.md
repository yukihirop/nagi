# Channel Plugin Skills

Skills for connecting messaging platforms to Nagi. Each channel plugin lets Nagi receive messages from and respond to a specific platform. Display-mode skills change how notifications (tool execution, thinking indicators, cost footers) are rendered without altering the underlying connection.

## Overview

| Skill | Platform | Purpose |
|---|---|---|
| `/add-channel-slack` | Slack | Connect Slack via Socket Mode |
| `/add-channel-slack-block-kit` | Slack | Switch to Block Kit rich display |
| `/add-channel-slack-block-kit-embed` | Slack | Switch to Block Kit Embed display (colored borders) |
| `/add-channel-discord` | Discord | Connect Discord via Gateway Intents |
| `/add-channel-discord-embed` | Discord | Switch to Embed rich display |
| `/add-channel-asana` | Asana | Connect Asana via comment polling |

---

## Slack

### `/add-channel-slack` — Connect Slack {#add-channel-slack}

Connect Slack using Socket Mode (no public URL required). The skill walks you through bot token and app-level token setup, channel registration, and group creation.

**Triggers:** `add slack`, `setup slack`, `connect slack`, `add channel slack`

#### Prerequisites

- A Slack workspace where you can install apps
- Permission to create a Slack app (or an existing one)

#### Tokens needed

| Token | Prefix | Where to find it |
|---|---|---|
| Bot User OAuth Token | `xoxb-...` | OAuth & Permissions page |
| App-Level Token | `xapp-...` | Basic Information > App-Level Tokens (scope: `connections:write`) |

Both tokens are stored in `deploy/{ASSISTANT_NAME}/.env` as `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN`.

#### Required OAuth scopes

`channels:history`, `channels:read`, `chat:write`, `groups:history`, `groups:read`, `im:history`, `im:read`, `users:read`

#### Required bot events

`message.channels`, `message.groups`, `message.im`

#### Setup tips

- The skill provides a ready-to-paste YAML manifest for creating the app, so you do not need to configure scopes and events manually.
- Socket Mode must be enabled in the app settings -- this is included in the manifest.
- After installing the app, the bot must be explicitly added to each channel it should monitor (Integrations > Add apps).
- The JID format for Slack groups is `slack:C0123456789` where the `C...` part is the channel ID from the channel URL.

#### Supported features

- Public channels, private channels, and direct messages
- Thread replies (bot replies in the same thread)
- Multi-channel operation alongside Discord or Asana
- Message queueing during disconnects, flushed on reconnect

---

### Slack display modes {#slack-display-modes}

Slack supports three display modes for tool execution notifications. All three use the same `createSlackFactory` function and identical configuration -- only the import path changes in `deploy/{ASSISTANT_NAME}/host/entry.ts`.

| Mode | Package | Appearance |
|---|---|---|
| **Plain text** (default) | `@nagi/channel-slack` | Inline text like `Bash: ls -la` |
| **Block Kit** | `@nagi/channel-slack-block-kit` | Rich cards with tool name header, code block, and divider |
| **Block Kit Embed** | `@nagi/channel-slack-block-kit-embed` | Block Kit content wrapped in colored left-border attachments (similar to Discord embeds) |

To switch modes, change the import in `deploy/{ASSISTANT_NAME}/host/entry.ts`:

```typescript
// Plain text (default)
const { createSlackFactory } = await import("@nagi/channel-slack");

// Block Kit
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit");

// Block Kit Embed
const { createSlackFactory } = await import("@nagi/channel-slack-block-kit-embed");
```

Do NOT change `deploy/templates/host/entry.template.ts` -- the template should keep the default. Display mode is a local customization per assistant.

#### `/add-channel-slack-block-kit` — Slack Block Kit Display {#add-channel-slack-block-kit}

Switch Slack channel display to Block Kit rich format. Tool execution notifications appear as formatted blocks instead of plain text.

**Triggers:** `add block kit`, `enable block kit`, `slack block kit`, `rich slack`, `slack rich display`

**Prerequisite:** Slack must already be connected via `/add-channel-slack`.

#### `/add-channel-slack-block-kit-embed` — Slack Block Kit Embed Display {#add-channel-slack-block-kit-embed}

Switch Slack to the Block Kit Embed variant. Each message gets a colored vertical bar on the left side:

- **Blurple** for agent replies
- **Per-tool colors** for tool notifications (e.g. blue for Bash, green for Read)
- **Gray** for thinking indicators and cost footers

**Triggers:** `add slack embed`, `enable slack embed`, `slack block kit embed`, `rich slack embed`

**Prerequisite:** Slack must already be connected via `/add-channel-slack`.

#### Reverting display modes

Run the same skill for the mode you want, or manually change the import back. Restart Nagi after switching.

---

## Discord

### `/add-channel-discord` — Connect Discord {#add-channel-discord}

Connect Discord using Gateway Intents as a bot. The skill guides you through bot creation, token setup, server invitation, group registration, and connection verification.

**Triggers:** `add discord`, `setup discord`, `connect discord`, `add channel discord`

#### Prerequisites

- A Discord server where you have permission to add bots
- Access to the [Discord Developer Portal](https://discord.com/developers/applications)

#### Token needed

| Token | Where to find it |
|---|---|
| Bot Token | Developer Portal > Application > Bot > Reset Token |

Stored in `deploy/{ASSISTANT_NAME}/.env` as `DISCORD_BOT_TOKEN`.

#### Required privileged Gateway Intents

These must be enabled in the Developer Portal under Bot > Privileged Gateway Intents:

- **MESSAGE CONTENT INTENT** -- required to read message content
- **SERVER MEMBERS INTENT**

#### Required bot permissions

`Send Messages`, `Read Message History`, `Create Public Threads`, `Send Messages in Threads`

#### Setup tips

- Developer Mode must be enabled in Discord (Settings > App Settings > Advanced) to copy channel IDs.
- The JID format for Discord groups is `dc:CHANNEL_ID` (e.g. `dc:1234567890`).
- The skill provides an OAuth2 URL template for inviting the bot to your server.
- If you see a "Used disallowed intents" error, enable the required intents in the Developer Portal and restart.

#### Supported features

- Trigger-based or main-channel (no trigger) operation
- Multi-channel operation alongside Slack or Asana

---

### `/add-channel-discord-embed` — Discord Embed Display {#add-channel-discord-embed}

Switch Discord channel display to Embed rich format. Tool notifications appear as colored embedded messages instead of plain text.

**Triggers:** `add discord embed`, `enable discord embed`, `discord embed`, `rich discord`, `discord rich display`

**Prerequisite:** Discord must already be connected via `/add-channel-discord`.

Like Slack display modes, switching is done by changing the import in `deploy/{ASSISTANT_NAME}/host/entry.ts`:

```typescript
// Plain text (default)
const { createDiscordFactory } = await import("@nagi/channel-discord");

// Embed (rich display)
const { createDiscordFactory } = await import("@nagi/channel-discord-embed");
```

Do NOT change `deploy/templates/host/entry.template.ts`. Restart Nagi after switching.

---

## Asana

### `/add-channel-asana` — Connect Asana {#add-channel-asana}

Connect Asana as a channel. Uses polling to watch task comments for trigger-pattern matches (e.g. `@ai ...`) and forwards them to the agent. No public URL or webhooks are needed.

**Triggers:** `add asana`, `setup asana`, `connect asana`, `add channel asana`

#### Prerequisites

- An Asana account with access to the projects you want to watch
- Permission to create a Personal Access Token

#### Token needed

| Token | Prefix | Where to create it |
|---|---|---|
| Personal Access Token (PAT) | `1/` | [My Apps](https://app.asana.com/0/my-apps) > Create new token |

Stored in `deploy/{ASSISTANT_NAME}/.env` as `ASANA_PAT`. The PAT inherits the permissions of your Asana user, so the bot acts as you in every workspace.

#### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ASANA_PAT` | Yes | Personal Access Token |
| `ASANA_PROJECT_GIDS` | Yes | Comma-separated project GIDs to watch |
| `ASANA_USER_GID` | No | Your Asana user GID (auto-resolved via `/users/me` if omitted) |
| `ASANA_POLL_INTERVAL_MS` | No | Polling interval in ms (default: 60000, minimum: 10000) |

#### How it works

Asana uses polling rather than webhooks because workspace-level webhooks do not deliver comment events and the workspace events API is Enterprise+ only. The flow is:

1. A trigger comment (e.g. `@ai ...`) is detected on a watched task
2. Nagi creates a **subtask** under the triggering task, named `ai > {first line of request}`
3. A short pointer comment is posted on the parent task linking to the subtask
4. The agent's reply (plus thinking/cost notifications if agent-hooks is enabled) goes to the subtask
5. Follow-up `@ai` comments inside the subtask continue the same conversation without creating another nesting level

#### Setup tips

- The trigger must appear at the start of the comment body (after HTML stripping). Leading text before `@ai` will prevent matching.
- Comments authored by the bot's own user GID are ignored to prevent loops.
- Project GIDs can be found in the Asana URL: `https://app.asana.com/0/{PROJECT_GID}/...`
- The JID format for Asana groups is `asana:{PROJECT_GID}`.
- Shorter polling intervals reduce latency but consume more of the 150 req/min API rate limit. Keep the default 60s unless you have a specific need.

#### Supported features

- Project-level watching (one group per project)
- Trigger-pattern detection on task comments
- Auto-subtask replies to keep parent tasks clean
- Subtask follow-ups for multi-turn conversations
- Task context injection (task name, description, comment history included automatically)
- Comment-only filtering (system stories like assignments are ignored)
- Self-reply guard via user GID
- Increment-only polling to minimize API calls
- Multi-channel operation alongside Slack or Discord

#### Known limitations

- **Reply routing is last-write-wins** per project -- if two triggers arrive between poll ticks, the reply goes to whichever was processed last
- **In-memory watchlist** -- after a restart, follow-ups on old agent subtasks are no longer picked up (start a new conversation by triggering on the parent task again)
- **In-memory cursors** -- triggers that arrive during downtime are skipped
- **PAT = your identity** -- the bot acts as you with all your permissions
- **Polling latency** -- default 60s delay; adjustable via `ASANA_POLL_INTERVAL_MS`
- **No attachment support** -- Asana attachments in comments are not forwarded

---

## Display mode comparison

All display-mode skills work by swapping a single import line. No other code changes are needed because every variant exports the same factory function with the same interface.

| Platform | Default | Rich | Rich + colored border |
|---|---|---|---|
| Slack | `@nagi/channel-slack` | `@nagi/channel-slack-block-kit` | `@nagi/channel-slack-block-kit-embed` |
| Discord | `@nagi/channel-discord` | -- | `@nagi/channel-discord-embed` |

After changing the import, run `pnpm exec tsc --noEmit` to verify TypeScript compiles, then restart Nagi.
