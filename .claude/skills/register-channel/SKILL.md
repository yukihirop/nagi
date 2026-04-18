---
name: register-channel
description: Register, list, or unregister a channel ID as a group in the assistant's SQLite DB. Supports Slack/Discord/Asana with reachability verification via channel APIs. Triggers on "register channel", "add channel id", "list groups", "unregister group", "チャンネル登録", "グループ登録", "グループ一覧", "グループ削除".
---

# register-channel

既存のチャンネルID(Bot/Appは既に作成済み前提)を、指定アシスタントの `__data/{ASSISTANT_NAME}/store/messages.db` の `registered_groups` に登録/一覧表示/削除するスキル。

`add-channel-slack/discord/asana` がBot作成込みの重いフローなのに対し、本スキルは **既存Bot + 既存チャンネル** を前提とした軽量な ID→DB 登録に特化。到達性検証で Bot 未招待/ID誤り を事前検出する。

## 実装構成

本スキルは `src/` 配下の Node CLI スクリプトを Bash から呼び出す形で動作する。SKILL.md はオーケストレーション(分岐・ユーザ入力・結果表示)に専念する。

| ファイル | 役割 |
|---|---|
| `src/jid.mjs` | JIDプレフィックスマップ + ID/folderバリデーション(ライブラリ) |
| `src/reachability.mjs` | `<channel> <id> <assistantName>` → Slack/Discord/Asana API で到達性検証 |
| `src/register.mjs` | `--assistant --channel --id --name --folder --trigger --isMain --requiresTrigger` → DB登録 + フォルダ作成 |
| `src/list.mjs` | `<assistantName>` → 登録済みグループをJSON配列で出力 |
| `src/unregister.mjs` | `<assistantName> <jid>` → DELETE |

すべて **JSON を stdout に出力** する。Bash 側で `jq` や `python3 -c 'import json'` でパースして user に表示する。

`src/jid.mjs` には JIDプレフィックスマップ(`slack:` / `discord:` / `asana:`)の single source of truth がある。プレフィックスを追加・変更する際はここを起点に grep すれば関連箇所を芋づる式に追える。

## Step 0: ASSISTANT_NAME の検出

```bash
ls -d deploy/*/ 2>/dev/null | grep -v templates | sed 's|deploy/||;s|/||'
```

検出された名前を `AskUserQuestion` でユーザに選ばせる。未検出なら「先に `/setup` か `/deploy` でプロファイルを作成してください」と案内して終了。

以降 `{NAME}` は選ばれた ASSISTANT_NAME を指す。

## Step 1: アクション選択

`AskUserQuestion`(単一選択、日本語):

- **登録する** — チャンネルIDを新規登録
- **一覧表示する** — 登録済みグループを表示
- **削除する** — 登録済みグループを削除

## Step 2a: list

```bash
node .claude/skills/register-channel/src/list.mjs {NAME}
```

出力 JSON の `groups[]` をテーブル形式で整形して表示。件数 0 なら「登録されたグループはありません」。

## Step 2b: unregister

1. まず list を実行して既存 JID 一覧を取得

   ```bash
   node .claude/skills/register-channel/src/list.mjs {NAME}
   ```

2. `AskUserQuestion` で削除対象 JID を選択(結果が3件以下ならそのまま選択肢化、4件以上なら Other で自由入力)

3. 該当行の詳細を表示して `AskUserQuestion` で最終確認

4. 確定後:

   ```bash
   node .claude/skills/register-channel/src/unregister.mjs {NAME} '{JID}'
   ```

5. 反映には orchestrator 再起動が必要である旨を案内(Step 2c-8 参照)

## Step 2c: register

### 2c-1 チャネル種別選択

`AskUserQuestion`: Slack / Discord / Asana

### 2c-2 channel ID 入力

`AskUserQuestion` で channel ID(Other で自由入力)。種別ごとの例を案内文に含める:

- Slack: `C` / `D` / `G` で始まる英数字(例: `C0AP0BRN50X`)
- Discord: 17〜20桁の数字(例: `1487646521259196426`)
- Asana: 数字のプロジェクトGID(例: `1214032481853688`)

### 2c-3 到達性検証

```bash
node .claude/skills/register-channel/src/reachability.mjs {CHANNEL} {ID} {NAME}
```

出力 `{ok: boolean, reason?, detail?}`:

- `ok: true` → 次へ
- `ok: false` → `reason` を user に表示 + `AskUserQuestion` で「登録を続行/中断」を確認

### 2c-4 メタデータ入力

`AskUserQuestion` を順次(日本語):

1. **グループ名** — デフォルト "Main"
2. **folder** — デフォルト "main"(`src/jid.mjs` の `validateFolder` で検証)
3. **trigger** — デフォルト `@{NAME}`
4. **isMain** — true / false。既存グループ数 0 なら `true` 推奨
5. **requiresTrigger** — isMain=true なら `false` 推奨、それ以外は `true`

### 2c-5 DB 登録

```bash
node .claude/skills/register-channel/src/register.mjs \
  --assistant {NAME} \
  --channel {CHANNEL} \
  --id {ID} \
  --name '{GROUP_NAME}' \
  --folder {FOLDER} \
  --trigger '{TRIGGER}' \
  --isMain {IS_MAIN} \
  --requiresTrigger {REQUIRES_TRIGGER}
```

出力 `{ok, jid, overwrote, folderCreated, folderPath}`:

- `overwrote: true` だった場合は「既存登録を上書きしました」と明示
- `folderCreated: true` だった場合は新規作成されたパスを表示

### 2c-6 既存JIDチェック(任意・先読み)

ユーザ体験を良くするため、Step 2c-5 の前に list で既存 JID を確認し、被っていたら事前に `AskUserQuestion` で上書き確認をする。一手間増えるが「知らずに上書きされた」を防げる。

### 2c-7 反映方法の案内

orchestrator は起動時に DB から groups を読み込むため、**再起動が必要**。稼働状態を検出して適切なコマンドを案内:

```bash
# launchd稼働中か
launchctl list 2>/dev/null | grep -q "com.nagi.{NAME}" && echo LAUNCHD || echo NOT_LAUNCHD
# 手動プロセス稼働中か
pgrep -f "deploy/{NAME}/host/entry.ts" >/dev/null && echo MANUAL || echo NOT_MANUAL
```

- **launchd 稼働中**: `launchctl kickstart -k gui/$(id -u)/com.nagi.{NAME}`
- **手動稼働中**: `pkill -f "deploy/{NAME}/host/entry.ts"` → 数秒後に `nohup npx tsx deploy/{NAME}/host/entry.ts >> __data/{NAME}/logs/bootstrap.log 2>&1 &`
- **停止中**: 次回起動時に自動反映、コマンド不要

**再起動は本スキルでは自動実行しない**(稼働中プロセスへの影響が大きいため user 判断に委ねる)。コマンドを出力するだけ。

## ルール

- `AskUserQuestion` の全選択肢・質問文は日本語(既存スキル慣習)
- 破壊的操作(unregister / 上書き)の前には必ず `AskUserQuestion` で最終確認
- 到達性検証失敗は警告止まり(ユーザ判断で続行可能)
- `src/*.mjs` は単独で `node <path> <args>` として動作する(ユニットテスト可能)
- JIDプレフィックスは `src/jid.mjs` の `PREFIX_MAP` が single source of truth

## 将来の拡張

- `src/jid.mjs` にユニットテストを追加(`libs/db/src/__tests__/` に並べる or `.claude/skills/` に vitest を置く)
- `configure-skills` と同じパターンで、src/ 分離を既存の `add-channel-*` スキルにも適用
