---
name: update-group-prompt
description: Interactively update an existing group prompt file (CLAUDE.md, AGENTS.md, IDENTITY.md etc.) under deploy/default/groups/{channel}/{group}/. Asks the user at every step and previews a diff before saving. Triggers on "update group prompt", "edit group prompt", "modify claude.md", "edit identity", "update soul", "update instructions".
---

# Update Group Prompt

Interactively modify an existing prompt file in a group's `deploy/default/groups/{channel}/{group}/` directory. Use this after `create-group-prompt` when you want to refine tone, add rules, rename things, or rewrite a section — without replacing the whole file.

If the target file does not exist yet, tell the user to run `create-group-prompt` instead.

**UX Note:** Use `AskUserQuestion` for every user-facing decision below. Do not guess — surface a question and let the user pick. **All AskUserQuestion questions, option labels, and option descriptions MUST be written in Japanese.**

## Step 1: Select the group

List existing groups under `deploy/default/groups/`:

```bash
find deploy/default/groups -type d -mindepth 2 -maxdepth 2 2>/dev/null | sed 's|deploy/default/groups/||' | sort
```

If the result is empty, tell the user there are no groups to edit and suggest running `/deploy` (Groups target) to materialize templates first.

AskUserQuestion: **どのグループを編集しますか？**
Present each existing `{channel}/{group}` as an option. If only one group exists, still confirm the choice.

## Step 2: Select the file

List markdown files in the selected group directory:

```bash
ls -1 deploy/default/groups/{channel}/{group}/*.md 2>/dev/null
```

AskUserQuestion: **どのファイルを更新しますか？**
Present each file as an option. Use Japanese descriptions:
- `CLAUDE.md` — SDK が自動読み込みするメイン指示
- `AGENTS.md` — ツール一覧と使用ルール
- `IDENTITY.md` — エージェントの性格と話し方
- `SOUL.md` — ミッションと行動原則
- `INSTRUCTIONS.md` — セキュリティ・ツール・出力ルール
- Any custom `*.md` the user added

If no `*.md` files exist in the group, tell the user to run `create-group-prompt` first and stop.

## Step 3: Read the current file

Use the `Read` tool on `deploy/default/groups/{channel}/{group}/{filename}` to load the current content. You will need this for both modes below (to generate diffs and to apply edits intelligently).

## Step 4: Choose the edit mode

AskUserQuestion: **どのように更新しますか？**

- **自然言語で指示（おすすめ）** — 変更内容を自由に記述して、スキルが適用する
- **末尾に追記** — ファイルの最後に新しい内容を追加する
- **キャンセル** — 変更せずに終了

## Step 5: Gather the change

### 5a. Natural instruction mode

AskUserQuestion: **どのように変更しますか？**（自由入力）
Accept a free-form description. Examples the user might give:
- 「トーンをもう少しカジュアルにして」
- 「`@Nagi` を `@Assistant` に全部置換して」
- 「SOUL セクションを自律性重視に書き換えて」
- 「セキュリティルールに『API キーを出力しない』を追加して」
- 「日本語設定のパラグラフを削除して」

Interpret the instruction against the current file content (loaded in Step 3) and prepare a precise `Edit` call (one or more `old_string` / `new_string` pairs). **Do not save yet** — the preview in Step 6 must come first.

If the instruction is ambiguous (e.g. 「もっと良くして」), push back with a clarifying AskUserQuestion (in Japanese) before proceeding. Do not guess.

### 5b. Append mode

AskUserQuestion: **ファイル末尾に追記する内容を入力してください。**
Accept a free-form multiline block. Prepare to append it to the file with a leading blank line if the file does not already end with one.

## Step 6: Preview

Show the user a **unified diff** of the proposed change. Keep it compact — only the hunks that actually change, with a few lines of context. Do not dump the whole file.

```
--- deploy/default/groups/{channel}/{group}/{filename} (current)
+++ deploy/default/groups/{channel}/{group}/{filename} (proposed)
@@ ... @@
 unchanged context line
-removed line
+added line
 unchanged context line
```

AskUserQuestion: **この変更を保存しますか？**

- **保存する** — 編集を適用
- **全文を表示** — 変更後のファイル全体を見てから再確認
- **やり直す** — Step 4 に戻って再入力
- **キャンセル** — 保存せず終了

## Step 7: Write the file

Apply the edit using the `Edit` tool on `deploy/default/groups/{channel}/{group}/{filename}`. For Append mode, use `Edit` with the last few lines of the file as `old_string` and those lines plus the new content as `new_string`, so the edit remains precise.

Confirm the write succeeded. If the edit failed (e.g. `old_string` not unique), report the error and offer to retry via Step 4.

## Step 8: Sync to runtime

AskUserQuestion: **`__data/groups/` に今すぐ同期しますか？**（デフォルト: はい）

- **はい** — 更新ファイルを `__data/groups/{channel}/{group}/{filename}` にコピー:
  ```bash
  mkdir -p "__data/groups/{channel}/{group}"
  cp "deploy/default/groups/{channel}/{group}/{filename}" "__data/groups/{channel}/{group}/{filename}"
  ```
- **いいえ** — `/update-groups` で後から同期できることを案内

Be aware: overwriting `__data/groups/{channel}/{group}/{filename}` will discard any edits the user made directly in the runtime directory. If the runtime file differs from the deploy/default version *before* this skill's edit, warn the user and let them pick Yes / No / Show diff.

## Step 9: Restart nagi if it is running

Check whether nagi is currently running under launchd:

```bash
launchctl list 2>/dev/null | grep -q com.nagi && echo RUNNING || echo STOPPED
```

- If **STOPPED**: skip this step (changes will apply on next start).
- If **RUNNING**: AskUserQuestion: **変更を反映するために nagi を再起動しますか？**（デフォルト: はい）
  - **はい** — `/nagi-restart` スキルを実行
  - **いいえ** — 次のコンテナ起動時または `/nagi-restart` 実行時に反映されることを案内

## Step 10: Summary

Report what was done in a single compact block:

- Group: `{channel}/{group}`
- File: `{filename}`
- Mode: Natural instruction / Append
- Change summary: one sentence (e.g. "Replaced @Nagi with @Assistant in 4 places")
- Synced to runtime: yes / no
- Nagi restarted: yes / no / not running

## Rules

- **Always preview before saving.** Never apply an edit without showing the user a diff and getting confirmation.
- **Always edit `deploy/default/groups/`**, never `deploy/templates/groups/` (that layer is the pristine upstream baseline) and never `__data/groups/` directly (except via Step 8's explicit sync).
- **Ask, don't guess.** If the user's instruction is ambiguous, follow up with another AskUserQuestion rather than making your best guess and saving it.
- **One file per invocation.** If the user wants to edit multiple files, complete one cycle first, then ask if they want to run the skill again.
- **Fail loudly.** If any step fails (file not found, edit conflict, cp failure), stop and report the exact error — do not silently proceed.
