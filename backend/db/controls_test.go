package db

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/pashagolub/pgxmock/v4"
)

// ─────────────────────────────────────────────────────
// CountControls
// ─────────────────────────────────────────────────────
func TestCountControls(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	q := New(mock)
	rows := mock.NewRows([]string{"count"}).AddRow(int64(42))
	mock.ExpectQuery("SELECT COUNT").WillReturnRows(rows)

	got, err := q.CountControls(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != 42 {
		t.Errorf("CountControls() = %d, want 42", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// ─────────────────────────────────────────────────────
// CreateControl
// ─────────────────────────────────────────────────────
func TestCreateControl(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	q := New(mock)
	now := time.Now()
	ts := pgtype.Timestamptz{Time: now, Valid: true}
	activeStatus := NullControlStatus{ControlStatus: ControlStatusActive, Valid: true}

	// 修正1: RETURNINGの順番に合わせてカラム名とAddRowの引数の順番を修正
	// 修正2: activeStatus.ControlStatus を string() でキャスト
	rows := mock.NewRows([]string{
		"id", "title", "question", "answer", "category", "tags", "version", "updated_by", "updated_at", "status",
	}).AddRow("CTL-001", "テスト", "質問", "回答", "認証", []string{"tag1"}, int32(1), "test_user", ts, string(activeStatus.ControlStatus))

	mock.ExpectQuery("INSERT INTO controls").
		WithArgs("CTL-001", "テスト", "質問", "回答", "認証", activeStatus, int32(1), []string{"tag1"}, "test_user").
		WillReturnRows(rows)

	params := CreateControlParams{
		ID:        "CTL-001",
		Title:     "テスト",
		Question:  "質問",
		Answer:    "回答",
		Category:  "認証",
		Status:    activeStatus,
		Version:   1,
		Tags:      []string{"tag1"},
		UpdatedBy: "test_user",
	}

	got, err := q.CreateControl(context.Background(), params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "CTL-001" {
		t.Errorf("CreateControl().ID = %q, want %q", got.ID, "CTL-001")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// ─────────────────────────────────────────────────────
// GetControl
// ─────────────────────────────────────────────────────
func TestGetControl(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	q := New(mock)
	now := time.Now()
	ts := pgtype.Timestamptz{Time: now, Valid: true}
	activeStatus := NullControlStatus{ControlStatus: ControlStatusActive, Valid: true}

	// 修正: activeStatus.ControlStatus を string() でキャスト
	rows := mock.NewRows([]string{
		"id", "title", "category", "question", "answer", "status", "version", "tags", "updated_by", "updated_at",
	}).AddRow("CTL-001", "テスト", "認証", "質問?", "回答!", string(activeStatus.ControlStatus), int32(2), []string{"tag1", "tag2"}, "test_user", ts)

	mock.ExpectQuery("SELECT").WithArgs("CTL-001").WillReturnRows(rows)

	got, err := q.GetControl(context.Background(), "CTL-001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "CTL-001" {
		t.Errorf("GetControl().ID = %q, want %q", got.ID, "CTL-001")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
} // ─────────────────────────────────────────────────────
// UpdateControl
// ─────────────────────────────────────────────────────
func TestUpdateControl(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	q := New(mock)
	now := time.Now()
	ts := pgtype.Timestamptz{Time: now, Valid: true}
	activeStatus := NullControlStatus{ControlStatus: ControlStatusActive, Valid: true}

	// 修正1: RETURNINGの順番に合わせてカラム名とAddRowの引数の順番を修正
	// 修正2: activeStatus.ControlStatus を string() でキャスト
	rows := mock.NewRows([]string{
		"id", "title", "question", "answer", "category", "tags", "version", "updated_by", "updated_at", "status",
	}).AddRow("CTL-001", "更新後", "新しい質問", "新しい回答", "ネットワーク", []string{"new_tag"}, int32(2), "test_user", ts, string(activeStatus.ControlStatus))

	mock.ExpectQuery("UPDATE controls").
		WithArgs("CTL-001", "更新後", "ネットワーク", "新しい質問", "新しい回答", activeStatus, int32(2), []string{"new_tag"}, "test_user").
		WillReturnRows(rows)

	params := UpdateControlParams{
		ID:        "CTL-001",
		Title:     "更新後",
		Category:  "ネットワーク",
		Question:  "新しい質問",
		Answer:    "新しい回答",
		Status:    activeStatus,
		Version:   2,
		Tags:      []string{"new_tag"},
		UpdatedBy: "test_user",
	}

	got, err := q.UpdateControl(context.Background(), params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Title != "更新後" {
		t.Errorf("UpdateControl().Title = %q, want %q", got.Title, "更新後")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// ─────────────────────────────────────────────────────
// ListControls
// ─────────────────────────────────────────────────────
func TestListControls(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	q := New(mock)
	now := time.Now()
	ts := pgtype.Timestamptz{Time: now, Valid: true}

	// 修正: ControlStatusActive と ControlStatusDraft を string() でキャスト
	rows := mock.NewRows([]string{
		"id", "title", "category", "question", "answer", "status", "version", "tags", "updated_by", "updated_at",
	}).
		AddRow("CTL-001", "タイトル1", "認証", "Q1", "A1", string(ControlStatusActive), int32(1), []string{"tag1"}, "user", ts).
		AddRow("CTL-002", "タイトル2", "暗号", "Q2", "A2", string(ControlStatusDraft), int32(1), []string{}, "user", ts)

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	got, err := q.ListControls(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("ListControls() returned %d rows, want 2", len(got))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
