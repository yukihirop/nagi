---
name: vercel-deploy
description: Deploy websites to Vercel using MCP tools. Use when the user asks to deploy, publish, or host a website.
---

# Vercel Deploy

Deploy websites to Vercel and return the live URL.

## How to use

You have these MCP tools available:

- `mcp__vercel__vercel_deploy` — Deploy files to Vercel. Returns the deployment URL.
- `mcp__vercel__vercel_list_projects` — List existing projects.
- `mcp__vercel__vercel_list_deployments` — List recent deployments.
- `mcp__vercel__vercel_get_deployment` — Get deployment details.
- `mcp__vercel__vercel_create_project` — Create a new project.
- `mcp__vercel__vercel_delete_project` — Delete a project.

## Workflow

When the user asks you to create and deploy a website:

1. **Build the site** — Write HTML/CSS/JS files as needed
2. **Deploy** — Use `mcp__vercel__vercel_deploy` with the file contents:
   - `name`: project name (lowercase, hyphens only)
   - `files`: array of `{file: "path", data: "content"}` objects
   - `projectSettings`: set `framework` if applicable (e.g. "nextjs", "vite")
3. **Return the URL** — The deploy tool returns a URL. Share it with the user.

## Example

For a simple static site:

```
mcp__vercel__vercel_deploy({
  name: "my-site",
  files: [
    { file: "index.html", data: "<html>...</html>" },
    { file: "style.css", data: "body { ... }" }
  ]
})
```

## Notes

- For static sites, no `projectSettings` needed — Vercel auto-detects.
- For frameworks (Next.js, Vite), set `framework` in `projectSettings`.
- Each deploy creates a unique URL. The latest deploy is also available at `<project-name>.vercel.app`.
- If VERCEL_API_TOKEN is not set, all tools will fail with an error.
