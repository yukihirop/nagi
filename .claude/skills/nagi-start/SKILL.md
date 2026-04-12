---
name: nagi-start
description: Start the nagi launchd service. Triggers on "start", "start nagi", "起動".
---

# Start Nagi

Start the nagi launchd service.

## Step 0: Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントを起動しますか？** — 検出された各名前をオプションとして表示する。

First check if already running:
```bash
launchctl list | grep com.nagi.{ASSISTANT_NAME} && echo "ALREADY_RUNNING" || echo "NOT_RUNNING"
```

If already running, tell the user. Use `/nagi-restart` to restart instead.

If not running:
```bash
launchctl load ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist
```

Verify:
```bash
sleep 2
launchctl list | grep com.nagi
tail -5 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

Expected: PID is a number, exit code is `0`, and logs show `Orchestrator started`.

If it fails to start, check error logs:
```bash
cat __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log
```
