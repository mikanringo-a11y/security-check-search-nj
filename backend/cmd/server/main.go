package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/pubsub/v2"
	"cloud.google.com/go/storage"
	"connectrpc.com/connect"
	"github.com/asuka-sakamoto/security-system/backend/db"
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/custom"
	"github.com/blevesearch/bleve/v2/analysis/token/lowercase"
	"github.com/google/uuid"
	"github.com/ikawaha/bleveplugin/analysis/lang/ja"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/protobuf/types/known/timestamppb"

	securityv1 "github.com/asuka-sakamoto/security-system/gen/proto/security/v1"
	"github.com/asuka-sakamoto/security-system/gen/proto/security/v1/securityv1connect"
)

// -------------------------------------------------------------
// データ構造体・サーバー定義
// -------------------------------------------------------------

// 検索インデックス用の構造体（ここで定義します）
type ControlIndexDoc struct {
	Type        string `json:"_type"`
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Answer      string `json:"answer"`
}

type SecurityServer struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	index   bleve.Index
}

// -------------------------------------------------------------
// APIハンドラー（gRPC / ConnectRPC）
// -------------------------------------------------------------

func (s *SecurityServer) Ping(
	ctx context.Context,
	req *connect.Request[securityv1.PingRequest],
) (*connect.Response[securityv1.PingResponse], error) {
	return connect.NewResponse(&securityv1.PingResponse{
		Message: "Pong: " + req.Msg.Message,
	}), nil
}

func (s *SecurityServer) DeleteControl(
	ctx context.Context,
	req *connect.Request[securityv1.DeleteControlRequest],
) (*connect.Response[securityv1.DeleteControlResponse], error) {
	err := s.queries.DeleteControl(ctx, req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("failed to delete control"))
	}
	if err := s.index.Delete(req.Msg.Id); err != nil {
		log.Printf("Warning: Failed to delete control from Bleve: %v", err)
	}
	return connect.NewResponse(&securityv1.DeleteControlResponse{Success: true}), nil
}

func (s *SecurityServer) GetControl(
	ctx context.Context,
	req *connect.Request[securityv1.GetControlRequest],
) (*connect.Response[securityv1.GetControlResponse], error) {
	row, err := s.queries.GetControl(ctx, req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("control not found: %s", req.Msg.Id))
	}

	return connect.NewResponse(&securityv1.GetControlResponse{
		Control: &securityv1.Control{
			Id:       row.ID,
			Title:    row.Title,
			Category: row.Category,
			Question: row.Question,
			Answer:   row.Answer,
			Status:   string(row.Status.ControlStatus),
			Version:  fmt.Sprintf("%d", row.Version),
			Tags:     row.Tags,
		},
	}), nil
}

