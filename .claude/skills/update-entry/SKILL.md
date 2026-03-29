---
name: update-entry
description: Sync apps/entry.ts with apps/entry.template.ts. Use when the template has been updated with new plugins, config changes, or after pulling upstream changes. Triggers on "update entry", "sync entry", "refresh entry".
---

# Update Entry Point

Sync `apps/entry.ts` (local, gitignored) with `apps/entry.template.ts` (tracked in git). Preserves user customizations while incorporating new features from the template.

## Steps

### 1. Check current state

```bash
test -f apps/entry.ts && echo "EXISTS" || echo "MISSING"
```

If `apps/entry.ts` doesn't exist, simply copy:
```bash
cp apps/entry.template.ts apps/entry.ts
```
Done.

### 2. Diff template vs local

Read both files:
- `apps/entry.template.ts` — the latest template (git-tracked)
- `apps/entry.ts` — the user's local version (gitignored)

Compare them and identify:
- **New in template** — new plugin registrations, config changes, imports
- **Custom in local** — user-added plugins, custom config, extra logic
- **Conflicts** — same section modified differently

### 3. Merge changes

Apply new template additions to `apps/entry.ts` while preserving user customizations:

- **New channel plugins** — add registration blocks that don't exist in local
- **New MCP plugins** — add `registerMcpPlugin` calls that don't exist in local
- **Updated imports** — add missing imports
- **Removed features** — warn user but don't remove unless they confirm

### 4. Verify

```bash
pnpm exec tsc --noEmit
```

TypeScript must compile without errors.

### 5. Summary

Show the user what changed:
- Added: list of new registrations/imports
- Preserved: list of user customizations kept
- Removed: list of anything removed (if any)

## Rules

- **Never overwrite user customizations** without asking
- **Never remove** registrations the user added manually
- **Always preserve** custom env variable names, plugin configs, extra logic
- If unsure about a conflict, use `AskUserQuestion` to let the user decide
- After merging, always run `tsc --noEmit` to verify
