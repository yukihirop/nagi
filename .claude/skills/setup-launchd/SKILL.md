---
name: setup-launchd
description: Set up nagi as a macOS launchd service for persistent background operation. Triggers on "setup launchd", "run as service", "background service", "auto start", "launchd".
---

# Setup Launchd Service

Configure nagi to run as a persistent macOS launchd service that starts automatically on login and restarts on crash.

## Step 0: Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントを対象にしますか？** — 検出された各名前をオプションとして表示する。ディレクトリが存在しない場合は `/deploy` を先に実行するよう案内する。

## Pre-flight

### Check platform

```bash
uname -s
```

If not `Darwin`, tell the user this skill is macOS-only. For Linux, use systemd instead.

### Check if already installed

```bash
launchctl list | grep com.nagi.{ASSISTANT_NAME} && echo "INSTALLED" || echo "NOT_INSTALLED"
```

If already installed, AskUserQuestion: reinstall/update or skip?

### Check deploy/{ASSISTANT_NAME}/host/entry.ts exists

```bash
test -f deploy/{ASSISTANT_NAME}/host/entry.ts && echo "EXISTS" || echo "MISSING"
```

If missing, tell the user to run `/deploy` first.

## Step 1: Detect paths

Detect the correct paths for this machine:

```bash
echo "NODE_PATH=$(nodenv which node 2>/dev/null || which node)"
echo "TSX_PATH=$(find node_modules/.pnpm -name 'cli.mjs' -path '*/tsx/dist/*' | head -1)"
echo "PROJECT_ROOT=$(pwd)"
echo "HOME=$HOME"
```

Verify all paths exist. If tsx is not found, run `pnpm install` first.

Derive `NODE_BIN_DIR` from `NODE_PATH`:
```bash
echo "NODE_BIN_DIR=$(dirname $NODE_PATH)"
```

## Step 2: Materialize plist from template

Read `deploy/templates/launchd/com.nagi.{ASSISTANT_NAME}.plist` and replace these placeholders with the values detected in Step 1:

| Placeholder | Value |
|---|---|
| `{{NODE_PATH}}` | Detected NODE_PATH |
| `{{TSX_PATH}}` | Full absolute path to tsx/dist/cli.mjs |
| `{{PROJECT_ROOT}}` | Detected PROJECT_ROOT |
| `{{NODE_BIN_DIR}}` | `$(dirname $NODE_PATH)` |
| `{{HOME}}` | Detected HOME |

Write the result to `deploy/{ASSISTANT_NAME}/launchd/com.nagi.{ASSISTANT_NAME}.plist`:

```bash
mkdir -p deploy/{ASSISTANT_NAME}/launchd
```

Use the Read tool to load the template, substitute all `{{PLACEHOLDER}}` occurrences with the real values, then use the Write tool to save to `deploy/{ASSISTANT_NAME}/launchd/com.nagi.{ASSISTANT_NAME}.plist`.

**Important:** `ProgramArguments` uses `node tsx/dist/cli.mjs deploy/{ASSISTANT_NAME}/host/entry.ts` — not `node_modules/.bin/tsx` (that's a shell script, not executable by node directly).

## Step 3: Create logs directory

```bash
mkdir -p __data/{ASSISTANT_NAME}/logs
```

## Step 4: Install

### Unload existing (if any)

```bash
launchctl unload ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist 2>/dev/null
```

### Copy and load

```bash
cp deploy/{ASSISTANT_NAME}/launchd/com.nagi.{ASSISTANT_NAME}.plist ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist
launchctl load ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist
```

## Step 5: Verify

```bash
sleep 3
launchctl list | grep com.nagi
```

Expected output: `PID  0  com.nagi.{ASSISTANT_NAME}` (PID is a number, exit code is 0).

If PID is `-` (not running):
1. Check error log: `cat __data/{ASSISTANT_NAME}/logs/nagi.error.log`
2. Common issues:
   - Node path wrong → re-run step 1
   - `deploy/{ASSISTANT_NAME}/host/entry.ts` missing → run `/deploy`
   - Port conflict (credential proxy) → check if another nagi/nanoclaw is running
   - Docker not running → start Docker first

### Confirm channel connection

```bash
tail -5 __data/{ASSISTANT_NAME}/logs/nagi.log
```

Look for: `Channel connected` and `Orchestrator started`.

## Management Commands

Tell the user these commands:

```bash
# View logs
tail -f __data/{ASSISTANT_NAME}/logs/nagi.log

# Restart
launchctl kickstart -k gui/$(id -u)/com.nagi

# Stop
launchctl unload ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist

# Start
launchctl load ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist

# Check status
launchctl list | grep com.nagi
```

## Troubleshooting

### Service keeps restarting (KeepAlive loop)

Check `__data/{ASSISTANT_NAME}/logs/nagi.error.log` for the crash reason. Common:
- Port already in use → another instance running. Kill it: `pkill -f "tsx deploy/{ASSISTANT_NAME}/host/entry.ts"`
- Missing `.env` → create `.env` with required tokens
- Docker not running → service starts but containers fail

### "Operation not permitted"

macOS may block launchd agents. Go to System Preferences → Privacy & Security → check for blocked items.

### Updating after code changes

After `pnpm build` or editing `deploy/{ASSISTANT_NAME}/host/entry.ts`:
```bash
launchctl kickstart -k gui/$(id -u)/com.nagi
```

No need to unload/load — kickstart restarts the running service.

### Re-materializing after template updates

If `deploy/templates/launchd/com.nagi.{ASSISTANT_NAME}.plist` has been updated (e.g., new keys added), re-run this skill or `/deploy` with the Launchd target to regenerate `deploy/{ASSISTANT_NAME}/launchd/com.nagi.{ASSISTANT_NAME}.plist`.
