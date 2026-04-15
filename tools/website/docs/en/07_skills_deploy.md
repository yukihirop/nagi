# Deploy & Sync Skills

Skills for expanding templates, synchronizing configuration files, and rebuilding container images. These skills maintain the **three-layer model** that separates upstream defaults from per-assistant customizations and runtime state.

## Three-Layer Model

All deploy/sync skills operate on a layered file architecture:

```
deploy/templates/              (Layer 1: pristine upstream — git-tracked, never edited)
        |
        |  /deploy skill copies templates -> per-assistant defaults
        v
deploy/{ASSISTANT_NAME}/       (Layer 2: user-editable defaults — customized per assistant)
        |
        |  /update-groups or pnpm dev startup copies defaults -> runtime
        v
__data/{ASSISTANT_NAME}/       (Layer 3: runtime — mounted into containers, active config)
```

Understanding which layer a skill operates on is key to choosing the right one.

## Template System

Templates live under `deploy/templates/` and are organized by target:

| Directory | Contents |
|-----------|----------|
| `deploy/templates/host/` | Host orchestrator entry point (`entry.template.ts`) |
| `deploy/templates/container/claude-code/` | Claude Code container entry + type stub |
| `deploy/templates/container/open-code/` | Open Code container entry + type stub |
| `deploy/templates/groups/{channel}/{group}/` | Group prompt files (`CLAUDE.md`, `AGENTS.md`, etc.) |
| `deploy/templates/launchd/` | macOS launchd plist with `{{PLACEHOLDER}}` variables |

Entry point templates (`.template.ts`) contain plugin registrations, import declarations, and configuration blocks. Group prompt files are plain Markdown with no placeholder substitution. The launchd plist uses `{{PLACEHOLDER}}` syntax (e.g. `{{NODE_PATH}}`, `{{PROJECT_ROOT}}`) that gets resolved to machine-specific paths during materialization.

---

## `/deploy` --- Full Template Sync {#deploy}

The primary deployment skill. Expands templates from `deploy/templates/` into `deploy/{ASSISTANT_NAME}/`, covering all targets in one operation. This is the skill to use when setting up a new assistant or pulling in upstream template changes.

**Triggers:** `deploy`, `sync deploy`, `update entry`, `sync entry`, `sync group templates`, `sync launchd`

**What it syncs:**

| Target | Template Source | Materialized Output |
|--------|---------------|---------------------|
| Host entry | `deploy/templates/host/entry.template.ts` | `deploy/{ASSISTANT_NAME}/host/entry.ts` |
| Claude Code entry | `deploy/templates/container/claude-code/entry.template.ts` | `deploy/{ASSISTANT_NAME}/container/claude-code/entry.ts` |
| Open Code entry | `deploy/templates/container/open-code/entry.template.ts` | `deploy/{ASSISTANT_NAME}/container/open-code/entry.ts` |
| Group prompts | `deploy/templates/groups/{channel}/{group}/*.md` | `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/*.md` |
| Launchd plist | `deploy/templates/launchd/com.nagi.plist` | `deploy/{ASSISTANT_NAME}/launchd/com.nagi.plist` |

**Workflow:**

1. Detects available assistant names from `deploy/*/` directories and asks which one to target (or creates a new one).
2. Asks which targets to sync (All, Host, Claude Code, Open Code, Groups, Launchd).
3. For new assistants, initializes the data directory (`__data/{ASSISTANT_NAME}/`) and `.env` file, then guides token configuration for agent authentication and messaging channels.
4. Checks whether local files already exist. Missing files are copied fresh from templates. Existing files are diffed against templates.
5. For entry points, merges new template additions (new plugin registrations, imports) into the local file while preserving user customizations.
6. For group prompts, asks per-file before overwriting any changed defaults.
7. For launchd, detects system paths and substitutes `{{PLACEHOLDER}}` values, then validates with `plutil -lint`.
8. Runs TypeScript compilation to verify entry points compile without errors.

**When to use:** Initial setup of a new assistant, after pulling upstream changes that update templates, or whenever you need a full sync across all targets.

---

## `/update-entry` --- Entry Point Sync {#update-entry}

Regenerates a single entry point (host or container) from its template. This is a focused alternative to `/deploy` when you only need to update one entry file.

**Triggers:** `update entry`, `sync entry`, `refresh entry`

**Workflow:**

1. Asks whether to update the Host entry or a Container entry (Claude Code / Open Code).
2. If the local file is missing, copies fresh from template and skips merge.
3. If the file exists, diffs the template against the local version. Identifies new registrations, user customizations, and conflicts.
4. Merges new template additions while preserving user-added plugins, custom config, and extra logic.
5. Verifies TypeScript compilation for the updated target.

