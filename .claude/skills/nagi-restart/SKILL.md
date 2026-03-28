---
name: nagi-restart
description: Restart the nagi launchd service. Triggers on "restart", "restart nagi", "再起動".
---

# Restart Nagi

Restart the nagi launchd service.

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi
```

Then verify it's running:

```bash
sleep 2
launchctl list | grep com.nagi
tail -5 __data/logs/nagi.log
```

Expected: PID is a number (not `-`), exit code is `0`, and logs show `Orchestrator started`.
