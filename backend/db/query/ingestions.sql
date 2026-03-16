-- name: CreateIngestion :one
INSERT INTO ingestions (file_name, status, created_by)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateIngestionStatus :exec
UPDATE ingestions
SET status = $2, error_message = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: ListIngestions :many
SELECT * FROM ingestions
ORDER BY created_at DESC
LIMIT 50;