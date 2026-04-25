---
name: teardown
description: Tear down a Nagi assistant — stop the launchd service, remove the plist, and optionally delete deploy/{ASSISTANT_NAME}/ and __data/{ASSISTANT_NAME}/. Inverse of /setup. Triggers on "teardown", "uninstall nagi", "remove assistant", "撤去", "アンインストール", "アシスタント削除".
---

# Nagi Teardown

Inverse of `/setup`. Stops the launchd service for an assistant, removes its launchd plist, and optionally deletes its `deploy/` config (including `.env` tokens) and `__data/` runtime state (DB, logs, sessions). Shared resources — `node_modules/`, Docker images, source code, and other assistants' files — are left untouched.

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

**UX Note:** Use `AskUserQuestion` for all user-facing questions. Treat every removal step as destructive — confirm before running it.

## 1. Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **Which assistant do you want to tear down?** — show each detected name as an option. If nothing is detected, tell the user there is no deployed assistant and exit.

Use the selected name as `{ASSISTANT_NAME}` throughout the remaining steps.

## 2. Inventory what exists

Before destroying anything, gather the current state so the user can decide what to remove and so the verification at the end is meaningful:

```bash
test -d deploy/{ASSISTANT_NAME} && echo "DEPLOY_EXISTS" || echo "DEPLOY_MISSING"
test -d __data/{ASSISTANT_NAME} && echo "DATA_EXISTS" || echo "DATA_MISSING"
test -f ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist && echo "PLIST_EXISTS" || echo "PLIST_MISSING"
launchctl list | grep -q com.nagi.{ASSISTANT_NAME} && echo "LAUNCHD_LOADED" || echo "LAUNCHD_NOT_LOADED"

# Containers that mount this assistant's __data dir (filter by absolute path so
# we don't pick up containers from another repo's same-named assistant).
ASSISTANT_DATA_PATH="$(pwd)/__data/{ASSISTANT_NAME}/"
for c in $(docker ps -q 2>/dev/null); do
  docker inspect --format '{{.Id}} {{range .Mounts}}{{.Source}} {{end}}' "$c" \
    | grep -F "$ASSISTANT_DATA_PATH" \
    | awk '{print $1}'
done
```

Show the user a one-line summary of what will/can be removed (including the container count).

## 3. Confirm intent

AskUserQuestion (single-select): **Confirm teardown of `{ASSISTANT_NAME}`?**

- **Continue** — proceed to the next step
- **Cancel** — abort and exit

If the user picks Cancel, stop immediately and do not run any further commands.

## 4. Stop and unload launchd

If `LAUNCHD_LOADED` (or to be safe, just always run — the call no-ops if the service is already stopped):

```bash
launchctl unload ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist 2>/dev/null
```

Verify the service is gone:

```bash
launchctl list | grep com.nagi.{ASSISTANT_NAME} || echo "STOPPED"
```

If it is still listed, force eviction:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist 2>/dev/null
```

`launchctl unload` sends SIGTERM to the orchestrator. The orchestrator's shutdown handler closes channel adapters but **detaches in-flight Docker containers rather than killing them** (by design — so they survive an orchestrator restart). For teardown those containers must be stopped explicitly in Step 4.5; otherwise they keep consuming the agent's API quota and writing to mount paths that we are about to delete.

## 4.5. Stop in-flight Docker containers for this assistant

Container names use the pattern `nagi-{channel}-{folder}-{epoch_ms}` and do **not** include `ASSISTANT_NAME`. The only safe identifier is the absolute mount path. Filter containers whose mounts reference `$(pwd)/__data/{ASSISTANT_NAME}/` — this avoids stopping:

- containers from other assistants in the same repo (different `__data/<other>/` path)
- containers from a same-named assistant in a different repo checkout (different `$(pwd)`)

```bash
ASSISTANT_DATA_PATH="$(pwd)/__data/{ASSISTANT_NAME}/"
TARGETS=$(for c in $(docker ps -q 2>/dev/null); do
  docker inspect --format '{{.Id}} {{range .Mounts}}{{.Source}} {{end}}' "$c" \
    | grep -F "$ASSISTANT_DATA_PATH" \
    | awk '{print $1}'
done)

if [ -n "$TARGETS" ]; then
  echo "$TARGETS" | xargs docker stop
