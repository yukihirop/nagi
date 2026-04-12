---
name: nagi-stop
description: Stop the nagi launchd service. Triggers on "stop", "stop nagi", "停止".
---

# Stop Nagi

Stop the nagi launchd service.

## Step 0: Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントを停止しますか？** — 検出された各名前をオプションとして表示する。

```bash
launchctl unload ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist
```

Verify it's stopped:

```bash
launchctl list | grep com.nagi.{ASSISTANT_NAME} || echo "Service stopped"
```
