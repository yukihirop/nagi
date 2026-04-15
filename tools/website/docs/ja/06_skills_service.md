# サービス制御スキル

launchd で動作する Nagi サービスの起動・停止・再起動・ログ確認を行うスキルです。
各スキルはマルチアシスタント構成に対応しており、実行時に `deploy/` ディレクトリからアシスタント名を検出し、対象を選択するプロンプトが表示されます。

## 共通の動作

すべてのサービス制御スキルは、実行時に以下のステップを最初に行います。

1. `deploy/` 配下のアシスタント名を自動検出する
2. 対象アシスタントを選択するか確認する（複数ある場合）
3. `launchctl` コマンドでサービスを操作する

plist ファイルは `~/Library/LaunchAgents/com.nagi.{ASSISTANT_NAME}.plist` に配置されている前提です。

---

## `/nagi-start` — サービス開始 {#nagi-start}

Nagi の launchd サービスを開始します。既に起動済みの場合はその旨を通知し、代わりに `/nagi-restart` を案内します。

**トリガー:** `start`, `start nagi`, `起動`

### 実行内容

1. `launchctl list` でサービスが既に起動しているか確認する
2. 未起動の場合、`launchctl load` で plist を読み込みサービスを開始する
3. 起動後、PID の割り当てとログ (`Orchestrator started`) を確認して成功を検証する

### 起動に失敗した場合

スキルはエラーログ (`__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log`) を自動的に確認し、原因を報告します。

### 利用例

- 初回セットアップ後にサービスを起動する
- `nagi-stop` で停止した後にサービスを再度起動する
- マシン再起動後、launchd の自動起動が設定されていない場合に手動で起動する

---

## `/nagi-stop` — サービス停止 {#nagi-stop}

Nagi の launchd サービスを停止します。`launchctl unload` により plist をアンロードし、サービスを完全に停止します。

**トリガー:** `stop`, `stop nagi`, `停止`

### 実行内容

1. `launchctl unload` で plist をアンロードする
2. `launchctl list` で停止を確認する

### 利用例

- 設定ファイルを大幅に変更する前にサービスを安全に停止する
- リソースを解放するためにサービスを一時的に止める
- デバッグのためにサービスを停止し、手動でプロセスを起動する

---

## `/nagi-restart` — サービス再起動 {#nagi-restart}

Nagi の launchd サービスを再起動します。`launchctl kickstart -k` を使用するため、stop + start よりもスムーズに再起動できます。

**トリガー:** `restart`, `restart nagi`, `再起動`

### 実行内容

1. `launchctl kickstart -k` でサービスプロセスを強制終了し、即座に再起動する
2. 再起動後、PID の割り当てとログ (`Orchestrator started`) を確認して成功を検証する

### 利用例

- `.env` やプラグイン設定を変更した後に反映する
- グループプロンプト (`CLAUDE.md` など) を更新した後に反映する
- サービスの挙動がおかしいときにプロセスをリフレッシュする

> **ヒント:** 設定変更後は `/nagi-restart` を使用してください。`/nagi-stop` + `/nagi-start` でも同じ結果になりますが、`kickstart -k` の方が 1 ステップで完了します。

---

## `/nagi-logs` — ログ確認 {#nagi-logs}

Nagi サービスの最新ログを表示します。標準ログとエラーログの両方に対応しています。

**トリガー:** `logs`, `show logs`, `nagi logs`, `check logs`, `ログ`

### 実行内容

1. `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log` の末尾 50 行を表示する
2. エラーログが必要な場合は `nagi-{ASSISTANT_NAME}.error.log` の末尾 30 行も表示する

### リアルタイム監視

リアルタイムでログを追跡したい場合は、スキルの案内に従い `tail -f` を実行できます。

```
tail -f __data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log
```

### 利用例

- サービス起動後に正常に動作しているか確認する
- エラーが発生した際に原因を調査する
- チャネル（Slack / Discord / Asana）からのメッセージ処理状況を確認する

### ログファイルの場所

| ファイル | 内容 |
|---|---|
| `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.log` | 標準出力ログ（起動メッセージ、メッセージ処理など） |
| `__data/{ASSISTANT_NAME}/logs/nagi-{ASSISTANT_NAME}.error.log` | 標準エラーログ（例外、スタックトレースなど） |
