---
name: update-container
description: Rebuild the nagi-agent Docker image. Use after changing Dockerfile, agent-runner source, MCP plugins, or container plugins. Triggers on "update container", "rebuild container", "rebuild image", "rebuild docker", "コンテナ再ビルド".
---

# Update Container Image

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Rebuild a nagi agent Docker image to pick up changes.

## Steps

### 1. Choose agent

AskUserQuestion: Which agent image to rebuild?

- **Claude Code** — `nagi-agent:latest` (default)
- **Open Code** — `nagi-agent-opencode:latest`

### 2. Check Docker is running

```bash
docker info > /dev/null 2>&1 && echo "RUNNING" || echo "NOT_RUNNING"
```

If not running, start Docker.

### 3. Build

**Claude Code:**
```bash
./container/claude-code/build.sh
```

Rebuilds based on:
- `container/claude-code/Dockerfile`
- `host/agent-runner-claudecode/src/`
- `container/plugins/`
- `deploy/templates/container/claude-code/entry.template.ts`

**Open Code:**
```bash
./container/open-code/build.sh
```

Rebuilds based on:
- `container/open-code/Dockerfile`
- `host/agent-runner-opencode/src/`
- `container/plugins/`

### 4. Verify

```bash
# Claude Code:
docker images nagi-agent --format "{{.Repository}}:{{.Tag}} {{.Size}} {{.CreatedSince}}"

# Open Code:
docker images nagi-agent-opencode --format "{{.Repository}}:{{.Tag}} {{.Size}} {{.CreatedSince}}"
```

### 5. Restart nagi

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}
sleep 2
launchctl list | grep com.nagi.{ASSISTANT_NAME}
tail -5 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

### 6. Summary

Report:
- Image size
- Build time
- Whether nagi restarted successfully
