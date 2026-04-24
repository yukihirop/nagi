---
name: configure-skills
description: Configure the per-group skills allowlist at deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/skills.config.json. Controls which skills from container/skills/ get mounted into the agent session, reducing input tokens for quieter groups. Triggers on "configure skills", "edit skills", "skills allowlist", "skills config", "limit skills", "スキル設定", "スキル絞り込み", "スキル制限".
---

# Configure Skills

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

Interactively edit `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/skills.config.json` — the per-group allowlist that controls which skills under `container/skills/` get copied into the agent session at `{groupSessionsDir}/skills`. Use this to reduce the input-token bill for groups that do not need every skill (e.g. casual chat channels).

**Behavior recap** (enforced by `host/orchestrator/src/container-runner.ts`):

- No file → all skills load (backward compatible)
- `{ "enabled": [...] }` → only the listed names load
- `{ "enabled": [] }` → zero skills load
- Malformed file → warn log, all skills load
- Unknown name in `enabled` → warn log, that name is skipped

**UX Note:** Use `AskUserQuestion` for every user-facing decision. All question text, option labels, and option descriptions MUST be in Japanese.

## Step 1: Select ASSISTANT_NAME

Detect existing assistants:

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

AskUserQuestion: **どのアシスタントを編集しますか？**
Present each detected name as an option. If only one exists, still confirm the choice. If none exist, tell the user to run `/setup` first and stop.

## Step 2: Select the group

List groups under the chosen `deploy/{ASSISTANT_NAME}/groups/`:

```bash
find deploy/{ASSISTANT_NAME}/groups -type d -mindepth 2 -maxdepth 2 2>/dev/null | sed 's|deploy/{ASSISTANT_NAME}/groups/||' | sort
```

AskUserQuestion: **どのグループのスキル設定を編集しますか？**
Present each `{channel}/{group}` pair as an option. If the list is empty, tell the user to run `/deploy` (Groups target) first and stop.

## Step 3: Read the current state

Check whether `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/skills.config.json` exists. Remember this: the user needs to see the difference between "currently no file (all skills)" and "currently allowlisting N skills".

If present, parse it. If `enabled` is missing/invalid, treat as "currently no allowlist (all skills)" and warn the user that the file will be rewritten cleanly.

## Step 4: List available skills

List directories under `container/skills/` — each directory is a skill whose `SKILL.md` YAML header `description` field is worth showing to the user:

```bash
for d in container/skills/*/; do
  name=$(basename "$d")
  desc=$(awk '/^description:/{sub(/^description: */,""); print; exit}' "$d/SKILL.md" 2>/dev/null | sed 's/^"//;s/"$//' | cut -c1-100)
  printf '%s — %s\n' "$name" "$desc"
done
```

Keep this list in memory for Step 5.

## Step 5: Pick the new allowlist

AskUserQuestion (`multiSelect: true`): **このグループで有効にするスキルを選んでください（選ばなかったものは読み込まれません）。**

Present each skill from Step 4 as an option. Label = skill name. Description = first ~80 chars of the skill's YAML-header description, in the skill's original language (descriptions in `container/skills/*/SKILL.md` are typically English — keep them as-is; do not translate).

If the current file already has an `enabled` list, **pre-indicate** which skills are currently active by prefixing `現在有効: ` in the description. Do not omit disabled ones — the user should be able to see the full catalogue and reshuffle freely.

Also include two special considerations (ask as a follow-up AskUserQuestion if applicable):

- If the user selected *all* of the skills, ask **「全スキル有効なら `skills.config.json` を削除して『設定なし（全スキルロード）』の状態に戻しますか？」** — deleting the file is cleaner than an always-full allowlist that drifts when `container/skills/` gains new entries.
- If the user selected *zero* skills, confirm **「空の allowlist（スキルを一切読み込まない）で本当に進めますか？」** to guard against accidental empty selections.

## Step 6: Preview

Show the user a compact preview:

```
deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/skills.config.json

Before:
{ "enabled": ["status", "slack-formatting"] }      ← or「ファイルなし（全ロード）」

After:
{ "enabled": ["status", "slack-formatting", "capabilities"] }   ← or「ファイル削除」

Delta: +capabilities, -ui-ux-pro-max
```

If `Before` and `After` are identical, tell the user nothing will change and stop.

AskUserQuestion: **この変更を適用しますか？**
- **適用する** — 保存
- **やり直す** — Step 5 に戻る
- **キャンセル** — 保存せず終了

## Step 7: Write (or delete) the file

- If the decision in Step 5 was to **delete** the file: `rm deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/skills.config.json` (check it exists first).
- Otherwise: write pretty-printed JSON with trailing newline:
  ```json
  {
    "enabled": ["status", "slack-formatting"]
  }
  ```

Use the `Write` tool.

## Step 8: Clear stale session skills (optional)

The orchestrator wipes `{groupSessionsDir}/skills` on every container spawn, so stale skills do not persist across runs. No manual cleanup is needed. Do not touch `__data/{ASSISTANT_NAME}/sessions/` yourself — the orchestrator owns that path.

## Step 9: Restart nagi if it is running

Check launchd:

```bash
launchctl list 2>/dev/null | grep -q com.nagi.{ASSISTANT_NAME} && echo RUNNING || echo STOPPED
```

- **STOPPED** → tell the user the change will take effect on next start and stop.
- **RUNNING** → AskUserQuestion: **変更を反映するために nagi を再起動しますか？**（デフォルト: はい）
  - **はい** — invoke `/nagi-restart`
  - **いいえ** — explain the change will take effect on the next container spawn (i.e. next message) or after `/nagi-restart`

If nagi is running as a manual `pnpm dev` / `npx tsx deploy/.../entry.ts` process (not launchd), detect it:

```bash
ps aux | grep "deploy/{ASSISTANT_NAME}/host/entry.ts" | grep -v grep
```

and tell the user to restart it themselves — `/nagi-restart` only handles launchd.

## Step 10: Summary

Report in one compact block:

- Target: `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/skills.config.json`
- Action: wrote allowlist of N skills / deleted file / no change
- Enabled skills: `[name1, name2, ...]` (or 「全スキル（ファイルなし）」 / 「なし（空の allowlist）」)
- Nagi: restarted / not running / user will restart manually
- Expected effect: 「次回の応答から input tokens が〇〇個分減ります」— optional, only if you can estimate (rough rule: each excluded skill = ~4,000–5,000 tokens)

## Rules

- **Always edit `deploy/{ASSISTANT_NAME}/groups/`**, never `__data/{ASSISTANT_NAME}/groups/` or `deploy/templates/`.
- **One group per invocation.** If the user wants to configure multiple groups, finish one cycle and invite them to run the skill again.
- **Preserve the file's meaning.** `skills.config.json` has only one supported key (`enabled`). Do not add `disabled`, `skills`, or any other keys that the orchestrator will ignore — that would mislead future readers.
- **Prefer file deletion over a full allowlist** when the user wants everything loaded. The orchestrator's default is strictly cheaper than maintaining an always-full list.
- **Never restart nagi without asking.** Even when the user opts in to restart, surface the confirmation once.
