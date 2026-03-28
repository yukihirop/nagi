---
name: update-groups
description: Sync group templates (CLAUDE.md etc.) from groups/ to __data/groups/. Use after editing group templates, or when the agent's CLAUDE.md needs refreshing. Triggers on "update groups", "sync groups", "refresh claude.md", "update agent config".
---

# Update Group Templates

Sync git-tracked group templates from `groups/` to `__data/groups/`. Normally this happens automatically on `pnpm dev` startup, but this skill forces an immediate sync — including overwriting existing files when the user explicitly requests it.

## Steps

### 1. Check what templates exist

```bash
find groups/ -type f 2>/dev/null | sort
```

If `groups/` doesn't exist or is empty, tell the user there are no templates to sync.

### 2. Compare with runtime

For each file found in `groups/`, compare with the corresponding file in `__data/groups/`:

```bash
for f in $(find groups/ -type f); do
  runtime="__data/$f"
  if [ ! -f "$runtime" ]; then
    echo "NEW: $f → $runtime"
  elif ! diff -q "$f" "$runtime" > /dev/null 2>&1; then
    echo "CHANGED: $f (template differs from runtime)"
  else
    echo "OK: $f (already in sync)"
  fi
done
```

### 3. Apply changes

Show the user the diff summary and ask how to proceed:

- **NEW files** — always copy (no conflict)
- **CHANGED files** — AskUserQuestion:

  - "Overwrite with template" — replace runtime file with template version
  - "Keep runtime version" — preserve user's customizations
  - "Show diff" — display the differences before deciding

For each file to sync:
```bash
mkdir -p "$(dirname "__data/$f")"
cp "$f" "__data/$f"
```

### 4. Verify

```bash
echo "=== Synced templates ==="
for f in $(find groups/ -type f); do
  runtime="__data/$f"
  if diff -q "$f" "$runtime" > /dev/null 2>&1; then
    echo "✓ $f"
  else
    echo "✗ $f (still differs)"
  fi
done
```

### 5. Summary

Report what was synced:
- Files copied (new)
- Files overwritten (changed)
- Files skipped (user chose to keep runtime version)

**Note:** Changes take effect on the next container launch. If nagi is currently running, restart it (`pnpm dev`) or the next message will pick up the new CLAUDE.md.
