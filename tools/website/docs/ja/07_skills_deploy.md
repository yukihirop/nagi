# デプロイ・同期スキル

テンプレートからの展開、ランタイムディレクトリへの同期、コンテナイメージの再ビルドを行うスキル群です。nagi では設定ファイルが「テンプレート → ユーザー編集レイヤー → ランタイム」という 3 層構造で管理されており、各スキルはこの層間の同期を担当します。

## テンプレートシステムの概要 {#template-system}

nagi のデプロイ設定は以下の 3 層で管理されています。

```
deploy/templates/                    ← ① pristine（Git 管理、上流ベースライン）
        │
        │  /deploy スキルで展開
        ▼
deploy/{ASSISTANT_NAME}/             ← ② user-editable（ユーザーがカスタマイズする層）
        │
        │  /update-groups スキル または pnpm dev 起動時に自動コピー
        ▼
__data/{ASSISTANT_NAME}/             ← ③ runtime（コンテナにマウントされる実行時データ）
```

- **① pristine 層** — `deploy/templates/` 配下。Git で追跡される原本テンプレートです。直接編集せず、コードベースの更新時に新しい機能やプラグイン登録が追加されます。
- **② user-editable 層** — `deploy/{ASSISTANT_NAME}/` 配下。テンプレートから展開されたファイルをユーザーが自由に編集できます。プラグインの追加・削除、環境変数の設定などはここで行います。
- **③ runtime 層** — `__data/{ASSISTANT_NAME}/` 配下。実際にオーケストレーターやコンテナが参照するランタイムデータです。DB、ログ、セッション、グループプロンプトなどが格納されます。

### プレースホルダー置換

テンプレートファイルの種類によって置換の方式が異なります。

| ファイル種別 | 置換方式 |
|---|---|
| エントリポイント（`entry.template.ts`） | プレースホルダーなし。テンプレートをそのままコピーし、ユーザーが直接編集 |
| グループプロンプト（`CLAUDE.md` 等） | プレースホルダーなし。プレーンな Markdown をそのままコピー |
| launchd plist | `{{PLACEHOLDER}}` 形式。`{{NODE_PATH}}`、`{{TSX_PATH}}`、`{{PROJECT_ROOT}}`、`{{NODE_BIN_DIR}}`、`{{HOME}}` をマシン固有のパスに置換 |

---

## `/deploy` — テンプレート一括同期 {#deploy}

pristine テンプレート（`deploy/templates/`）からユーザー編集レイヤー（`deploy/{ASSISTANT_NAME}/`）への展開を一括で行うスキルです。新規セットアップ時にも、テンプレート更新の取り込み時にも使用します。

**トリガー:** `deploy`, `sync deploy`, `update entry`, `sync entry`, `sync group templates`, `sync launchd`

### 同期対象

| 対象 | テンプレート | 展開先 |
|------|------------|--------|
| Host エントリ | `deploy/templates/host/entry.template.ts` | `deploy/{ASSISTANT_NAME}/host/entry.ts` |
| Claude Code エントリ | `deploy/templates/container/claude-code/entry.template.ts` | `deploy/{ASSISTANT_NAME}/container/claude-code/entry.ts` |
| Open Code エントリ | `deploy/templates/container/open-code/entry.template.ts` | `deploy/{ASSISTANT_NAME}/container/open-code/entry.ts` |
| グループプロンプト | `deploy/templates/groups/{channel}/{group}/*.md` | `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/*.md` |
| launchd plist | `deploy/templates/launchd/com.nagi.plist` | `deploy/{ASSISTANT_NAME}/launchd/com.nagi.plist` |

### 処理フロー

1. **アシスタント名の決定** — 既存の `deploy/*/` ディレクトリを検出し、どのアシスタントにデプロイするか選択します。新規名称の入力も可能です。
2. **同期対象の選択** — All（全対象）または個別対象（Host / Claude Code / Open Code / Groups / Launchd）を選択します。
3. **データディレクトリと `.env` の初期化** — 新規アシスタントの場合、`__data/{ASSISTANT_NAME}/` 配下のディレクトリ構造と `.env` ファイルを作成します。`.env` ではエージェント認証（OAuth トークンまたは API キー）とチャンネルトークン（Slack / Discord / Asana）を設定します。
4. **差分検出とマージ** — 既存ファイルがある場合はテンプレートとの差分を確認し、新規追加分のみを取り込みます。ユーザーのカスタマイズは常に保持されます。
5. **TypeScript コンパイル検証** — エントリポイントについては `tsc --noEmit` でコンパイルが通ることを確認します。

