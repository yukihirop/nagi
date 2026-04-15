# Installation & Configuration

## Prerequisites

Make sure the following tools are installed before you begin.

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 22 or later | Check with `node -v` |
| **pnpm** | 9.x (repo pins 9.15.4) | Check with `pnpm -v`. Install via `corepack enable && corepack prepare pnpm@9.15.4 --activate` |
| **Docker** | Desktop or Engine | Required for running agent containers. Verify with `docker info` |
| **Claude Code** | Latest | Used as the agent runner. Install from [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code/overview) |

> **Tip:** On macOS you can install Node.js and pnpm with Homebrew:
> ```bash
> brew install node
> corepack enable && corepack prepare pnpm@9.15.4 --activate
> ```

## Installation

Clone the repository and install all workspace dependencies.

```bash
git clone https://github.com/yukihirop/nagi.git
cd nagi
pnpm install
```

After installation succeeds, verify the build works:

```bash
pnpm build
```

## Initial Setup

Open a **Claude Code** session inside the repository root and run the setup skill:

```
/setup
```

The setup skill walks you through the following steps interactively:

1. **Add channels** -- Configure channel plugins for Slack, Discord, Asana, etc.
2. **Register groups** -- Map channels to groups that define how agents behave.
3. **Create group prompts** -- Define agent behavior with `CLAUDE.md` and related prompt files (`IDENTITY.md`, `INSTRUCTIONS.md`, etc.).
4. **Configure launchd service** (macOS) -- Auto-start Nagi as a background service.

> **Note:** You can re-run `/setup` at any time to add more channels or groups.

## Environment Variables

Each channel plugin requires its own credentials. The setup skill will prompt you, but you can also set them manually. Common variables include:

- `SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN` -- For the Slack channel
- `DISCORD_BOT_TOKEN` -- For the Discord channel
- `ASANA_ACCESS_TOKEN` -- For the Asana channel

Store these in the `.env` file at the repository root. This file is gitignored by default.

## Running

### Development Mode

Start the orchestrator in the foreground for local development and debugging:

```bash
pnpm dev
```

This runs `deploy/{ASSISTANT_NAME}/host/entry.ts` directly with `tsx`.

### launchd Service (macOS)

For persistent background operation, use the launchd skills inside a Claude Code session:

| Skill | Description |
|-------|-------------|
| `/nagi-start` | Start the launchd service |
| `/nagi-stop` | Stop the launchd service |
| `/nagi-restart` | Restart the service (e.g., after config changes) |
| `/nagi-logs` | Tail the service log output |

> **Tip:** Run `/setup-launchd` first if you haven't configured the launchd plist yet.

## CLI

The Nagi CLI lets you run agent prompts directly from the terminal without going through a channel.

```bash
# Show help
pnpm nagi --help

# Run a prompt in the default (main) group
pnpm nagi "Summarize today's tasks"

# Run a prompt in a specific group
pnpm nagi -g my-group "Check the latest PR"

# Resume a previous session
pnpm nagi -s <session-id> "Continue where we left off"

# List all registered groups
pnpm nagi --list

# Pipe input from another command
echo "Explain this error" | pnpm nagi
```

### CLI Options

| Flag | Short | Description |
|------|-------|-------------|
| `--group <name>` | `-g` | Target a specific group (default: main) |
| `--session <id>` | `-s` | Resume a previous session by ID |
| `--list` | `-l` | List all registered groups |
| `--verbose` | `-v` | Show container details |
| `--help` | `-h` | Print usage information |

## Web UI

Launch the web dashboard for a visual overview of agents and groups:

```bash
pnpm ui:dev
```

This starts both the UI frontend and the UI server in parallel. For production use:

```bash
pnpm ui:build
pnpm ui:preview
```

## Troubleshooting

### `pnpm install` fails

- Make sure you are using pnpm 9.x. Run `pnpm -v` to check.
- Delete `node_modules` and the pnpm lock file, then retry: `rm -rf node_modules pnpm-lock.yaml && pnpm install`.

### Docker container won't start

- Verify Docker is running: `docker info`.
- Rebuild the agent image with the `/update-container` skill inside Claude Code.

### launchd service not starting

- Check logs with `/nagi-logs`.
- Make sure you ran `/setup-launchd` to generate the plist.
- Inspect the plist directly: `launchctl list | grep nagi`.

### Channel not receiving messages

- Double-check that your tokens in `.env` are correct and not expired.
- For Slack, ensure Socket Mode is enabled in the Slack app configuration.
- For Discord, confirm that the bot has the required Gateway intents enabled.
- Restart the service with `/nagi-restart` after any configuration change.
