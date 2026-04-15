# チャンネルプラグインスキル

メッセージングプラットフォームを Nagi に接続するスキルです。Slack、Discord、Asana の 3 つのチャンネルに対応しており、それぞれ接続スキルと表示モード切替スキルが用意されています。

## 一覧

| スキル | 用途 | 必要なトークン |
|---|---|---|
| `/add-channel-slack` | Slack 接続 | Bot Token (`xoxb-`) + App-Level Token (`xapp-`) |
| `/add-channel-slack-block-kit` | Slack 表示を Block Kit に切替 | (Slack 接続済みであること) |
| `/add-channel-slack-block-kit-embed` | Slack 表示を Block Kit Embed に切替 | (Slack 接続済みであること) |
| `/add-channel-discord` | Discord 接続 | Bot Token |
| `/add-channel-discord-embed` | Discord 表示を Embed に切替 | (Discord 接続済みであること) |
| `/add-channel-asana` | Asana 接続 | Personal Access Token (`1/...`) |

---

## `/add-channel-slack` -- Slack 接続 {#add-channel-slack}

Slack を Socket Mode で接続します。公開 URL は不要です。ボットトークンとアプリレベルトークンの設定、グループの登録までをガイドします。

**トリガー:** `add slack`, `setup slack`, `connect slack`, `add channel slack`

### 前提条件

- Slack ワークスペースの管理者権限（アプリのインストールに必要）
- 以下の 2 つのトークン:
  - **Bot User OAuth Token** (`xoxb-...`): OAuth & Permissions ページから取得
  - **App-Level Token** (`xapp-...`): Basic Information > App-Level Tokens から生成（スコープ: `connections:write`）

### 必要な OAuth スコープ

`channels:history`, `channels:read`, `chat:write`, `groups:history`, `groups:read`, `im:history`, `im:read`, `users:read`

### 必要なイベントサブスクリプション

`message.channels`, `message.groups`, `message.im`

### セットアップの流れ

1. https://api.slack.com/apps からアプリを作成（Manifest を使うと簡単です）
2. Socket Mode を有効化し、App-Level Token を生成
3. ワークスペースにインストールして Bot Token を取得
4. `deploy/{ASSISTANT_NAME}/.env` にトークンを設定
5. ボットを対象チャンネルに追加し、グループを登録

### 対応機能

- パブリックチャンネル、プライベートチャンネル、ダイレクトメッセージ
- スレッド返信（同じスレッド内で応答）
- メッセージキューイング（切断中のメッセージを再接続時に処理）
- 他チャンネル（Discord、Asana）との同時運用

---

## Slack の表示モード {#slack-display-modes}

Slack には 3 つの表示モードがあります。接続後にいつでも切り替え可能です。

| モード | パッケージ | 見た目 |
|---|---|---|
| **プレーンテキスト** | `@nagi/channel-slack` | シンプルなテキスト表示（デフォルト） |
| **Block Kit** | `@nagi/channel-slack-block-kit` | ツール名ヘッダー、コードブロック、区切り線付きのリッチカード |
| **Block Kit Embed** | `@nagi/channel-slack-block-kit-embed` | Block Kit の内容を色付き左ボーダーのアタッチメントで表示 |

切り替えは `deploy/{ASSISTANT_NAME}/host/entry.ts` の import 文を変更するだけで完了します。ファクトリ関数やコンフィグの変更は不要です。

> **注意:** `deploy/templates/host/entry.template.ts` は変更しないでください。テンプレートはデフォルトの `@nagi/channel-slack` のままにし、表示モードの変更はアシスタント固有の `entry.ts` のみで行います。

### `/add-channel-slack-block-kit` -- Slack Block Kit 表示 {#add-channel-slack-block-kit}

Slack チャンネルの表示を Block Kit リッチ表示に切り替えます。ツール実行通知がフォーマットされたブロックで表示されるようになります。

**トリガー:** `add block kit`, `enable block kit`, `slack block kit`, `rich slack`, `slack rich display`

