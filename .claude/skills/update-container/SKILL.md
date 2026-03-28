---
name: update-container
description: Rebuild the nagi-agent Docker image. Use after changing Dockerfile, agent-runner source, MCP plugins, or container plugins. Triggers on "update container", "rebuild container", "rebuild image", "rebuild docker", "コンテナ再ビルド".
---

# Update Container Image

Rebuild the `nagi-agent:latest` Docker image to pick up changes in:
- `container/Dockerfile`
- `apps/agent-runner/src/`
- `plugins/mcp-ollama/`, `plugins/mcp-vercel/`
- `container/plugins/`
- `container/entry.template.ts`

## Steps

### 1. Check Docker is running

```bash
docker info > /dev/null 2>&1 && echo "RUNNING" || echo "NOT_RUNNING"
```

If not running, start Docker:
- macOS: `open -a Docker` then wait 15s
- Linux: `sudo systemctl start docker`

### 2. Build

```bash
./container/build.sh
```

This takes a few minutes on first build (cached afterwards).

### 3. Verify

```bash
docker images nagi-agent --format "{{.Repository}}:{{.Tag}} {{.Size}} {{.CreatedSince}}"
```

Expected: `nagi-agent:latest` with a recent timestamp.

### 4. Restart nagi

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi
sleep 2
launchctl list | grep com.nagi
tail -5 __data/logs/nagi.log
```

Expected: PID is a number, logs show `Orchestrator started`.

### 5. Summary

Report:
- Image size
- Build time
- Whether nagi restarted successfully
