---
name: nagi-logs
description: Show nagi service logs. Triggers on "logs", "show logs", "nagi logs", "check logs", "ログ".
---

# Nagi Logs

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Show the latest nagi service logs.

## Prerequisite: Determine ASSISTANT_NAME

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
