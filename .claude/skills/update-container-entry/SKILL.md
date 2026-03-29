---
name: update-container-entry
description: Sync container/claude-code/entry.ts with container/claude-code/entry.template.ts. Use when the template has been updated with new container plugins or after pulling upstream changes. Triggers on "update container entry", "sync container entry", "refresh container entry".
---

# Update Container Entry Point

Sync `container/claude-code/entry.ts` (local, gitignored) with `container/claude-code/entry.template.ts` (tracked in git). Preserves user customizations while incorporating new features from the template.

## Steps

### 1. Check current state

```bash
test -f container/claude-code/entry.ts && echo "EXISTS" || echo "MISSING"
```

If `container/claude-code/entry.ts` doesn't exist, simply copy:
```bash
cp container/claude-code/entry.template.ts container/claude-code/entry.ts
```
Done.

### 2. Diff template vs local

Read both files:
- `container/claude-code/entry.template.ts` — the latest template (git-tracked)
- `container/claude-code/entry.ts` — the user's local version (gitignored)

Compare them and identify:
- **New in template** — new container plugin registrations, hook additions
- **Custom in local** — user-added plugins, custom hooks
- **Conflicts** — same section modified differently

### 3. Merge changes

Apply new template additions to `container/claude-code/entry.ts` while preserving user customizations:

- **New container plugins** — add plugin blocks that don't exist in local
- **Updated imports** — add missing imports
- **Removed features** — warn user but don't remove unless they confirm

### 4. Verify

```bash
pnpm exec tsc --noEmit -p apps/agent-runner/tsconfig.json
```

TypeScript must compile without errors.

### 5. Summary

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
