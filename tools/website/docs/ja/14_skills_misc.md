# その他のスキル

## `/add-context-probe` — コンテキストプローブ {#add-context-probe}

### コンテキストマウントとは

Nagi では、エージェントコンテナの外にあるファイルやリポジトリをコンテナ内から参照できるようにする **コンテキスト自動マウント機構** が備わっています。具体的には、ホスト側の `deploy/{ASSISTANT_NAME}/container/context/` 配下に置かれたサブディレクトリが、コンテナ起動時に以下の経路で自動的に取り込まれます。

1. **ボリュームマウント** — 各サブディレクトリが `/workspace/extra/{名前}` に read-only でマウントされる
2. **additionalDirectories 登録** — Claude Code の `additionalDirectories` に追加され、エージェントがファイルを直接読み取れるようになる
3. **CLAUDE.md 自動追記** — サブディレクトリ内に `CLAUDE.md` があれば、`CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` 経由でエージェントのコンテキストに自動追記される

この仕組みにより、社内ドキュメントや外部リポジトリなどの追加知識をエージェントに与えることができます。

### プローブが必要な理由

コンテキストマウントは複数のレイヤー（Docker ボリューム、Claude Code 設定、CLAUDE.md 追記）が連携して動作するため、どこかの設定が抜けていると正しく機能しません。プローブを使うことで、以下のような問題を素早く切り分けられます。

- ボリュームマウント自体が失敗していないか（ファイルが読めるか）
- `additionalDirectories` にディレクトリが認識されているか
- `CLAUDE.md` の自動追記が有効か

問題が起きたときにどのレイヤーが壊れているかを特定できるため、デバッグ時間を大幅に短縮できます。

### 対応するプローブの種類

| 種類 | 説明 | 用途 |
|------|------|------|
| **marker** | `probe/` 固定ディレクトリに最小限の `CLAUDE.md` と `probe-marker.txt` を設置 | 軽量。全経路（Read・additionalDirectories・CLAUDE.md 追記）を一度に検証できる |
| **clone** | 指定した git リポジトリを `context/{名前}/` に clone | 実リポジトリでの動作確認に有効。clone 元に `CLAUDE.md` がなければ自動追記経路はテストできない |

### トリガー

以下のいずれかのフレーズでスキルが起動します。

`add context probe` / `context probe` / `probe context` / `verify context mount` / `test context mount` / `コンテキストプローブ`

### 使用例

#### marker プローブで全経路を検証する

```
> add context probe
```

スキルが起動すると、まず `context/` 配下の現状が表示されます。アクションとして **install** を選び、プローブ方式として **marker** を選択すると、`deploy/{ASSISTANT_NAME}/container/context/probe/` に以下のファイルが作成されます。

- `CLAUDE.md` — 自動追記経路の検証用
- `probe-marker.txt` — `probe-marker-ok` と書かれたマーカーファイル

設置後、コンテナを再起動（`/nagi-restart`）すれば反映されます。チャットから以下のように動作確認できます。

- **Read 経路の確認**: 「`/workspace/extra/probe/probe-marker.txt` を読んで中身を教えて」 → `probe-marker-ok` が返れば OK
- **CLAUDE.md 追記経路の確認**: 「プローブについて知ってる？」 → プローブの説明が返れば OK

#### clone プローブで外部リポジトリのマウントを検証する

```
> verify context mount
```

アクションとして **install**、プローブ方式として **clone** を選ぶと、リポジトリ URL やディレクトリ名などを対話的に入力できます。clone 完了後にコンテナを再起動すれば、チャットから「`/workspace/extra/{名前}/README.md` を読んで要約して」のように確認できます。

#### 不要になったプローブを撤去する

```
> context probe
```

アクションとして **remove** を選ぶと、`context/` 配下のサブディレクトリが一覧表示され、撤去対象を選択できます。削除前に最終確認があるため、誤って別のコンテキストディレクトリを消す心配はありません。

### 補足

- `deploy/*/` は `.gitignore` で除外されているため、プローブファイルが Nagi 本体のリポジトリにコミットされることはありません。
- プローブが設置されたままでも害はありませんが、不要になったら **remove** で撤去することを推奨します。
- ログ（`/nagi-logs`）で `Container mount configuration` や `Additional directories` のエントリを確認すると、マウントの成否をより詳細に把握できます。