**What it checks during merge:**

- **Host entry:** channel plugin registrations (`registry.register`), MCP plugin registrations (`registerMcpPlugin`), hooks plugin registration (`registerHooksPlugin`), mount allowlist config (`setMountAllowlist`)
- **Container entry:** plugin imports (`import(pluginPath)`), plugin push blocks (`plugins.push`), hook factory wiring (`createHooks`)

**When to use:** After adding a new plugin to the template, or when you want to pull in template changes for just one entry point without touching groups or launchd.

---

## `/update-groups` --- Group Prompt Sync {#update-groups}

Syncs group prompt defaults from Layer 2 (`deploy/{ASSISTANT_NAME}/groups/`) to Layer 3 (`__data/{ASSISTANT_NAME}/groups/`). This copies the user-editable defaults into the runtime directory that containers actually mount.

**Triggers:** `update groups`, `sync groups`, `refresh claude.md`, `update agent config`

**Workflow:**

1. Scans `deploy/{ASSISTANT_NAME}/groups/` for all prompt files.
2. Compares each file with its counterpart in `__data/{ASSISTANT_NAME}/groups/`.
3. New files are copied automatically. Changed files prompt the user to choose: overwrite, keep runtime version, or show diff.
4. Verifies all files are in sync after applying changes.

**Note:** This skill syncs Layer 2 to Layer 3. If you need to update Layer 2 from upstream templates (Layer 1), run `/deploy` with the Groups target first, then `/update-groups`.

**Note:** Changes take effect on the next container launch. If nagi is running, restart with `pnpm dev` or the next message will pick up the new prompts.

**When to use:** After editing `CLAUDE.md`, `AGENTS.md`, or other prompt files under `deploy/{ASSISTANT_NAME}/groups/` and wanting to push those changes to the running runtime immediately.

---

## `/update-container` --- Container Rebuild {#update-container}

Rebuilds the nagi-agent Docker image. This does not sync templates; it rebuilds the container image from source.

**Triggers:** `update container`, `rebuild container`, `rebuild image`, `rebuild docker`

**Supported images:**

| Agent | Image Name | Build Script |
|-------|-----------|-------------|
| Claude Code | `nagi-agent:latest` | `./container/claude-code/build.sh` |
| Open Code | `nagi-agent-opencode:latest` | `./container/open-code/build.sh` |

**What triggers a rebuild:**

- Changes to `container/{agent}/Dockerfile`
- Changes to agent-runner source (`host/agent-runner-claudecode/src/` or `host/agent-runner-opencode/src/`)
- Changes to container plugins (`container/plugins/`)
- Changes to container entry templates (`deploy/templates/container/{agent}/entry.template.ts`)

**Workflow:**

1. Asks which agent image to rebuild (Claude Code or Open Code).
2. Checks that Docker is running.
3. Runs the build script for the selected agent.
4. Verifies the new image exists and reports its size.
5. Restarts the nagi launchd service via `launchctl kickstart` and confirms it is running.

**When to use:** After modifying a Dockerfile, agent-runner source code, MCP plugins, or container plugins. Entry point or group prompt changes do NOT require a container rebuild since those files are mounted at runtime.

---

## Choosing the Right Skill

| Scenario | Skill |
|----------|-------|
| First-time setup of a new assistant | `/deploy` |
| Pulled upstream changes, need full sync | `/deploy` |
| Added a new plugin to the host entry template | `/update-entry` (Host) |
| Added a new plugin to the container entry template | `/update-entry` (Container) |
| Edited CLAUDE.md and want it live now | `/update-groups` |
| Changed Dockerfile or agent-runner code | `/update-container` |
| Changed a container plugin | `/update-container` |
| Updated group templates AND want runtime sync | `/deploy` (Groups), then `/update-groups` |

## Common Workflow Examples

### Setting up a new assistant from scratch

```
/deploy          -- creates deploy/mybot/, initializes .env, syncs all templates
/update-groups   -- pushes group defaults to __data/mybot/groups/
/update-container -- builds the Docker image
```

### Updating agent personality after editing CLAUDE.md

```
# Edit deploy/mybot/groups/slack/main/CLAUDE.md
/update-groups   -- syncs the edited file to __data/mybot/groups/
# Restart nagi or send a new message to pick up changes
```

### Pulling in a new plugin added to upstream templates

```
/update-entry    -- merges the new plugin registration into your local entry.ts
/update-container -- rebuilds if the plugin changed container-side code
```
