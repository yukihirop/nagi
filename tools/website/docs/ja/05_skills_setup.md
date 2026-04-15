# セットアップ系スキル

Nagi の初期導入やサービス登録に関するスキルをまとめています。いずれも対話形式で進行し、必要な箇所でユーザーに確認を取りながら設定を行います。

---

## `/setup` — 初期セットアップ {#setup}

Nagi の初期設定を対話的に実行します。依存関係のインストールからコンテナビルド、チャンネル接続、メイングループ登録、動作確認までを一括でガイドします。

**トリガー:** `setup`, `install`, `configure nagi`

### 実行ステップ

| # | 内容 | 詳細 |
|---|------|------|
| 1 | **前提条件の確認** | Node.js >= 22 および pnpm がインストールされているか確認します。不足している場合は nodenv / nvm / brew 経由で自動インストールを試みます。 |
| 2 | **依存関係のインストールとビルド** | `pnpm install` と `pnpm build` を実行します。ネイティブバインディングのビルドに失敗した場合は `xcode-select --install`（macOS）等で対処します。 |
| 3 | **Docker の確認とエージェントタイプの選択** | Docker が起動しているか確認し、**Claude Code** または **Open Code** のどちらをエージェントランタイムとして使用するかを選択します。選択に応じてコンテナイメージをビルドします。 |
| 4 | **デプロイ** | `/deploy` スキルを呼び出し、ローカルエントリポイント・データディレクトリ・`.env`・グループプロンプトのデフォルトをテンプレートから生成します。 |
| 5 | **起動とメイングループ登録** | `pnpm dev` でオーケストレータを起動し、ログからチャンネル ID を取得してメイングループを DB に登録します。メイングループはトリガー不要で他グループの登録権限を持ちます。 |
| 6 | **Dashboard UI（任意）** | `pnpm ui:dev` で Web ダッシュボード（SPA ポート 5174 + API ポート 3001）を起動できます。 |
| 7 | **動作確認** | チャンネルにメッセージを送信し、コンテナ経由で応答が返ることを確認します。 |

### エージェントタイプの違い

| | Claude Code | Open Code |
|---|---|---|
| ランタイム | Anthropic 公式 CLI | オープンソースエージェント SDK |
| 認証 | `CLAUDE_CODE_OAUTH_TOKEN` または `ANTHROPIC_API_KEY` | プロバイダー固有の API キー |
| コンテナイメージ | `nagi-agent:latest` | `nagi-agent-opencode:latest` |
| 対応プロバイダー | Anthropic のみ | OpenRouter / Google Gemini / OpenAI |

### トラブルシューティング

- **"No channels connected"** — `.env` のトークンを確認し、オーケストレータを再起動してください。
- **"Container runtime is required but failed to start"** — Docker が起動していません。Docker を起動してから再試行してください。
- **メッセージに応答がない** — グループが DB に登録されているか、トリガーパターンが一致しているか確認してください。メイングループはトリガー不要です。
- **コンテナ起動失敗** — `__data/{ASSISTANT_NAME}/groups/main/logs/container-*.log` を確認してください。Docker イメージがビルド済みであることも確認してください。
- **"SLACK_BOT_TOKEN not set"** — トークンはプロジェクトルートの `.env` に記載する必要があります。シェルの環境変数ではありません。

---

## `/setup-launchd` — launchd サービス設定 {#setup-launchd}

macOS の launchd を使って Nagi をバックグラウンドサービスとして登録します。ログイン時の自動起動とクラッシュ時の自動復旧（KeepAlive）が設定されます。

> **注意:** このスキルは macOS 専用です。Linux では systemd を使用してください。

**トリガー:** `setup launchd`, `run as service`, `background service`, `auto start`, `launchd`

### 前提条件

- `/deploy` が実行済みで `deploy/{ASSISTANT_NAME}/host/entry.ts` が存在すること
- 複数アシスタントがある場合は、対象のアシスタント名を選択するよう求められます

### 実行ステップ

| # | 内容 | 詳細 |
|---|------|------|
| 0 | **アシスタント名の決定** | `deploy/` 配下のディレクトリを検出し、対象を選択します。 |
| 1 | **パスの検出** | Node.js パス、tsx パス、プロジェクトルート、ホームディレクトリを自動検出します。 |
| 2 | **plist ファイルの生成** | `deploy/templates/launchd/com.nagi.ASSISTANT_NAME.plist` テンプレートのプレースホルダーを検出値で置換し、`deploy/{ASSISTANT_NAME}/launchd/` に出力します。 |
| 3 | **ログディレクトリの作成** | `__data/{ASSISTANT_NAME}/logs/` を作成します。 |
| 4 | **サービスのインストール** | 既存の plist をアンロードし、新しい plist を `~/Library/LaunchAgents/` にコピーしてロードします。 |
| 5 | **動作確認** | `launchctl list` でサービスの状態を確認し、ログでチャンネル接続を検証します。 |

