---
name: add-mcp-vercel
description: Add Vercel MCP plugin for deploying websites from agent containers. Triggers on "add vercel", "setup vercel", "enable vercel".
---

# Add Vercel MCP Plugin

This skill configures the Vercel MCP plugin so container agents can deploy websites, manage projects, and list deployments.

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Phase 1: Pre-flight

### Check if already configured

```bash
grep -c "VERCEL_API_TOKEN" .env 2>/dev/null || echo "0"
```

If token exists, ask user: keep existing or reconfigure?

### Check deploy/default/host/entry.ts has Vercel registration

Read `deploy/default/host/entry.ts` and verify it contains `registerMcpPlugin("vercel"`. If not, add it.

## Phase 2: Get API Token

AskUserQuestion: Do you already have a Vercel API token?

### If no — guide through creation:

1. Go to https://vercel.com/account/tokens
2. Click **Create** token
3. Name: `nagi` (or any name)
4. Scope: Full Account (or specific project)
5. Copy the token

### Configure .env

Add to `.env`:

```
VERCEL_API_TOKEN=...
```

## Phase 3: Configure entry.ts

Verify `deploy/default/host/entry.ts` contains the Vercel MCP plugin registration. If not, add this block after the orchestrator creation:

```typescript
const vercelEnv = readEnvFile(["VERCEL_API_TOKEN"]);
if (vercelEnv.VERCEL_API_TOKEN) {
  orchestrator.registerMcpPlugin("vercel", {
    entryPoint: "/app/mcp-plugins/vercel/dist/index.js",
    env: { VERCEL_API_TOKEN: vercelEnv.VERCEL_API_TOKEN },
  });
  logger.info("Vercel MCP plugin registered");
}
```

If `deploy/default/host/entry.ts` is outdated, compare with `deploy/templates/host/entry.template.ts` and update accordingly.

## Phase 4: Rebuild & Verify

### Rebuild Docker image (if not already built with Vercel plugin)

```bash
./container/claude-code/build.sh
```

### Restart nagi

```bash
pnpm dev
```

### Test

Tell user:

> Send a message in your Slack channel asking the agent to deploy something:
> - "Deploy a simple hello world page to Vercel"
> - "List my Vercel projects"
>
> The agent should use `mcp__vercel__vercel_deploy` or `mcp__vercel__vercel_list_projects`.

## Available Tools

Once configured, container agents have access to:

- `vercel_list_projects` — List Vercel projects
- `vercel_create_project` — Create a new project
- `vercel_deploy` — Deploy files and get a URL
- `vercel_list_deployments` — List recent deployments
- `vercel_get_deployment` — Get deployment details
- `vercel_delete_project` — Delete a project

## Troubleshooting

### "VERCEL_API_TOKEN is not set"

The token must be in `.env` at the project root AND registered in `deploy/default/host/entry.ts` via `registerMcpPlugin` with `env: { VERCEL_API_TOKEN: ... }`.

### Agent doesn't see Vercel tools

1. Check `deploy/default/host/entry.ts` has `registerMcpPlugin("vercel", ...)`
2. Check Docker image was rebuilt after adding the plugin: `./container/claude-code/build.sh`
3. Restart nagi after changes

### Deploy fails

1. Verify token is valid: `curl -s -H "Authorization: Bearer $VERCEL_API_TOKEN" https://api.vercel.com/v9/projects | head`
2. Check token scope has deploy permissions