### 使用するタイミング

- 初めてアシスタントをセットアップするとき
- `git pull` でテンプレートに新しいプラグイン登録や設定が追加されたとき
- 新しいチャンネルやグループを追加した後にデフォルトプロンプトを配布するとき

::: tip
既存ファイルを上書きする際は必ず確認が入ります。ユーザーが手動で追加したプラグイン登録や設定が意図せず失われることはありません。
:::

---

## `/update-entry` — エントリポイント個別同期 {#update-entry}

単一のエントリポイントファイルをテンプレートから同期するスキルです。`/deploy` が全対象を一括処理するのに対し、このスキルは Host / Claude Code / Open Code のいずれか 1 つを対象として対話的に選択できます。

**トリガー:** `update entry`, `sync entry`, `refresh entry`

### 同期対象

| 対象 | テンプレート | 展開先 |
|------|------------|--------|
| Host | `deploy/templates/host/entry.template.ts` | `deploy/{ASSISTANT_NAME}/host/entry.ts` |
| Claude Code | `deploy/templates/container/claude-code/entry.template.ts` | `deploy/{ASSISTANT_NAME}/container/claude-code/entry.ts` |
| Open Code | `deploy/templates/container/open-code/entry.template.ts` | `deploy/{ASSISTANT_NAME}/container/open-code/entry.ts` |

### 差分検出で確認される項目

**Host エントリの場合:**
- チャンネルプラグイン登録（`registry.register`）
- MCP プラグイン登録（`registerMcpPlugin`）
- Hooks プラグイン登録（`registerHooksPlugin`）
- マウント許可リスト設定（`setMountAllowlist`）

**Container エントリの場合:**
- コンテナプラグインのインポート（`import(pluginPath)`）
- プラグイン追加ブロック（`plugins.push`）
- フック生成の配線（`createHooks`）

### 使用するタイミング

- 特定のエントリポイントだけを更新したいとき（全体の `/deploy` を実行するほどではない場合）
- 新しいプラグインをテンプレートに追加した後、その変更を 1 ファイルだけ取り込みたいとき

---

## `/update-groups` — グループプロンプト同期 {#update-groups}

ユーザー編集レイヤー（`deploy/{ASSISTANT_NAME}/groups/`）からランタイムディレクトリ（`__data/{ASSISTANT_NAME}/groups/`）へグループプロンプトを同期するスキルです。`CLAUDE.md`、`AGENTS.md` などエージェントの振る舞いを定義するプロンプトファイルが対象です。

**トリガー:** `update groups`, `sync groups`, `refresh claude.md`, `update agent config`

### 3 層モデルにおける位置づけ

```
deploy/templates/groups/             ← pristine（上流ベースライン）
        │
        │  /deploy スキルで展開
        ▼
deploy/{ASSISTANT_NAME}/groups/      ← user-editable（このスキルのソース）
        │
        │  /update-groups スキル または pnpm dev 起動時にコピー
        ▼
__data/{ASSISTANT_NAME}/groups/      ← runtime（コンテナマウント、実行時参照先）
```

`/deploy` が ① → ② の同期を担当するのに対し、`/update-groups` は ② → ③ の同期を担当します。

### 処理フロー

1. `deploy/{ASSISTANT_NAME}/groups/` 配下のファイルを走査します。
2. `__data/{ASSISTANT_NAME}/groups/` の対応ファイルと比較し、NEW / CHANGED / OK に分類します。
3. NEW ファイルはそのままコピーします。CHANGED ファイルはユーザーに「上書き」「現状維持」「差分表示」を選択させます。
4. 同期結果を検証し、サマリーを表示します。

### 使用するタイミング

