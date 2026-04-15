# MCP Plugin Skills

Skills for adding MCP (Model Context Protocol) plugins that provide external tools to agents inside containers.

## What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is an open standard that lets AI agents call external tools through a unified interface. In nagi, MCP plugins run inside Docker containers alongside the agent. The host process registers each plugin with the orchestrator, which spawns the MCP server and exposes its tools to the agent automatically.

When you add an MCP plugin, three things happen:

1. The plugin package is included in the Docker image at build time.
2. `deploy/{ASSISTANT_NAME}/host/entry.ts` registers the plugin with `orchestrator.registerMcpPlugin()`.
3. At runtime, the agent sees the plugin's tools (prefixed `mcp__<plugin>__`) and can call them like any other tool.

---

## `/add-mcp-ollama` --- Add Ollama {#add-mcp-ollama}

Add the Ollama MCP plugin so container agents can access local LLM models for cheaper or faster tasks.

**Triggers:** `add ollama`, `setup ollama`, `enable ollama`

### Prerequisites

- **Ollama installed and running on the host.** macOS: `brew install ollama`; Linux: `curl -fsSL https://ollama.com/install.sh | sh`; or download from <https://ollama.com>.
- **At least one model pulled.** Run `ollama pull <model>` before using the plugin.
- **Network reachability.** The container reaches the host via `host.docker.internal:11434`. On Linux, nagi automatically adds `--add-host=host.docker.internal:host-gateway`.

### Supported Models (examples)

| Model | Size | Notes |
|---|---|---|
| `llama3.2` | ~2 GB | Fast, good general-purpose |
| `mistral` | ~4 GB | Strong reasoning quality |
| `gemma2` | ~5 GB | Google's open model |

Any model available in your local Ollama library can be used. Run `ollama list` to see what is installed.

### Available Tools

Once configured, container agents have access to:

| Tool | Description |
|---|---|
| `ollama_list_models` | List installed local models with sizes |
| `ollama_generate` | Send a prompt to a local model and get a response |

### Configuration

The skill performs the following steps:

1. **Pre-flight** --- Checks that Ollama is installed, running, and has at least one model.
2. **Register plugin** --- Adds the Ollama MCP plugin to `deploy/{ASSISTANT_NAME}/host/entry.ts`:
   ```typescript
   orchestrator.registerMcpPlugin("ollama", {
     entryPoint: "/app/mcp-plugins/ollama/dist/index.js",
   });
   ```
   No API token is needed because Ollama runs locally.
3. **Custom host (optional)** --- If Ollama runs on a different machine or port, pass the address via an environment variable:
   ```typescript
   orchestrator.registerMcpPlugin("ollama", {
     entryPoint: "/app/mcp-plugins/ollama/dist/index.js",
     env: { OLLAMA_HOST: "http://192.168.1.100:11434" },
   });
   ```
4. **Rebuild & verify** --- Rebuild the Docker image (`./container/claude-code/build.sh` or `./container/open-code/build.sh`), restart nagi, and test via Slack/Discord.

### Troubleshooting

| Symptom | Fix |
|---|---|
| "Failed to connect to Ollama" | Ensure `ollama serve` is running. Verify with `curl http://localhost:11434/api/tags`. |
| Agent does not see Ollama tools | Confirm `registerMcpPlugin("ollama", ...)` is in entry.ts, rebuild the image, and restart. |
| No models available | Pull a model: `ollama pull llama3.2` |

---

## `/add-mcp-vercel` --- Add Vercel {#add-mcp-vercel}

Add the Vercel MCP plugin so container agents can deploy websites, manage projects, and inspect deployments.

**Triggers:** `add vercel`, `setup vercel`, `enable vercel`

### Prerequisites

- **A Vercel account** at <https://vercel.com>.
- **An API token.** Create one at <https://vercel.com/account/tokens> with at least deploy-level scope.

### Available Tools

Once configured, container agents have access to:

| Tool | Description |
|---|---|
| `vercel_list_projects` | List Vercel projects |
| `vercel_create_project` | Create a new project |
| `vercel_deploy` | Deploy files and receive a live URL |
| `vercel_list_deployments` | List recent deployments |
| `vercel_get_deployment` | Get details of a specific deployment |
| `vercel_delete_project` | Delete a project |

### Configuration

The skill performs the following steps:

1. **Pre-flight** --- Checks whether `VERCEL_API_TOKEN` already exists in `.env`.
2. **Get API token** --- Guides you through creating a token on the Vercel dashboard if you do not have one, then saves it to `.env`.
3. **Register plugin** --- Adds the Vercel MCP plugin to `deploy/{ASSISTANT_NAME}/host/entry.ts`:
   ```typescript
   const vercelEnv = readEnvFile(["VERCEL_API_TOKEN"]);
   if (vercelEnv.VERCEL_API_TOKEN) {
     orchestrator.registerMcpPlugin("vercel", {
       entryPoint: "/app/mcp-plugins/vercel/dist/index.js",
       env: { VERCEL_API_TOKEN: vercelEnv.VERCEL_API_TOKEN },
     });
   }
   ```
4. **Rebuild & verify** --- Rebuild the Docker image, restart nagi, and test by asking the agent to list projects or deploy a page.

### Troubleshooting

| Symptom | Fix |
|---|---|
| "VERCEL_API_TOKEN is not set" | Add the token to `.env` at the project root AND ensure entry.ts passes it via `registerMcpPlugin`. |
| Agent does not see Vercel tools | Confirm `registerMcpPlugin("vercel", ...)` is in entry.ts, rebuild the image, and restart. |
| Deploy fails | Verify the token: `curl -s -H "Authorization: Bearer $VERCEL_API_TOKEN" https://api.vercel.com/v9/projects`. Check that the token scope includes deploy permissions. |
