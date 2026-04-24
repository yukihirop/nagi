---
name: add-context-probe
description: Install or remove a context probe under deploy/{ASSISTANT_NAME}/container/context/ to verify the auto-mount mechanism. Supports minimal marker probe or git clone probe. Triggers on "add context probe", "context probe", "probe context", "verify context mount", "test context mount", "コンテキストプローブ".
---

# Add Context Probe

## Step 0: Language selection

Before proceeding with any other steps in this skill, ask the user which language to continue in using `AskUserQuestion`. Keep this initial prompt in English because the preferred language is not yet known.

- Question: `Which language should I continue in?`
- Options: `English`, `日本語 (Japanese)`

Use the selected language for all subsequent user-facing messages and for every further `AskUserQuestion` prompt in this skill. Do not translate code, file paths, shell commands, or file contents.

`deploy/{ASSISTANT_NAME}/container/context/` 配下の自動マウント機構（`/workspace/extra/{name}` への read-only マウント + Claude Code の `additionalDirectories` 取り込み + `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` 経由の `CLAUDE.md` 自動追記）が動いているかを確認するためのプローブを設置するスキル。

2 種類のプローブに対応:

- **marker** — `probe/` 固定ディレクトリに最小限の CLAUDE.md とマーカーファイルを書き込む（軽量）
- **clone** — 指定 git リポジトリを `deploy/{ASSISTANT_NAME}/container/context/{name}/` に clone する（実リポジトリでの検証）

動作確認が済んだら同じスキルで撤去もできる。

## Step 1: Status check

どのアクションでもまず現状を確認する。`context/` 配下の全サブディレクトリを一覧するのが目的（marker probe 以外にも clone 済みリポジトリがあるかもしれない）:

```bash
ls -la deploy/{ASSISTANT_NAME}/container/context/ 2>/dev/null || echo "context dir not present"
```

結果をユーザー向けの判断材料として控えておく。

## Step 2: Decide action

AskUserQuestion でアクションを聞く:

- **install** — 新しいプローブを設置する
- **remove** — 既存のプローブを撤去する
- **status** — 現状を確認するだけ（何も変更しない）

Status のみの場合は Step 1 の結果を表示して終了。install されていれば必要に応じて各ディレクトリの中身を `ls` で示してよい。

## Step 3a: Install

`install` を選んだ場合のみ実行。

### Step 3a-1: プローブ方式を選ぶ

AskUserQuestion:

- **marker** — 最小構成。`probe/` 固定ディレクトリに `CLAUDE.md` と `probe-marker.txt` を書き込む。`additionalDirectories` 経路と `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` 経路の両方を確認できる。
- **clone** — 実リポジトリを clone する。マウントと Read 経路の確認に有効（clone 元に `CLAUDE.md` が無ければ自動追記経路はテストできない）。

### Step 3a-2a: Marker install

marker を選んだ場合のみ実行。設置先は `probe/` 固定。

既存チェック:

```bash
ls -la deploy/{ASSISTANT_NAME}/container/context/probe 2>/dev/null && echo "already exists" || echo "ok to create"
```

既存の場合は上書きしてよいかユーザーに確認する。

ディレクトリ作成:

```bash
mkdir -p deploy/{ASSISTANT_NAME}/container/context/probe
```

`deploy/{ASSISTANT_NAME}/container/context/probe/CLAUDE.md` を Write ツールで作成。内容:

```markdown
# Probe Context

このファイルは `deploy/{ASSISTANT_NAME}/container/context/` の自動マウント機構が動作していることを確認するためのプローブです。

コンテナ内では `/workspace/extra/probe/` にマウントされ、`additionalDirectories` 経由で Claude Code から参照可能になります。同ディレクトリには `probe-marker.txt` があり、`probe-marker-ok` という文字列が書かれています。

ユーザーから「プローブについて知ってる？」のように聞かれたら、このコンテキストを読んでいることを伝え、必要なら `probe-marker.txt` を Read して中身を示してください。
```

`deploy/{ASSISTANT_NAME}/container/context/probe/probe-marker.txt` を Write ツールで作成。内容:

```
probe-marker-ok
```

作成後、ファイルが存在することを確認:

```bash
ls -la deploy/{ASSISTANT_NAME}/container/context/probe/
```

### Step 3a-2b: Clone install

clone を選んだ場合のみ実行。

AskUserQuestion で以下を聞く（1 回の AskUserQuestion にまとめて OK）:

1. **リポジトリ URL** — Other 選択で自由入力してもらう
2. **ディレクトリ名** — 「リポジトリ名を自動使用」または Other で自由入力
3. **clone 深度** — `--depth 1`（推奨、高速）または full clone

