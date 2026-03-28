---
name: nagi-logs
description: Show nagi service logs. Triggers on "logs", "show logs", "nagi logs", "check logs", "ログ".
---

# Nagi Logs

Show the latest nagi service logs.

```bash
tail -50 __data/logs/nagi.log
```

If the user wants to follow logs in real-time, tell them to run:
```
! tail -f __data/logs/nagi.log
```

For error logs:
```bash
tail -30 __data/logs/nagi.error.log
```
