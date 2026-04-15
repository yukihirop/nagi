# エージェント切替スキル

コンテナ内で動作するエージェントランナーを Claude Code と Open Code の間で切り替えるスキルです。切替時には Docker イメージ・環境変数・モデル設定が自動で変更され、launchd サービスが再起動されます。

## Claude Code と Open Code の違い

| 項目 | Claude Code | Open Code |
|------|-------------|-----------|
| LLM プロバイダー | Anthropic (Claude) のみ | OpenRouter / Google / OpenAI など複数対応 |
| Docker イメージ | `nagi-agent:latest` | `nagi-agent-opencode:latest` |
| 環境変数 | `ANTHROPIC_API_KEY` | `OPENROUTER_API_KEY` / `GOOGLE_API_KEY` / `OPENAI_API_KEY` + `OPENCODE_MODEL` |
| モデル選択 | Claude のみ（固定） | プロバイダーに応じて自由に選択可能 |
| セットアップ | 初期構築時に自動で用意 | `/setup-opencode` で事前セットアップが必要 |

### 切替時に変わること

- `.env` の `CONTAINER_IMAGE` が対象イメージに更新されます
- プロバイダー固有の環境変数（`OPENCODE_MODEL`、API キー）が追加またはコメントアウトされます
- launchd サービスが再起動され、新しいコンテナイメージが使用されます
- それ以外（チャンネル設定、グループ、プラグイン、MCP サーバー）はすべてそのまま維持されます

### 使い分けの目安

- **Claude Code** — Anthropic の Claude モデルを使いたい場合や、特にプロバイダーにこだわりがない場合の標準選択です。初期構築時にそのまま使えるため、追加設定は不要です。
- **Open Code** — OpenRouter 経由で Claude 以外のモデル（Gemini、GPT-4o など）を試したい場合や、コスト・レート制限の都合でプロバイダーを切り替えたい場合に使用します。

## `/change-claude-code` — Claude Code に切替 {#change-claude-code}

エージェントランナーを Claude Code に切り替えます。Open Code から戻す場合に使用します。

スキル実行時に行われる処理:

1. `.env` の `CONTAINER_IMAGE` を `nagi-agent:latest` に変更
2. Open Code 固有の設定（`OPENCODE_MODEL` など）をコメントアウト
3. Claude Code の Docker イメージが存在するか確認（なければビルド）
4. launchd サービスを再起動

**トリガー:** `change claude code`, `switch to claude code`, `use claude code`, `claude code に切り替え`

---

## `/change-open-code` — Open Code に切替 {#change-open-code}

エージェントランナーを Open Code に切り替えます。OpenRouter、Gemini、OpenAI などのプロバイダーを使用したい場合に使用します。

:::tip 前提条件
Open Code を使用するには、事前に `/setup-opencode` を実行して Docker イメージのビルドと API キーの設定を完了しておく必要があります。
:::

スキル実行時に行われる処理:

1. Open Code の Docker イメージと API キーが設定済みか確認
2. `.env` の `CONTAINER_IMAGE` を `nagi-agent-opencode:latest` に変更
3. `OPENCODE_MODEL` が未設定の場合、使用するモデルを対話的に選択
4. launchd サービスを再起動

選択可能なモデルの例:

- `openrouter/anthropic/claude-sonnet-4`
- `openrouter/google/gemini-2.5-pro`
- `openrouter/openai/gpt-4o`
- `google/gemini-2.5-pro`
- `openai/gpt-4o`

**トリガー:** `change open code`, `switch to open code`, `use open code`, `open code に切り替え`
