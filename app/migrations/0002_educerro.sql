-- Educerro learner model. Additive only.
CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT 'en',
  grade INTEGER,
  medium TEXT,
  style TEXT NOT NULL DEFAULT 'visual',
  share_teacher INTEGER NOT NULL DEFAULT 0,
  share_family INTEGER NOT NULL DEFAULT 0,
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  kind TEXT NOT NULL,
  item TEXT NOT NULL,
  correct INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 2,
  misconception TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS evidence_learner ON evidence (learner_id, concept);
