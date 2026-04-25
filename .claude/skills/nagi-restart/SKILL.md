---
name: nagi-restart
description: Restart the nagi launchd service. Triggers on "restart", "restart nagi", "再起動".
---

# Restart Nagi

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Restart the nagi launchd service.

## Prerequisite: Determine ASSISTANT_NAME

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
