# Skills Reference

Nagi ships with **29 built-in skills** that cover every stage of the assistant lifecycle — from first-time setup to day-to-day service management, channel wiring, and plugin scaffolding.

## What are skills?

Skills are slash commands you invoke inside Claude Code (or Open Code). Type the skill name prefixed with `/` in your terminal session and the corresponding workflow runs automatically. For example:

```
/setup          # run initial Nagi setup
/nagi-restart   # restart the launchd service
/add-channel-slack   # connect a Slack workspace
```

Skills accept natural-language triggers too — typing "restart nagi" or "add slack" in your Claude Code session will match the right skill without the `/` prefix.

## Skill categories

| # | Category | Count | What it covers |
|---|----------|------:|----------------|
| 1 | [Setup](/en/05_skills_setup) | 3 | Initial setup wizard, launchd service registration, Open Code installation |
| 2 | [Service Control](/en/06_skills_service) | 4 | Start, stop, restart the launchd service; view logs |
| 3 | [Deploy & Sync](/en/07_skills_deploy) | 4 | Template synchronization, container rebuilds, group prompt refresh |
| 4 | [Agent Switching](/en/08_skills_agent) | 2 | Toggle between Claude Code and Open Code |
| 5 | [Channel Plugins](/en/09_skills_channel) | 6 | Slack, Discord, and Asana connections plus rich-display modes |
| 6 | [MCP Plugins](/en/10_skills_mcp) | 2 | Ollama (local LLM) and Vercel (deployment) integrations |
| 7 | [Agent Hooks](/en/11_skills_hooks) | 2 | Tool-execution and session-start notifications to chat channels |
| 8 | [Group Prompts](/en/12_skills_group_prompt) | 2 | Create and edit prompt files (IDENTITY.md, INSTRUCTIONS.md, etc.) |
| 9 | [Plugin Scaffolding](/en/13_skills_scaffold) | 3 | Generators for new channel, MCP, and hooks plugins |
| 10 | [Misc](/en/14_skills_misc) | 1 | Context probe for verifying auto-mount |

## Quick-reference: all 29 skills

| Skill | Category | Description |
|-------|----------|-------------|
| `/setup` | Setup | Full interactive setup wizard |
| `/setup-launchd` | Setup | Register Nagi as a macOS launchd service |
| `/setup-opencode` | Setup | Install and configure Open Code agent |
| `/nagi-start` | Service | Start the launchd service |
| `/nagi-stop` | Service | Stop the launchd service |
| `/nagi-restart` | Service | Restart the launchd service |
| `/nagi-logs` | Service | Stream service logs |
| `/deploy` | Deploy | Sync deploy templates to active config |
| `/update-entry` | Deploy | Sync a single entry.ts with its template |
| `/update-groups` | Deploy | Refresh group defaults (CLAUDE.md, etc.) |
| `/update-container` | Deploy | Rebuild the nagi-agent Docker image |
| `/change-claude-code` | Agent | Switch back to Claude Code |
| `/change-open-code` | Agent | Switch to Open Code |
| `/add-channel-slack` | Channel | Connect a Slack workspace (Socket Mode) |
| `/add-channel-slack-block-kit` | Channel | Enable Block Kit rich display for Slack |
| `/add-channel-slack-block-kit-embed` | Channel | Enable Block Kit Embed display for Slack |
| `/add-channel-discord` | Channel | Connect a Discord bot (Gateway) |
| `/add-channel-discord-embed` | Channel | Enable Embed rich display for Discord |
| `/add-channel-asana` | Channel | Connect Asana task comment polling |
| `/add-mcp-ollama` | MCP | Add Ollama for local LLM access |
| `/add-mcp-vercel` | MCP | Add Vercel for container deployments |
| `/add-agent-hooks-claude-code` | Hooks | Notification hooks for Claude Code containers |
| `/add-agent-hooks-open-code` | Hooks | Notification hooks for Open Code containers |
| `/create-group-prompt` | Prompt | Create new group prompt files |
| `/update-group-prompt` | Prompt | Edit existing group prompt files |
| `/create-plugin-channel` | Scaffold | Generate a channel plugin package |
| `/create-container-plugin-mcp` | Scaffold | Generate an MCP plugin package |
| `/create-container-plugin-agent-hooks` | Scaffold | Generate an agent-hooks plugin package |
| `/add-context-probe` | Misc | Install or remove a context probe |

## Tips

- **Run `/setup` first.** It walks through every prerequisite and calls the other skills as needed.
- **Skills are idempotent.** Running one twice will not create duplicates — it detects existing config and offers to update it.
- **Trigger words work anywhere.** You do not need the exact `/slash-command` name; natural phrases like "connect slack" or "restart" are matched automatically.
- **Skill files live in `.claude/skills/`.** They must be placed flat in that directory — subdirectory nesting is not supported.
