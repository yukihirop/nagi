# プラグイン開発スキル

新しいプラグインの雛形（スキャフォールド）を生成する開発者向けスキルです。スキルを実行すると、対話形式で必要な情報を収集し、ファイル生成からデプロイテンプレートへの登録までを一括で行います。

nagi には以下の 3 種類のプラグインがあり、それぞれ専用のスキャフォールドスキルが用意されています。

| スキル | 用途 | 配置先 |
|---|---|---|
| `/create-plugin-channel` | メッセージングプラットフォームとの接続 | `host/plugins/channel-{name}/` |
| `/create-container-plugin-mcp` | コンテナ内で動作する MCP ツール | `container/plugins/mcp-{name}/` |
| `/create-container-plugin-agent-hooks` | エージェント実行時の通知フック | `container/{agent}/plugins/agent-hooks-{name}/` |

---

## `/create-plugin-channel` --- チャンネルプラグイン作成 {#create-plugin-channel}

新しいチャンネルプラグインの雛形を生成します。Slack や Discord のように、外部メッセージングプラットフォームと nagi を接続するためのプラグインです。

**トリガー:** `create channel plugin`, `new channel`, `scaffold channel`, `add channel plugin`

### 対話で聞かれる項目

1. チャンネル名（小文字。例: `telegram`, `whatsapp`, `line`）
2. 一行の説明（例: "Telegram bot channel via grammy library"）
3. 使用する SDK / ライブラリ（例: `grammy`, `whatsapp-web.js`）
4. 必要な認証情報と環境変数名（例: `TELEGRAM_BOT_TOKEN`）
5. JID プレフィックス（例: Telegram なら `tg:`、WhatsApp なら `wa:`）

### 生成されるファイル構造

```
host/plugins/channel-{name}/
  package.json              # @nagi/channel-{name} パッケージ定義
  tsconfig.json             # TypeScript コンパイル設定
  vitest.config.ts          # テスト設定
  src/
    {name}-channel.ts       # Channel インターフェースの実装（メインロジック）
    index.ts                # 公開エクスポート
    __tests__/
      {name}-channel.test.ts  # ユニットテスト
```

上記に加えて、以下の既存ファイルも更新されます。

- `deploy/templates/host/entry.template.ts` --- チャンネル登録ブロックの追加
- ルートの `package.json` --- ワークスペース依存の追加

### 主要な設計ルール

チャンネルプラグインを実装する際は、以下のルールに従ってください。

- **JID フォーマット**: `{prefix}:{platformId}` の形式で、すべてのチャンネルを通じて一意である必要があります
- **`ownsJid()`**: 自プラグインの JID プレフィックスだけに `true` を返します
- **`sendMessage()`**: 例外を投げてはいけません。エラーはログに記録して `return` します
- **`onMessage()`**: 登録済みグループ（`opts.registeredGroups()[jid]`）からのメッセージだけを通知します
- **`onChatMetadata()`**: すべてのメッセージに対して呼び出します（グループ検出に使用）
- **メンション変換**: プラットフォーム固有のメンション形式（例: `<@BOT_ID>`）をトリガーパターン（`@AssistantName`）に変換します

### スキャフォールド後のカスタマイズ手順

1. **Channel インターフェースの実装** --- `src/{name}-channel.ts` の `TODO` コメント箇所を埋めます
   - `connect()` --- SDK クライアントの初期化、メッセージハンドラの登録
   - `sendMessage()` --- JID からチャンネル ID を抽出してメッセージ送信
   - `setTyping()` --- 入力中インジケータの送信（未対応なら no-op）
   - `syncGroups()` --- グループメタデータの検出（任意）
2. **SDK の追加** --- `pnpm --filter @nagi/channel-{name} add {sdk-package}`
3. **エントリファイルの同期** --- `/deploy` スキルを実行して Host を選択
4. **認証情報の設定** --- `.env` にトークンを追加
5. **テスト実行** --- `pnpm --filter @nagi/channel-{name} test`
6. **再起動** --- `/nagi-restart` を実行

### 参考になる既存プラグイン

- `host/plugins/channel-slack/` --- Socket Mode、スレッド返信、メッセージキューイング、ユーザー名キャッシュ
- `host/plugins/channel-discord/` --- Gateway intents、スレッド作成、添付ファイル処理、2000 文字分割

---

## `/create-container-plugin-mcp` --- MCP プラグイン作成 {#create-container-plugin-mcp}

新しい MCP（Model Context Protocol）プラグインの雛形を生成します。コンテナ内で stdio MCP サーバーとして動作し、エージェントに外部サービスへのアクセス手段を提供します。

**トリガー:** `create mcp plugin`, `new mcp plugin`, `add mcp`, `scaffold mcp`

### 対話で聞かれる項目

1. プラグイン名（小文字、`mcp-` プレフィックスは不要。例: `youtube`, `github`, `notion`）
2. 一行の説明（例: "YouTube analytics and video search"）
3. API トークン / キーの要否と環境変数名（例: `YOUTUBE_API_KEY`）
4. 対象エージェント（Claude Code / Open Code / 両方）

### 生成されるファイル構造

```
container/plugins/mcp-{name}/
  package.json        # @nagi/mcp-{name} パッケージ定義
  tsconfig.json       # TypeScript コンパイル設定
  src/
    index.ts          # MCP サーバー本体（ツール定義を含む）
```

