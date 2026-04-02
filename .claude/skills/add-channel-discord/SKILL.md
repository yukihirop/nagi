---
name: add-channel-discord
description: Add Discord as a channel. Uses Gateway intents with bot token. Triggers on "add discord", "setup discord", "connect discord", "add channel discord".
---

# Add Discord Channel

This skill configures Discord for nagi — bot creation, token setup, group registration, and verification.

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Phase 1: Pre-flight

### Check if already configured

```bash
grep -c "DISCORD_BOT_TOKEN" .env 2>/dev/null || echo "0"
```

If token already exists in `.env`, ask user: keep existing token or reconfigure?

### Check plugin is available

Verify `@nagi/channel-discord` is in `package.json` dependencies. If not:

```bash
pnpm add @nagi/channel-discord --filter nagi
pnpm build
```

### Check deploy/default/host/entry.ts has Discord registration

Read `deploy/default/host/entry.ts` and verify it contains `createDiscordFactory`. If not, add the Discord registration block from `deploy/templates/host/entry.template.ts`.

## Phase 2: Create Discord Bot

AskUserQuestion: Do you already have a Discord bot configured?

### If no — guide through creation:

1. Go to https://discord.com/developers/applications → **New Application**
2. Give it a name (e.g., "Nagi")
3. Go to **Bot** tab → **Reset Token** → Copy the token
4. Enable these **Privileged Gateway Intents**:
   - MESSAGE CONTENT INTENT
   - SERVER MEMBERS INTENT
5. Go to **OAuth2** → **URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`, `Create Public Threads`, `Send Messages in Threads`
   - Or use this URL (replace `CLIENT_ID`):
   ```
   https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=274877908992&scope=bot
   ```
6. Open the generated URL to invite the bot to your server

### Configure .env

Add to `.env`:

```
DISCORD_BOT_TOKEN=...
```

## Phase 3: Register Group

### Get channel ID

Tell user:

> 1. In Discord, right-click the channel → **Copy Channel ID**
>    (If "Copy Channel ID" is not visible, enable Developer Mode in Settings → App Settings → Advanced)
> 2. The JID format is: `dc:CHANNEL_ID` (e.g., `dc:1234567890`)

Wait for user to provide the channel ID.

### Register group

```bash
npx tsx -e "
import { createDatabase } from '@nagi/db';
import fs from 'fs';

const db = createDatabase({ path: '__data/store/messages.db' });
db.groups.set('dc:CHANNEL_ID', {
  name: 'Discord Main',
  folder: 'discord_main',
  trigger: '@Nagi',
  added_at: new Date().toISOString(),
  isMain: false,
  requiresTrigger: true,
});
db.close();

fs.mkdirSync('__data/groups/discord_main', { recursive: true });
console.log('Discord group registered');
"
```

Replace `CHANNEL_ID` with the actual channel ID. Adjust `name`, `folder`, `trigger`, `isMain`, and `requiresTrigger` as needed.

## Phase 4: Verify

### Start nagi

```bash
pnpm dev
```

Look for these log lines:
- `Discord channel registered` — plugin loaded
- `Discord bot connected` — bot online
- `groupCount` includes the new group

### Test

Tell user:

> Send a message in your registered Discord channel:
> - **If trigger required:** `@Nagi hello`
> - **If main (no trigger):** Any message works
>
> The bot should respond within a few seconds.

### If no response, check:

1. **Bot added to server?** — Bot must be invited via OAuth2 URL
2. **Bot has channel access?** — Check channel permissions
3. **Group registered?** — Check DB
4. **MESSAGE CONTENT INTENT enabled?** — Required for reading message content
5. **Docker running?** — `docker info`
6. **Container image built?** — `docker images nagi-agent`

## Troubleshooting

### Bot not receiving messages

1. Verify MESSAGE CONTENT INTENT is enabled in Discord Developer Portal
2. Verify bot has access to the channel
3. Verify bot is online (green dot in server member list)

### "Used disallowed intents" error

Enable the required intents in Discord Developer Portal → Bot → Privileged Gateway Intents:
- MESSAGE CONTENT INTENT
- SERVER MEMBERS INTENT

### Getting channel ID

- Enable Developer Mode: User Settings → App Settings → Advanced → Developer Mode
- Right-click channel → Copy Channel ID
