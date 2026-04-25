---
name: deploy
description: Sync deploy/{ASSISTANT_NAME}/ with deploy/templates/. Covers host/container entry files, group prompt defaults, and launchd plist. Triggers on "deploy", "sync deploy", "update entry", "sync entry", "update container entry", "sync container entry", "sync group templates", "sync launchd".
---

# Deploy

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Sync `deploy/{ASSISTANT_NAME}/` (user-editable) with `deploy/templates/` (pristine, git-tracked). Preserves user customizations while incorporating new features from templates.

## Targets

### Entry points

| Target | Template | Local |
|--------|----------|-------|
| Host | `deploy/templates/host/entry.template.ts` | `deploy/{ASSISTANT_NAME}/host/entry.ts` |
| Claude Code | `deploy/templates/container/claude-code/entry.template.ts` | `deploy/{ASSISTANT_NAME}/container/claude-code/entry.ts` |
| Open Code | `deploy/templates/container/open-code/entry.template.ts` | `deploy/{ASSISTANT_NAME}/container/open-code/entry.ts` |

### Group prompts

| Target | Template | Local |
|--------|----------|-------|
| Groups | `deploy/templates/groups/{channel}/{group}/*.md` | `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/*.md` |

Group prompt files (`CLAUDE.md`, `AGENTS.md`, and any others) are plain markdown with no placeholder substitution. Templates act as the pristine baseline; `deploy/{ASSISTANT_NAME}/groups/` is the copy the user edits freely.

### Launchd

| Target | Template | Local |
|--------|----------|-------|
| Launchd | `deploy/templates/launchd/com.nagi.plist` | `deploy/{ASSISTANT_NAME}/launchd/com.nagi.plist` |

The launchd plist uses `{{PLACEHOLDER}}` substitution for machine-specific paths (`{{NODE_PATH}}`, `{{TSX_PATH}}`, `{{PROJECT_ROOT}}`, `{{NODE_BIN_DIR}}`, `{{HOME}}`). Materialization requires path detection — see `/setup-launchd` for the full logic.

## Steps

### 0. Determine ASSISTANT_NAME

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントにデプロイしますか？** — 検出された各名前をオプションとして表示する。ディレクトリが存在しない場合は Other で新しい名前を入力させ、`mkdir -p deploy/{ASSISTANT_NAME}` で作成する。

Use the selected name as `{ASSISTANT_NAME}` throughout the remaining steps.

### 1. Choose target

AskUserQuestion: Which target(s) to sync?

- **All** — sync everything below
- **Host** — host orchestrator entry only
- **Claude Code** — claude-code container entry only
- **Open Code** — open-code container entry only
- **Groups** — group prompt defaults only
- **Launchd** — launchd plist（パス検出とプレースホルダー置換が必要）

### 1.5. Initialize data directory and .env

新規アシスタントの場合、データディレクトリと .env を初期化する。既存なら何もしない。

```bash
# データディレクトリ（DB・ログ・セッション等）
mkdir -p __data/{ASSISTANT_NAME}/store
mkdir -p __data/{ASSISTANT_NAME}/logs
mkdir -p __data/{ASSISTANT_NAME}/groups
mkdir -p __data/{ASSISTANT_NAME}/sessions
mkdir -p __data/{ASSISTANT_NAME}/ipc
```

DB が存在しない場合、orchestrator が初回起動時に自動作成するので手動作成は不要。

```bash
# .env テンプレートコピー（存在しない場合のみ）
if [ ! -f deploy/{ASSISTANT_NAME}/.env ]; then
  cp deploy/templates/.env.example deploy/{ASSISTANT_NAME}/.env
  sed -i '' "s/ASSISTANT_NAME=ai/ASSISTANT_NAME={ASSISTANT_NAME}/" deploy/{ASSISTANT_NAME}/.env
  echo ".env created — トークンを設定してください: deploy/{ASSISTANT_NAME}/.env"
fi
```

### 1.6. Configure .env tokens

