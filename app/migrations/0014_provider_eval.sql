-- Phase 5: real-provider evaluation runs (Admin -> AI providers). Additive only: two new tables, nothing changed or
-- deleted. Each result keeps the answer that would have been shown, so a person can score it; no student data is used
-- (the cases are fixed and run as the admin).
CREATE TABLE IF NOT EXISTS ai_eval_runs (
  id TEXT PRIMARY KEY,
  label TEXT,
  -- 1 only when every provider in the run pointed at its vendor's real API (not a local test double).
  real INTEGER NOT NULL DEFAULT 0,
  configs TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_eval_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES ai_eval_runs(id) ON DELETE CASCADE,
  config TEXT NOT NULL,
  case_id TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  latency_ms INTEGER,
  calls INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  checks TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  needs_human INTEGER NOT NULL DEFAULT 0,
  answer TEXT NOT NULL,
  orchestration TEXT,
  human_correct INTEGER CHECK (human_correct BETWEEN 1 AND 5),
  human_fluency INTEGER CHECK (human_fluency BETWEEN 1 AND 5),
  human_pedagogy INTEGER CHECK (human_pedagogy BETWEEN 1 AND 5),
  human_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (run_id, config, case_id)
);
CREATE INDEX IF NOT EXISTS ai_eval_results_run ON ai_eval_results (run_id, config);
