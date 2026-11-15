-- Educerro accounts. Additive only: no existing table or row is changed except one new nullable column.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified_at TEXT,
  pending_email TEXT,
  password_hash TEXT NOT NULL,
  registration_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  password_changed_at TEXT
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 1 AND 200),
  username TEXT NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 20),
  avatar_key TEXT,
  avatar_type TEXT,
  avatar_preset TEXT,
  school TEXT,
  country TEXT NOT NULL DEFAULT 'BD',
  district TEXT,
  region TEXT,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  curriculum TEXT NOT NULL,
  curriculum_other TEXT,
  curriculum_other_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset', 'email_change')),
  new_email TEXT,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens (user_id, purpose);

CREATE TABLE IF NOT EXISTS rate_events (
  bucket TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_events_bucket ON rate_events (bucket, at);

ALTER TABLE learners ADD COLUMN user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS learners_user ON learners (user_id);
