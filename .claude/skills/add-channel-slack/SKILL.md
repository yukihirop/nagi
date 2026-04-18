---
name: add-channel-slack
description: Add Slack as a channel. Uses Socket Mode (no public URL needed). Triggers on "add slack", "setup slack", "connect slack", "add channel slack".
---

# Add Slack Channel

This skill configures Slack for nagi — token setup, group registration, and verification.

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Phase 0: Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントに Slack を追加しますか？** — 検出された各名前をオプションとして表示する。

Use the selected name as `{ASSISTANT_NAME}` throughout. The .env file is at `deploy/{ASSISTANT_NAME}/.env`.

## Phase 1: Pre-flight

### Check if already configured

```bash
grep -c "SLACK_BOT_TOKEN" deploy/{ASSISTANT_NAME}/.env 2>/dev/null || echo "0"
```

If tokens already exist in `deploy/{ASSISTANT_NAME}/.env`, ask user: keep existing tokens or reconfigure?

### Check plugin is available

Verify `@nagi/channel-slack` is in `package.json` dependencies (root or orchestrator). If not:

```bash
pnpm add @nagi/channel-slack --filter nagi
pnpm build
```

### Check deploy/{ASSISTANT_NAME}/host/entry.ts has Slack registration

Read `deploy/{ASSISTANT_NAME}/host/entry.ts` and verify it contains `createSlackFactory`. If not, add the Slack registration block from `deploy/templates/host/entry.template.ts`.

## Phase 2: Create Slack App

AskUserQuestion: Do you already have a Slack app configured?

### If no — guide through creation:

1. Go to https://api.slack.com/apps → **Create New App** → **From Manifest**
2. Select workspace, paste this manifest:

```yaml
display_information:
  name: Nagi
  description: AI Assistant
features:
  bot_user:
    display_name: Nagi
    always_online: true
oauth_config:
  scopes:
    bot:
      - channels:history
      - channels:read
      - chat:write
      - groups:history
      - groups:read
      - im:history
      - im:read
      - users:read
settings:
  event_subscriptions:
    bot_events:
      - message.channels
      - message.groups
      - message.im
  interactivity:
    is_enabled: false
  org_deploy_enabled: false
  socket_mode_enabled: true
```

3. **Install to workspace** (OAuth & Permissions page)
4. **Generate App-Level Token:**
   - Settings → Basic Information → App-Level Tokens → Generate Token
   - Name: `socket-mode`
   - Scope: `connections:write`
   - Copy the `xapp-...` token
5. **Copy Bot Token:**
   - OAuth & Permissions → Bot User OAuth Token
   - Copy the `xoxb-...` token

### Configure .env

Add to `deploy/{ASSISTANT_NAME}/.env`:

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
```

## Phase 3: Register Channel

### Add bot to channel

Tell user:

> 1. In Slack, go to the channel you want the bot to respond in
> 2. Right-click channel → **View channel details** → **Integrations** → **Add apps** → Add **Nagi**
> 3. Get the channel ID:
>    - Right-click channel name → **Copy link**
>    - Channel ID is the `C...` part at the end of the URL
>    - Example: `https://app.slack.com/client/T.../C0123456789` → ID is `C0123456789`
>
> The JID format is: `slack:C0123456789`

Wait for user to provide the channel ID.

### Register main group

Register the group in the database:

```bash
node -e "
const { createDatabase } = require('./libs/db/dist/index.js');
const fs = require('fs');
const db = createDatabase({ path: '__data/{ASSISTANT_NAME}/store/nagi.db' });
db.groups.set('slack:CHANNEL_ID', {
  name: 'Main',
  channel: 'slack',
  folder: 'main',
  trigger: '@{ASSISTANT_NAME}',
  added_at: new Date().toISOString(),
  isMain: true,
  requiresTrigger: false,
});
db.close();
fs.mkdirSync('__data/{ASSISTANT_NAME}/groups/main', { recursive: true });
console.log('Main group registered');
"
```

Replace `CHANNEL_ID` with the actual channel ID.

### Register additional channels (optional)

For channels that require a trigger (e.g. `@ai hello`):

```bash
node -e "
const { createDatabase } = require('./libs/db/dist/index.js');
const fs = require('fs');
const db = createDatabase({ path: '__data/{ASSISTANT_NAME}/store/nagi.db' });
db.groups.set('slack:CHANNEL_ID', {
  name: 'Channel Name',
  channel: 'slack',
  folder: 'slack_channel-name',
  trigger: '@{ASSISTANT_NAME}',
  added_at: new Date().toISOString(),
  requiresTrigger: true,
});
db.close();
fs.mkdirSync('__data/{ASSISTANT_NAME}/groups/slack_channel-name', { recursive: true });
console.log('Group registered');
"
```

## Phase 4: Verify

### Start nagi

```bash
pnpm dev
```

Look for these log lines:
- `Slack channel registered` — plugin loaded
- `Connected to Slack` — bot connected
- `groupCount: 1` (or more) — groups registered

### Test

Tell user:

> Send a message in your registered Slack channel:
> - **Main channel:** Any message works (no trigger needed)
> - **Other channels:** `@Nagi hello` (trigger required)
>
> The bot should respond within a few seconds.

### If no response, check:

1. **Bot added to channel?** — Bot must be explicitly added to each channel
2. **Group registered?** — Check DB:
   ```bash
   npx tsx -e "
   import { createDatabase } from '@nagi/db';
   const db = createDatabase({ path: '__data/{ASSISTANT_NAME}/store/nagi.db' });
   console.log(JSON.stringify(db.groups.getAll(), null, 2));
   db.close();
   "
   ```
3. **Docker running?** — `docker info`
4. **Container image built?** — `docker images nagi-agent` (Claude Code) or `docker images nagi-agent-opencode` (Open Code)
5. **Check container logs:** `ls __data/{ASSISTANT_NAME}/groups/main/logs/`

## Troubleshooting

### Bot not receiving messages

1. Verify Socket Mode is enabled in Slack app settings
2. Verify bot events: `message.channels`, `message.groups`, `message.im`
3. Verify bot is added to the channel
4. Verify OAuth scopes: `chat:write`, `channels:history`, `groups:history`, `im:history`

### "missing_scope" errors

1. Go to **OAuth & Permissions** → add missing scope
2. **Reinstall the app** (scope changes require reinstallation)
3. Copy the new Bot Token (it changes on reinstall)
4. Update `deploy/{ASSISTANT_NAME}/.env` and restart

### Getting channel ID

- Desktop: right-click channel → **Copy link** → extract `C...` from URL
- Web: URL shows `https://app.slack.com/client/TXXXXXXX/C0123456789`
- API: `curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" "https://slack.com/api/conversations.list" | jq '.channels[] | {id, name}'`

## Supported Features

- **Public channels** — Bot must be added
- **Private channels** — Bot must be invited
- **Direct messages** — Users can DM the bot
- **Multi-channel** — Runs alongside Discord or other channels
- **Thread replies** — Bot replies in the same thread
- **Message queueing** — Messages queued during disconnect, flushed on reconnect