`.env` が新規作成された場合、認証トークンとチャンネルトークンの設定をガイドする。既にトークンが設定済みならスキップ。

#### Agent authentication

AskUserQuestion: Which agent runtime? (Claude Code / Open Code)

**Claude Code:**

AskUserQuestion: Claude subscription (Pro/Max) vs Anthropic API key?

- **Subscription (Pro/Max):** Tell user to run `! claude setup-token`, copy the token, then add to `deploy/{ASSISTANT_NAME}/.env`:
  ```
  CLAUDE_CODE_OAUTH_TOKEN=<token>
  ```
- **API key:** Tell user to add to `deploy/{ASSISTANT_NAME}/.env`:
  ```
  ANTHROPIC_API_KEY=<key>
  ```

**Open Code:**

AskUserQuestion: Which LLM provider? (OpenRouter / Google Gemini / OpenAI / Anthropic)

Set `CONTAINER_IMAGE` and provider-specific keys in `deploy/{ASSISTANT_NAME}/.env`:
```
CONTAINER_IMAGE=nagi-agent-opencode:latest
OPENCODE_MODEL={provider}/{model}
```

| Provider | Model example | Key variable |
|---|---|---|
| OpenRouter | `openrouter/anthropic/claude-sonnet-4` | `OPENROUTER_API_KEY=sk-or-...` |
| Google Gemini | `google/gemini-2.5-pro` | `GOOGLE_API_KEY=...` |
| OpenAI | `openai/gpt-4.1` | `OPENAI_API_KEY=sk-...` |
| Anthropic | `anthropic/claude-sonnet-4` | `ANTHROPIC_API_KEY=...` |

#### Channel tokens

AskUserQuestion (multiSelect): Which messaging channels do you want to enable?
- Slack (Socket Mode — no public URL needed)
- Discord (bot token)
- Asana (polls task comments — no public URL needed)

