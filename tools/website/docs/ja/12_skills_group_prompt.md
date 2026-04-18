# グループプロンプトスキル

エージェントの振る舞いを定義するプロンプトファイルを作成・編集するスキルです。プロンプトファイルはグループごとに管理され、セッション開始時にエージェントの `systemPrompt` へ自動的に読み込まれます。

## プロンプトファイルの階層構造 {#file-hierarchy}

プロンプトファイルは以下のディレクトリ構造で管理されます。

```
deploy/
├── templates/groups/          # テンプレート（上流のベースライン、直接編集しない）
│   ├── slack/main/
│   │   ├── CLAUDE.md
│   │   └── AGENTS.md
│   ├── discord/main/
│   └── asana/main/
├── {ASSISTANT_NAME}/groups/   # ユーザー編集レイヤー（スキルはここを操作する）
│   ├── slack/main/
│   │   ├── CLAUDE.md
│   │   ├── AGENTS.md
│   │   ├── IDENTITY.md
│   │   ├── SOUL.md
│   │   ├── INSTRUCTIONS.md
│   │   └── skills.config.json   # スキル allowlist（任意、`/configure-skills`）
│   └── discord/main/
│       └── ...
__data/{ASSISTANT_NAME}/groups/  # ランタイムレイヤー（コンテナが実際に参照する）
```

**3 つのレイヤーの役割:**

| レイヤー | パス | 役割 |
|---|---|---|
| テンプレート | `deploy/templates/groups/` | 上流のデフォルト。直接編集しません |
| ユーザー編集 | `deploy/{ASSISTANT_NAME}/groups/` | ユーザーが自由にカスタマイズするレイヤー。スキルはこのレイヤーを操作します |
| ランタイム | `__data/{ASSISTANT_NAME}/groups/` | コンテナ内でマウントされる実行時のコピー。`/update-groups` で同期します |

## ファイルの読み込み方式 {#loading}

コンテナ起動時、`agent-runner-claudecode` がグループディレクトリ内の Markdown ファイルを読み込みます。

### 読み込みルール

- **`CLAUDE.md`** — Claude Code SDK が **自動的に** 読み込みます（`systemPrompt` とは別経路）。グループの基本指示を記述します。
- **`AGENTS.md`** — Open Code ランナー専用のファイルです。Claude Code ランナーではペルソナ指示の競合を避けるため読み込まれません。
- **その他の `*.md` ファイル** — `systemPrompt.append` としてセッションに注入されます。`IDENTITY.md`、`SOUL.md`、`INSTRUCTIONS.md` など自由に追加できます。

### 読み込み順序

ファイルはアルファベット順にソートされて結合されます。

```
AGENTS.md  → (Claude Code ではスキップ)
CLAUDE.md  → (SDK 自動読み込み)
IDENTITY.md → systemPrompt.append (1番目)
INSTRUCTIONS.md → systemPrompt.append (2番目)
SOUL.md → systemPrompt.append (3番目)
```

ファイル名のアルファベット順が読み込み順序に直結するため、順序が重要な場合は `01_IDENTITY.md` のようにプレフィックスを付けることもできます。

## プロンプトファイルの種類 {#file-types}

| ファイル | 用途 | 記述例 |
|---|---|---|
| `IDENTITY.md` | エージェントの名前・性格・話し方・使用言語 | 「ずんだもん風キャラクター、語尾は〜のだ」 |
| `SOUL.md` | ミッション・価値観・行動原則 | 「安全性を最優先、不明点は確認する」 |
| `INSTRUCTIONS.md` | セキュリティルール・ツール使用規則・出力形式 | 「API キーを出力しない、Bash より MCP ツールを優先」 |
| `AGENTS.md` | ツール一覧と使用ガイドライン（Open Code 用） | MCP ツールのカテゴリと使い分け |
| `CLAUDE.md` | Claude Code SDK 向けのメイン指示 | SDK が自動読み込みする設定・ルール |
| カスタム `*.md` | 任意の追加プロンプト | プロジェクト固有のコンテキスト情報など |

## プロンプト記述のベストプラクティス {#best-practices}

1. **ファイルを目的別に分割する** — 1 つのファイルに全てを詰め込まず、アイデンティティ・ルール・ミッションなどを別ファイルに分けると管理しやすくなります。
2. **Markdown の見出し構造を活用する** — `##` セクションで構造化すると、エージェントが指示を把握しやすくなります。
3. **具体例を含める** — 「カジュアルな口調で」よりも「語尾に『〜だよ』を使う。例: 『調べてみるだよ！』」のように具体例を示すと再現性が高まります。
4. **矛盾を避ける** — 複数ファイルに跨る指示が矛盾しないよう注意します。特に `CLAUDE.md` と他のファイルの間で言語設定やトーンが食い違わないようにします。
5. **`deploy/templates/` は編集しない** — テンプレートは上流ベースラインです。カスタマイズは必ず `deploy/{ASSISTANT_NAME}/groups/` 側で行います。
6. **変更後は同期する** — `deploy/` を編集した後は `/update-groups` で `__data/` へ同期し、`/nagi-restart` でコンテナに反映します。

---

## `/create-group-prompt` — プロンプト作成 {#create-group-prompt}

`deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/` にプロンプトファイルを新規作成します。対話形式でエージェントのパーソナリティや振る舞いを定義します。

