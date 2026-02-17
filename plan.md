# セキュリティチェック統制管理システム 技術計画書

**実装期間:** 2025年3月末  
**Backend:** Go（全面移行）  
**Infra:** GKE（Google Kubernetes Engine）

---

## 1. サービス概要

複数企業のセキュリティチェックシートを**統制観点（Control）**で一元管理するシステム。

### 課題と解決方法

企業ごとに異なるフォーマットのセキュリティチェックシート（CSV）をアップロードすると：

1. **RAG + 全文検索**で自動的に統制観点（Control）へマッピング
2. **信頼度 ≥ 80%** → 自動処理で完了
3. **信頼度 < 80%** → 担当者がUIでワンクリックで紐付けを確定
4. 過去の回答を **Gemini 2.0 でRAG検索**し、新規質問にも自動回答を生成

---

## 2. 現状 → 新アーキテクチャ比較

| 項目 | 現状（Python） | 新（Go） |
|------|--------------|---------|
| 形態素解析 | Janome | **Kagome v2** |
| 全文検索 | TF-IDF（scikit-learn） | **Bleve** |
| AIモデル | Vertex AI Python SDK | Vertex AI **Go SDK** |
| デプロイ | Cloud Functions | **GKE（マイクロサービス）** |
| 処理速度 | 基準 | **約10倍** |
| 型安全性 | なし（Python） | あり（Go） |
| 並行処理 | なし | **goroutine** |

---

## 3. 利用技術スタック

### Frontend
- **Next.js 14** / TypeScript / Tailwind CSS / Server Actions

### Backend（Go 全面移行）
| ライブラリ | 用途 |
|-----------|------|
| **Kagome v2** | 日本語形態素解析（Janome の完全代替） |
| **Bleve** | 全文検索エンジン（TF-IDF の完全代替） |
| **Vertex AI Go SDK** | Gemini 2.0 Flash 呼び出し |
| gorilla/mux | HTTP ルーター |