**Slack:** Tell user to create a Slack app (From Manifest at https://api.slack.com/apps), install to workspace, generate App-Level Token (`connections:write` scope), copy Bot Token. Add to `deploy/{ASSISTANT_NAME}/.env`:
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
```

**Discord:** Tell user to create app at https://discord.com/developers/applications, enable MESSAGE CONTENT INTENT and SERVER MEMBERS INTENT, copy bot token. Add to `deploy/{ASSISTANT_NAME}/.env`:
```
DISCORD_BOT_TOKEN=...
```

**Asana:** Tell user to create Personal Access Token at https://app.asana.com/0/my-apps, find project GID(s). Add to `deploy/{ASSISTANT_NAME}/.env`:
```
ASANA_PAT=...
ASANA_PROJECT_GIDS=<comma-separated project gids>
```

### 2. Check current state

For each selected target, check if the local file exists:

```bash
test -f deploy/{ASSISTANT_NAME}/host/entry.ts && echo "HOST_EXISTS" || echo "HOST_MISSING"
test -f deploy/{ASSISTANT_NAME}/container/claude-code/entry.ts && echo "CC_EXISTS" || echo "CC_MISSING"
test -f deploy/{ASSISTANT_NAME}/container/open-code/entry.ts && echo "OC_EXISTS" || echo "OC_MISSING"
```

If a local file is missing, create the directory and copy from template:

```bash
mkdir -p deploy/{ASSISTANT_NAME}/host
cp deploy/templates/host/entry.template.ts deploy/{ASSISTANT_NAME}/host/entry.ts

mkdir -p deploy/{ASSISTANT_NAME}/container/claude-code
cp deploy/templates/container/claude-code/entry.template.ts deploy/{ASSISTANT_NAME}/container/claude-code/entry.ts
cp deploy/templates/container/claude-code/index.d.ts deploy/{ASSISTANT_NAME}/container/claude-code/index.d.ts

mkdir -p deploy/{ASSISTANT_NAME}/container/open-code
cp deploy/templates/container/open-code/entry.template.ts deploy/{ASSISTANT_NAME}/container/open-code/entry.ts
cp deploy/templates/container/open-code/index.d.ts deploy/{ASSISTANT_NAME}/container/open-code/index.d.ts
```

If the file was missing and copied fresh, skip to verification for that target.

#### Groups target

For group prompt defaults, walk every file under `deploy/templates/groups/`:

```bash
for f in $(find deploy/templates/groups -type f); do
  local="deploy/{ASSISTANT_NAME}/groups/${f#deploy/templates/groups/}"
  if [ ! -f "$local" ]; then
    mkdir -p "$(dirname "$local")"
    cp "$f" "$local"
    echo "NEW: $local"
  elif ! diff -q "$f" "$local" > /dev/null 2>&1; then
    echo "CHANGED: $local (differs from template)"
  else
    echo "OK: $local"
  fi
done
```

For **CHANGED** files, use `AskUserQuestion` per file: "Overwrite with template", "Keep local", or "Show diff". Never overwrite without asking — `deploy/{ASSISTANT_NAME}/groups/` is the user's editable layer.

#### Launchd target

The launchd plist requires path detection before materialization. Run the same detection as `/setup-launchd` Step 1:

```bash
NODE_PATH=$(nodenv which node 2>/dev/null || which node)
TSX_PATH=$(pwd)/$(find node_modules/.pnpm -name 'cli.mjs' -path '*/tsx/dist/*' | head -1)
PROJECT_ROOT=$(pwd)
NODE_BIN_DIR=$(dirname $NODE_PATH)
```

Then read `deploy/templates/launchd/com.nagi.plist`, substitute `{{NODE_PATH}}`, `{{TSX_PATH}}`, `{{PROJECT_ROOT}}`, `{{NODE_BIN_DIR}}`, `{{HOME}}` with the detected values, and write to `deploy/{ASSISTANT_NAME}/launchd/com.nagi.plist`.

If the local file already exists, show the user a diff of the XML structure changes and ask before overwriting.

Validate with:
```bash
plutil -lint deploy/{ASSISTANT_NAME}/launchd/com.nagi.plist
```

Skip steps 3–5 for the Launchd target (no merge logic, no tsc).

### 3. Diff template vs local

For each selected target, read both the template and local file. Compare and identify:

- **New in template** — new registrations, imports, config changes
- **Custom in local** — user-added plugins, custom config, extra logic
- **Conflicts** — same section modified differently

#### Host-specific items to check
- Channel plugin registrations (`registry.register`)
- MCP plugin registrations (`registerMcpPlugin`)
- Hooks plugin registration (`registerHooksPlugin`)
- Mount allowlist configuration (`setMountAllowlist`)

#### Container-specific items to check
- Container plugin imports (`import(pluginPath)`)
- Plugin push blocks (`plugins.push`)
- Hook factory wiring (`createHooks`)

#### Groups-specific notes
Group prompt files have no placeholder substitution — a straight diff between template and local is the whole story. Skip steps 4 and 5 for the Groups target (no merge logic, no tsc).

### 4. Merge changes

Apply new template additions to the local file while preserving user customizations:

- **New plugins/registrations** — add blocks that don't exist in local
- **Updated imports** — add missing imports
- **Removed features** — warn user but don't remove unless they confirm

### 5. Verify

```bash
# Host:
pnpm exec tsc --noEmit

# Claude Code container:
pnpm exec tsc --noEmit -p host/agent-runner-claudecode/tsconfig.json

# Open Code container:
pnpm exec tsc --noEmit -p host/agent-runner-opencode/tsconfig.json
```

TypeScript must compile without errors for all selected targets.

### 6. Summary

Show the user what changed per target:
- Added: list of new registrations/imports
- Preserved: list of user customizations kept
- Removed: list of anything removed (if any)

## Rules

- **Never overwrite user customizations** without asking
- **Never remove** registrations the user added manually
- **Always preserve** custom env variable names, plugin configs, extra logic
- If unsure about a conflict, use `AskUserQuestion` to let the user decide
- After merging, always verify TypeScript compiles