- `deploy/{ASSISTANT_NAME}/groups/` 内のプロンプトファイルを編集した後、変更をランタイムに反映させたいとき
- エージェントの `CLAUDE.md` を更新して、次回のコンテナ起動から新しい設定を適用したいとき
- `pnpm dev` を再起動せずに即座にグループプロンプトを反映させたいとき

::: tip
通常は `pnpm dev` の起動時に自動同期が行われます。このスキルは、起動を待たずに即座に反映させたい場合や、手動で上書き確認しながら同期したい場合に使用します。
:::

::: warning
ランタイム層（`__data/`）のファイルを直接編集しても、次回の同期で上書きされる可能性があります。永続的な変更は必ず `deploy/{ASSISTANT_NAME}/groups/` に対して行ってください。
:::

---

## `/update-container` — コンテナイメージ再ビルド {#update-container}

nagi-agent の Docker イメージを再ビルドするスキルです。コンテナ内部の構成要素を変更した後に実行します。

**トリガー:** `update container`, `rebuild container`, `rebuild image`, `rebuild docker`, `コンテナ再ビルド`

### 対象イメージ

| エージェント | イメージ名 | ビルドスクリプト |
|---|---|---|
| Claude Code | `nagi-agent:latest` | `./container/claude-code/build.sh` |
| Open Code | `nagi-agent-opencode:latest` | `./container/open-code/build.sh` |

### ビルドに影響するファイル

**Claude Code の場合:**
- `container/claude-code/Dockerfile`
- `host/agent-runner-claudecode/src/`（エージェントランナーのソースコード）
- `container/plugins/`（MCP プラグイン、コンテナプラグイン）
- `deploy/templates/container/claude-code/entry.template.ts`

**Open Code の場合:**
- `container/open-code/Dockerfile`
- `host/agent-runner-opencode/src/`
- `container/plugins/`

### 処理フロー

1. 対象エージェント（Claude Code / Open Code）を選択します。
2. Docker が起動していることを確認します。
3. ビルドスクリプトを実行してイメージを再ビルドします。
4. イメージサイズと作成日時を確認します。
5. `launchctl kickstart` で nagi サービスを再起動し、新しいイメージが使用されていることを確認します。

### 使用するタイミング

- Dockerfile を変更したとき
- エージェントランナー（`agent-runner-claudecode` / `agent-runner-opencode`）のソースコードを変更したとき
- MCP プラグインやコンテナプラグイン（`container/plugins/`）を追加・変更したとき
- コンテナ内部のエントリポイントテンプレートを更新したとき

---

## スキル選択ガイド {#choosing-the-right-skill}

| シナリオ | 推奨スキル |
|----------|-----------|
| 新規アシスタントの初回セットアップ | `/deploy` |
| `git pull` 後にテンプレート変更を取り込みたい | `/deploy` |
| ホストエントリテンプレートに新しいプラグインを追加した | `/update-entry`（Host） |
| コンテナエントリテンプレートに新しいプラグインを追加した | `/update-entry`（Container） |
| CLAUDE.md を編集して即座に反映させたい | `/update-groups` |
| Dockerfile やエージェントランナーのコードを変更した | `/update-container` |
| コンテナプラグインを変更した | `/update-container` |
| グループテンプレートを更新し、ランタイムにも反映したい | `/deploy`（Groups）→ `/update-groups` |

---

## ワークフロー例 {#workflow-examples}

### 初回セットアップ

```
/deploy  →  全対象を選択  →  .env にトークンを設定  →  /update-container  →  pnpm dev
```

### テンプレート更新の取り込み（git pull 後）

```
git pull
/deploy          … テンプレートの変更を user-editable 層に反映
/update-groups   … グループプロンプトをランタイム層に反映
/update-container … コンテナ関連の変更がある場合のみ
```

### グループプロンプトだけを編集した場合

```
deploy/{ASSISTANT_NAME}/groups/ 内のファイルを編集
/update-groups   … 編集内容をランタイムに反映（pnpm dev 再起動でも可）
```

### 特定のエントリポイントだけを更新したい場合

```
/update-entry    … Host / Claude Code / Open Code を選択して個別に同期
```
