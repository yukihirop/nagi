# Agent Switching Skills

Skills for switching the agent runner between Claude Code and Open Code inside containers. Each agent runs in its own Docker image, so switching means changing the `CONTAINER_IMAGE` in `.env` and restarting the service.

## Background — Claude Code vs Open Code

Nagi supports two agent runners. You can switch between them at any time without losing your channel configuration, group prompts, or plugin setup.

| | Claude Code | Open Code |
|---|---|---|
| **Docker image** | `nagi-agent:latest` | `nagi-agent-opencode:latest` |
| **LLM provider** | Anthropic (Claude) | OpenRouter, Google Gemini, OpenAI |
| **Model selection** | Determined by your Anthropic plan | User-configurable via `OPENCODE_MODEL` |
| **API key env var** | `ANTHROPIC_API_KEY` | `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, or `OPENAI_API_KEY` |
| **Best for** | Native Claude experience with full tool-use support | Using non-Anthropic models, or routing through OpenRouter for cost control |

### What changes when you switch

- The `CONTAINER_IMAGE` value in `.env` is updated to point to the target image.
- Provider-specific environment variables (`OPENCODE_MODEL`, API keys) are added or commented out.
- The launchd service is restarted so the new container image takes effect.
- Everything else — channels, groups, plugins, MCP servers — stays the same.

### When to use each

- **Stay on Claude Code** if you are happy with Claude models and want the simplest setup.
- **Switch to Open Code** if you want to use GPT-4o, Gemini 2.5 Pro, or other models available through OpenRouter, Google, or OpenAI. Open Code also lets you route Anthropic models through OpenRouter if you prefer a unified billing account.

::: tip
If Open Code is not set up yet, run `/setup-opencode` first. That skill walks you through provider selection, API key configuration, and Docker image building.
:::

---

## `/change-claude-code` — Switch to Claude Code {#change-claude-code}

Switch the agent runner back to Claude Code. Use when you are currently running Open Code and want to revert.

**Triggers:** `change claude code`, `switch to claude code`, `use claude code`

### What the skill does

1. Sets `CONTAINER_IMAGE=nagi-agent:latest` in `.env`.
2. Comments out Open Code settings (`OPENCODE_MODEL`, etc.).
3. Verifies the `nagi-agent` Docker image exists (builds it via `./container/claude-code/build.sh` if missing).
4. Restarts the launchd service and confirms the agent is responding.

---

## `/change-open-code` — Switch to Open Code {#change-open-code}

Switch the agent runner to Open Code. Use when you want to use providers like OpenRouter, Gemini, or OpenAI.

**Triggers:** `change open code`, `switch to open code`, `use open code`

### Prerequisites

- Open Code must already be set up (Docker image built, API key configured). If not, the skill will ask you to run `/setup-opencode` first.

### What the skill does

1. Checks that the `nagi-agent-opencode` Docker image and at least one provider API key exist.
2. Sets `CONTAINER_IMAGE=nagi-agent-opencode:latest` in `.env`.
3. Ensures `OPENCODE_MODEL` is set. If missing, prompts you to choose a model:
   - `openrouter/anthropic/claude-sonnet-4`
   - `openrouter/google/gemini-2.5-pro`
   - `openrouter/openai/gpt-4o`
   - `google/gemini-2.5-pro`
   - `openai/gpt-4o`
4. Restarts the launchd service and confirms the agent is responding with the selected model.
