# インストールと初期設定

## 前提条件

Nagi を利用するには、以下のソフトウェアが必要です。

| ソフトウェア | バージョン | 用途 |
|---|---|---|
| **Node.js** | 22 以上 | ランタイム |
| **pnpm** | 9.x（`packageManager` フィールドで 9.15.4 を指定） | パッケージマネージャ |
| **Docker** Desktop または Docker Engine | 最新安定版 | エージェントコンテナの実行 |
| **Claude Code** CLI | 最新版 | エージェントランナー |

### バージョン確認

```bash
node -v        # v22.x.x 以上であること
pnpm -v        # 9.x.x であること
docker -v      # Docker が利用可能であること
claude --version  # Claude Code CLI がインストール済みであること
```

> **ヒント**: Node.js のバージョン管理には [volta](https://volta.sh/) や [fnm](https://github.com/Schniz/fnm) の利用を推奨します。

## インストール

リポジトリをクローンして依存関係をインストールします。

```bash
git clone https://github.com/yukihirop/nagi.git
cd nagi
pnpm install
```

ビルドが必要な場合は、以下を実行します。

```bash
pnpm build
```

## 初期セットアップ

Claude Code のセッション内で setup スキルを実行します。

```
/setup
```

setup スキルが対話形式で以下をガイドします。

1. **チャンネルの追加** — Slack、Discord、Asana などのチャンネルプラグインを設定
2. **グループの登録** — チャンネルとグループの紐付けを設定
3. **グループプロンプトの作成** — エージェントの振る舞いを定義する CLAUDE.md などを作成
4. **launchd サービスの設定**（macOS）— バックグラウンドサービスとして自動起動

> **補足**: セットアップ後に個別のチャンネルを追加したい場合は、`/add-channel-slack`、`/add-channel-discord`、`/add-channel-asana` などの専用スキルも利用できます。

## 環境変数

各チャンネルプラグインには専用の認証情報が必要です。setup スキルが対話的に設定を案内しますが、手動で設定することもできます。主な環境変数:

- `SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN` — Slack チャンネル用
- `DISCORD_BOT_TOKEN` — Discord チャンネル用
- `ASANA_ACCESS_TOKEN` — Asana チャンネル用

リポジトリルートの `.env` ファイルに設定してください。このファイルはデフォルトで gitignore されています。

## 起動

### 開発モード

ローカルで直接起動します。ログがターミナルに出力されるため、デバッグに便利です。

```bash
pnpm dev
```

### launchd サービス（macOS）

macOS では launchd を使ってバックグラウンドサービスとして動作させることができます。Claude Code セッション内で以下のスキルを使用します。

```
/nagi-start    # サービス開始
/nagi-stop     # サービス停止
/nagi-restart  # サービス再起動
/nagi-logs     # ログ確認
```

> **補足**: launchd の初期設定がまだの場合は、先に `/setup-launchd` スキルを実行してください。

## CLI

Nagi CLI でエージェントやグループをターミナルから管理できます。

```bash
pnpm nagi --help
```

### 主なコマンド

```bash
# プロンプトを実行（メイングループ）
pnpm nagi "プロンプト内容"

# 特定のグループを指定して実行
pnpm nagi -g <グループ名> "プロンプト内容"

# 前回のセッションを再開
pnpm nagi -s <セッションID> "プロンプト内容"

# 登録済みグループの一覧を表示
pnpm nagi --list

# パイプで入力を渡す
echo "プロンプト内容" | pnpm nagi
```

### オプション一覧

| オプション | 短縮形 | 説明 |
|---|---|---|
| `--group <name>` | `-g` | 対象グループを指定（デフォルト: main） |
| `--session <id>` | `-s` | 再開するセッション ID |
| `--list` | `-l` | 登録済みグループの一覧を表示 |
| `--verbose` | `-v` | コンテナの詳細情報を表示 |
| `--help` | `-h` | ヘルプを表示 |

## Web UI

Web ダッシュボードを起動します。フロントエンドと API サーバーが同時に立ち上がります。

```bash
pnpm ui:dev
```

> **補足**: ビルド済みの UI をプレビューする場合は `pnpm ui:build` でビルド後、`pnpm ui:preview` を実行します。

## トラブルシューティング

### `pnpm install` が失敗する

- Node.js のバージョンが 22 以上であることを確認してください。
- pnpm のバージョンが 9.x 系であることを確認してください。`corepack enable && corepack prepare` で正しいバージョンを有効化できます。

### `pnpm dev` で起動しない

- `pnpm build` を先に実行してパッケージのビルドを完了させてください。
- Docker が起動していることを確認してください（`docker info` でエラーが出ないこと）。

### launchd サービスが起動しない

- `/setup-launchd` で plist ファイルが正しく配置されているか確認してください。
- `/nagi-logs` でエラーログを確認してください。

### Claude Code CLI が見つからない

- `claude` コマンドにパスが通っていることを確認してください。
- インストールがまだの場合は [Claude Code 公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code) を参照してください。

### チャンネルがメッセージを受信しない

- `.env` のトークンが正しく、期限切れでないことを確認してください。
- Slack の場合、Slack アプリ設定で Socket Mode が有効になっていることを確認してください。
- Discord の場合、ボットに必要な Gateway Intents が有効になっていることを確認してください。
- 設定変更後は `/nagi-restart` でサービスを再起動してください。
