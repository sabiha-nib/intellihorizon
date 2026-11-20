-- Server-side file store used when Supabase Storage keys are not configured (and for tests). Private: only the
-- server role can read it. Keys mirror the old R2 object keys (e.g. avatars/<user>/<id>.webp).
CREATE TABLE IF NOT EXISTS app_files (
  key TEXT PRIMARY KEY,
  content BYTEA NOT NULL,
  content_type TEXT,
  size BIGINT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

