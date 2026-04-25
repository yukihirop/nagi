---
name: nagi-stop
description: Stop the nagi launchd service. Triggers on "stop", "stop nagi", "停止".
---

# Stop Nagi

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Stop the nagi launchd service.

## Prerequisite: Determine ASSISTANT_NAME

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
