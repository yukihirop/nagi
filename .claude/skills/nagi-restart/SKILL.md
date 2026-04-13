---
name: nagi-restart
description: Restart the nagi launchd service. Triggers on "restart", "restart nagi", "再起動".
---

# Restart Nagi

Restart the nagi launchd service.

## Step 0: Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントを再起動しますか？** — 検出された各名前をオプションとして表示する。

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}
```

Then verify it's running:

```bash
sleep 2
launchctl list | grep com.nagi.{ASSISTANT_NAME}
tail -5 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

Expected: PID is a number (not `-`), exit code is `0`, and logs show `Orchestrator started`.
