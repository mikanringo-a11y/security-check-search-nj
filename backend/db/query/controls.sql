-- name: GetControl :one
SELECT 
    id, title, category, question, answer, status, version, tags, updated_by, updated_at
FROM controls
WHERE id = $1;

-- name: ListControls :many
SELECT
    id, title, category, question, answer, status, version, tags, updated_by, updated_at
FROM controls
ORDER BY updated_at DESC;

-- name: ListControlsPaginated :many
SELECT
    id, title, category, question, answer, status, version, tags, updated_by, updated_at
FROM controls
ORDER BY updated_at DESC
LIMIT $1 OFFSET $2;

-- name: CreateControl :one
INSERT INTO controls (
  id, title, question, answer, category, status, version, tags, updated_by
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: UpdateControl :one
UPDATE controls
SET 
    title = $2,
    category = $3,
    question = $4,
    answer = $5,
    status = $6,
    version = $7,
    tags = $8,
    updated_by = $9,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: DeleteControl :exec
DELETE FROM controls
WHERE id = $1;

-- name: CreateControlVersion :one
-- 変更前のスナップショットと差分をJSONで保存するためのクエリです
INSERT INTO control_versions (
    control_id, version, snapshot, diff, changed_by
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetControlsByIDs :many
SELECT 
    id, title, category, question, answer, status, version, tags, updated_by, updated_at
FROM controls
WHERE id = ANY($1::varchar[])
ORDER BY updated_at DESC;

-- name: CountControls :one
SELECT COUNT(*) FROM controls;

-- name: CountPendingUnmatchedTasks :one
SELECT COUNT(*) FROM unmatched_tasks WHERE status = 'pending';

-- name: CountRecentTeamUpdates :one
SELECT COUNT(*) FROM feed_events 
WHERE created_at >= NOW() - INTERVAL '7 days';