func (s *SecurityServer) CreateControl(ctx context.Context, req *connect.Request[securityv1.CreateControlRequest]) (*connect.Response[securityv1.CreateControlResponse], error) {
	newID := uuid.New().String()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		log.Printf("🚨 TX Begin Error: %v\n", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to begin tx: %w", err))
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	// 💡 修正ポイント1: Tags が nil の場合は空の配列をセットする
	// （PostgreSQLの配列カラムにnilを直接入れようとするとエラーになるのを防ぐため）
	tags := req.Msg.Tags
	if tags == nil {
		tags = []string{}
	}

	// 💡 修正ポイント2: db.CreateControlParams に tags を渡す
	ctrl, err := qtx.CreateControl(ctx, db.CreateControlParams{
		ID:        newID,
		Title:     req.Msg.Title,
		Question:  req.Msg.Question,
		Answer:    req.Msg.Answer,
		Category:  req.Msg.Category,
		Status:    db.NullControlStatus{ControlStatus: db.ControlStatusActive, Valid: true},
		Version:   1,
		Tags:      tags, // ここを nil チェック済みの tags に変更
		UpdatedBy: "userEmail",
	})
	if err != nil {
		// 🚨 修正ポイント3: 隠れていたデータベースのエラーをコンソールに出力させる
		log.Printf("🚨 CreateControl DB Error: %v\n", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to create control: %w", err))
	}

	if req.Msg.UnmatchedTaskId != "" {
		taskIDInt, err := strconv.Atoi(req.Msg.UnmatchedTaskId)
		if err == nil {
			err = qtx.UpdateUnmatchedTaskStatus(ctx, db.UpdateUnmatchedTaskStatusParams{
				ID: int32(taskIDInt),
				Status: db.NullUnmatchedStatus{
					UnmatchedStatus: db.UnmatchedStatus("resolved"),
					Valid:           true,
				},
			})
			if err != nil {
				// 🚨 念のためここにもログを追加
				log.Printf("🚨 UpdateUnmatchedTaskStatus DB Error: %v\n", err)
			}
		} else {
			log.Printf("🚨 UnmatchedTaskId Parse Error: %v\n", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("🚨 TX Commit Error: %v\n", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to commit: %w", err))
	}
	if s.index != nil {
		indexDoc := ControlIndexDoc{
			Type:        "control",
			ID:          ctrl.ID,
			Title:       ctrl.Title,
			Description: ctrl.Question,
			Answer:      ctrl.Answer,
		}
		if err := s.index.Index(ctrl.ID, indexDoc); err != nil {
			log.Printf("Bleve Index Error: %v\n", err)
		}
	}

	// 💡 元のコードで途切れていた正常終了時の return を補完
	// ※ Proto の定義に合わせてマッピング項目は微調整してください
	return connect.NewResponse(&securityv1.CreateControlResponse{
		Control: &securityv1.Control{
			Id:       ctrl.ID,
			Title:    ctrl.Title,
			Question: ctrl.Question,
			Answer:   ctrl.Answer,
			Category: ctrl.Category,
			Tags:     ctrl.Tags,
		},
	}), nil
}

func (s *SecurityServer) UpdateControl(
	ctx context.Context,
	req *connect.Request[securityv1.UpdateControlRequest],
) (*connect.Response[securityv1.UpdateControlResponse], error) {
	userEmail := req.Header().Get("X-User-Email")
	if userEmail == "" {
		userEmail = "system" // ヘッダーが無い場合の予備
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to begin tx: %w", err))
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	oldControl, err := qtx.GetControl(ctx, req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("control not found: %w", err))
	}

	snapshotBytes, _ := json.Marshal(oldControl)

	_, err = qtx.CreateControlVersion(ctx, db.CreateControlVersionParams{
		ControlID: oldControl.ID,
		Version:   oldControl.Version,
		Snapshot:  snapshotBytes,
		Diff:      []byte("{}"),
		ChangedBy: "system",
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to save version history: %w", err))
	}

	updatedControl, err := qtx.UpdateControl(ctx, db.UpdateControlParams{
		ID:        req.Msg.Id,
		Title:     req.Msg.Title,
		Category:  req.Msg.Category,
		Question:  req.Msg.Question,
		Answer:    req.Msg.Answer,
		Status:    oldControl.Status,
		Version:   oldControl.Version + 1,
		Tags:      req.Msg.Tags,
		UpdatedBy: userEmail,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to update control: %w", err))
	}

	description := fmt.Sprintf("「%s」が更新されました (v%d → v%d)", updatedControl.Title, oldControl.Version, updatedControl.Version)
	_, _ = qtx.CreateFeedEvent(ctx, db.CreateFeedEventParams{
		EventType:   db.FeedEventTypeUpdated,
		ControlID:   pgtype.Text{String: req.Msg.Id, Valid: true},
		UserName:    userEmail,
		Description: pgtype.Text{String: description, Valid: true},
	})
	if err := tx.Commit(ctx); err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to commit: %w", err))
	}
	if s.index != nil {
		// 検索に引っ掛けてほしい項目をBleveに渡す
		indexData := map[string]interface{}{
			"id":       updatedControl.ID,
			"title":    updatedControl.Title,
			"question": updatedControl.Question,
			"answer":   updatedControl.Answer,
			"category": updatedControl.Category,
			"tags":     updatedControl.Tags,
		}
		if err := s.index.Index(updatedControl.ID, indexData); err != nil {
			log.Printf("Failed to update Bleve index for control %s: %v", updatedControl.ID, err)
		}
	}

	indexDoc := ControlIndexDoc{
		Type:        "control",
		ID:          updatedControl.ID,
		Title:       updatedControl.Title,
		Description: updatedControl.Question,
		Answer:      updatedControl.Answer,
	}
	_ = s.index.Index(updatedControl.ID, indexDoc)

	return connect.NewResponse(&securityv1.UpdateControlResponse{
		Control: &securityv1.Control{
			Id:       updatedControl.ID,
			Title:    updatedControl.Title,
			Category: updatedControl.Category,
			Status:   string(updatedControl.Status.ControlStatus),
			Version:  fmt.Sprintf("%d", updatedControl.Version),
			Tags:     req.Msg.Tags,
			Question: updatedControl.Question,
			Answer:   updatedControl.Answer,
		},
	}), nil
}

func (s *SecurityServer) ListControls(
	ctx context.Context,
	req *connect.Request[securityv1.ListControlsRequest],
) (*connect.Response[securityv1.ListControlsResponse], error) {
	totalCount, _ := s.queries.CountControls(ctx)

	limit := req.Msg.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := req.Msg.Offset
	if offset < 0 {
		offset = 0
	}

	rows, err := s.queries.ListControlsPaginated(ctx, db.ListControlsPaginatedParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to fetch controls: %w", err))
	}

	controls := make([]*securityv1.Control, 0, len(rows))
	for _, row := range rows {
		controls = append(controls, &securityv1.Control{
			Id:        row.ID,
			Title:     row.Title,
			Category:  row.Category,
			Status:    string(row.Status.ControlStatus),
			Version:   fmt.Sprintf("%d", row.Version),
			Tags:      row.Tags,
			Question:  row.Question,
			Answer:    row.Answer,
			UpdatedAt: timestamppb.New(row.UpdatedAt.Time),
		})
	}

	sortField := req.Msg.SortField
	sortOrder := req.Msg.SortOrder
	if sortOrder == "" {
		sortOrder = "desc"
	}
	if sortField != "" {
		sort.Slice(controls, func(i, j int) bool {
			var less bool
			switch sortField {
			case "title":
				less = controls[i].Title < controls[j].Title
			case "category":
				less = controls[i].Category < controls[j].Category
			case "updated_at":
				ti := controls[i].UpdatedAt.AsTime()
				tj := controls[j].UpdatedAt.AsTime()
				less = ti.Before(tj)
			}
			if sortOrder == "desc" {
				return !less
			}
			return less
		})
	}

	return connect.NewResponse(&securityv1.ListControlsResponse{
		Controls:   controls,
		TotalCount: int32(totalCount),
	}), nil
}

func (s *SecurityServer) SearchControls(
	ctx context.Context,
	req *connect.Request[securityv1.SearchControlsRequest],
) (*connect.Response[securityv1.SearchControlsResponse], error) {
	queryStr := req.Msg.Query
	if queryStr == "" {
		listRes, err := s.ListControls(ctx, &connect.Request[securityv1.ListControlsRequest]{})
		if err != nil {
			return nil, err
		}
		return connect.NewResponse(&securityv1.SearchControlsResponse{Hits: listRes.Msg.Controls}), nil
	}

	query := bleve.NewMatchQuery(queryStr)
	searchRequest := bleve.NewSearchRequest(query)
	searchRequest.Size = 20
	searchResult, err := s.index.Search(searchRequest)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("bleve search failed: %w", err))
	}

	results := make([]*securityv1.Control, 0, len(searchResult.Hits))
	for _, hit := range searchResult.Hits {
		row, err := s.queries.GetControl(ctx, hit.ID)
		if err != nil {
			continue
		}
		results = append(results, &securityv1.Control{
			Id:       row.ID,
			Title:    row.Title,
			Category: row.Category,
			Question: row.Question,
			Answer:   row.Answer,
			Status:   string(row.Status.ControlStatus),
			Version:  fmt.Sprintf("%d", row.Version),
			Tags:     row.Tags,
		})
	}
	return connect.NewResponse(&securityv1.SearchControlsResponse{Hits: results}), nil
}

func (s *SecurityServer) ListUnmatchedTasks(
	ctx context.Context,
	req *connect.Request[securityv1.ListUnmatchedTasksRequest],
) (*connect.Response[securityv1.ListUnmatchedTasksResponse], error) {
	dbTasks, err := s.queries.ListPendingUnmatchedTasks(ctx, db.ListPendingUnmatchedTasksParams{
		Limit:  50,
		Offset: 0,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to fetch unmatched tasks: %v", err))
	}

	var protoTasks []*securityv1.UnmatchedTask
	for _, t := range dbTasks {
		protoTasks = append(protoTasks, &securityv1.UnmatchedTask{
			Id:               t.ID,
			OriginalFileName: t.OriginalFileName,
			RowNumber:        t.RowNumber,
			QuestionText:     t.QuestionText,
			Status:           string(t.Status.UnmatchedStatus),
		})
	}
	return connect.NewResponse(&securityv1.ListUnmatchedTasksResponse{Tasks: protoTasks}), nil
}

func (s *SecurityServer) ListFeedEvents(ctx context.Context, req *connect.Request[securityv1.ListFeedEventsRequest]) (*connect.Response[securityv1.ListFeedEventsResponse], error) {
	rows, err := s.queries.ListFeedEvents(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to fetch feed events: %w", err))
	}

	events := make([]*securityv1.FeedEvent, 0, len(rows))
	for _, row := range rows {
		controlID := ""
		if row.ControlID.Valid {
			controlID = row.ControlID.String
		}
		description := ""
		if row.Description.Valid {
			description = row.Description.String
		}
		controlTitle := "削除されたControl"
		if row.ControlTitle.Valid {
			controlTitle = row.ControlTitle.String
		}

		events = append(events, &securityv1.FeedEvent{
			Id:           row.ID,
			EventType:    string(row.EventType),
			ControlId:    controlID,
			UserName:     row.UserName,
			Description:  description,
			CreatedAt:    timestamppb.New(row.CreatedAt.Time),
			ControlTitle: controlTitle,
		})
	}
	return connect.NewResponse(&securityv1.ListFeedEventsResponse{Events: events}), nil
}

func (s *SecurityServer) GetDashboardStats(
	ctx context.Context,
	req *connect.Request[securityv1.GetDashboardStatsRequest],
) (*connect.Response[securityv1.GetDashboardStatsResponse], error) {
	totalControls, _ := s.queries.CountControls(ctx)
	pendingUnmatched, _ := s.queries.CountPendingUnmatchedTasks(ctx)
	recentTeamUpdates, _ := s.queries.CountRecentTeamUpdates(ctx)

	return connect.NewResponse(&securityv1.GetDashboardStatsResponse{
		TotalControls:    int32(totalControls),
		PendingUnmatched: int32(pendingUnmatched),
		TeamUpdates:      int32(recentTeamUpdates),
	}), nil
}

// -------------------------------------------------------------
// ヘルパー・初期化関数群
// -------------------------------------------------------------

func initBleveIndex(indexPath string) (bleve.Index, error) {
	index, err := bleve.Open(indexPath)
	if err == bleve.ErrorIndexPathDoesNotExist {
		indexMapping := bleve.NewIndexMapping()
		err = indexMapping.AddCustomTokenizer("ja_tokenizer", map[string]interface{}{
			"type":      ja.Name,
			"dict":      ja.DictIPA,
			"base_form": true,
			"stop_tags": true,
		})
		if err != nil {
			return nil, err
		}
		err = indexMapping.AddCustomAnalyzer("ja", map[string]interface{}{
			"type":          custom.Name,
			"tokenizer":     "ja_tokenizer",
			"token_filters": []string{ja.StopWordsName, lowercase.Name},
		})
		if err != nil {
			return nil, err
		}
		jaTextFieldMapping := bleve.NewTextFieldMapping()
		jaTextFieldMapping.Analyzer = "ja"

		controlMapping := bleve.NewDocumentMapping()
		controlMapping.AddFieldMappingsAt("title", jaTextFieldMapping)
		controlMapping.AddFieldMappingsAt("description", jaTextFieldMapping)
		controlMapping.AddFieldMappingsAt("answer", jaTextFieldMapping)

		indexMapping.AddDocumentMapping("control", controlMapping)
		index, err = bleve.New(indexPath, indexMapping)
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	return index, nil
}

func indexAllControls(dbQueries *db.Queries, index bleve.Index) error {
	ctx := context.Background()
	controls, err := dbQueries.ListControls(ctx)
	if err != nil {
		return err
	}
	batch := index.NewBatch()
	for _, c := range controls {
		doc := ControlIndexDoc{
			Type:        "control",
			ID:          c.ID,
			Title:       c.Title,
			Description: c.Question,
			Answer:      c.Answer,
		}
		batch.Index(c.ID, doc)
	}
	return index.Batch(batch)
}

func startPubSubListener(projectID string, subID string, dbPool *pgxpool.Pool, index bleve.Index) {
	ctx := context.Background()
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return
	}
	defer client.Close()

	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		return
	}
	defer storageClient.Close()

	sub := client.Subscriber(subID)
	log.Printf("Listening for messages on subscription: %s\n", subID)
	_ = sub.Receive(ctx, func(ctx context.Context, msg *pubsub.Message) {
		fileName := msg.Attributes["objectId"]
		eventType := msg.Attributes["eventType"]
		bucketId := msg.Attributes["bucketId"]

		if eventType == "OBJECT_FINALIZE" {
			go func() {
				querier := db.New(dbPool)
				bgCtx := context.Background()

				ingestion, err := querier.CreateIngestion(bgCtx, db.CreateIngestionParams{
					FileName:  fileName,
					Status:    "PROCESSING",
					CreatedBy: "system",
				})
				if err != nil {
					log.Printf("履歴作成エラー: %v\n", err)
				}

				csvErr := processUploadedCSV(bgCtx, storageClient, bucketId, fileName, dbPool, index)

				var status, errMsg string
				if csvErr != nil {
					status = "FAILED"
					errMsg = csvErr.Error()
				} else {
					status = "COMPLETED"
				}

				if err == nil {
					_ = querier.UpdateIngestionStatus(bgCtx, db.UpdateIngestionStatusParams{
						ID:           ingestion.ID,
						Status:       status,
						ErrorMessage: pgtype.Text{String: errMsg, Valid: errMsg != ""},
					})
				}
			}()
		}
		msg.Ack()
	})
}

func processUploadedCSV(ctx context.Context, client *storage.Client, bucketName, fileName string, dbPool *pgxpool.Pool, index bleve.Index) error {
	rc, err := client.Bucket(bucketName).Object(fileName).NewReader(ctx)
	if err != nil {
		return err
	}
	defer rc.Close()

	csvReader := csv.NewReader(rc)
	csvReader.LazyQuotes = true
	csvReader.FieldsPerRecord = -1

	header, err := csvReader.Read()
	if err != nil {
		return err
	}
	if len(header) < 2 {
		return fmt.Errorf("CSVの列数が足りません")
	}

	querier := db.New(dbPool)
	rowCount := 1

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		rowCount++
		if err != nil {
			continue
		}

		var questionText string
		if len(record) >= 3 {
			questionText = strings.TrimSpace(record[2])
		}

		if questionText != "" {
			query := bleve.NewMatchQuery(questionText)
			searchRequest := bleve.NewSearchRequest(query)
			searchRequest.Size = 1
			searchResult, err := index.Search(searchRequest)

			if err == nil && len(searchResult.Hits) > 0 && searchResult.Hits[0].Score > 1.0 {
				continue
			}

			_, _ = querier.CreateUnmatchedTask(ctx, db.CreateUnmatchedTaskParams{
				OriginalFileName: fileName,
				RowNumber:        int32(rowCount),
				QuestionText:     questionText,
			})
		}
	}
	return nil
}

// -------------------------------------------------------------
// エントリーポイント (main)
// -------------------------------------------------------------

func main() {
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:password@localhost:5433/security_check?sslmode=disable"
	}
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()
	queries := db.New(pool)

	indexPath := os.Getenv("BLEVE_INDEX_PATH")
	if indexPath == "" {
		indexPath = "controls.bleve"
	}
	index, err := initBleveIndex(indexPath)
	if err != nil {
		log.Fatalf("Failed to init bleve: %v", err)
	}
	log.Println("Building Bleve index from database...")
	if err := indexAllControls(queries, index); err != nil {
		log.Printf("Warning: failed to index all controls: %v\n", err)
	} else {
		log.Println(" Successfully built Bleve index!")
	}

	securityServer := &SecurityServer{
		pool:    pool,
		queries: queries,
		index:   index,
	}

	mux := http.NewServeMux()
	pathName, handler := securityv1connect.NewSecurityServiceHandler(securityServer)
	mux.Handle(pathName, handler)

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	mux.HandleFunc("/api/ingestions", func(w http.ResponseWriter, r *http.Request) {
		ingestions, err := queries.ListIngestions(r.Context())
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		type FrontendIngestion struct {
			ID        string `json:"id"`
			FileName  string `json:"fileName"`
			Status    string `json:"status"`
			CreatedBy string `json:"createdBy"`
			CreatedAt string `json:"createdAt"`
		}

		var results []FrontendIngestion
		for _, ing := range ingestions {
			// 日付をフロントエンドが読める標準形式（ISO8601）に変換
			idStr := fmt.Sprintf("%d", ing.ID)
			createdAtStr := ""
			if ing.CreatedAt.Valid {
				createdAtStr = ing.CreatedAt.Time.Format(time.RFC3339)
			}

			results = append(results, FrontendIngestion{
				ID:        idStr,
				FileName:  ing.FileName,
				Status:    ing.Status,
				CreatedBy: ing.CreatedBy,
				CreatedAt: createdAtStr,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		// dbIngestions ではなく、整形した results を返す
		json.NewEncoder(w).Encode(results)
	})

	go startPubSubListener("welcome-study-sakamoto", "ingestion-subscription", pool, index)

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"POST", "OPTIONS", "GET"},
		AllowedHeaders: []string{"Content-Type", "Connect-Protocol-Version"},
	})

	addr := "0.0.0.0:8080"
	fmt.Printf(" Server is running on http://%s\n", addr)
	if err := http.ListenAndServe(addr, c.Handler(h2c.NewHandler(mux, &http2.Server{}))); err != nil {
		fmt.Printf("Failed to start server: %v\n", err)
	}
}