> 📖 参考: [実践：形態素解析 kagome v2](https://zenn.dev/ikawaha/books/kagome-v2-japanese-tokenizer/viewer/foreword)

### Infra（GKE）
- **GKE**（Google Kubernetes Engine）
- **GCS**（controls.json / mappings.json / CSV ファイル保存）
- **Cloud SQL**（PostgreSQL — Control 永続化）
- **ConfigMap**（Kagome IPAdic 辞書管理）

---

## 4. GKE システム構成

```
Internet
    │
    ▼
[Ingress / Load Balancer]
    │
    ▼
[Next.js Pod]（フロントエンド）
    │
    ▼
[Go API Gateway Pod]
    ├──► [Control Service Pod]   — CRUD / Cloud SQL (PostgreSQL)
    ├──► [Search Service Pod]    — Kagome + Bleve インデックス
    ├──► [Ingest Service Pod]    — CSV 解析 + 自動マッピング
    └──► [RAG Service Pod]       — Vertex AI Gemini 2.0 Flash
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  [GCS]  [Cloud SQL]  [ConfigMap]
  CSV/JSON  PostgreSQL  Kagome辞書
```

---

## 5. 各機能の概要と実装方法

### 機能 1：CSV 取り込み & 自動マッピング

**処理フロー:**
```
CSV アップロード
    → GCS uploads/ へ保存
    → GCS トリガーで Ingest Service 起動
    → Kagome v2 で質問文を形態素解析（IPAdic 辞書）
    → Bleve インデックスで類似 Control を検索
    → confidence ≥ 0.8 → 自動マッピング保存
    → confidence < 0.8 → 未マッチリストへ
    → 結果を results/{vendor}/ に保存
```

**実装技術:** Go / Kagome v2 / Bleve / GCS トリガー

**UI（/ingest ページ）:**
```
企業名入力 → CSV ドラッグ&ドロップ → 処理進捗バー
→ 結果サマリー（自動: N件 / 要確認: N件）
→ 未マッチ画面へのリンク
```

---

### 機能 2：未マッチ管理画面（アプリの心臓部）

**概要:** 信頼度 80% 未満の質問を担当者が手動でマッピングする画面

**UI（/unmatched ページ）:**

```
┌──────────────────────────────────────────────┐
│ フィルタ: [企業名▼] [カテゴリ▼]              │
├──────────────────────────────────────────────┤
│ CompanyB                                      │
│ 「特権IDに多要素認証を適用していますか？」     │
│                                               │
│ ◉ BASE-0001 (87%) 多要素認証の実施           │ ← 緑バッジ
│ ○ BASE-0007 (61%) アクセス権限管理           │ ← 黄バッジ
│ ○ BASE-0003 (45%) パスワードポリシー         │ ← 赤バッジ
│                                               │
│ [✓ 紐付ける]  [新規Control作成]  [スキップ]  │
└──────────────────────────────────────────────┘
```

**実装詳細:**
- Bleve 検索で上位 3 候補をスコア付きで提示
- confidence バッジを緑（≥80%）/ 黄（≥50%）/ 赤（<50%）で色分け
- 確定後はカードがリアルタイムで消え、カウントが減少
- 候補が全て不適切な場合 → 新規 Control 作成ダイアログを表示
  - タイトル・代表質問・カテゴリ・タグを入力
  - Control Service API で即時登録 → Bleve インデックス自動更新

---

### 機能 3：全文検索 API（Go / Kagome / Bleve）

**概要:** Control・質問を横断的に検索する高速 API（Python 比 **約 10 倍**）

**検索フロー:**
```
検索クエリ入力
    → Kagome v2 で形態素解析（IPAdic辞書）
    → 名詞・動詞の原形でインデックス検索
    → Bleve インデックス（Control + Mapping）を横断検索
    → ファセット集計（カテゴリ・企業・タグの件数）
    → ミリ秒でレスポンス返却
```

**API エンドポイント:**
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/search` | 全横断検索（Control + 質問） |
| POST | `/controls/search` | Control のみ絞り込み検索 |
| POST | `/questions/search` | 企業質問のみ検索 |
| GET | `/search/facets` | カテゴリ・企業・タグの件数取得 |

**Kagome v2 の活用:**
- 「MFA」「多要素認証」「二段階認証」を同義語として検索可能
- IPAdic 辞書で品詞分解 → 名詞・動詞の原形でインデックス登録
- goroutine でインデックスの並行更新

**UI（/search ページ）:**
```
[🔍 認証                               ]
フィルタ: カテゴリ [Access Control ▼]  企業 [All ▼]

結果 (12件 / 3ms):
┌────────────────────────────────────────┐
│ [Control] BASE-0001 多要素認証の実施    │
│ 「管理者アカウントに MFA を適用...」    │
├────────────────────────────────────────┤
│ [Question] CompanyB                    │
│ 「特権 ID に多要素認証を適用して...」   │
└────────────────────────────────────────┘
ファセット: Access Control (8) / Auth (4)
```

---

### 機能 4：Control 管理 & RAG 自動回答生成

**Control CRUD（Go REST API）:**
- 作成・読取・更新・削除を Go REST API で実装
- Cloud SQL（PostgreSQL）に永続化
- Control 作成・更新時に Bleve インデックスを自動再構築
- `BASE-0001` 形式の ID を自動採番

**RAG 自動回答（Gemini 2.0 Flash）:**
```
質問入力
    → ① クエリ拡張（Gemini で同義語・関連語を生成）
    → ② Bleve で過去の Clean_Answer を検索（rawdate.csv）
    → ③ 上位 3 件をコンテキストとして Gemini に注入
    → ④ Gemini 2.0 Flash で自然文の回答を生成
    → 回答を返却
```

**統計ダッシュボード（/ ページ）:**
- 総 Control 数 / 総 Mapping 数 / 未マッチ件数 / 企業数
- カテゴリ別分布グラフ（Recharts）
- 自動マッピング率の推移
- 直近の取り込みアクティビティ一覧

---

## 6. UI イメージ（主要 3 画面）

### ① ダッシュボード（/）
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Control  │ │ Mapping  │ │ 未マッチ │ │  企業数  │
│   127    │ │   843    │ │   23     │ │    8     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

カテゴリ別分布         自動マッピング率推移
[████ Access(38)]      [━━━━━━━━ 87%]
[███  Auth(29)  ]
[██   Log(18)   ]
```

### ② 未マッチ管理（/unmatched）
```
┌──────────────────────────────────────────────┐
│ CompanyB                                      │
│ 「特権IDに多要素認証を適用していますか？」     │
│ ◉ BASE-0001 [87%] 多要素認証の実施           │
│ ○ BASE-0007 [61%] アクセス権限管理           │
│ ○ BASE-0003 [45%] パスワードポリシー         │
│ [✓ 紐付ける]  [新規作成]  [スキップ]         │
└──────────────────────────────────────────────┘
```

### ③ 全文検索（/search）
```
[🔍 認証                               ]
フィルタ: カテゴリ [Access Control ▼]  企業 [All ▼]
→ ミリ秒で結果表示 + ファセット件数
```

---

## 7. 実装スケジュール（3 週間）

```
3月  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
     ├──────────── Week 1 ─────────────┤─────────────────── Week 2 ───────────────────┤── Week 3 ──┤
```

### Week 1（3/1 〜 3/7）：GKE 基盤構築
- [ ] GKE クラスタ作成・Namespace 設計
- [ ] Go マイクロサービス骨格（4 サービス）
- [ ] Kagome v2 / Bleve 組み込み・動作確認
- [ ] GCS / Cloud SQL 接続確認

### Week 2（3/8 〜 3/21）：API 実装 + 画面開発
- [ ] Control Service API（CRUD）
- [ ] Search Service API（Kagome + Bleve）
- [ ] Ingest Service API（CSV 解析 + 自動マッピング）
- [ ] RAG Service API（Vertex AI Go SDK + Gemini 2.0）
- [ ] Next.js 5 画面開発（/ / ingest / unmatched / controls / search）

### Week 3（3/22 〜 3/31）：テスト + リリース
- [ ] E2E 統合テスト
- [ ] パフォーマンス検証（検索速度・負荷テスト）
- [ ] 本番 GKE デプロイ
- [ ] ドキュメント整備
- [ ] **3/31 本番リリース** 🚀

---

## 8. まとめと次のステップ

### 達成目標
- バックエンドを **Python → Go に全面移行**（Janome→Kagome / TF-IDF→Bleve）
- 検索速度 **約 10 倍**向上
- goroutine による効率的な並行処理
- GKE マイクロサービス化でスケールアウト可能な構成

### 次のステップ
1. GKE クラスタ作成 / Namespace 設計
2. Go マイクロサービス実装（Control / Search / Ingest / RAG）
3. Next.js 5 画面開発（/ / ingest / unmatched / controls / search）
4. **3/31 本番リリース**

---

*参考: [実践：形態素解析 kagome v2 — Zenn](https://zenn.dev/ikawaha/books/kagome-v2-japanese-tokenizer/viewer/foreword)*