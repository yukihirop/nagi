# Setup Skills

## `/setup` — Initial Setup {#setup}

Interactively run the full Nagi initial setup from scratch. The skill drives each step automatically, only pausing when user action is genuinely required (pasting tokens, choosing options). If a dependency is missing it will install it rather than asking you to do so manually.

**Triggers:** `setup`, `install`, `configure nagi`

**Prerequisites checked automatically:**

| Requirement | Detail |
|---|---|
| Node.js >= 22 | Installed via nodenv, nvm, or Homebrew if missing |
| pnpm | Installed via corepack or npm if missing |
| Docker | Must be running; the skill will attempt to start it |

**Steps:**

1. **Install dependencies and build** — `pnpm install && pnpm build`. If the build fails (e.g. missing native build tools), the skill reads the error and fixes it.
2. **Choose agent type** — Claude Code (Anthropic's CLI, requires `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`) or Open Code (open-source agent SDK supporting OpenRouter, Gemini, and OpenAI).
3. **Build container image** — `./container/claude-code/build.sh` or `./container/open-code/build.sh` depending on the choice above.
4. **Deploy** — Runs the `/deploy` skill internally to generate entry points, `.env`, data directories, and group prompt defaults.
5. **Start and register the main group** — Starts the orchestrator with `pnpm dev`, detects the channel ID from logs, and registers the main group in the database. The main group has elevated privileges (no trigger required, can register other groups).
6. **Dashboard UI (optional)** — `pnpm ui:dev` starts the web dashboard (SPA on port 5174, API on port 3001) for monitoring agent activity.
7. **Verify** — Restarts the orchestrator and confirms end-to-end message flow: channel connects, message received, container spawned, response sent.

**Troubleshooting (built into the skill):**

- **No channels connected** — `.env` tokens are checked and the orchestrator is restarted.
- **Container runtime failed** — Docker status is verified; the skill starts it if stopped.
- **No response to messages** — Group registration and trigger patterns are validated.
- **Container fails** — Logs at `__data/{ASSISTANT_NAME}/groups/main/logs/container-*.log` are inspected. The Docker image tag is confirmed (`nagi-agent:latest` for Claude Code, `nagi-agent-opencode:latest` for Open Code).

---

## `/setup-launchd` — launchd Service Setup {#setup-launchd}

Register Nagi as a macOS background service using launchd. The service starts automatically on login and restarts on crash (via the `KeepAlive` directive in the plist). This skill is macOS-only; for Linux, use systemd instead.

**Triggers:** `setup launchd`, `run as service`, `background service`, `auto start`, `launchd`

**Multi-assistant aware:** If multiple assistants exist under `deploy/`, the skill asks which one to target before proceeding.

**What it does:**

1. **Pre-flight checks** — Verifies the platform is macOS, checks whether the service is already installed (offers reinstall/update), and confirms `deploy/{ASSISTANT_NAME}/host/entry.ts` exists (points to `/deploy` if not).
2. **Detect paths** — Resolves `NODE_PATH`, `TSX_PATH` (tsx CLI inside `node_modules/.pnpm`), `PROJECT_ROOT`, `NODE_BIN_DIR`, and `HOME` for the current machine.
3. **Materialize plist** — Reads the template at `deploy/templates/launchd/com.nagi.ASSISTANT_NAME.plist`, substitutes `{{NODE_PATH}}`, `{{TSX_PATH}}`, `{{PROJECT_ROOT}}`, `{{NODE_BIN_DIR}}`, and `{{HOME}}` with detected values, then writes the result to `deploy/{ASSISTANT_NAME}/launchd/com.nagi.{ASSISTANT_NAME}.plist`.
4. **Create log directory** — `mkdir -p __data/{ASSISTANT_NAME}/logs`.
5. **Install** — Unloads any existing agent, copies the plist to `~/Library/LaunchAgents/`, and loads it with `launchctl load`.
6. **Verify** — Checks `launchctl list`, confirms a PID is present, and tails the log for `Channel connected` / `Orchestrator started`.

**Management commands provided after setup:**

```bash
# View logs (live)
tail -f __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log

# Restart (no unload/load needed)
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}

# Stop
launchctl unload ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist

# Start
launchctl load ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist

# Check status
launchctl list | grep com.nagi.{ASSISTANT_NAME}
```

**Troubleshooting:**

| Symptom | Cause / Fix |
|---|---|
| Service keeps restarting (KeepAlive loop) | Check `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log`. Common causes: port already in use (kill the other instance), missing `.env`, Docker not running. |
| "Operation not permitted" | macOS may block launchd agents. Check System Preferences > Privacy & Security for blocked items. |
| Need to pick up code changes | Run `launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}` after `pnpm build`. No unload/load cycle required. |
| Template was updated upstream | Re-run `/setup-launchd` or `/deploy` with the Launchd target to regenerate the plist from the updated template. |

---

## `/setup-opencode` — Open Code Setup {#setup-opencode}

Set up [Open Code](https://github.com/opencode-ai/opencode) as an alternative agent runtime to Claude Code. Open Code is an open-source agent SDK that lets you choose from multiple AI providers through a single configuration.

**Triggers:** `setup opencode`, `setup open code`, `use opencode`, `switch to opencode`

**Supported providers and models:**

| Provider | Example Models | API Key Source |
|---|---|---|
| **OpenRouter** | `anthropic/claude-sonnet-4`, `openai/gpt-4o`, `google/gemini-2.5-pro` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Google Gemini** | `gemini-2.5-pro`, `gemini-2.5-flash` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **OpenAI** | `gpt-4o`, `o1` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

**Steps:**

1. **Pre-flight** — Checks Docker is running and whether the `nagi-agent-opencode` image already exists.
2. **Choose provider** — Interactive prompt to select OpenRouter, Google Gemini, or OpenAI.
3. **Enter API key** — Guides you to the provider's key page and asks you to paste the key.
4. **Choose model** — Suggests recommended defaults per provider (e.g. `openrouter/anthropic/claude-sonnet-4` for OpenRouter).
5. **Configure `.env`** — Sets `CONTAINER_IMAGE=nagi-agent-opencode:latest`, `OPENCODE_MODEL={provider}/{model}`, and the provider-specific API key variable (`OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, or `OPENAI_API_KEY`).
6. **Build Docker image** — Runs `./container/open-code/build.sh` to produce the `nagi-agent-opencode:latest` image.
7. **Restart Nagi** — Kicks the launchd service and tails logs to confirm the new agent is responding.
8. **Test** — Prompts you to send a message in Slack/Discord and verify the response comes from the selected model.

**Switching back to Claude Code:**

Update `.env` to set `CONTAINER_IMAGE=nagi-agent:latest` and remove (or comment out) the `OPENCODE_MODEL` and provider API key lines, then restart Nagi. Alternatively, run the `/change-claude-code` skill.

**Troubleshooting:**

| Symptom | Cause / Fix |
|---|---|
| Container fails to start | Verify Docker is running (`docker info`). Rebuild the image with `./container/open-code/build.sh`. Check error logs at `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log`. |
| No response from agent | Confirm the API key is valid and not rate-limited. Verify `CONTAINER_IMAGE=nagi-agent-opencode:latest` and `OPENCODE_MODEL` are set in `.env`. |
| Wrong model responding | Check `OPENCODE_MODEL` in `.env` matches the intended `{provider}/{model}`. Restart Nagi after any `.env` change. |
