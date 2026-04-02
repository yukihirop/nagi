---
name: update-entry
description: Sync a single entry.ts with its template. Interactively choose host or container (claude-code/open-code). Triggers on "update entry", "sync entry", "refresh entry".
---

# Update Entry

Sync a single `deploy/default/` entry file with its `deploy/templates/` template. Preserves user customizations while incorporating new features.

## Steps

### 1. Choose target

AskUserQuestion: Which entry point to update?

- **Host** — orchestrator config (`deploy/default/host/entry.ts`)
- **Container** — agent container config

### 2. If Container, choose agent

AskUserQuestion: Which agent?

- **Claude Code** — `deploy/default/container/claude-code/entry.ts`
- **Open Code** — `deploy/default/container/open-code/entry.ts`

### 3. Resolve paths

| Target | Template | Local |
|--------|----------|-------|
| Host | `deploy/templates/host/entry.template.ts` | `deploy/default/host/entry.ts` |
| Claude Code | `deploy/templates/container/claude-code/entry.template.ts` | `deploy/default/container/claude-code/entry.ts` |
| Open Code | `deploy/templates/container/open-code/entry.template.ts` | `deploy/default/container/open-code/entry.ts` |

### 4. Check current state

```bash
test -f <local_path> && echo "EXISTS" || echo "MISSING"
```

If missing, create the directory and copy from template:

```bash
mkdir -p <local_dir>
cp <template_path> <local_path>
```

For container targets, also copy the type stub for IDE resolution:

```bash
cp deploy/templates/container/<agent>/index.d.ts deploy/default/container/<agent>/index.d.ts
```

If copied fresh, skip to verification.

### 5. Diff template vs local

Read both files. Compare and identify:

- **New in template** — new registrations, imports, config changes
- **Custom in local** — user-added plugins, custom config, extra logic
- **Conflicts** — same section modified differently

#### Host-specific items
- Channel plugin registrations (`registry.register`)
- MCP plugin registrations (`registerMcpPlugin`)
- Hooks plugin registration (`registerHooksPlugin`)
- Mount allowlist configuration (`setMountAllowlist`)

#### Container-specific items
- Container plugin imports (`import(pluginPath)`)
- Plugin push blocks (`plugins.push`)
- Hook factory wiring (`createHooks`)

### 6. Merge changes

Apply new template additions to the local file while preserving user customizations:

- **New plugins/registrations** — add blocks that don't exist in local
- **Updated imports** — add missing imports
- **Removed features** — warn user but don't remove unless they confirm

### 7. Verify

```bash
# Host:
pnpm exec tsc --noEmit

# Claude Code container:
pnpm exec tsc --noEmit -p host/agent-runner-claudecode/tsconfig.json

# Open Code container:
pnpm exec tsc --noEmit -p host/agent-runner-opencode/tsconfig.json
```

TypeScript must compile without errors.

### 8. Summary

Show the user what changed:
- Added: list of new registrations/imports
- Preserved: list of user customizations kept
- Removed: list of anything removed (if any)

## Rules

- **Never overwrite user customizations** without asking
- **Never remove** registrations the user added manually
- **Always preserve** custom env variable names, plugin configs, extra logic
- If unsure about a conflict, use `AskUserQuestion` to let the user decide
- After merging, always verify TypeScript compiles
