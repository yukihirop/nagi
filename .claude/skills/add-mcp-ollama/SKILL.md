---
name: add-mcp-ollama
description: Add Ollama MCP plugin for local LLM access from agent containers. Triggers on "add ollama", "setup ollama", "enable ollama".
---

# Add Ollama MCP Plugin

This skill configures the Ollama MCP plugin so container agents can use local LLM models (llama3.2, mistral, gemma2, etc.) for cheaper/faster tasks.

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Phase 1: Pre-flight

### Check Ollama is installed

```bash
which ollama 2>/dev/null && ollama --version || echo "NOT_FOUND"
```

If not installed, AskUserQuestion: Install Ollama?

- macOS: `brew install ollama`
- Linux: `curl -fsSL https://ollama.com/install.sh | sh`
- Or download from https://ollama.com

### Check Ollama is running

```bash
curl -s http://localhost:11434/api/tags | head -1 || echo "NOT_RUNNING"
```

If not running: `ollama serve &` or start the Ollama app.

### Check models are installed

```bash
ollama list
```

If no models, suggest pulling one:
```bash
ollama pull llama3.2
```

## Phase 2: Configure entry.ts

Verify `deploy/default/host/entry.ts` contains the Ollama MCP plugin registration. If not, add this block after the orchestrator creation:

```typescript
orchestrator.registerMcpPlugin("ollama", {
  entryPoint: "/app/mcp-plugins/ollama/dist/index.js",
});
```

No API token needed — Ollama runs locally. The container reaches the host via `host.docker.internal:11434`.

If `deploy/default/host/entry.ts` is outdated, compare with `deploy/templates/host/entry.template.ts` and update accordingly.

### Custom Ollama host (optional)

If Ollama runs on a different host/port, pass it as an environment variable:

```typescript
orchestrator.registerMcpPlugin("ollama", {
  entryPoint: "/app/mcp-plugins/ollama/dist/index.js",
  env: { OLLAMA_HOST: "http://192.168.1.100:11434" },
});
```

## Phase 3: Rebuild & Verify

### Rebuild Docker image (if not already built with Ollama plugin)

```bash
./container/claude-code/build.sh
```

### Restart nagi

```bash
pnpm dev
```

### Test

Tell user:

> Send a message in your Slack channel:
> - "What models does Ollama have?"
> - "Use Ollama with llama3.2 to summarize: The quick brown fox jumps over the lazy dog."
>
> The agent should use `mcp__ollama__ollama_list_models` or `mcp__ollama__ollama_generate`.

## Available Tools

Once configured, container agents have access to:

- `ollama_list_models` — List installed local models with sizes
- `ollama_generate` — Send a prompt to a local model and get a response

## Troubleshooting

### "Failed to connect to Ollama"

1. Ollama must be running on the host: `ollama serve` or start the Ollama app
2. Verify: `curl http://localhost:11434/api/tags`
3. Docker must be able to reach the host — `host.docker.internal` is used automatically on macOS/Windows. On Linux, ensure `--add-host=host.docker.internal:host-gateway` is set (nagi handles this automatically).

### Agent doesn't see Ollama tools

1. Check `deploy/default/host/entry.ts` has `registerMcpPlugin("ollama", ...)`
2. Check Docker image was rebuilt: `./container/claude-code/build.sh`
3. Restart nagi

### No models available

Pull a model on the host:
```bash
ollama pull llama3.2    # 2GB, fast
ollama pull mistral     # 4GB, good quality
ollama pull gemma2      # 5GB, Google's model
```
