---
name: nagi-logs
description: Show nagi service logs. Triggers on "logs", "show logs", "nagi logs", "check logs", "ログ".
---

# Nagi Logs

Show the latest nagi service logs.

## Step 0: Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントのログを表示しますか？** — 検出された各名前をオプションとして表示する。

```bash
tail -50 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

If the user wants to follow logs in real-time, tell them to run:
```
! tail -f __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

For error logs:
```bash
tail -30 __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log
```