**トリガー:** `create group prompt`, `add group prompt`, `create prompt`, `add identity`, `add soul`

### 作成フロー

1. **グループ選択** — 既存の `{channel}/{group}` 一覧から対象を選択します。
2. **既存ファイル確認** — 選択したグループに既に存在するファイルを表示します。
3. **ファイル種類選択** — `IDENTITY.md`、`SOUL.md`、`INSTRUCTIONS.md`、`AGENTS.md`、カスタムファイルから選択します（複数選択可）。既に存在するファイルはスキップされます。
4. **内容のヒアリング** — ファイルごとにエージェントの性格・ミッション・ルールなどを対話的に決定します。
5. **ファイル書き込み** — 内容をプレビュー後、確認してから保存します。
6. **ランタイム同期** — `__data/` へのコピーを実行するか選択します。

---

## `/update-group-prompt` — プロンプト編集 {#update-group-prompt}

既存のグループプロンプトファイルを対話的に編集します。変更内容を diff でプレビューしてから保存できます。

**トリガー:** `update group prompt`, `edit group prompt`, `modify claude.md`, `edit identity`, `update soul`, `update instructions`

### 編集フロー

1. **グループ選択** — 編集対象の `{channel}/{group}` を選択します。
2. **ファイル選択** — グループ内の Markdown ファイルから対象を選択します。
3. **編集モード選択** — 「自然言語で指示」（例: 「トーンをカジュアルにして」）または「末尾に追記」から選びます。
4. **diff プレビュー** — 変更箇所の差分を確認してから保存します。
5. **ランタイム同期** — `__data/` へのコピーを実行するか選択します。
6. **再起動確認** — nagi が稼働中の場合、再起動するか選択します。

### 注意事項

- 編集対象は常に `deploy/{ASSISTANT_NAME}/groups/` です。`deploy/templates/` や `__data/` を直接編集することはありません。
- 1 回の実行で編集できるファイルは 1 つです。複数ファイルを編集する場合はスキルを再実行します。
- ランタイム同期時、`__data/` 側に直接編集された内容がある場合は警告が表示されます。

---

## `/configure-skills` — スキル allowlist 編集 {#configure-skills}

`deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/skills.config.json` を対話的に編集し、そのグループでロードされるスキル（`container/skills/` 配下）を絞り込みます。コンテナセッションへ投入される SKILL.md の合計サイズを減らすことで、雑談チャンネルなどスキルをフルセット必要としないグループの input トークンを削減できます。

**トリガー:** `configure skills`, `edit skills`, `skills allowlist`, `skills config`, `limit skills`, `スキル設定`, `スキル絞り込み`, `スキル制限`

### 設定ファイルの仕様

- パス: `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/skills.config.json`
- フォーマット:
  ```json
  { "enabled": ["status", "slack-formatting"] }
  ```
- 評価ルール（`host/orchestrator/src/container-runner.ts` の実装）:
  - ファイル不在 → 全スキルをロード（後方互換のデフォルト動作）
  - `enabled` が配列 → 配列内の名前と一致するスキルのみコピー
  - `enabled` が `[]` → スキルをひとつもロードしない
  - JSON 破損 → warn ログを出して全ロードにフォールバック
  - `container/skills/` に存在しない名前 → warn ログを出してその名前はスキップ

### 編集フロー

1. **アシスタント選択** — `deploy/*/` を検出して対象の ASSISTANT_NAME を選択します。
2. **グループ選択** — `deploy/{ASSISTANT_NAME}/groups/` 配下の `{channel}/{group}` 一覧から対象を選択します。
3. **現在の状態を表示** — `skills.config.json` が存在する場合はその `enabled` 配列を、存在しない場合は「全スキルロード中」と表示します。
4. **スキル多肢選択** — `container/skills/` から利用可能なスキルを列挙し、有効化するものを multiSelect で選ばせます。現在有効なスキルにはマーカーが付きます。
5. **差分プレビュー** — Before / After の diff と追加/削除されるスキル名を提示します。
6. **書き込みまたは削除** — 全スキルを選択した場合は、allowlist を持たない（ファイル削除）状態に戻すかを確認します。削除の方がデフォルト動作に戻るため推奨されます。
7. **再起動確認** — nagi が launchd で稼働中なら `/nagi-restart` を提案します。`pnpm dev` などで手動起動している場合はユーザに再起動を促します。

### コスト削減の目安

1 つのスキル SKILL.md は平均でおよそ 4,000〜5,000 input トークンに相当します。雑談用途で 9 スキル中 2 スキルだけに絞った実測では、input トークンが 51,897 → 14,972（約 71% 削減）まで減少しました。コンテナ起動ごとに効くため、複数ターンある会話ほど累積効果が大きくなります。

### 注意事項

- 編集対象は常に `deploy/{ASSISTANT_NAME}/groups/` です。`deploy/templates/` や `__data/` を直接編集することはありません。
- `skills.config.json` には `enabled` キーのみが有効です。`disabled` などを書いてもオーケストレーターは無視するため、スキルが自動的に書き込むこともありません。
- コンテナ起動ごとに `__data/{ASSISTANT_NAME}/sessions/.../skills/` は再生成されるため、allowlist から外したスキルの残骸は残りません。
