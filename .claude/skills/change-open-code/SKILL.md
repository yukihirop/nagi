---
name: change-open-code
description: Switch agent to Open Code. Triggers on "change open code", "switch to open code", "use open code", "open code に切り替え".
---

# Switch to Open Code Agent

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Switch the agent from Claude Code to Open Code.

## Prerequisites

Open Code must be set up first. If not, run `/setup-opencode`.

## Steps

### 1. Check prerequisites

```bash
docker images nagi-agent-opencode --format "{{.Repository}}:{{.Tag}}" | head -1
```

If no image, tell user to run `/setup-opencode` first.

### 2. Check API key is configured

```bash
grep -c "OPENROUTER_API_KEY\|GOOGLE_API_KEY\|OPENAI_API_KEY" .env 2>/dev/null || echo "0"
```

If no API key, tell user to run `/setup-opencode` first.

### 3. Update .env

Set `CONTAINER_IMAGE` to Open Code image:

```bash
# In .env, change:
CONTAINER_IMAGE=nagi-agent-opencode:latest
```

Ensure `OPENCODE_MODEL` is set. If not, add it:
```bash
grep -c "OPENCODE_MODEL" .env 2>/dev/null || echo "0"
```

If missing, AskUserQuestion for model choice:
- `openrouter/anthropic/claude-sonnet-4`
- `openrouter/google/gemini-2.5-pro`
- `openrouter/openai/gpt-4o`
- `google/gemini-2.5-pro`
- `openai/gpt-4o`

### 4. Restart nagi

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}
sleep 3
launchctl list | grep com.nagi.{ASSISTANT_NAME}
tail -5 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

### 5. Test

Tell user:

> Send a message in Slack/Discord. The agent should now respond using Open Code with your selected model.
