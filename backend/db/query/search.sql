-- name: SearchControls :many
SELECT 
    id, title, category, question, answer, status, version, tags, updated_by, updated_at
FROM controls
WHERE 
    (title || ' ' || question || ' ' || answer) ILIKE '%' || $1 || '%'
ORDER BY updated_at DESC;
