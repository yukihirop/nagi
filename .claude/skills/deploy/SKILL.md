---
name: deploy
description: Sync deploy/default/ with deploy/templates/. Covers host/container entry files and group prompt defaults (CLAUDE.md etc.). Triggers on "deploy", "sync deploy", "update entry", "sync entry", "update container entry", "sync container entry", "sync group templates".
---

# Deploy

Sync `deploy/default/` (user-editable) with `deploy/templates/` (pristine, git-tracked). Preserves user customizations while incorporating new features from templates.

## Targets

### Entry points

| Target | Template | Local |
|--------|----------|-------|
| Host | `deploy/templates/host/entry.template.ts` | `deploy/default/host/entry.ts` |
| Claude Code | `deploy/templates/container/claude-code/entry.template.ts` | `deploy/default/container/claude-code/entry.ts` |
| Open Code | `deploy/templates/container/open-code/entry.template.ts` | `deploy/default/container/open-code/entry.ts` |

### Group prompts

| Target | Template | Local |
|--------|----------|-------|
| Groups | `deploy/templates/groups/{channel}/{group}/*.md` | `deploy/default/groups/{channel}/{group}/*.md` |

Group prompt files (`CLAUDE.md`, `AGENTS.md`, and any others) are plain markdown with no placeholder substitution. Templates act as the pristine baseline; `deploy/default/groups/` is the copy the user edits freely.

## Steps

### 1. Choose target

AskUserQuestion: Which target(s) to sync?

- **All** — sync everything below
- **Host** — host orchestrator entry only
- **Claude Code** — claude-code container entry only
- **Open Code** — open-code container entry only
- **Groups** — group prompt defaults only

### 2. Check current state

For each selected target, check if the local file exists:

```bash
test -f deploy/default/host/entry.ts && echo "HOST_EXISTS" || echo "HOST_MISSING"
test -f deploy/default/container/claude-code/entry.ts && echo "CC_EXISTS" || echo "CC_MISSING"
test -f deploy/default/container/open-code/entry.ts && echo "OC_EXISTS" || echo "OC_MISSING"
```

If a local file is missing, create the directory and copy from template:

```bash
mkdir -p deploy/default/host
cp deploy/templates/host/entry.template.ts deploy/default/host/entry.ts

mkdir -p deploy/default/container/claude-code
cp deploy/templates/container/claude-code/entry.template.ts deploy/default/container/claude-code/entry.ts
cp deploy/templates/container/claude-code/index.d.ts deploy/default/container/claude-code/index.d.ts

mkdir -p deploy/default/container/open-code
cp deploy/templates/container/open-code/entry.template.ts deploy/default/container/open-code/entry.ts
cp deploy/templates/container/open-code/index.d.ts deploy/default/container/open-code/index.d.ts
```

If the file was missing and copied fresh, skip to verification for that target.

#### Groups target

For group prompt defaults, walk every file under `deploy/templates/groups/`:

```bash
for f in $(find deploy/templates/groups -type f); do
  local="deploy/default/groups/${f#deploy/templates/groups/}"
  if [ ! -f "$local" ]; then
    mkdir -p "$(dirname "$local")"
    cp "$f" "$local"
    echo "NEW: $local"
  elif ! diff -q "$f" "$local" > /dev/null 2>&1; then
    echo "CHANGED: $local (differs from template)"
  else
    echo "OK: $local"
  fi
done
```

For **CHANGED** files, use `AskUserQuestion` per file: "Overwrite with template", "Keep local", or "Show diff". Never overwrite without asking — `deploy/default/groups/` is the user's editable layer.

### 3. Diff template vs local

For each selected target, read both the template and local file. Compare and identify:

- **New in template** — new registrations, imports, config changes
- **Custom in local** — user-added plugins, custom config, extra logic
- **Conflicts** — same section modified differently

#### Host-specific items to check
- Channel plugin registrations (`registry.register`)
- MCP plugin registrations (`registerMcpPlugin`)
- Hooks plugin registration (`registerHooksPlugin`)
- Mount allowlist configuration (`setMountAllowlist`)

#### Container-specific items to check
- Container plugin imports (`import(pluginPath)`)
- Plugin push blocks (`plugins.push`)
- Hook factory wiring (`createHooks`)

#### Groups-specific notes
Group prompt files have no placeholder substitution — a straight diff between template and local is the whole story. Skip steps 4 and 5 for the Groups target (no merge logic, no tsc).

### 4. Merge changes

Apply new template additions to the local file while preserving user customizations:

- **New plugins/registrations** — add blocks that don't exist in local
- **Updated imports** — add missing imports
- **Removed features** — warn user but don't remove unless they confirm

### 5. Verify

```bash
# Host:
pnpm exec tsc --noEmit

# Claude Code container:
pnpm exec tsc --noEmit -p host/agent-runner-claudecode/tsconfig.json

# Open Code container:
pnpm exec tsc --noEmit -p host/agent-runner-opencode/tsconfig.json
```

TypeScript must compile without errors for all selected targets.

### 6. Summary

Show the user what changed per target:
- Added: list of new registrations/imports
- Preserved: list of user customizations kept
- Removed: list of anything removed (if any)

## Rules

- **Never overwrite user customizations** without asking
- **Never remove** registrations the user added manually
- **Always preserve** custom env variable names, plugin configs, extra logic
- If unsure about a conflict, use `AskUserQuestion` to let the user decide
- After merging, always verify TypeScript compiles