URL からディレクトリ名を自動生成する場合は、末尾の `.git` を除去し、パスの最後のセグメントを使う（例: `https://github.com/foo/bar.git` → `bar`、`https://github.com/foo/bar` → `bar`）。

ディレクトリ名は英数字・ハイフン・アンダースコアのみ許可（スラッシュや `..` が含まれたら拒否してやり直し）。

既存チェック:

```bash
ls -la deploy/{ASSISTANT_NAME}/container/context/{name} 2>/dev/null && echo "already exists" || echo "ok to clone"
```

既存の場合はユーザーに上書きしてよいか確認する。上書き時は先に `rm -rf` する。

親ディレクトリ作成 + clone:

```bash
mkdir -p deploy/{ASSISTANT_NAME}/container/context
git clone {--depth 1} {URL} deploy/{ASSISTANT_NAME}/container/context/{name}
```

clone 後、ファイルが存在することと `CLAUDE.md` の有無を確認:

```bash
ls -la deploy/{ASSISTANT_NAME}/container/context/{name}/ | head -20
ls deploy/{ASSISTANT_NAME}/container/context/{name}/CLAUDE.md 2>/dev/null && echo "CLAUDE.md exists — auto-append path will work" || echo "no CLAUDE.md — only Read path testable"
```

## Step 3b: Remove

`remove` を選んだ場合のみ実行。

Step 1 の status 結果から context 配下のサブディレクトリを洗い出し、AskUserQuestion で撤去対象を選ばせる。候補が 1 個なら直接確認。候補が無ければ「撤去対象がない」と伝えて終了。

**重要**: `deploy/{ASSISTANT_NAME}/container/context/` 直下の任意のサブディレクトリを削除できるが、`context/` 自体や `deploy/{ASSISTANT_NAME}/container/` より上は絶対に触らない。ユーザーが「全部消して」と言った場合でも、選択肢として列挙されたディレクトリだけを対象にする。

削除前の最終確認（AskUserQuestion）を挟んでから:

```bash
rm -rf deploy/{ASSISTANT_NAME}/container/context/{name}
```

削除後の確認:

```bash
ls -la deploy/{ASSISTANT_NAME}/container/context/{name} 2>/dev/null || echo "removed"
```

## Step 4: Post-action guidance

### Install 後

ユーザーに以下を伝える:

1. **反映にはコンテナ再起動が必要**。`/nagi-restart` を実行するか、次回コンテナ起動時から自動マウントされる。
2. **動作確認の方法** — 登録済みグループのチャットから以下を投げる:
   - **marker** の場合:
     - 「`/workspace/extra/probe/probe-marker.txt` を読んで中身を教えて」→ `probe-marker-ok` が返れば Read 経路 OK
     - 「プローブについて知ってる？」→ `CLAUDE.md` の内容を踏まえた応答が返れば `additionalDirectories` + `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` 経路 OK
   - **clone** の場合:
     - 「`/workspace/extra/{name}/README.md` を読んで要約して」→ 内容が返れば Read + additionalDirectories 経路 OK
     - clone 元に `CLAUDE.md` があれば「{リポジトリ}について知ってる？」で自動追記経路も確認できる
3. **ログで確認**するなら `/nagi-logs` で:
   - `Container mount configuration` に `.../context/{name} -> /workspace/extra/{name} (ro)` が出ていればホスト側マウント成功
   - `[agent-runner] Additional directories: ... /workspace/extra/{name}` が出ていればエージェント側認識成功

ユーザーに `/nagi-restart` を実行するか確認する（AskUserQuestion）。

### Remove 後

- 次回コンテナ起動時からマウントが消える。
- ユーザーに `/nagi-restart` を実行するか確認する（AskUserQuestion）。

### Status のみ

現状を表示するだけで終了。

## 注意点

- `deploy/*/` は `.gitignore` で除外済みなので、プローブファイルがナギ本体のリポに混入する心配はない。clone したリポジトリの `.git/` も同様にコミットされない。
- `deploy/{ASSISTANT_NAME}/container/context/` の自動マウント機構は、直下のサブディレクトリをすべてスキャンしてそれぞれを `/workspace/extra/{名前}` に read-only でマウントする。名前は固定ではないので、clone する際は任意のディレクトリ名を使える。
- Remove 時は候補列挙 → 明示選択 → 最終確認の順を守る。ユーザーが意図していない context ディレクトリ（別の用途で置かれた clone など）を巻き込まないこと。
- プローブが install されたままでも害はないが、不要になったら `remove` で撤去することを推奨。
