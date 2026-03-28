---
name: nagi-start
description: Start the nagi launchd service. Triggers on "start", "start nagi", "起動".
---

# Start Nagi

Start the nagi launchd service.

First check if already running:
```bash
launchctl list | grep com.nagi && echo "ALREADY_RUNNING" || echo "NOT_RUNNING"
```

If already running, tell the user. Use `/nagi-restart` to restart instead.

If not running:
```bash
launchctl load ~/Library/LaunchAgents/com.nagi.plist
```

Verify:
```bash
sleep 2
launchctl list | grep com.nagi
tail -5 logs/nagi.log
```

Expected: PID is a number, exit code is `0`, and logs show `Orchestrator started`.

If it fails to start, check error logs:
```bash
cat logs/nagi.error.log
```
