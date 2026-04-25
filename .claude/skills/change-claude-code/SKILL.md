---
name: change-claude-code
description: Switch agent back to Claude Code. Triggers on "change claude code", "switch to claude code", "use claude code", "claude code に切り替え".
---

# Switch to Claude Code Agent

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Switch the agent from Open Code back to Claude Code.

## Steps

### 1. Update .env

Set `CONTAINER_IMAGE` to Claude Code image:

```bash
# In .env, change:
CONTAINER_IMAGE=nagi-agent:latest
```

Comment out or remove Open Code settings:
```bash
# OPENCODE_MODEL=...
```

### 2. Verify Claude Code image exists

```bash
docker images nagi-agent --format "{{.Repository}}:{{.Tag}}" | head -1
```

If no image, build it:
```bash
./container/claude-code/build.sh
```

### 3. Restart nagi

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}
sleep 3
launchctl list | grep com.nagi.{ASSISTANT_NAME}
tail -5 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

### 4. Test

Tell user:

> Send a message in Slack/Discord. The agent should now respond using Claude Code.