上記に加えて、以下の既存ファイルも更新されます。

- 選択したエージェントの `Dockerfile` --- COPY + ビルドステップの追加
- `deploy/templates/host/entry.template.ts` --- `registerMcpPlugin` ブロックの追加

### MCP サーバーの仕組み

生成される `src/index.ts` は、`@modelcontextprotocol/sdk` を使った stdio トランスポートの MCP サーバーです。プレースホルダーとして `{name}_hello` ツールが含まれており、実際のツールに置き換えて開発を進めます。

環境変数は `entry.ts` の `registerMcpPlugin` で `env` オプションとして渡され、コンテナ内で `process.env` から読み取れます。API トークンが不要な場合は `env` オプションが省略されます。

### スキャフォールド後のカスタマイズ手順

1. **ツールの実装** --- `src/index.ts` のプレースホルダーツールを実際の機能に置き換えます。`server.tool()` で複数のツールを登録できます
2. **Docker イメージの再ビルド** --- `./container/claude-code/build.sh` や `./container/open-code/build.sh` を実行
3. **エントリファイルの同期** --- `/deploy` スキルを実行して Host を選択
4. **認証情報の設定**（必要な場合）--- `.env` に `{ENV_VAR}=...` を追加
5. **再起動** --- `/nagi-restart` を実行
6. **動作確認** --- Slack や Discord でエージェントに新しいツールの使用を依頼

### 参考になる既存プラグイン

- `container/plugins/mcp-ollama/` --- API トークン不要。`host.docker.internal` 経由でローカルサービスに接続
- `container/plugins/mcp-vercel/` --- `VERCEL_API_TOKEN` が必要。外部 REST API を呼び出す

---

## `/create-container-plugin-agent-hooks` --- エージェントフックプラグイン作成 {#create-container-plugin-agent-hooks}

新しいエージェントフックプラグインの雛形を生成します。エージェントがツールを実行したときやセッションを開始したときに、チャットチャンネルへ通知を送るための仕組みです。

**トリガー:** `create agent hooks plugin`, `new agent hooks`, `scaffold agent hooks`

### 対話で聞かれる項目

1. プラグイン名（小文字。例: `open-code`, `cursor`, `windsurf`）
2. 一行の説明（例: "Tool execution and session notifications for Open Code"）
3. サポートするフック種別（PostToolUse / SessionStart / 両方）
4. 対象エージェント（Claude Code / Open Code / 両方）

### 生成されるファイル構造

```
container/{agent}/plugins/agent-hooks-{name}/
  index.mjs           # フックファクトリ関数（純粋な ES Module）
```

上記に加えて、以下の既存ファイルも更新されます。

- `deploy/templates/container/{agent}/entry.template.ts` --- プラグイン読み込みブロックの追加

### エージェントフックの特徴

チャンネルプラグインや MCP プラグインとは異なり、エージェントフックには以下の特徴があります。

- **純粋な JavaScript** --- TypeScript ではなく `.mjs` ファイル 1 つだけで構成されます。ビルドステップも `package.json` も不要です
- **IPC メッセージング** --- `/workspace/ipc/messages/` に JSON ファイルを書き込むことで、ホストプロセスと通信します
- **アトミック書き込み** --- `.tmp` ファイルに書き込んでから `rename` することで、部分読み取りを防ぎます
- **例外を投げない** --- フックのロジックは try/catch で囲み、エラーはログに記録して `{}` を返します
- **内部ツールのスキップ** --- `mcp__nagi__send_message` など、通知ループを引き起こすツールは自動的にスキップされます

### サポートされるフック種別

| フック | タイミング | 用途の例 |
|---|---|---|
| `PostToolUse` | エージェントがツールを実行した後 | 実行したツール名をチャットに通知 |
| `SessionStart` | エージェントセッションの開始時 | "Thinking..." メッセージの送信 |

### スキャフォールド後のカスタマイズ手順

1. **フックのカスタマイズ** --- `index.mjs` の通知フォーマットや動作条件を編集します
2. **コンテナエントリの同期** --- `/deploy` スキルを実行して対象エージェントを選択
3. **Docker イメージの再ビルド** --- `./container/claude-code/build.sh` や `./container/open-code/build.sh` を実行
4. **再起動** --- `/nagi-restart` を実行
5. **動作確認** --- Slack や Discord でツールの実行を伴うメッセージを送信

### 参考になる既存プラグイン

- `container/claude-code/plugins/agent-hooks/` --- PostToolUse（ツールアイコンとサマリー）と SessionStart（"Thinking..."）を実装

---

## 開発ワークフローのまとめ

3 種類のプラグインに共通する開発の流れは以下のとおりです。

1. **スキャフォールド** --- 上記いずれかのスキルを実行して雛形を生成
2. **実装** --- 生成されたファイルの `TODO` コメントやプレースホルダーを実際のロジックに置き換え
3. **ビルド / テスト** --- `pnpm build` と `pnpm test`（エージェントフックはビルド不要）
4. **デプロイテンプレートの同期** --- `/deploy` スキルで `entry.ts` を更新
5. **Docker 再ビルド**（コンテナプラグインの場合）--- `build.sh` を実行
6. **再起動と動作確認** --- `/nagi-restart` で反映を確認

スキャフォールド後に手動で生成内容を修正しても問題ありません。スキルは初回の雛形生成のみを担当し、その後の変更は通常の開発フローで管理します。
