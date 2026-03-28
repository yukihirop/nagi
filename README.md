# Nagi (凪)

> 面倒な作業やノイズを静かに消し去り、日常に波風の立たない「凪」のような平穏をもたらす。表立って主張するのではなく、裏で動いて平和を保ってくれる相棒。

AI assistant that runs Claude Agent SDK in Docker containers and communicates through messaging channels (Slack, Discord, etc.).

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed diagrams (system overview, message flow, package dependencies, plugin system).

## Quick Start

In Claude Code, run:

```
/setup
```

This interactively handles everything: dependencies, Docker, authentication, channels, and service startup.

## Configuration

All configuration is in two files:

- **`.env`** — Tokens, assistant name, runtime settings
- **`entry.ts`** — Which plugins to enable (channels + MCP)

### Key .env variables

| Variable | Default | Description |
|---|---|---|
| `ASSISTANT_NAME` | Andy | Bot name and trigger pattern (`@Andy`) |
| `SLACK_BOT_TOKEN` | — | Slack bot token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | — | Slack app token (`xapp-...`) |
| `DISCORD_BOT_TOKEN` | — | Discord bot token |
| `CLAUDE_CODE_OAUTH_TOKEN` | — | Claude subscription token |
| `ANTHROPIC_API_KEY` | — | Alternative: Anthropic API key |
| `VERCEL_API_TOKEN` | — | Vercel deployment token |
| `MAX_AGENT_TURNS` | 50 | Max turns per agent session |

## Skills

All operations are done through Claude Code skills:

### Setup & Configuration

| Skill | Description |
|---|---|
| `/setup` | Initial setup wizard (dependencies, Docker, auth, channels) |
| `/setup-launchd` | Install as macOS background service |
| `/update-entry` | Sync entry.ts with latest template |
| `/update-groups` | Sync group templates (CLAUDE.md etc.) |

### Add Plugins

| Skill | Description |
|---|---|
| `/add-channel-slack` | Configure Slack channel |
| `/add-mcp-vercel` | Enable Vercel deployment tools |
| `/add-mcp-ollama` | Enable local LLM tools |

### Create Plugins

| Skill | Description |
|---|---|
| `/create-plugin-channel` | Scaffold a new channel plugin |
| `/create-plugin-mcp` | Scaffold a new MCP plugin |

### Service Management

| Skill | Description |
|---|---|
| `/nagi-start` | Start service |
| `/nagi-stop` | Stop service |
| `/nagi-restart` | Restart service |
| `/nagi-logs` | View logs |

## Project Structure

```
nagi/
  entry.template.ts       ← Git-tracked template
  entry.ts                ← Local config (gitignored)
  .env                    ← Tokens & settings (gitignored)
  __data/                 ← Runtime data (gitignored)
  groups/                 ← Group templates (git-tracked)
    └── main/CLAUDE.md    ← Agent behavior config
  container/
    ├── Dockerfile        ← Agent container image
    └── skills/           ← Container-side skills
  apps/                   ← Application packages
  libs/                   ← Shared libraries
  plugins/                ← Channel & MCP plugins
```
