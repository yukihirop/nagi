# Nagi (凪)

> 面倒な作業やノイズを静かに消し去り、日常に波風の立たない「凪」のような平穏をもたらす。表立って主張するのではなく、裏で動いて平和を保ってくれる相棒。

AI assistant that runs Claude Agent SDK in Docker containers and communicates through messaging channels (Slack, Discord, etc.).

## Architecture

See [docs/architecture.md](docs/architecture.md) for diagrams.

## Quick Start

```
/setup
```

## Configuration

- **`.env`** — Tokens, assistant name, runtime settings
- **`entry.ts`** — Which plugins to enable

## Project Structure

```
nagi/
  entry.ts                ← Plugin registration (gitignored)
  .env                    ← Secrets & settings (gitignored)
  __data/                 ← Runtime data (gitignored)
  groups/main/CLAUDE.md   ← Agent behavior
  container/              ← Docker image
  apps/                   ← orchestrator, agent-runner, credential-proxy
  libs/                   ← 10 shared packages
  plugins/                ← channel-slack, channel-discord, mcp-ollama, mcp-vercel
```