### テンプレートのプレースホルダー

| プレースホルダー | 値 |
|---|---|
| `{{NODE_PATH}}` | Node.js の実行パス |
| `{{TSX_PATH}}` | `tsx/dist/cli.mjs` の絶対パス |
| `{{PROJECT_ROOT}}` | プロジェクトルート |
| `{{NODE_BIN_DIR}}` | Node.js バイナリのディレクトリ |
| `{{HOME}}` | ホームディレクトリ |

### 管理コマンド

サービス登録後は以下のコマンドで管理できます。

```bash
# ログの監視
tail -f __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log

# 再起動（コード変更後など）
launchctl kickstart -k gui/$(id -u)/com.nagi.{ASSISTANT_NAME}

# 停止
launchctl unload ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist

# 起動
launchctl load ~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist

# 状態確認
launchctl list | grep com.nagi.{ASSISTANT_NAME}
```

### トラブルシューティング

- **サービスが再起動を繰り返す（KeepAlive ループ）** — `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log` でクラッシュ原因を確認してください。ポート競合や `.env` 未作成が主な原因です。
- **"Operation not permitted"** — macOS のシステム環境設定 → プライバシーとセキュリティでブロックされている項目がないか確認してください。
- **コード変更後の反映** — `pnpm build` の後 `launchctl kickstart -k` で再起動すれば反映されます。unload/load は不要です。
- **テンプレート更新後** — plist テンプレートが更新された場合は、このスキルまたは `/deploy` を再実行して plist を再生成してください。

---

## `/setup-opencode` — Open Code セットアップ {#setup-opencode}

Claude Code の代替として Open Code エージェントをセットアップします。複数の AI プロバイダーに対応しており、用途に応じて選択できます。

**トリガー:** `setup opencode`, `setup open code`, `use opencode`, `switch to opencode`

### 対応プロバイダーとモデル

| プロバイダー | 特徴 | 推奨モデル | API キー取得先 |
|---|---|---|---|
| **OpenRouter** | 一つのキーで多数のモデル（Claude, GPT, Gemini 等）にアクセス | `openrouter/anthropic/claude-sonnet-4` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Google Gemini** | Google の Gemini モデルに直接アクセス | `google/gemini-2.5-pro` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **OpenAI** | GPT-4o, o1 等 | `openai/gpt-4o` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

### 実行ステップ

| # | 内容 | 詳細 |
|---|------|------|
| 1 | **事前確認** | Docker が起動しているか、既存のコンテナイメージがあるかを確認します。 |
| 2 | **プロバイダーの選択** | OpenRouter / Google Gemini / OpenAI から選択します。 |
| 3 | **API キーの入力** | 選択したプロバイダーの API キーを入力します。 |
| 4 | **モデルの選択** | プロバイダーごとの推奨モデルから選択、またはカスタム指定します。 |
| 5 | **`.env` の設定** | `CONTAINER_IMAGE`、`OPENCODE_MODEL`、API キーを `.env` に書き込みます。 |
| 6 | **Docker イメージのビルド** | `./container/open-code/build.sh` で `nagi-agent-opencode:latest` をビルドします。 |
| 7 | **Nagi の再起動** | launchd サービスを再起動して新しい設定を反映します。 |
| 8 | **動作確認** | Slack / Discord でメッセージを送信し、Open Code 経由で応答があることを確認します。 |

### `.env` に追加される設定

```bash
# Open Code settings
CONTAINER_IMAGE=nagi-agent-opencode:latest
OPENCODE_MODEL={provider}/{model}

# プロバイダー固有のキー（選択したものだけ）
OPENROUTER_API_KEY=sk-or-...
# GOOGLE_API_KEY=...
# OPENAI_API_KEY=sk-...
```

### Claude Code に戻す場合

`.env` の `CONTAINER_IMAGE` を `nagi-agent:latest` に変更し、Open Code 関連の設定をコメントアウトまたは削除してから Nagi を再起動してください。

### トラブルシューティング

- **コンテナが起動しない** — Docker が起動しているか確認し、`./container/open-code/build.sh` でイメージを再ビルドしてください。
- **応答がない** — API キーが正しいこと、`.env` に `CONTAINER_IMAGE=nagi-agent-opencode:latest` と `OPENCODE_MODEL` が設定されていることを確認してください。
- **意図しないモデルが応答する** — `.env` の `OPENCODE_MODEL` が正しいか確認し、変更後は Nagi を再起動してください。
