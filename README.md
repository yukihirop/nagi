<p align="center">
  <img src="assets/icon.png" alt="Nagi" width="240" />
</p>

<h1 align="center">Nagi (凪)</h1>

<p align="center">
  <em>面倒な作業やノイズを静かに消し去り、日常に波風の立たない「凪」のような平穏をもたらす。<br/>表立って主張するのではなく、裏で動いて平和を保ってくれる相棒。</em>
</p>

AI assistant that runs Claude Agent SDK in Docker containers and communicates through messaging channels (Slack, Discord, etc.).

Built as a clean-room reimplementation of [NanoClaw](https://github.com/qwibitai/nanoclaw) with a Turborepo monorepo architecture, plugin system, and DI-based design.

## Quick Start

Open [Claude Code](https://claude.ai/code) in this directory and run:

```
/setup
```

## CLI

Run agents from the terminal without opening Slack:

```bash
pnpm nagi "今日の天気を教えて"
pnpm nagi --list
```

## Architecture

See [docs/architecture.md](docs/architecture.md)

## Troubleshooting

Just ask Claude Code. It understands the codebase and skills, and can fix most issues for you.
