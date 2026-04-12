---
name: add-channel-asana
description: Add Asana as a channel. Polls task comments for trigger-pattern matches (no public URL needed). Triggers on "add asana", "setup asana", "connect asana", "add channel asana".
---

# Add Asana Channel

This skill configures Asana for nagi — Personal Access Token setup, project discovery, group registration, and verification.

Asana uses **polling** (not webhooks) because workspace-level webhooks do not deliver story/comment events, and the workspace events API is Enterprise+ only. This keeps the launchd-only deployment self-contained.

Detection model matches Slack/Discord: any task comment in a watched project whose body contains the configured trigger pattern (e.g. `@ai ...`) dispatches the agent. Because nagi authenticates via PAT it has no real Asana user account, so Asana's structured `@mention` autocomplete does not apply to nagi — plain-text triggers are the only viable signal.

To keep parent tasks clean, nagi's responses land on an auto-created **subtask** rather than on the triggering task itself. The channel:

1. Detects a trigger comment on a watched task
2. Creates a subtask under it named `ai ▸ {first line of the request}`
3. Posts a short Japanese pointer comment on the parent task: `🤖 こちらのサブタスクで返信します: {url}`
4. Routes the agent's reply (plus Thinking/cost hook messages if agent-hooks is enabled) to the subtask
5. Adds the subtask to a watchlist so follow-up `@ai` comments posted inside it continue the same conversation without creating another nesting level

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Phase 0: Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントに Asana を追加しますか？** — 検出された各名前をオプションとして表示する。

Use the selected name as `{ASSISTANT_NAME}` throughout. The .env file is at `deploy/{ASSISTANT_NAME}/.env`.

## Phase 1: Pre-flight

### Check if already configured

```bash
grep -c "ASANA_PAT" deploy/{ASSISTANT_NAME}/.env 2>/dev/null || echo "0"
```

If `ASANA_PAT` already exists in `deploy/{ASSISTANT_NAME}/.env`, ask the user: keep existing configuration or reconfigure?

### Check plugin is available

Verify `@nagi/channel-asana` is in root `package.json` dependencies. If not:

```bash
pnpm add @nagi/channel-asana --filter nagi
pnpm build
```

### Check deploy/{ASSISTANT_NAME}/host/entry.ts has Asana registration

Read `deploy/{ASSISTANT_NAME}/host/entry.ts` and verify it contains `createAsanaFactory`. If not, run `/deploy` to sync from `deploy/templates/host/entry.template.ts`.

## Phase 2: Create Personal Access Token

AskUserQuestion: Do you already have an Asana Personal Access Token?

### If no — guide through creation:

1. Go to https://app.asana.com/0/my-apps
2. Click **Create new token** under **Personal access tokens**
3. Give it a name (e.g., `nagi`)
4. Copy the token (shown only once — starts with `1/`)

The PAT inherits the permissions of your Asana user, so the bot will act as you in every workspace you have access to.

### Configure .env (token only — project gids added later)

Add to `deploy/{ASSISTANT_NAME}/.env`:

```
ASANA_PAT=1/1234567890:abcdef...
```

## Phase 3: Discover user gid and project gids

### Fetch your user gid (optional — auto-resolved at connect if omitted)

Leaving `ASANA_USER_GID` empty is fine; the channel calls `GET /users/me` on connect. If you want to pin it for faster startup:

```bash
curl -s -H "Authorization: Bearer $(grep '^ASANA_PAT=' .env | cut -d= -f2)" \
  https://app.asana.com/api/1.0/users/me | jq -r '.data | "\(.gid)\t\(.name)"'
```

Add to `deploy/{ASSISTANT_NAME}/.env` (optional):

```
ASANA_USER_GID=1234567890123456
```

### Discover project gids

Ask the user which projects should be watched. For each workspace, list projects via:

```bash
# Replace WORKSPACE_GID
curl -s -H "Authorization: Bearer $(grep '^ASANA_PAT=' .env | cut -d= -f2)" \
  "https://app.asana.com/api/1.0/workspaces/WORKSPACE_GID/projects?opt_fields=gid,name&limit=100" \
  | jq -r '.data[] | "\(.gid)\t\(.name)"'
```

