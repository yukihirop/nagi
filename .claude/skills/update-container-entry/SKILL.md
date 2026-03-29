---
name: update-container-entry
description: Sync container entry.ts with its template. Supports both Claude Code and Open Code. Triggers on "update container entry", "sync container entry", "refresh container entry".
---

# Update Container Entry Point

Sync a container's `entry.ts` (local, gitignored) with its `entry.template.ts` (tracked in git). Preserves user customizations while incorporating new features from the template.

## Steps

### 1. Choose agent

AskUserQuestion: Which agent's entry point to update?

- **Claude Code** — `container/claude-code/entry.ts`
- **Open Code** — `container/open-code/entry.ts`

### 2. Check current state

```bash
# Claude Code:
test -f container/claude-code/entry.ts && echo "EXISTS" || echo "MISSING"

# Open Code:
test -f container/open-code/entry.ts && echo "EXISTS" || echo "MISSING"
```

If the entry.ts doesn't exist, simply copy:
```bash
# Claude Code:
cp container/claude-code/entry.template.ts container/claude-code/entry.ts

# Open Code:
cp container/open-code/entry.template.ts container/open-code/entry.ts
```
Done.

### 3. Diff template vs local

Read both files (template and local) for the selected agent and compare:
- **New in template** — new container plugin registrations, hook additions
- **Custom in local** — user-added plugins, custom hooks
- **Conflicts** — same section modified differently

### 4. Merge changes

Apply new template additions to entry.ts while preserving user customizations:

- **New container plugins** — add plugin blocks that don't exist in local
- **Updated imports** — add missing imports
- **Removed features** — warn user but don't remove unless they confirm

### 5. Verify

```bash
# Claude Code:
pnpm exec tsc --noEmit -p apps/agent-runner/tsconfig.json

# Open Code:
pnpm exec tsc --noEmit -p apps/agent-runner-opencode/tsconfig.json
```

TypeScript must compile without errors.

### 6. Summary

Show the user what changed:
- Added: list of new plugins/hooks
- Preserved: list of user customizations kept
- Removed: list of anything removed (if any)

## Rules

- **Never overwrite user customizations** without asking
- **Never remove** plugins the user added manually
- **Always preserve** custom hook configurations
- If unsure about a conflict, use `AskUserQuestion` to let the user decide
- After merging, always verify TypeScript compiles
