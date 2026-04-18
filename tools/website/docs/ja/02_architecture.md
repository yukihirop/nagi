# システム構成

## 全体像

Nagi はホスト側とコンテナ側の 2 層構成で動作します。ホスト側はメッセージング連携・キュー管理・認証情報の仲介を担い、コンテナ側は AI エージェントの実行環境として隔離された空間を提供します。

```
┌──────────────────────────────────────────────────────────────────┐
│  Host (macOS / Linux)                                            │
│                                                                  │
│  deploy/{ASSISTANT_NAME}/host/entry.ts                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐    ┌──────────────────────────────────┐         │
│  │ Orchestrator │───▶│  Channel Plugins (host/plugins/) │         │
│  │              │    │  ├── Slack (Socket Mode)         │         │
│  │              │    │  ├── Slack Block Kit             │         │
│  │              │    │  ├── Slack Block Kit Embed       │         │
│  │              │    │  ├── Discord (Gateway)           │         │
│  │              │    │  ├── Discord Embed               │         │
│  │              │    │  └── Asana (Polling)             │         │
│  │              │    └──────────────────────────────────┘         │
│  │              │                                                 │
│  │              │───▶ Credential Proxy (:3002)                    │
│  │              │───▶ SQLite DB                                   │
│  │              │───▶ GroupQueue                                  │
│  │              │───▶ Scheduler                                   │
│  │              │───▶ Router                                      │
│  │              │───▶ Auth (allowlist)                             │
│  │              │◀──▶ IpcWatcher (IPC file monitoring)            │
│  └──────┬───────┘                                                 │
│         │ docker run                                              │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  Docker Container (claude-code or open-code)        │          │
│  │                                                     │          │
│  │  Agent Runner (Claude Code / Open Code)              │          │
│  │  ├── Nagi MCP Server (stdio)                        │          │
│  │  │    ├── send_message    (即時メッセージ送信)      │          │
│  │  │    ├── schedule_task   (タスクスケジュール)      │          │
│  │  │    └── list_tasks      (タスク一覧)              │          │
│  │  ├── Agent Hooks                                    │          │
│  │  │    ├── PostToolUse     (tool通知)                │          │
│  │  │    ├── SessionStart    (セッション通知)          │          │
│  │  │    └── PromptComplete  (完了通知)                │          │
│  │  ├── MCP Plugins                                    │          │
│  │  │    ├── Ollama  (ローカル LLM)                    │          │
│  │  │    └── Vercel  (デプロイ)                        │          │
│  │  └── Container Skills (/workspace/group/skills)     │          │
│  │       ├── agent-browser      (ブラウザ操作)         │          │
│  │       ├── ai-changelog       (変更履歴生成)         │          │
│  │       ├── capabilities       (機能イントロ)         │          │
│  │       ├── jupyter-deploy     (Notebook実行)         │          │
│  │       ├── slack-formatting   (Slack書式)            │          │
│  │       ├── status             (ステータス報告)       │          │
│  │       ├── ui-ux-pro-max     (UI/UXデザイン)         │          │
│  │       ├── vercel-deploy      (Vercelデプロイ)       │          │
│  │       └── youtube-analytics  (YouTube分析)          │          │
│  └─────────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

## メッセージフロー

ユーザーからのメッセージが処理される一連の流れは以下のとおりです。

```
User (Slack/Discord/Asana)
  │
  │ メッセージ送信
  ▼
Orchestrator
  │ 1. メッセージを SQLite に保存
  │ 2. enqueueMessageCheck で GroupQueue へ投入
  ▼
GroupQueue
  │ 3. グループ単位でキューイング
  │ 4. docker run でコンテナを起動
  ▼
Container (Agent Runner)
  │ 5. Claude Code / Open Code がタスクを実行
  │ 6. Credential Proxy 経由で API を呼び出し
  │    (プレースホルダトークン → 実トークンに差し替え)
  │ 7. 応答マーカー (---NAGI_OUTPUT_START---) を stdout に出力
  ▼
Orchestrator
  │ 8. マーカーを検知して応答を抽出
  ▼
Channel Plugin
  │ 9. sendMessage でユーザーへ返信
  ▼
User
```

## ワークスペース構成

Nagi のモノレポは 4 つの主要ディレクトリで構成されています。

| ディレクトリ | 役割 |
|---|---|
| `host/` | ホスト側で動作するパッケージ (Orchestrator, Credential Proxy, チャンネルプラグイン) |
| `libs/` | ホスト・コンテナ共通のライブラリパッケージ |
| `container/` | Docker コンテナ内で動作するエージェント・プラグイン |
| `tools/` | Website など開発支援ツール |

## パッケージ依存関係

```
deploy/{ASSISTANT_NAME}/host/entry.ts
  │
  ├── host/orchestrator
  │     ├── libs/channel-core
  │     ├── libs/db
  │     ├── libs/queue
  │     ├── libs/scheduler
  │     ├── libs/ipc
  │     ├── libs/router
  │     ├── libs/auth
  │     ├── libs/config
  │     ├── libs/logger
  │     └── host/credential-proxy
  │
  ├── host/plugins/channel-slack
  ├── host/plugins/channel-slack-block-kit
  ├── host/plugins/channel-slack-block-kit-embed
  ├── host/plugins/channel-discord
  ├── host/plugins/channel-discord-embed
  ├── host/plugins/channel-asana
  │     └── (すべて libs/channel-core → libs/types に依存)
  │
  ├── host/agent-runner-claudecode
  └── host/agent-runner-opencode