To list workspaces first:

```bash
curl -s -H "Authorization: Bearer $(grep '^ASANA_PAT=' .env | cut -d= -f2)" \
  https://app.asana.com/api/1.0/workspaces | jq -r '.data[] | "\(.gid)\t\(.name)"'
```

Alternative — copy gid from the URL: open a project in Asana and the URL looks like `https://app.asana.com/0/1234567890/...`. The first long number is the project gid.

Add to `deploy/{ASSISTANT_NAME}/.env`:

```
ASANA_PROJECT_GIDS=1111111111111111,2222222222222222
```

Multiple gids are comma-separated, no spaces required.

### Optional: polling interval

Default is 60 seconds, minimum 10 seconds. To customize:

```
ASANA_POLL_INTERVAL_MS=30000
```

Shorter intervals reduce latency but consume more of the 150 req/min rate limit. Stay at 60s unless you have a specific need.

## Phase 4: Register Group

Each watched Asana project becomes one nagi group. JID format is `asana:{projectGid}`.

```bash
npx tsx -e "
import { createDatabase } from '@nagi/db';
import fs from 'fs';

const db = createDatabase({ path: '__data/{ASSISTANT_NAME}/store/messages.db' });
db.groups.set('asana:PROJECT_GID', {
  name: 'Asana Project',
  folder: 'asana_project',
  trigger: '@Nagi',
  added_at: new Date().toISOString(),
  isMain: false,
  requiresTrigger: true,
});
db.close();

fs.mkdirSync('__data/{ASSISTANT_NAME}/groups/asana_project', { recursive: true });
console.log('Asana group registered');
"
```

Replace `PROJECT_GID` with the actual project gid. Repeat for each project in `ASANA_PROJECT_GIDS`. Adjust `name`, `folder`, and `trigger` as needed.

**`requiresTrigger: true` is the normal choice** — the channel already filters stories by the trigger pattern at the channel level, and `requiresTrigger` has the MessageLoop re-check the same condition. Leaving it on is cheap insurance; switching it to `false` (or setting `isMain: true`) would make the agent respond to every comment in the project, which is usually too noisy for Asana.

## Phase 5: Verify

### Restart nagi

If nagi is running under launchd:

```bash
# via skill
/nagi-restart
# or directly
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}
```

Otherwise:

```bash
pnpm dev
```

### Check logs

```bash
/nagi-logs
```

Look for these log lines:

- `Asana channel registered` — plugin loaded, env vars detected
- `Resolved Asana user via /users/me` — PAT works and user gid fetched (or `Using preconfigured Asana user` if you set `ASANA_USER_GID`)
- `Asana channel connected` — polling started, with `projects: N` matching your `ASANA_PROJECT_GIDS` count

### Test

Tell the user:

> 1. Open one of your watched projects in Asana
> 2. Open any task (or create a new one)
> 3. From a **different account**, post a comment whose body starts with your configured trigger — e.g. `@ai テストです`
>    - The trigger is plain text; you don't need to use Asana's `@` autocomplete (nagi is not an Asana user)
> 4. Wait up to `ASANA_POLL_INTERVAL_MS` (default 60 seconds)
> 5. Nagi should post a reply comment on the same task

### If no response, check:

1. **Is `Asana channel registered` in the logs?** — If not, `deploy/{ASSISTANT_NAME}/.env` keys are missing or wrong; check `ASANA_PAT` and `ASANA_PROJECT_GIDS` are both set
2. **Is `Asana channel connected` in the logs?** — If not, the PAT is invalid; regenerate it at https://app.asana.com/0/my-apps
3. **Is the project gid correct?** — Re-run the project discovery curl command
4. **Is the group registered?** — Check the DB directly:
   ```bash
   sqlite3 __data/{ASSISTANT_NAME}/store/messages.db "SELECT jid, name, channel, folder, is_main, requires_trigger FROM registered_groups WHERE jid LIKE 'asana:%';"
   ```
