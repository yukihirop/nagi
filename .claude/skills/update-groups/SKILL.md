---
name: update-groups
description: Sync group defaults (CLAUDE.md etc.) from deploy/default/groups/ to __data/groups/. Use after editing group defaults, or when the agent's CLAUDE.md needs refreshing. Triggers on "update groups", "sync groups", "refresh claude.md", "update agent config".
---

# Update Group Defaults

Sync git-tracked group defaults from `deploy/default/groups/` to `__data/groups/`. Normally this happens automatically on `pnpm dev` startup, but this skill forces an immediate sync — including overwriting existing files when the user explicitly requests it.

Note: `deploy/default/groups/` is the user-editable materialized copy of `deploy/templates/groups/` (the pristine upstream). Use the `deploy` skill to refresh `deploy/default/groups/` from templates first if needed.

## Steps

### 1. Check what defaults exist

```bash
find deploy/default/groups/ -type f 2>/dev/null | sort
```

If `deploy/default/groups/` doesn't exist or is empty, tell the user there are no defaults to sync.

### 2. Compare with runtime

For each file found in `deploy/default/groups/`, compare with the corresponding file in `__data/groups/`:

```bash
for f in $(find deploy/default/groups/ -type f); do
  # Strip the deploy/default/ prefix to get the runtime-relative path
  rel="${f#deploy/default/}"
  runtime="__data/$rel"
  if [ ! -f "$runtime" ]; then
    echo "NEW: $f → $runtime"
  elif ! diff -q "$f" "$runtime" > /dev/null 2>&1; then
    echo "CHANGED: $f (default differs from runtime)"
  else
    echo "OK: $f (already in sync)"
  fi
done
```

### 3. Apply changes

Show the user the diff summary and ask how to proceed:

- **NEW files** — always copy (no conflict)
- **CHANGED files** — AskUserQuestion:

  - "Overwrite with default" — replace runtime file with default version
  - "Keep runtime version" — preserve user's customizations
  - "Show diff" — display the differences before deciding

For each file to sync:
```bash
rel="${f#deploy/default/}"
mkdir -p "$(dirname "__data/$rel")"
cp "$f" "__data/$rel"
```

### 4. Verify

```bash
echo "=== Synced defaults ==="
for f in $(find deploy/default/groups/ -type f); do
  rel="${f#deploy/default/}"
  runtime="__data/$rel"
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

## Three-layer model

```
deploy/templates/groups/   (pristine — upstream baseline, reset target)
        │
        │  deploy skill materializes templates → default
        ▼
deploy/default/groups/      (user-editable — this skill's source)
        │
        │  this skill / pnpm dev startup copies default → runtime
        ▼
__data/groups/              (runtime — container mount, preserves customizations)
```
