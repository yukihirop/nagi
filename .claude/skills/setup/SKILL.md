---
name: setup
description: Run initial Nagi setup. Use when user wants to install dependencies, configure channels, register groups, or start services. Triggers on "setup", "install", "configure nagi", or first-time setup requests.
---

# Nagi Setup

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Run setup steps automatically. Only pause when user action is required (pasting tokens, configuration choices).

**Principle:** When something is broken or missing, fix it. Don't tell the user to go fix it themselves unless it genuinely requires their manual action (e.g. pasting a secret token). If a dependency is missing, install it.

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## 1. Prerequisites (Node.js + pnpm)

Check Node.js and pnpm are available:

```bash
node --version   # Must be >= 22
pnpm --version   # Must be installed
```

- If Node.js missing or too old: install via nodenv (`nodenv install 22.x.x && nodenv local 22.x.x`), nvm (`nvm install 22`), or brew (`brew install node@22`)
- If using nodenv/nvm and switching versions: `rm -rf node_modules && pnpm install` to rebuild native bindings
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

### 3b. Choose Agent Type

AskUserQuestion: Which agent runtime do you want to use?
- **Claude Code** — Anthropic's Claude Code CLI runs inside the container. Auth is proxied from the host (credential proxy). Requires `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`.
- **Open Code** — Open-source agent SDK. Supports OpenRouter, Google Gemini, OpenAI, and Anthropic as providers. Requires provider-specific API key.

Remember the choice — it affects the container image build (step 3c) and authentication (step 5).

### 3c. Build Container Image

Build the Docker image matching the chosen agent type:

**Claude Code:**
```bash
./container/claude-code/build.sh
```
Verify: `docker images nagi-agent`

**Open Code:**
```bash
./container/open-code/build.sh
```
Verify: `docker images nagi-agent-opencode`

Takes a few minutes on first build (cached afterwards).

## 4. Deploy

Run `/deploy` to generate local entry points, data directories, `.env`, and group prompt defaults from templates. Select **All** when prompted.

`/deploy` handles:
- `.env` creation and token configuration (authentication + channels)
- Entry point generation (host, Claude Code container, Open Code container)
- Group prompt defaults
- Data directories (`__data/{ASSISTANT_NAME}/`)

If Open Code was chosen in step 3b, tell `/deploy` so it can set `CONTAINER_IMAGE=nagi-agent-opencode:latest` in `.env`.

## 5. Start & Register Main Group

Kill any existing nagi processes first (credential proxy on port 3002 may linger):
```bash
pkill -f "tsx deploy/{ASSISTANT_NAME}/host/entry.ts" 2>/dev/null
lsof -ti :3002 | xargs kill 2>/dev/null
```

Then start nagi in development mode:
```bash
pnpm dev
```

Once the orchestrator starts and channels connect, check the logs for the channel ID:
```bash
tail -20 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

Look for log lines showing channel JIDs (e.g. `slack:C...` or `discord:...`).

Then register the main group. The main group has elevated privileges (no trigger required, can register other groups):

```bash
node -e "
const { createDatabase } = require('./libs/db/dist/index.js');
const fs = require('fs');
const db = createDatabase({ path: '__data/{ASSISTANT_NAME}/store/nagi.db' });
db.groups.set('slack:C_YOUR_CHANNEL_ID', {
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

## 6. Dashboard UI (Optional)

Start the web dashboard to monitor agent activity:

```bash
pnpm ui:dev    # SPA (port 5174) + API server (port 3001)
```

Features: Overview stats, Groups, Channels, Sessions (chat viewer), Tasks, Logs, Settings.

## 7. Verify

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

**Container fails:** Check `__data/{ASSISTANT_NAME}/groups/main/logs/container-*.log` for details. Ensure the Docker image is built (`nagi-agent:latest` for Claude Code, `nagi-agent-opencode:latest` for Open Code).

**"SLACK_BOT_TOKEN not set":** Tokens must be in `.env` at the project root, not in environment variables.