5. **Does the comment body actually contain the trigger?** — The body (after HTML stripping) must match the regex derived from `ASSISTANT_NAME`. For `ASSISTANT_NAME=ai` that is `/^@ai\b/i`. Whitespace or other text *before* `@ai` will prevent matching — the trigger must be at the start of a line.
6. **Did you wait long enough?** — Polling is every 60s by default; the first poll only sees task comments whose parent task was modified after the service started.

## Troubleshooting

### `Failed to resolve Asana user` in logs

The PAT is invalid, expired, or not authorized for the workspace. Regenerate at https://app.asana.com/0/my-apps and update `deploy/{ASSISTANT_NAME}/.env`.

### Polling works but no triggers fire

Inspect the specific story whose body you expect to match:

```bash
curl -s -H "Authorization: Bearer $(grep '^ASANA_PAT=' .env | cut -d= -f2)" \
  "https://app.asana.com/api/1.0/tasks/TASK_GID/stories?opt_fields=html_text,created_by.gid,resource_subtype" \
  | jq
```

Checklist:

- `resource_subtype` must be `comment_added` (system stories like `assigned` are filtered out)
- `created_by.gid` must NOT equal your `ASANA_USER_GID` (self-authored stories are filtered out to prevent loops)
- `html_text`, after tag stripping, must start with the trigger — `@ai ...`. Leading newlines/whitespace are tolerated; leading body text is not.

### Reply goes to the wrong task

The channel tracks the **most recently triggered task per project** and replies there. If two people trigger nagi in two different tasks between poll ticks, the reply routes to whichever was processed last. This is a known limitation — prefer splitting busy projects, or wait for replies before the next trigger.

### Stories being re-processed after restart

By design, `lastStoryTs` is in-memory. After a restart, the first poll only considers tasks modified after the service started, so past comments are skipped — but triggers that arrive while nagi is down are also skipped. If strict at-least-once delivery matters, add persistent state tracking (not implemented yet).

### Rate limit errors (`429 Too Many Requests`)

The client retries with `Retry-After` automatically. If you see repeated 429s in logs, increase `ASANA_POLL_INTERVAL_MS` or reduce the number of projects watched.

## Supported Features

- **Project-level watching** — Each `ASANA_PROJECT_GIDS` entry = one nagi group
- **Trigger-pattern detection** — Any comment whose body starts with `@ai` (or the configured trigger) dispatches the agent
- **Auto-subtask replies** — Responses land on a fresh subtask named from the user's request; the parent task only gets a short pointer comment
- **Subtask follow-ups** — A `@ai` comment inside an existing agent subtask continues that conversation (no new nesting)
- **Task context injection** — Every dispatched message is prefixed with an `<asana_task>` block containing the task's name, description (notes), parent task info (for subtasks) and full comment history, so the agent can answer questions grounded in the task's content without needing extra tool calls
- **Comment-only filter** — System stories (assignment, date changes, etc.) are ignored
- **Self-reply guard** — The bot's own comments never re-trigger it (requires `ASANA_USER_GID` or auto-resolved /users/me)
- **Increment-only polling** — `modified_since` + per-task `created_at` cursor keeps API calls minimal
- **Multi-channel** — Runs alongside Slack/Discord or other channels

## Known limitations

- **Reply routing is last-write-wins** per project — `lastTaskGid[projectJid]` stores the most recent triggered task, so if two triggers arrive on different tasks between poll ticks the reply routes to whichever was processed last
- **In-memory watchlist** — `watchedSubtasks` is kept in memory; after a nagi restart the channel forgets which subtasks it created, so follow-ups posted inside old agent subtasks will no longer be picked up (you can start a new conversation by `@ai`-ing on the parent task again)
- **In-memory cursors** — Triggers that arrived during downtime are skipped
- **Subtask creation fallback** — If the Asana API refuses `POST /tasks/{gid}/subtasks` the channel falls back to replying on the parent task and logs a warning
- **PAT = your identity** — The bot acts as you in every workspace, with all your permissions
- **Polling latency** — Default 60s delay between trigger and response; `ASANA_POLL_INTERVAL_MS` can reduce this at the cost of API quota
- **No attachment support** — Asana attachments in comments are not downloaded or forwarded