**変更前:** `🔧 \`Bash: ls -la\``
**変更後:** ツール名ヘッダー、コードブロック、区切り線付きのリッチカード

### `/add-channel-slack-block-kit-embed` -- Slack Block Kit Embed 表示 {#add-channel-slack-block-kit-embed}

Slack を Block Kit Embed バリアントに切り替えます。Block Kit の内容を Slack の `attachments` でラップし、色付きの左ボーダーを表示します。Discord の Embed スタイルに近い見た目になります。

**トリガー:** `add slack embed`, `enable slack embed`, `slack block kit embed`, `rich slack embed`, `slack embed 表示`

**色の使い分け:**

- エージェント返信: blurple（青紫）
- ツール通知: ツールごとの色（Bash は青、Read は緑など）
- Thinking / コストフッター: グレー

---

## `/add-channel-discord` -- Discord 接続 {#add-channel-discord}

Discord を Gateway Intents でボットとして接続します。ボットトークンの設定、グループの登録、接続確認までをガイドします。

**トリガー:** `add discord`, `setup discord`, `connect discord`, `add channel discord`

### 前提条件

- Discord サーバーの管理権限（ボットの招待に必要）
- **Bot Token**: Discord Developer Portal > Bot > Reset Token から取得

### 必要な Privileged Gateway Intents

- **MESSAGE CONTENT INTENT** -- メッセージ内容の読み取りに必須
- **SERVER MEMBERS INTENT**

### 必要な Bot Permissions

`Send Messages`, `Read Message History`, `Create Public Threads`, `Send Messages in Threads`

### セットアップの流れ

1. https://discord.com/developers/applications からアプリケーションを作成
2. Bot タブでトークンを取得し、Privileged Gateway Intents を有効化
3. OAuth2 URL を生成してボットをサーバーに招待
4. `deploy/{ASSISTANT_NAME}/.env` にトークンを設定
5. チャンネル ID を取得してグループを登録

### チャンネル ID の取得方法

1. Discord の設定 > App Settings > Advanced で **Developer Mode** を有効にする
2. チャンネルを右クリック > **Copy Channel ID**
3. JID 形式は `dc:CHANNEL_ID`（例: `dc:1234567890`）

### トラブルシューティング

- **ボットがメッセージを受信しない場合:** MESSAGE CONTENT INTENT が有効か確認してください
- **"Used disallowed intents" エラー:** Developer Portal で必要な Intents をすべて有効にしてください

---

## Discord の表示モード {#discord-display-modes}

Discord には 2 つの表示モードがあります。

| モード | パッケージ | 見た目 |
|---|---|---|
| **プレーンテキスト** | `@nagi/channel-discord` | シンプルなテキスト表示（デフォルト） |
| **Embed** | `@nagi/channel-discord-embed` | 色付きの埋め込みメッセージでツール通知を表示 |

Slack と同様、`deploy/{ASSISTANT_NAME}/host/entry.ts` の import 文を変更するだけで切り替えできます。

### `/add-channel-discord-embed` -- Discord Embed 表示 {#add-channel-discord-embed}

Discord チャンネルの表示を Embed リッチ表示に切り替えます。ツール通知が色付きの埋め込みメッセージで表示されるようになります。

**トリガー:** `add discord embed`, `enable discord embed`, `discord embed`, `rich discord`, `discord rich display`

---

## `/add-channel-asana` -- Asana 接続 {#add-channel-asana}

Asana をチャンネルとして接続します。タスクのコメントをポーリングし、トリガーパターン（例: `@ai ...`）に一致するコメントを検知してエージェントに転送します。

**トリガー:** `add asana`, `setup asana`, `connect asana`, `add channel asana`

### 前提条件

- **Asana Personal Access Token** (`1/...`): https://app.asana.com/0/my-apps から生成
- 監視対象プロジェクトの **Project GID**（URL の `https://app.asana.com/0/{projectGid}/...` から取得可能）

> **注意:** PAT はあなたの Asana ユーザーの権限を継承します。ボットはあなたのアカウントとして動作するため、アクセスできるすべてのワークスペースで操作が可能です。

