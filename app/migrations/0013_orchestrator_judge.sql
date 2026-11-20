-- Phase 5: IntelliCore multi-model orchestrator metadata, review queue for model disagreements, a cache of validated
-- answers, and isolated judge-demo access. Additive only: new tables and new nullable/defaulted columns. No data is
-- changed or deleted.

-- One tutoring request can now use several models (author, fallback, reviewer, independent). Metadata only, as before:
-- no question text, no answer text, no key.
ALTER TABLE ai_requests ADD COLUMN request_group TEXT;
ALTER TABLE ai_requests ADD COLUMN task TEXT;
ALTER TABLE ai_requests ADD COLUMN strategy TEXT;
ALTER TABLE ai_requests ADD COLUMN role TEXT;
ALTER TABLE ai_requests ADD COLUMN cost_usd REAL;
ALTER TABLE ai_requests ADD COLUMN attempts INTEGER;
ALTER TABLE ai_requests ADD COLUMN disagreements INTEGER;
CREATE INDEX IF NOT EXISTS ai_requests_group ON ai_requests (request_group);
CREATE INDEX IF NOT EXISTS ai_requests_time ON ai_requests (created_at, provider);

-- Validated answers, reused for the same student, question, settings and evidence within a short window.
CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_cache_time ON ai_cache (created_at);

-- Explanations withheld because independent checks disagreed and the evidence couldn't settle it. Admin review only.
CREATE TABLE IF NOT EXISTS ai_disputes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_group TEXT NOT NULL,
  task TEXT NOT NULL,
  question TEXT NOT NULL,
  passage_ids TEXT NOT NULL,
  draft TEXT NOT NULL,
  issues TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_disputes_status ON ai_disputes (status, created_at);

-- Judge demo. One shared credential (stored only as a PBKDF2 hash, rotatable from Admin); every sign-in with it opens a
-- fresh, isolated demo student account that expires, so judges never see each other's activity.
ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN demo_expires_at TEXT;
CREATE TABLE IF NOT EXISTS demo_access (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  rotated_at TEXT NOT NULL,
  rotated_by TEXT,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO demo_access (id, username, password_hash, active, version, rotated_at, created_at)
VALUES ('judge', 'ih.judge', 'pbkdf2-sha256$100000$HQ4jSa_4YdnwtL_hDzwiTw$YJjBum5MOQbFYl9WVveeVr_Jue_fhij8NkqgO3MuDF4', 1, 1, '2026-11-20T00:00:00Z', '2026-11-20T00:00:00Z');
