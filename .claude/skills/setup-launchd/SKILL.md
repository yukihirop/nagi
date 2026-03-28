---
name: setup-launchd
description: Set up nagi as a macOS launchd service for persistent background operation. Triggers on "setup launchd", "run as service", "background service", "auto start", "launchd".
---

# Setup Launchd Service

Configure nagi to run as a persistent macOS launchd service that starts automatically on login and restarts on crash.

## Pre-flight

### Check platform

```bash
uname -s
```

If not `Darwin`, tell the user this skill is macOS-only. For Linux, use systemd instead.

### Check if already installed

```bash
launchctl list | grep com.nagi && echo "INSTALLED" || echo "NOT_INSTALLED"
```

If already installed, AskUserQuestion: reinstall/update or skip?

### Check entry.ts exists

```bash
test -f entry.ts && echo "EXISTS" || echo "MISSING"
```

If missing, tell the user to run `/update-entry` first.

## Step 1: Detect paths

Detect the correct paths for this machine:

```bash
echo "NODE_PATH=$(nodenv which node 2>/dev/null || which node)"
echo "TSX_PATH=$(find node_modules/.pnpm -name 'cli.mjs' -path '*/tsx/dist/*' | head -1)"
echo "PROJECT_ROOT=$(pwd)"
echo "HOME=$HOME"
```

Verify all paths exist. If tsx is not found, run `pnpm install` first.

## Step 2: Generate plist

Update `launchd/com.nagi.plist` with the detected paths:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nagi</string>
    <key>ProgramArguments</key>
    <array>
        <string>NODE_PATH</string>
        <string>TSX_PATH</string>
        <string>PROJECT_ROOT/entry.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>PROJECT_ROOT</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>HOME</string>
    </dict>
    <key>StandardOutPath</key>
    <string>PROJECT_ROOT/logs/nagi.log</string>
    <key>StandardErrorPath</key>
    <string>PROJECT_ROOT/logs/nagi.error.log</string>
</dict>
</plist>
```

Replace all placeholders with actual paths.

**Important:** `ProgramArguments` uses `node tsx/dist/cli.mjs entry.ts` — not `node_modules/.bin/tsx` (that's a shell script, not executable by node directly).

## Step 3: Create logs directory

```bash
mkdir -p logs
```

## Step 4: Install

### Unload existing (if any)

```bash
launchctl unload ~/Library/LaunchAgents/com.nagi.plist 2>/dev/null
```

### Copy and load

```bash
cp launchd/com.nagi.plist ~/Library/LaunchAgents/com.nagi.plist
launchctl load ~/Library/LaunchAgents/com.nagi.plist
```

## Step 5: Verify

```bash
sleep 3
launchctl list | grep com.nagi
```

Expected output: `PID  0  com.nagi` (PID is a number, exit code is 0).

If PID is `-` (not running):
1. Check error log: `cat logs/nagi.error.log`
2. Common issues:
   - Node path wrong → re-run step 1
   - `entry.ts` missing → run `/update-entry`
   - Port conflict (credential proxy) → check if another nagi/nanoclaw is running
   - Docker not running → start Docker first

### Confirm Slack connection

```bash
tail -5 logs/nagi.log
```

Look for: `Connected to Slack` and `Orchestrator started`.

## Management Commands

Tell the user these commands:

```bash
# View logs
tail -f logs/nagi.log

# Restart
launchctl kickstart -k gui/$(id -u)/com.nagi

# Stop
launchctl unload ~/Library/LaunchAgents/com.nagi.plist

# Start
launchctl load ~/Library/LaunchAgents/com.nagi.plist

# Check status
launchctl list | grep com.nagi
```

## Troubleshooting

### Service keeps restarting (KeepAlive loop)

Check `logs/nagi.error.log` for the crash reason. Common:
- Port already in use → another instance running. Kill it: `pkill -f "tsx entry.ts"`
- Missing `.env` → create `.env` with required tokens
- Docker not running → service starts but containers fail

### "Operation not permitted"

macOS may block launchd agents. Go to System Preferences → Privacy & Security → check for blocked items.

### Updating after code changes

After `pnpm build` or editing `entry.ts`:
```bash
launchctl kickstart -k gui/$(id -u)/com.nagi
```

No need to unload/load — kickstart restarts the running service.