```

## プラグインシステム

Nagi は 4 種類の拡張をサポートしています。それぞれホスト側・コンテナ側のどちらで動作するかが異なります。

### チャンネルプラグイン (ホスト側)

チャンネルプラグインはホスト側で動作し、メッセージングプラットフォームとの接続を担います。`libs/channel-core` の `Channel` インターフェースを実装します。

```
deploy/{ASSISTANT_NAME}/host/entry.ts
  → registry.register("slack", createSlackFactory({ ... }))
  → Orchestrator が登録済みチャンネルをすべて接続して起動
```

**利用可能なチャンネルプラグイン:**

| プラグイン | プラットフォーム | 接続方式 |
|---|---|---|
| `channel-slack` | Slack | Socket Mode |
| `channel-slack-block-kit` | Slack | Socket Mode + Block Kit リッチ表示 |
| `channel-slack-block-kit-embed` | Slack | Socket Mode + Block Kit Embed 表示 |
| `channel-discord` | Discord | Gateway (Bot Token) |
| `channel-discord-embed` | Discord | Gateway + Embed リッチ表示 |
| `channel-asana` | Asana | ポーリング方式 |

### MCP プラグイン (コンテナ側)

MCP プラグインは Docker コンテナ内で stdio MCP サーバーとして動作します。エージェントにツールを提供し、その能力を拡張します。

```
deploy/{ASSISTANT_NAME}/host/entry.ts
  → orchestrator.registerMcpPlugin("ollama", { entryPoint: "..." })
  → ContainerInput.mcpPlugins として agent-runner へ stdin 経由で渡す
  → agent-runner が動的に mcpServers として登録
```

**利用可能な MCP プラグイン:**

| プラグイン | 機能 |
|---|---|
| `mcp-ollama` | ローカル LLM (Ollama) へのアクセス |
| `mcp-vercel` | Vercel へのデプロイ |

### Agent Hooks プラグイン (コンテナ側)

Agent Hooks はコンテナ内のエージェントランナーに組み込まれるプラグインです。ツール実行やセッション開始時にチャットチャンネルへ通知を送信します。Claude Code 用と Open Code 用の 2 種類が用意されています。

### Container Skills (コンテナ側)

Container Skills はコンテナイメージに組み込まれたプロンプトベースの専門機能です。特定のタスクに必要なドメイン知識をエージェントに提供します。

例: `vercel-deploy`、`jupyter-deploy`、`slack-formatting`、`ai-changelog`、`youtube-analytics`、`ui-ux-pro-max` など。

配置場所: `container/skills/`

## Credential Proxy

Credential Proxy はホスト側のポート 3002 で動作する HTTP プロキシです。コンテナ内のエージェントが外部 API (Anthropic API など) を呼び出す際、プレースホルダトークンを実際の認証情報に差し替えます。これにより、コンテナ内に秘密情報を直接渡す必要がなくなります。

```
Container (プレースホルダトークン)
  → Credential Proxy (:3002)
    → 実トークンに差し替え
      → Anthropic API / その他外部 API
```

## マルチアシスタント対応

Nagi は 1 つのモノレポから複数のアシスタントを独立して運用できます。各アシスタントは `{ASSISTANT_NAME}` で識別され、デプロイ成果物とランタイムデータがそれぞれ分離されています。launchd サービスもアシスタントごとに独立して管理されます。

## データディレクトリ

| ディレクトリ | 用途 | Git 管理 |
|---|---|---|
| `deploy/templates/` | エントリポイント・グループプロンプトのテンプレート (原本) | 管理対象 |
| `deploy/templates/groups/` | グループプロンプトテンプレート (CLAUDE.md, AGENTS.md) | 管理対象 |
| `deploy/{ASSISTANT_NAME}/` | ローカルにマテリアライズされたエントリポイント | 対象外 |
| `deploy/{ASSISTANT_NAME}/groups/` | ユーザー編集可能なグループプロンプトのデフォルト値 | 対象外 |
| `__data/{ASSISTANT_NAME}/store/nagi.db` | SQLite データベース (groups / chats / messages / scheduled_tasks / sessions / state) | 対象外 |
| `__data/{ASSISTANT_NAME}/groups/` | ランタイムグループデータ (コンテナにマウント、ローカル編集を保持) | 対象外 |
| `__data/{ASSISTANT_NAME}/sessions/` | エージェントセッション (グループ単位) | 対象外 |
| `__data/{ASSISTANT_NAME}/ipc/` | コンテナ IPC ファイル | 対象外 |
| `__data/{ASSISTANT_NAME}/logs/` | サービスログ | 対象外 |
