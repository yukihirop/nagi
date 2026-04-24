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

Hand off to the `/deploy` skill (invoke it via the Skill tool, do not just print "run /deploy"). Tell `/deploy` to select **All** targets, and pass through the agent type chosen in step 3b so it can set `CONTAINER_IMAGE` correctly.

`/deploy` will guide the user through:

- `.env` creation, with prompts for **agent authentication** (`CLAUDE_CODE_OAUTH_TOKEN` via `claude setup-token`, or `ANTHROPIC_API_KEY`, or Open Code provider keys)
- `.env` channel tokens (Slack / Discord / Asana — multi-select, with Bot/App creation instructions)
- Entry points (host, Claude Code container, Open Code container)
- Group prompt defaults
- Data directories (`__data/{ASSISTANT_NAME}/`)

When `/deploy` returns, `.env` should have at least one channel token plus an agent auth token. If neither is present, ask the user before continuing — `pnpm dev` in the next step will not produce a usable bot otherwise.

## 5. Install as a Background Service & Register Main Group

Hand off to `/setup-launchd` (invoke via the Skill tool, do not just print "run /setup-launchd"). It installs the launchd plist with detected paths and loads the service so the orchestrator starts in the background. macOS only — see Troubleshooting if the host is Linux.

Once the service is loaded, the channel adapters connect and log their channel JIDs. Read them so the user can pick which one to register as the main group:

```bash
tail -50 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log | grep -E 'slack:|discord:|asana:'
```

Look for log lines like `slack:C0AP0BRN50X` or `discord:1487646521259196426`. If nothing shows up yet, wait a few seconds for the adapters to connect and re-tail.

Now register the main group via the `/register-channel` skill (invoke via the Skill tool, do not run a hand-rolled `node -e` script). Pre-fill the answers so the user just confirms:

- Action: **register** (the option labelled `登録する` / `Register` depending on the language picked in `/register-channel`)
- Channel kind: whichever JID prefix you found in the logs
- Channel ID: the suffix of the JID (e.g. `C0AP0BRN50X` for `slack:C0AP0BRN50X`)
- Group name: `Main`
- folder: `main`
- trigger: `@{ASSISTANT_NAME}`
- isMain: `true`
- requiresTrigger: `false`

`/register-channel` runs a reachability check (Slack/Discord/Asana API), creates the DB row, and creates `__data/{ASSISTANT_NAME}/groups/main/`. The main group has elevated privileges: no trigger required, and it can register additional groups at runtime.

After `/register-channel` returns, run `/nagi-restart` so launchd reloads the service and picks up the new group.

<!-- Legacy fallback: if `/register-channel` is unavailable for some reason,
the equivalent script is:

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
-->

## 6. Dashboard UI (Optional)

Start the web dashboard to monitor agent activity:

```bash
pnpm ui:dev    # SPA (port 5174) + API server (port 3001)
```

Features: Overview stats, Groups, Channels, Sessions (chat viewer), Tasks, Logs, Settings.

## 7. Verify

Send a message in your main channel and watch the logs via `/nagi-logs` (or tail directly):

```bash
tail -f __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

Expected behavior:
1. Channel connects (Slack/Discord bot comes online)
2. Message received (log: "Discord message stored" or similar)
3. Container spawned (log: "Spawning container agent")
4. Response sent back to channel

## 8. Next Steps

After Step 7 succeeds, do not stop silently. Assess the current state and surface follow-up actions via `AskUserQuestion` (use the language picked in Step 0). Inspect the workspace before asking so you can recommend only what still applies:

- Read `.env` and check which of `SLACK_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `ASANA_PAT` are set.
- Check whether a launchd plist exists for this assistant (e.g. `~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist` on macOS).

Then offer the relevant items below as options. Suggest only what is not already done; do not pad the question with already-completed items.

1. **Add more channels** — if only one channel token is configured and the user has not said they only want one. Recommend:
   - `/add-channel-slack` — Slack Socket Mode bot
   - `/add-channel-discord` — Discord Gateway bot
   - `/add-channel-asana` — Asana PAT + project polling

2. **Rich channel display (optional)** — only if the user expressed interest in nicer notifications. Mention `/add-channel-slack-block-kit` / `/add-channel-slack-block-kit-embed` for Slack, `/add-channel-discord-embed` for Discord.

3. **Agent hooks (optional)** — `/add-agent-hooks-claude-code` or `/add-agent-hooks-open-code` for PostToolUse / SessionStart notifications during long agent sessions.

Present the still-applicable items as `AskUserQuestion` options (single-select; include an explicit "Done — exit setup" option). When the user picks one, hand off by suggesting they invoke that slash command — do not run the other skill yourself inside `/setup`. If they pick "Done", confirm completion and exit.

## Troubleshooting

**"No channels connected":** Check `.env` has correct tokens. Restart orchestrator.

**"Container runtime is required but failed to start":** Docker isn't running. Start it and retry.

**No response to messages:** Check group is registered in DB. Check trigger pattern matches. Main group doesn't need trigger prefix.

**Container fails:** Check `__data/{ASSISTANT_NAME}/groups/main/logs/container-*.log` for details. Ensure the Docker image is built (`nagi-agent:latest` for Claude Code, `nagi-agent-opencode:latest` for Open Code).

**"SLACK_BOT_TOKEN not set":** Tokens must be in `deploy/{ASSISTANT_NAME}/.env`, not in environment variables. The project-root `.env` is not loaded.

**Linux:** Currently unsupported. The maintained startup path uses macOS launchd (`/setup-launchd`). `pnpm dev` exists in the codebase and may work for self-driven Linux setups, but there is no official Linux flow.
