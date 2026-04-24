# Welcome to Nagi

## How We Use Claude

Based on yukihirop's usage over the last 30 days:

Work Type Breakdown:
  Build Feature     ████████████████████  36%
  Plan Design       ██████████████████░░  32%
  Improve Quality   █████████░░░░░░░░░░░  16%
  Write Docs        ██████░░░░░░░░░░░░░░  11%

Top Skills & Commands:
  /nagi-restart          ████████████████████  17x/month
  /update-group-prompt   ████████████░░░░░░░░  10x/month
  /deploy                ████████░░░░░░░░░░░░  7x/month
  /update-container      ███████░░░░░░░░░░░░░  6x/month
  /setup-launchd         ███████░░░░░░░░░░░░░  6x/month
  /setup                 █████░░░░░░░░░░░░░░░  4x/month

Top MCP Servers:
  plugin_discord_discord  █░░░░░░░░░░░░░░░░░░░  1 call

## Your Setup Checklist

### Codebases
- [ ] nagi — https://github.com/yukihirop/nagi

### MCP Servers to Activate
- [ ] Discord (plugin_discord_discord) — Lets Claude read and reply in Discord channels for testing the Discord channel integration. Run `/discord:configure` to paste a bot token; access is then managed via `/discord:access`.

### Skills to Know About
- [/nagi-restart](.claude/skills/nagi-restart/SKILL.md) — Restart the nagi launchd service. Use after changing code, templates, or group prompts so the running agent picks up changes.
- [/update-group-prompt](.claude/skills/update-group-prompt/SKILL.md) — Interactively edit a group's CLAUDE.md / IDENTITY.md / SOUL.md under `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/`. Previews a diff before saving.
- [/deploy](.claude/skills/deploy/SKILL.md) — Sync `deploy/{ASSISTANT_NAME}/` with `deploy/templates/`. Covers host/container entry files, group prompt defaults, and the launchd plist. Run this after editing anything under `deploy/templates/`.
- [/update-container](.claude/skills/update-container/SKILL.md) — Rebuild the nagi-agent Docker image. Use after changing the Dockerfile, agent-runner source, or container MCP plugins.
- [/setup-launchd](.claude/skills/setup-launchd/SKILL.md) — Install nagi as a macOS launchd service so it runs persistently in the background.
- [/setup](.claude/skills/setup/SKILL.md) — First-time setup: installs dependencies, configures channels, registers groups, and starts services.
- [/register-channel](.claude/skills/register-channel/SKILL.md) — Register an existing Slack/Discord/Asana channel ID as a group in the assistant's SQLite DB (lighter-weight than full channel setup).
- [/add-channel-slack](.claude/skills/add-channel-slack/SKILL.md), [/add-channel-discord](.claude/skills/add-channel-discord/SKILL.md), [/add-channel-asana](.claude/skills/add-channel-asana/SKILL.md) — Full channel onboarding flows (bot creation, token setup, group registration, verification).
- [/change-claude-code](.claude/skills/change-claude-code/SKILL.md) / [/change-open-code](.claude/skills/change-open-code/SKILL.md) — Switch the agent runtime between Claude Code and Open Code.

## Team Tips

_TODO_

## Get Started

_TODO_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