fi
```

`docker stop` sends SIGTERM (10s grace) then SIGKILL. The container's `docker run --rm` wrapper process on the host exits automatically once the container is removed, so no extra `kill` is needed.

If the user wants to preserve a long-running container (e.g. an agent in the middle of a delicate task), let them pick **Cancel** in Step 3 instead — there is no per-container opt-out here, because partial cleanup creates worse failure modes (zombie container writing to a deleted mount path).

## 5. Remove plist from LaunchAgents

If `PLIST_EXISTS`:

```bash
rm -f ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist
```

The materialized copy under `deploy/{ASSISTANT_NAME}/launchd/` is handled in Step 6 along with the rest of `deploy/`.

## 6. Choose what else to delete

AskUserQuestion (multi-select): **What else should be removed?**

- **deploy/{ASSISTANT_NAME}/** — config, `.env` tokens (Slack/Discord/Asana/Anthropic), host & container entry files, group prompt defaults, materialized launchd plist. Removing this wipes the agent's tokens; you'll have to re-paste them on the next setup.
- **__data/{ASSISTANT_NAME}/** — SQLite DB (registered groups, scheduled tasks, sessions), logs, IPC sockets. Removing this wipes group registrations and scheduled tasks for this assistant.

If the user picks neither, skip this step — only the launchd unload + plist removal stays. This is a valid choice for temporarily disabling an assistant without losing config.

For each selected target:

```bash
# deploy/{ASSISTANT_NAME}/ — config + tokens
rm -rf deploy/{ASSISTANT_NAME}

# __data/{ASSISTANT_NAME}/ — DB, logs, sessions
rm -rf __data/{ASSISTANT_NAME}
```

If the user wants to preserve the tokens for later, suggest copying `deploy/{ASSISTANT_NAME}/.env` somewhere outside the repo first.

## 7. Verify

```bash
launchctl list | grep com.nagi.{ASSISTANT_NAME} && echo "STILL RUNNING" || echo "STOPPED"
test -f ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist && echo "PLIST STILL THERE" || echo "PLIST GONE"
test -d deploy/{ASSISTANT_NAME} && echo "DEPLOY STILL THERE" || echo "DEPLOY GONE"
test -d __data/{ASSISTANT_NAME} && echo "DATA STILL THERE" || echo "DATA GONE"

# Same path-based filter as Step 4.5 — confirms no zombie containers remain.
ASSISTANT_DATA_PATH="$(pwd)/__data/{ASSISTANT_NAME}/"
LEFTOVER=$(for c in $(docker ps -q 2>/dev/null); do
  docker inspect --format '{{.Id}} {{range .Mounts}}{{.Source}} {{end}}' "$c" \
    | grep -F "$ASSISTANT_DATA_PATH" \
    | awk '{print $1}'
done)
[ -z "$LEFTOVER" ] && echo "CONTAINERS GONE" || echo "CONTAINERS STILL THERE: $LEFTOVER"
```

Summarize what was removed and what was preserved.

## What is *not* removed

The following are shared between assistants (or live outside this repo) and are left untouched. Remove manually if you want a fully clean machine:

- `node_modules/` and `pnpm-lock.yaml` (project dependencies)
- Docker images: `nagi-agent:latest`, `nagi-agent-opencode:latest` — `docker rmi nagi-agent nagi-agent-opencode`
- Source code under `host/`, `libs/`, `container/`, `deploy/templates/`
- `~/Library/LaunchAgents/com.nagi.*.plist` for *other* assistants
- The Slack/Discord apps and Asana PATs themselves — the bots remain registered in those workspaces; revoke separately at api.slack.com / discord.com / app.asana.com

## Linux

This skill is macOS-only (it targets launchd). On Linux, the equivalent flow is `systemctl --user stop` + `systemctl --user disable` + delete the unit file under `~/.config/systemd/user/`, then run Step 6 manually.

## Re-creating the assistant later

- Kept `deploy/` and `__data/`: `launchctl load ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist` (if you also kept the system plist), or re-run `/setup-launchd` to reinstall the plist.
- Kept `deploy/` only: re-run `/setup-launchd` to reinstall the plist; data dir will be recreated on first start.
- Kept nothing: re-run `/setup` from scratch.
