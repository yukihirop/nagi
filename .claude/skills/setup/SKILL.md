---
name: setup
description: Run initial Nagi setup. Use when user wants to install dependencies, configure channels, register groups, or start services. Triggers on "setup", "install", "configure nagi", or first-time setup requests.
---

# Nagi Setup

Run setup steps automatically. Only pause when user action is required (pasting tokens, configuration choices).

**Principle:** When something is broken or missing, fix it. Don't tell the user to go fix it themselves unless it genuinely requires their manual action (e.g. pasting a secret token). If a dependency is missing, install it.

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## 1. Prerequisites (Node.js + pnpm)

Check Node.js and pnpm are available:

```bash
node --version   # Must be >= 22
pnpm --version   # Must be installed
```

- If Node.js missing or too old: install via nvm (`nvm install 22`) or brew (`brew install node@22`)
- If pnpm missing: `corepack enable && corepack prepare pnpm@latest --activate`, or `npm install -g pnpm`

## 2. Install Dependencies & Build

```bash
pnpm install
pnpm build
```

If build fails, read the error and fix. Common issues:
- Missing native build tools: `xcode-select --install` (macOS) or `sudo apt-get install build-essential` (Linux)
- better-sqlite3 build failure: install build tools and retry

## 3. Docker

Check container runtime:

```bash
docker info
```

- If running: continue
- If installed but not running: `open -a Docker` (macOS) or `sudo systemctl start docker` (Linux). Wait 15s, recheck.
- If not installed: AskUserQuestion — install Docker? Then:
  - macOS: `brew install --cask docker` then `open -a Docker`
  - Linux: `curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER`

### 3b. Build Container Image

Build the `nagi-agent:latest` Docker image:

```bash
./container/build.sh
```

This builds the agent container with Chromium, Python/Jupyter, Claude Agent SDK, and MCP servers. Takes a few minutes on first build (cached afterwards).

Verify:
```bash
docker images nagi-agent
```

## 4. Environment File

Create `.env` from the template if it doesn't exist:

```bash
cp -n .env.example .env
```

(`-n` = no clobber — won't overwrite an existing `.env`)

## 5. Claude Authentication

AskUserQuestion: Claude subscription (Pro/Max) vs Anthropic API key?

**Subscription:** Tell user to run `! claude setup-token` (the `!` prefix runs it in the current terminal session), copy the token, then add to `.env`:
```
CLAUDE_CODE_OAUTH_TOKEN=<token>
```

**API key:** Tell user to add to `.env`:
```
ANTHROPIC_API_KEY=<key>
```

## 6. Channel Setup

AskUserQuestion (multiSelect): Which messaging channels do you want to enable?
- Slack (Socket Mode — no public URL needed)
- Discord (bot token)

### Slack

Tell user to create a Slack app:
1. Go to https://api.slack.com/apps → Create New App → From Manifest
2. Use this manifest (adjust name as needed):
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
3. Install to workspace
4. Generate App-Level Token (Settings → Basic Information → App-Level Tokens → `connections:write` scope)
5. Copy Bot Token (OAuth & Permissions page) and App Token

Add to `.env`:
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
```

### Discord

Tell user:
1. Go to https://discord.com/developers/applications → New Application
2. Bot → Reset Token → Copy
3. Enable: MESSAGE CONTENT INTENT, SERVER MEMBERS INTENT
4. Invite bot to server with this URL (replace CLIENT_ID):
   `https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=274877908992&scope=bot`

Add to `.env`:
```
DISCORD_BOT_TOKEN=...
```

## 7. Create Entry Points

Copy the templates to create your local entry points:

```bash
cp -n apps/entry.template.ts apps/entry.ts
cp -n container/entry.template.ts container/entry.ts
```

Both are gitignored — they're your local configuration. The `.template.ts` files are tracked in git as references.

- `apps/entry.ts` — host-side orchestrator config (channels, MCP plugins, hooks)
- `container/entry.ts` — container-side agent config (container plugins like agent-hooks)

To start nagi in development mode:
```bash
pnpm dev
```

This runs `tsx apps/entry.ts` which reads `.env`, registers configured channels, and starts the orchestrator.

## 8. Register Main Group

The first group to register is "main" — it has elevated privileges (no trigger required, can register other groups).

After the orchestrator starts and channels connect, check the logs for the channel ID / JID of your main chat:
```bash
pnpm --filter @nagi/orchestrator dev
```

Look for log lines like:
- Slack: `Discord bot connected` or metadata logs showing `slack:C...` JIDs
- Discord: `Discord bot: ...` showing the bot tag

Then register the main group in the database. Create a quick script or use the DB directly:

```bash
# Example: register a Slack channel as main
node -e "
const { createDatabase } = require('@nagi/db');
const db = createDatabase({ path: '__data/store/messages.db' });
db.groups.set('slack:C_YOUR_CHANNEL_ID', {
  name: 'Main',
  folder: 'main',
  trigger: '@Nagi',
  added_at: new Date().toISOString(),
  isMain: true,
  requiresTrigger: false,
});
db.close();
console.log('Main group registered');
"
```

Create the group directory:
```bash
mkdir -p __data/groups/main
```

## 9. Dashboard UI (Optional)

Start the web dashboard to monitor agent activity:

```bash
pnpm ui:dev    # SPA (port 5174) + API server (port 3001)
```

Features: Overview stats, Groups, Channels, Sessions (chat viewer), Tasks, Logs, Settings.

## 10. Verify

Restart the orchestrator and send a message in your main channel. Check logs:

```bash
pnpm dev
```

Expected behavior:
1. Channel connects (Slack/Discord bot comes online)
2. Message received (log: "Discord message stored" or similar)
3. Container spawned (log: "Spawning container agent")
4. Response sent back to channel

## Troubleshooting

**"No channels connected":** Check `.env` has correct tokens. Restart orchestrator.

**"Container runtime is required but failed to start":** Docker isn't running. Start it and retry.

**No response to messages:** Check group is registered in DB. Check trigger pattern matches. Main group doesn't need trigger prefix.

**Container fails:** Check `__data/groups/main/logs/container-*.log` for details. Ensure Docker image `nagi-agent:latest` is built.

**"SLACK_BOT_TOKEN not set":** Tokens must be in `.env` at the project root, not in environment variables.
