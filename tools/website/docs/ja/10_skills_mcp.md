# MCP プラグインスキル

コンテナ内のエージェントに外部ツールを提供する MCP（Model Context Protocol）プラグインを追加するスキルです。

## MCP とは {#what-is-mcp}

MCP（Model Context Protocol）は、AI エージェントが外部のツールやサービスにアクセスするための標準プロトコルです。Nagi では、Docker コンテナ内で動作するエージェントに対して MCP サーバーを自動的に起動・接続する仕組みを備えています。

MCP プラグインを追加すると、エージェントは `mcp__<プラグイン名>__<ツール名>` という形式のツールを使用できるようになります。例えば Ollama プラグインの場合、`mcp__ollama__ollama_generate` のようなツールが利用可能になります。

### 仕組み

1. **ホスト側（entry.ts）** で `orchestrator.registerMcpPlugin()` によりプラグインを登録します
2. エージェントコンテナ起動時に、登録された MCP サーバーが **コンテナ内で** 自動的に起動します
3. エージェントは MCP プロトコルを通じてツールを呼び出し、外部サービスと連携します

API トークンが必要なプラグイン（Vercel など）は、`.env` から読み込んだ環境変数を `registerMcpPlugin` の `env` オプション経由でコンテナに渡します。トークン不要のプラグイン（Ollama など）はそのまま登録するだけで使用できます。

---

## `/add-mcp-ollama` — Ollama 追加 {#add-mcp-ollama}

Ollama MCP プラグインを追加し、コンテナ内のエージェントがローカル LLM モデルにアクセスできるようにします。Ollama はローカルマシン上で LLM を実行するためのツールで、API コストをかけずに高速な推論を行えます。

**トリガー:** `add ollama`, `setup ollama`, `enable ollama`

### 前提条件

- **Ollama がインストール済みであること** — [ollama.com](https://ollama.com) からダウンロードするか、macOS では `brew install ollama` でインストールできます
- **Ollama が起動していること** — アプリを起動するか `ollama serve` を実行します
- **最低 1 つのモデルがインストール済みであること** — `ollama pull <モデル名>` で取得します

### 対応モデル（例）

| モデル | サイズ | 特徴 |
|--------|--------|------|
| `llama3.2` | 約 2GB | 軽量・高速。簡単なタスクに適しています |
| `mistral` | 約 4GB | バランスの取れた品質。汎用的に使えます |
| `gemma2` | 約 5GB | Google 製モデル。多言語対応が強みです |

`ollama list` で現在インストール済みのモデルを確認できます。

### 設定内容

- Ollama MCP プラグインパッケージの登録（`registerMcpPlugin("ollama", ...)`）
- コンテナからホストの Ollama サービスへの接続（`host.docker.internal:11434` 経由）
- API トークンは不要です

### 利用可能なツール

プラグイン追加後、エージェントは以下のツールを使用できます。

| ツール名 | 説明 |
|----------|------|
| `ollama_list_models` | ホストにインストール済みのローカルモデル一覧を取得します |
| `ollama_generate` | 指定したモデルにプロンプトを送信し、応答を取得します |

### カスタムホスト設定

Ollama がデフォルトの `localhost:11434` 以外で動作している場合は、`entry.ts` で環境変数 `OLLAMA_HOST` を指定できます。

```typescript
orchestrator.registerMcpPlugin("ollama", {
  entryPoint: "/app/mcp-plugins/ollama/dist/index.js",
  env: { OLLAMA_HOST: "http://192.168.1.100:11434" },
});
```

### トラブルシューティング

- **"Failed to connect to Ollama"** — ホスト上で Ollama が起動しているか確認してください（`curl http://localhost:11434/api/tags`）。Linux 環境では `--add-host=host.docker.internal:host-gateway` が必要ですが、Nagi は自動で設定します。
- **エージェントが Ollama ツールを認識しない** — `entry.ts` に `registerMcpPlugin("ollama", ...)` があるか確認し、Docker イメージを再ビルドしてください。
- **モデルが見つからない** — ホスト上で `ollama pull llama3.2` などを実行してモデルを取得してください。

---

## `/add-mcp-vercel` — Vercel 追加 {#add-mcp-vercel}

Vercel MCP プラグインを追加し、コンテナ内のエージェントが Web サイトのデプロイやプロジェクト管理を行えるようにします。Slack などのチャットから「このページを Vercel にデプロイして」と指示するだけで、エージェントがデプロイを実行します。

**トリガー:** `add vercel`, `setup vercel`, `enable vercel`

### 前提条件

- **Vercel アカウント** — [vercel.com](https://vercel.com) でアカウントを作成してください
- **API トークン** — [vercel.com/account/tokens](https://vercel.com/account/tokens) で発行します。スコープは「Full Account」または特定のプロジェクトを選択できます

### 設定内容

- Vercel MCP プラグインパッケージの登録（`registerMcpPlugin("vercel", ...)`）
- `.env` への `VERCEL_API_TOKEN` の追加
- `entry.ts` で `readEnvFile` を使ったトークンの読み込みとコンテナへの受け渡し

### 利用可能なツール

プラグイン追加後、エージェントは以下のツールを使用できます。

| ツール名 | 説明 |
|----------|------|
| `vercel_list_projects` | Vercel プロジェクトの一覧を取得します |
| `vercel_create_project` | 新しいプロジェクトを作成します |
| `vercel_deploy` | ファイルをデプロイし、公開 URL を取得します |
| `vercel_list_deployments` | 最近のデプロイ履歴を表示します |
| `vercel_get_deployment` | 特定のデプロイの詳細情報を取得します |
| `vercel_delete_project` | プロジェクトを削除します |

### トラブルシューティング

- **"VERCEL_API_TOKEN is not set"** — プロジェクトルートの `.env` にトークンが設定されていること、かつ `entry.ts` の `registerMcpPlugin` で `env` オプションにトークンが渡されていることを確認してください。
- **エージェントが Vercel ツールを認識しない** — `entry.ts` に `registerMcpPlugin("vercel", ...)` があるか確認し、Docker イメージを再ビルドしてください。
- **デプロイが失敗する** — `curl -s -H "Authorization: Bearer $VERCEL_API_TOKEN" https://api.vercel.com/v9/projects` でトークンの有効性を確認してください。

---

## 新しい MCP プラグインを追加するには {#create-new-mcp}

Ollama・Vercel 以外のサービス用に独自の MCP プラグインを作成することもできます。`/create-container-plugin-mcp` スキルを使うと、パッケージの雛形生成から Dockerfile・entry.ts への登録までをガイド付きで行えます。詳しくは [スキャフォールドスキル](13_skills_scaffold.md) のページを参照してください。
