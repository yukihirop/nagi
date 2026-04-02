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

1. **Build the content in memory** — Compose HTML/CSS/JS as strings. Do NOT write files to disk first.
2. **Deploy directly** — Pass the strings straight to `mcp__vercel__vercel_deploy`:
   - `name`: project name (lowercase, hyphens only)
   - `files`: array of `{file: "path", data: "content"}` objects — `data` is the raw file content as a string
   - `projectSettings`: only set when using a known framework (see below). **For plain HTML/CSS/JS sites, do NOT pass `projectSettings` at all.**
3. **Return the URL** — The deploy tool returns a URL. Share it with the user.

**Important:** Do NOT write files to disk and then read them back to pass to the deploy tool. This causes unnecessary read/escape loops. Build the content and pass it directly to `data`.

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

## Critical: `projectSettings.framework` rules

The Vercel API will **reject the deploy with a 400 error** if `projectSettings.framework` is not an exact match from the allowed list. To avoid this:

- **Plain HTML/CSS/JS sites** → Do NOT include `projectSettings` at all. Omit it entirely. Vercel auto-detects static sites.
- **Known frameworks only** → Only set `framework` if the project actually uses one of these: `nextjs`, `vite`, `astro`, `remix`, `svelte`, `sveltekit`, `nuxtjs`, `gatsby`, `vue`, `angular`, `create-react-app`, `solidstart`, `hugo`, `jekyll`, `eleventy`, `redwoodjs`.
- **When in doubt** → Omit `projectSettings`. It is always safer to let Vercel auto-detect than to guess a framework value.

## Notes

- Each deploy creates a unique URL. The latest deploy is also available at `<project-name>.vercel.app`.
- If VERCEL_API_TOKEN is not set, all tools will fail with an error.
