---
name: nagi-stop
description: Stop the nagi launchd service. Triggers on "stop", "stop nagi", "停止".
---

# Stop Nagi

Stop the nagi launchd service.

```bash
launchctl unload ~/Library/LaunchAgents/com.nagi.plist
```

Verify it's stopped:

```bash
launchctl list | grep com.nagi || echo "Service stopped"
```
