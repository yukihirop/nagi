# スキル一覧

## スキルとは

Nagi のスキルは、Claude Code の **スキルシステム** (`.claude/skills/`) を活用した操作コマンド群です。セットアップからデプロイ、チャンネル接続まで、あらゆる操作をスラッシュコマンドひとつで実行できます。

### 使い方

Claude Code のセッション内で、スラッシュコマンドとしてスキルを呼び出します。

```
/setup          ← 初期セットアップを開始
/nagi-start     ← launchd サービスを起動
/add-channel-slack  ← Slack チャンネルを追加
```

スキル名の一部を入力すると候補が表示されるため、正確な名前を覚える必要はありません。

---

## カテゴリ別スキル一覧（全 29 スキル）

| カテゴリ | スキル数 | 主なスキル | 概要 |
|:---------|:--------:|:-----------|:-----|
| [セットアップ](/ja/05_skills_setup) | 3 | `setup` / `setup-launchd` / `setup-opencode` | 初期設定、launchd 登録、Open Code 導入 |
| [サービス制御](/ja/06_skills_service) | 4 | `nagi-start` / `nagi-stop` / `nagi-restart` / `nagi-logs` | サービスの起動・停止・再起動・ログ確認 |
| [デプロイ・同期](/ja/07_skills_deploy) | 4 | `deploy` / `update-entry` / `update-groups` / `update-container` | テンプレート同期、コンテナ再ビルド |
| [エージェント切替](/ja/08_skills_agent) | 2 | `change-claude-code` / `change-open-code` | Claude Code ↔ Open Code の切り替え |
| [チャンネルプラグイン](/ja/09_skills_channel) | 6 | `add-channel-slack` / `add-channel-discord` など | Slack・Discord・Asana 接続と表示カスタマイズ |
| [MCP プラグイン](/ja/10_skills_mcp) | 2 | `add-mcp-ollama` / `add-mcp-vercel` | ローカル LLM・Vercel デプロイ連携 |
| [エージェントフック](/ja/11_skills_hooks) | 2 | `add-agent-hooks-claude-code` / `add-agent-hooks-open-code` | ツール実行・セッション開始の通知 |
| [グループプロンプト](/ja/12_skills_group_prompt) | 2 | `create-group-prompt` / `update-group-prompt` | エージェント人格・指示の作成と編集 |
| [プラグイン開発](/ja/13_skills_scaffold) | 3 | `create-plugin-channel` / `create-container-plugin-mcp` / `create-container-plugin-agent-hooks` | チャンネル・MCP・フックの雛形生成 |
| [その他](/ja/14_skills_misc) | 1 | `add-context-probe` | コンテキスト自動マウントの検証用プローブ |

---

## 全 29 スキル一覧（クイックリファレンス）

| スキル | カテゴリ | 説明 |
|--------|----------|------|
| `/setup` | セットアップ | 初期セットアップウィザード |
| `/setup-launchd` | セットアップ | macOS launchd サービスの登録 |
| `/setup-opencode` | セットアップ | Open Code エージェントのインストールと設定 |
| `/nagi-start` | サービス制御 | launchd サービスの開始 |
| `/nagi-stop` | サービス制御 | launchd サービスの停止 |
| `/nagi-restart` | サービス制御 | launchd サービスの再起動 |
| `/nagi-logs` | サービス制御 | サービスログの表示 |
| `/deploy` | デプロイ・同期 | テンプレートから設定を一括同期 |
| `/update-entry` | デプロイ・同期 | 単一のエントリポイントをテンプレートから同期 |
| `/update-groups` | デプロイ・同期 | グループプロンプトのランタイム同期 |
| `/update-container` | デプロイ・同期 | nagi-agent Docker イメージの再ビルド |
| `/change-claude-code` | エージェント切替 | Claude Code に切り替え |
| `/change-open-code` | エージェント切替 | Open Code に切り替え |
| `/add-channel-slack` | チャンネル | Slack ワークスペースの接続（Socket Mode） |
| `/add-channel-slack-block-kit` | チャンネル | Slack Block Kit リッチ表示の有効化 |
| `/add-channel-slack-block-kit-embed` | チャンネル | Slack Block Kit Embed 表示の有効化 |
| `/add-channel-discord` | チャンネル | Discord ボットの接続（Gateway） |
| `/add-channel-discord-embed` | チャンネル | Discord Embed リッチ表示の有効化 |
| `/add-channel-asana` | チャンネル | Asana タスクコメントポーリングの接続 |
| `/add-mcp-ollama` | MCP | ローカル LLM アクセス用 Ollama の追加 |
| `/add-mcp-vercel` | MCP | デプロイ用 Vercel の追加 |
| `/add-agent-hooks-claude-code` | フック | Claude Code コンテナ用の通知フック |
| `/add-agent-hooks-open-code` | フック | Open Code コンテナ用の通知フック |
| `/create-group-prompt` | プロンプト | グループプロンプトファイルの新規作成 |
| `/update-group-prompt` | プロンプト | 既存グループプロンプトファイルの編集 |
| `/create-plugin-channel` | スキャフォールド | チャンネルプラグインパッケージの生成 |
| `/create-container-plugin-mcp` | スキャフォールド | MCP プラグインパッケージの生成 |
| `/create-container-plugin-agent-hooks` | スキャフォールド | エージェントフックプラグインパッケージの生成 |
| `/add-context-probe` | その他 | コンテキストプローブのインストール・削除 |

---

## Tips

- **スキルはフラット構成です** — `.claude/skills/` 直下にファイルを配置してください。サブディレクトリのネストは認識されません。
- **対話形式で進行します** — ほとんどのスキルは実行後に確認や選択を求めるため、誤操作のリスクが低くなっています。
- **組み合わせて使えます** — 例えば `/add-channel-slack` でチャンネルを追加した後、`/add-agent-hooks-claude-code` でフック通知を有効にし、`/deploy` でテンプレートを同期する、という流れが一般的です。