### ポーリング方式について

Asana チャンネルは Webhook ではなくポーリングを使用します。これは、ワークスペースレベルの Webhook がコメントイベントを配信しないこと、またワークスペースイベント API が Enterprise+ プラン限定であることが理由です。

- デフォルトのポーリング間隔: **60 秒**（`ASANA_POLL_INTERVAL_MS` で変更可能、最小 10 秒）
- 間隔を短くするとレスポンスは速くなりますが、150 req/min のレート制限を消費します

### 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `ASANA_PAT` | 必須 | Personal Access Token（`1/...`で始まる文字列） |
| `ASANA_PROJECT_GIDS` | 必須 | 監視対象プロジェクトの GID（カンマ区切りで複数指定可） |
| `ASANA_USER_GID` | 任意 | ユーザー GID（省略時は `/users/me` で自動取得） |
| `ASANA_POLL_INTERVAL_MS` | 任意 | ポーリング間隔（ミリ秒、デフォルト 60000） |

### 応答の仕組み

Asana チャンネルでは、親タスクを整理するために自動的にサブタスクを作成して応答します。

1. 監視対象プロジェクトのタスクでトリガーコメント（例: `@ai テストです`）を検知
2. そのタスクの下にサブタスク（`ai > {リクエストの1行目}`）を自動作成
3. 親タスクには短いポインターコメントを投稿（`🤖 こちらのサブタスクで返信します: {url}`）
4. エージェントの返信はサブタスクに書き込み
5. サブタスク内での `@ai` コメントは同じ会話を継続（新しいネストは作成しない）

### 対応機能

- プロジェクト単位の監視（`ASANA_PROJECT_GIDS` の各エントリが 1 つのグループに対応）
- トリガーパターン検出（コメント本文の先頭が `@ai` などのトリガーに一致する場合に起動）
- タスクコンテキスト注入（タスク名、説明、コメント履歴を自動的にエージェントに提供）
- システムストーリーのフィルタリング（割り当て変更や日付変更などは無視）
- 自己返信ガード（ボット自身のコメントでは再トリガーしない）
- 他チャンネル（Slack、Discord）との同時運用

### 既知の制限事項

- **ポーリング遅延:** デフォルトで最大 60 秒の遅延があります
- **インメモリカーソル:** Nagi の再起動中に到着したトリガーはスキップされます
- **Last-write-wins ルーティング:** 同じプロジェクト内で 2 つのタスクが同時にトリガーされた場合、最後に処理された方に返信されます
- **添付ファイル非対応:** Asana コメント内の添付ファイルは転送されません

---

## 表示モード比較 {#display-mode-comparison}

すべての表示モードスキルは、`entry.ts` 内の import 文を1行変更するだけで切り替えられます。各バリアントは同じファクトリ関数・同じインターフェースをエクスポートしているため、コードの変更は不要です。

| プラットフォーム | デフォルト | リッチ表示 | リッチ + 色付きボーダー |
|---|---|---|---|
| Slack | `@nagi/channel-slack` | `@nagi/channel-slack-block-kit` | `@nagi/channel-slack-block-kit-embed` |
| Discord | `@nagi/channel-discord` | -- | `@nagi/channel-discord-embed` |

import 変更後は `pnpm exec tsc --noEmit` で TypeScript のコンパイルを確認し、Nagi を再起動してください。

---

## セットアップのヒント

- **複数チャンネルの同時運用:** Slack、Discord、Asana は同時に接続できます。それぞれ独立して動作するため、用途に応じて使い分けが可能です。
- **表示モードの切り替え:** Slack と Discord の表示モードは、いつでも `entry.ts` の import 文を変更して再起動するだけで切り替えできます。テンプレートファイルは変更しないでください。
- **トークンの管理:** すべてのトークンは `deploy/{ASSISTANT_NAME}/.env` で管理されます。トークンを再発行した場合は `.env` を更新してサービスを再起動してください。
- **グループ登録:** 各チャンネルのグループは DB に登録する必要があります。スキルを実行するとガイドに従って登録できます。
