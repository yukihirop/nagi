# エージェントフックスキル

エージェントがツールを実行したりセッションを開始したりしたとき、その様子をチャットチャンネル（Slack / Discord / Asana）にリアルタイムで通知する仕組みです。
フックを有効にすると、エージェントが裏側で何をしているかがチャット上に流れるため、応答を待っている間の「今何をしているのか分からない」という問題を解消できます。

## フックの種類

| フック名 | 発火タイミング | 通知内容の例 |
|---|---|---|
| **PostToolUse** | ツール実行のたびに | 🔧 `Bash: ls -la /workspace/group` |
| **SessionStart** | エージェントが応答を開始したとき | 💭 Thinking... |
| **PromptComplete** | プロンプト処理が完了したとき | 💰 `claude-sonnet-4-20250514 \| $0.0312 \| 1,245 in / 890 out` |

### 通知メッセージの詳細

**PostToolUse** では、ツールごとにアイコンが自動で付与されます。

| ツール | アイコン | 表示例 |
|---|---|---|
| Bash | 🔧 | `🔧 Bash: pnpm exec tsc --noEmit` |
| Read | 📖 | `📖 Read: /workspace/src/index.ts` |
| Write | 📝 | `📝 Write: /workspace/src/config.ts` |
| Edit | ✏️ | `✏️ Edit: /workspace/src/index.ts` |
| Grep | 🔍 | `🔍 Grep: registerHooksPlugin` |
| Glob | 📂 | `📂 Glob: **/*.ts` |
| Skill | ⚡ | `⚡ Skill: deploy` |
| Agent | 🤖 | `🤖 Agent: research task` |
| WebSearch / WebFetch | 🌐 | `🌐 WebSearch: Node.js stream API` |
| MCP ツール (`mcp__*`) | 🔌 | `🔌 mcp__nagi__get_task: ...` |
| Task | ⏰ | `⏰ Task: create` |
| TodoWrite | 📋 | `📋 TodoWrite` |
| その他 | ⚙️ | `⚙️ ToolName` |

`mcp__nagi__send_message` と `mcp__nagi__list_tasks` はデフォルトでスキップされます（通知のループを防ぐため）。

**SessionStart** では、エージェントの内部思考（thinking）が取得できる場合、冒頭 200 文字まで表示されます。取得できない場合は `💭 Thinking...` のみが送信されます。

## どのような場面で有効にするべきか

- エージェントの応答に時間がかかるとき、進捗をリアルタイムで確認したい場合
- エージェントが意図しないファイル操作を行っていないか監視したい場合
- デバッグ時に、エージェントがどのツールをどの順序で実行したかを追跡したい場合

フック通知はチャットチャンネルに直接表示されるため、別途ログファイルを確認する必要はありません。

## `/add-agent-hooks-claude-code` — Claude Code フック {#add-agent-hooks-claude-code}

Claude Code コンテナに PostToolUse / SessionStart / PromptComplete フックを追加します。

**トリガー:** `add agent hooks`, `enable hooks`, `setup agent hooks`, `add hooks`

### セットアップの流れ

1. 前提条件の確認（プラグインファイルと entry.ts の存在チェック）
2. ホスト側の `deploy/{ASSISTANT_NAME}/host/entry.ts` に `registerHooksPlugin` を追加
3. コンテナ側の `deploy/{ASSISTANT_NAME}/container/claude-code/entry.ts` にプラグイン読み込みを追加
4. TypeScript コンパイルチェック
5. launchd サービスの再起動
6. チャットチャンネルでツール実行を発生させて動作確認

---

## `/add-agent-hooks-open-code` — Open Code フック {#add-agent-hooks-open-code}

Open Code コンテナに PostToolUse / SessionStart / PromptComplete フックを追加します。Claude Code 版と同じ IPC ベースのプラグインを使用します。

**トリガー:** `add open code hooks`, `enable open code hooks`, `setup open code hooks`

### セットアップの流れ

1. 前提条件の確認（entry.ts とテンプレートの存在チェック）
2. Open Code 用プラグインの作成（Claude Code 版からコピー）
3. ホスト側の `deploy/{ASSISTANT_NAME}/host/entry.ts` に `registerHooksPlugin` を追加
4. コンテナ側テンプレートにプラグイン読み込みを追加し、ローカル entry.ts へ同期
5. コンテナの再ビルドと launchd サービスの再起動
6. チャットチャンネルで動作確認

---

## 設定オプション

`deploy/{ASSISTANT_NAME}/host/entry.ts` 内の `registerHooksPlugin` で、フックの有効・無効やスキップするツールを制御できます。

```typescript
orchestrator.registerHooksPlugin({
  postToolUse: true,      // ツール実行通知の有効・無効
  sessionStart: true,     // "Thinking..." メッセージの有効・無効
  promptComplete: true,   // プロンプト完了時にコスト・トークン情報を通知
  skipTools: [            // 通知をスキップするツール名の追加
    "mcp__nagi__list_tasks",  // デフォルトでスキップ済み
    "mcp__custom__tool",      // 任意のツールを追加可能
  ],
});
```

個別のフックを無効にするには、対応するプロパティを `false` に設定します。

## 通知の仕組み（IPC）

フックプラグインはコンテナ内部で動作し、`/workspace/ipc/messages/` ディレクトリに JSON ファイルを書き出すことでホスト側と通信します。ホスト側のオーケストレーターがこのディレクトリを監視し、メッセージを検出するとチャットチャンネルへ転送します。

この IPC 方式により、コンテナが直接ネットワークにアクセスする必要がなく、セキュリティを維持したまま通知が実現されています。
