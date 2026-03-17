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

## 4. Terraform と Kubernetes manifest も責務ごとに分けたい

### 対象
- [`infra/main.tf`](infra/main.tf)
- [`k8s/backend.yaml`](k8s/backend.yaml)
- [`k8s/frontend.yaml`](k8s/frontend.yaml)
- [`k8s/ingress.yaml`](k8s/ingress.yaml)
- [`k8s/managed-cert.yaml`](k8s/managed-cert.yaml)
- [`k8s/backendconfig.yaml`](k8s/backendconfig.yaml)
- [`k8s/healthcheck.yaml`](k8s/healthcheck.yaml)

### 問題
[`infra/main.tf`](infra/main.tf) には、Pub/Sub、GCS 通知、Artifact Registry、Cloud SQL、GKE、Workload Identity、IAM が同居しています。

また Kubernetes manifest も、現状はファイル単位ではある程度分かれていますが、今後リソースが増えると「アプリ」「ネットワーク」「証明書」「運用設定」の境界が見えにくくなります。

### なぜ修正するのか
インフラ定義もアプリケーションコードと同様に、変更理由ごとに分けた方が保守しやすいです。

責務ごとに分かれていないと、次の問題が起きやすくなります。

- 変更対象のファイルを特定しづらい
- レビュー範囲が広がる
- 影響調査に時間がかかる
- 環境差分や運用設定の意図が追いにくい

### どう修正するのか
Terraform はリソース群ごとにファイルを分けます。

- `infra/provider.tf`
  - Terraform backend、provider 定義
- `infra/pubsub.tf`
  - Pub/Sub topic、subscription、GCS notification
- `infra/artifact_registry.tf`
  - Artifact Registry
- `infra/cloudsql.tf`
  - Cloud SQL、database、user
- `infra/gke.tf`
  - GKE cluster、node pool
- `infra/iam.tf`
  - Service Account、IAM、Workload Identity
- `infra/output.tf`
  - output 定義

Kubernetes manifest も責務ごとに整理します。

- `k8s/apps/backend/`
  - backend の Deployment、Service、ServiceAccount
- `k8s/apps/frontend/`
  - frontend の Deployment、Service、ServiceAccount
- `k8s/network/`
  - Ingress、BackendConfig、HealthCheck
- `k8s/security/`
  - ManagedCertificate、Secret 関連

### レビューコメント例
[`infra/main.tf`](infra/main.tf) に複数種類のインフラリソースが集約されており、変更理由ごとの境界が見えにくいです。Terraform もアプリケーションコードと同様に責務ごとにファイル分割したいです。あわせて Kubernetes manifest もアプリ、ネットワーク、証明書の単位でディレクトリを分けると、レビューと運用がしやすくなります。

### 指摘する背景
[`k8s/backend.yaml`](k8s/backend.yaml) では、Bleve index を PVC に載せて永続化しています。

- [`bleve-index-volume`](k8s/backend.yaml:25)
- [`mountPath: /tmp/controls.bleve`](k8s/backend.yaml:33)
- [`BLEVE_INDEX_PATH`](k8s/backend.yaml:46)
- [`PersistentVolumeClaim`](k8s/backend.yaml:87)

ここで確認したいのは、Bleve index をどのような性質のデータとして扱うかです。

- DB から再生成できるキャッシュなのか
- 失うと困る永続データに近いものなのか
- API Pod が持つべき責務なのか
- 別ワーカーや別コンポーネントで管理すべきものなのか

特に [`accessModes: ReadWriteOnce`](k8s/backend.yaml:92) になっているため、現在の構成は単一 Pod 前提です。
将来 replicas を増やしたい場合や、API Pod と index 管理を分離したい場合に制約になりやすいです。

そのため、保存方式を選ぶ前に、更新頻度・復旧方針・スケール方針を整理したい、という背景があります。

### Bleve index 永続化の選択肢
#### 1. バッチで Cloud Storage に反映し、gcsfuse でマウントする
**メリット**
- Pod をまたいで同じ保存先を参照しやすい
- index の退避先が明確になる
- バッチ更新に寄せると API Pod の責務を軽くしやすい

**デメリット**
- オブジェクトストレージはローカルディスク前提の index と相性確認が必要
- 更新反映が即時ではなくなりやすい
- gcsfuse 経由の I/O 性能や整合性を検証する必要がある

#### 2. NFS を使用する
**メリット**
- 複数 Pod から同じ index を参照しやすい
- `ReadWriteOnce` の制約を避けやすい
- 既存のファイルベース index の構成を大きく変えずに済む

**デメリット**
- NFS 自体の運用負荷が増える
- レイテンシやロックの影響で検索性能が不安定になる可能性がある
- index 更新時の同時書き込み制御を別途考える必要がある

#### 3. index をコンテナイメージに含める
**メリット**
- 起動時の配置が単純になる
- 配布物として version を固定しやすい
- 読み取り専用の index なら構成が分かりやすい

**デメリット**
- index 更新のたびにイメージ再ビルドと再デプロイが必要
- 動的更新と相性が悪い
- index サイズが大きいと build と配布の負担が増える

### 使い分けの観点
- 更新頻度が低く、配布物として固定したいなら **コンテナイメージ同梱**
- 複数 Pod で共有したいがファイルベース運用を維持したいなら **NFS**
- API Pod から永続化責務を外し、バッチ同期を前提にするなら **Cloud Storage + gcsfuse**

現状の [`k8s/backend.yaml`](k8s/backend.yaml) は PVC 前提で単一 Pod に寄った設計なので、将来のスケール方針と更新頻度を先に決めてから保存方式を選ぶのがよいです。

## 補足: フロントエンドの責務分離の参考
フロントエンドで責務分離を説明する際は、feature 単位で構成を整理する考え方も参考になります。

- `features/controls/`
  - controls 一覧・詳細・作成に関する UI、hook、API 呼び出しを集約する
- `lib/api/`
  - ConnectRPC client や transport の共通化
- `components/ui/`
  - 汎用 UI コンポーネント

参考例としては React の feature-first な構成を紹介している react-bulletproof 系の考え方が近いです。
Next.js App Router でも、page に責務を集めすぎず、feature / ui / lib に分ける説明につなげやすいです。
