# レビュー観点

## 1. 1ファイルに責務が集まりすぎている / ハンドラー内に業務ロジックが入りすぎている

### 対象
- [`backend/cmd/server/main.go`](backend/cmd/server/main.go)
- [`CreateControl()`](backend/cmd/server/main.go:106)
- [`UpdateControl()`](backend/cmd/server/main.go:171)

### 問題
[`backend/cmd/server/main.go`](backend/cmd/server/main.go) に、次の責務が同居しています。

- API ハンドラー
- 業務ロジック
- DB アクセス
- 検索インデックス操作
- CSV 取り込み処理
- Pub/Sub リスナー
- 起動処理

変更理由の異なるコードが 1 か所に集まっており、コード量が増えるほど影響範囲が広がります。

### なぜ修正するのか
Layered Architecture では、役割ごとに責務を分けます。

- **Handler**: リクエストを受け取り、レスポンスを返す
- **Service**: 業務ルールを表現する
- **Repository**: DB や外部サービスとのやり取りを担当する

現状は、[`CreateControl()`](backend/cmd/server/main.go:106) と [`UpdateControl()`](backend/cmd/server/main.go:171) の中に、業務ルールや永続化の詳細まで入っています。

そのため、次の変更がすべて同じファイルに波及します。

- API の入出力変更
- 更新ルールの変更
- DB 保存方法の変更
- インデックス更新方法の変更

### どう修正するのか
Layered Architecture に沿って責務を分離します。

- `handler/control_handler.go`
  - ConnectRPC の Request / Response を扱う
- `service/control_service.go`
  - Control 作成・更新の業務ロジックを持つ
- `repository/control_repository.go`
  - DB への保存や取得を担当する
- `search/index_service.go`
  - Bleve の更新を担当する
- `mapper/control_mapper.go`
  - DB モデルから Proto への変換を担当する

ハンドラーは薄くし、Service 呼び出しに集中させます。

### データ変換処理の重複
[`GetControl()`](backend/cmd/server/main.go:83), [`CreateControl()`](backend/cmd/server/main.go:106), [`UpdateControl()`](backend/cmd/server/main.go:171), [`ListControls()`](backend/cmd/server/main.go:251), [`SearchControls()`](backend/cmd/server/main.go:320) では、`securityv1.Control` への詰め替えが個別に書かれています。

データ変換をハンドラーごとに持つと、項目追加や型変更のたびに修正箇所が増えます。
Layered Architecture の観点では、この変換責務も分離した方が保守しやすいです。

- Handler
  - Request / Response の制御に集中する
- Mapper
  - `toProtoControl(row)` のような変換を担当する

### 現状の例
[`UpdateControl()`](backend/cmd/server/main.go:171) では、1つの関数で次を実施しています。

- DB トランザクション開始
- 既存 Control 取得
- バージョン履歴保存
- Control 更新
- Feed 作成
- インデックス更新
- Response 生成

### 分割後のイメージ
#### Handler
- Request を受ける
- 入力チェックをする
- Service を呼ぶ
- Response を返す

#### Service
- 更新ルールを判断する
- バージョン履歴を残す
- Repository に保存を依頼する
- 必要な副作用を調整する

#### Repository
- SQL 実行
- DB モデルの取得・保存

### レビューコメント例
[`backend/cmd/server/main.go`](backend/cmd/server/main.go) に責務が集まりすぎています。特に [`CreateControl()`](backend/cmd/server/main.go:106) と [`UpdateControl()`](backend/cmd/server/main.go:171) は、ハンドラーでありながら業務ロジックや永続化処理まで持っています。加えて、`securityv1.Control` への変換処理も各ハンドラーに分散しています。Layered Architecture の観点では、Handler / Service / Repository に責務を分け、変換処理は Mapper に寄せることで、ハンドラーは入出力に集中させたいです。

## 2. WebAPI サーバと Pub/Sub プロセスが同居している

### 対象
- [`main()`](backend/cmd/server/main.go:618)
- [`startPubSubListener()`](backend/cmd/server/main.go:499)
- [`processUploadedCSV()`](backend/cmd/server/main.go:557)

### 問題
[`main()`](backend/cmd/server/main.go:618) では、WebAPI サーバを起動しつつ、[`startPubSubListener()`](backend/cmd/server/main.go:499) も同じプロセス内で起動しています。

- HTTP リクエストを受ける処理
- Pub/Sub メッセージを購読して CSV を処理する処理

この 2 つは役割も負荷特性も異なるため、同じプロセスに置くと責務が混ざります。

### なぜ修正するのか
WebAPI サーバはリクエストに素早く応答することが重要です。
一方で Pub/Sub 側は、バックグラウンドで時間のかかる処理や再実行を前提にした設計が求められます。

同じプロセスに置くと、次の問題が起きやすくなります。

- API サーバの障害とバッチ処理の障害が切り分けにくい
- スケール戦略を分けられない
- デプロイ単位を分けられない
- ログや監視の観点が混ざる
- 重い CSV 処理が API 応答性に影響する可能性がある

### どう修正するのか
WebAPI 用プロセスと Pub/Sub ワーカー用プロセスを分離します。

- `cmd/server`
  - HTTP / ConnectRPC を受ける
- `cmd/worker`
  - Pub/Sub を購読して CSV を処理する

共通で使う業務ロジックは Service に寄せ、エントリーポイントだけを分けます。

### 分離後のイメージ
#### server
- API リクエストを受ける
- Service を呼ぶ
- レスポンスを返す

#### worker
- Pub/Sub メッセージを受ける
- CSV 処理 Service を呼ぶ
- 処理結果を保存する

### レビューコメント例
[`main()`](backend/cmd/server/main.go:618) で WebAPI サーバと Pub/Sub リスナーを同時に起動しており、同期 API と非同期バッチの責務が同居しています。両者は運用方法とスケール戦略が異なるため、`cmd/server` と `cmd/worker` のようにプロセスを分離したいです。

## 3. CSV仕様がコード上で見えにくい

### 対象
- [`processUploadedCSV()`](backend/cmd/server/main.go:557)

### 問題
[`processUploadedCSV()`](backend/cmd/server/main.go:557) では、CSV の列を配列インデックスで直接参照しています。

- `len(header) < 2` で列数だけを見ている
- `record[2]` を質問文として扱っている

この書き方だと、どの列が何を意味するのかがコードから読み取りにくいです。
CSV の仕様変更時にも、どこを直すべきか判断しづらくなります。

### なぜ修正するのか
CSV は外部仕様なので、コード上で列の意味が明確であることが重要です。

配列インデックスに依存すると、次の問題が起きやすくなります。

- 列順変更に弱い
- どの列を使っているかレビューで把握しづらい
- 仕様変更時にバグを埋め込みやすい
- 不正な CSV に対するバリデーション方針が見えにくい

### どう修正するのか
列番号ではなく、ヘッダー名で列を特定する形にします。

- ヘッダー行を読み取る
- `question_text` のような必要列を名前で探す
- 必須列が無ければ明示的にエラーにする
- レコード処理では取得した列 index を使う

### 修正イメージ
- `headerMap := map[string]int{...}` を作る
- `questionIdx, ok := headerMap["question_text"]` のように必要列を取得する
- `record[questionIdx]` を参照する

### レビューコメント例
[`processUploadedCSV()`](backend/cmd/server/main.go:557) で CSV 列を `record[2]` のように直接参照しており、仕様がコード上で見えにくいです。CSV は外部仕様なので、列の意味が名前で追える形にしたいです。ヘッダー名から列 index を解決し、必須列が無い場合は明示的にエラーにすると、仕様変更に強くなります。
