---
name: create-plugin-mcp
description: Scaffold a new MCP plugin for nagi agent containers. Generates package, Dockerfile entry, and entry.template.ts registration. Triggers on "create mcp plugin", "new mcp plugin", "add mcp", "scaffold mcp".
---

# Create MCP Plugin

Scaffold a new MCP plugin that runs inside agent containers, following the established pattern (mcp-ollama, mcp-vercel).

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Step 1: Gather information

AskUserQuestion:
1. Plugin name (lowercase, no `mcp-` prefix — e.g., "youtube", "github", "notion")
2. One-line description (e.g., "YouTube analytics and video search")
3. Does it need an API token/key? If yes, what env var name? (e.g., `YOUTUBE_API_KEY`)

## Step 2: Generate package

Create `plugins/mcp-{name}/` with three files:

### package.json

```json
{
  "name": "@nagi/mcp-{name}",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### src/index.ts

Generate a starter MCP server with a placeholder tool. Follow this pattern:

```typescript
/**
 * {Name} MCP Server for Nagi
 * {description}
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Read config from environment (passed via entry.ts registerMcpPlugin env option)
const API_TOKEN = process.env.{ENV_VAR} || "";

function log(msg: string): void {
  console.error(`[{NAME_UPPER}] ${msg}`);
}

const server = new McpServer({
  name: "{name}",
  version: "1.0.0",
});

// TODO: Add tools here
server.tool(
  "{name}_hello",
  "A placeholder tool — replace with real functionality",
  {
    message: z.string().describe("A test message"),
  },
  async (args) => {
    log(`Hello: ${args.message}`);
    return {
      content: [{ type: "text" as const, text: `Hello from {name}: ${args.message}` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
log("{Name} MCP server started");
```

Replace all `{name}`, `{Name}`, `{NAME_UPPER}`, `{description}`, `{ENV_VAR}` placeholders.

If no API token is needed, remove the `API_TOKEN` line.

## Step 3: Add to Dockerfile

Append the following block to `container/Dockerfile` **before** the `# Create workspace directories` line:

```dockerfile
COPY plugins/mcp-{name}/package*.json /app/mcp-plugins/{name}/
RUN cd /app/mcp-plugins/{name} && npm install
COPY plugins/mcp-{name}/src/ /app/mcp-plugins/{name}/src/
COPY plugins/mcp-{name}/tsconfig.json /app/mcp-plugins/{name}/
RUN cd /app/mcp-plugins/{name} && npx tsc
```

## Step 4: Add to entry.template.ts

Add a `registerMcpPlugin` block to `entry.template.ts`:

**If API token required:**
```typescript
const {name}Env = readEnvFile(["{ENV_VAR}"]);
if ({name}Env.{ENV_VAR}) {
  orchestrator.registerMcpPlugin("{name}", {
    entryPoint: "/app/mcp-plugins/{name}/dist/index.js",
    env: { {ENV_VAR}: {name}Env.{ENV_VAR} },
  });
}
```

**If no API token:**
```typescript
orchestrator.registerMcpPlugin("{name}", {
  entryPoint: "/app/mcp-plugins/{name}/dist/index.js",
});
```

## Step 5: Build & verify

```bash
pnpm install
pnpm build
```

All packages must build successfully.

## Step 6: Next steps

Tell the user:

1. **Implement tools** — Edit `plugins/mcp-{name}/src/index.ts` to add real MCP tools
2. **Rebuild Docker image** — `./container/build.sh`
3. **Sync entry.ts** — Run `/update-entry` to add the plugin registration to your local entry.ts
4. **If API token needed** — Add `{ENV_VAR}=...` to `.env`
5. **Restart nagi** — Run `/nagi-restart`
6. **Test** — Send a message in Slack and ask the agent to use the new tools

## Reference

Existing MCP plugins to study:
- `plugins/mcp-ollama/` — No API token, connects to local service via `host.docker.internal`
- `plugins/mcp-vercel/` — Requires `VERCEL_API_TOKEN`, calls external REST API
