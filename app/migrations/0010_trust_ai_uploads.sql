-- 0010: content trust lifecycle, review history, AI request log and private uploads. Additive only.
--
-- A passage now has two independent trust fields:
--   review_status (existing column) — how far its TEXT has been verified:
--     NULL               extracted (text layer or OCR), never reviewed
--     'ocr_corrected'    a person corrected the OCR text but has not compared it word by word with the page image
--     'checked'          checked word by word against the page image (the 16 rows from 0009)
--     'teacher_reviewed' a teacher reviewed it (recorded with the teacher's name; not an NCTB endorsement)
--     'rejected'         not usable
--   publish_status (new) — whether students may see it:
--     NULL        legacy rows: follow their book's approval, as before
--     'draft'     imported, awaiting review
--     'approved'  approved for student-facing retrieval, not yet published
--     'published' searchable by the tutor
--     'withdrawn' removed from students; text and history kept
-- Copyright permission is a separate fact on the book (textbooks.license_status) and is not implied by publishing.

ALTER TABLE passages ADD COLUMN publish_status TEXT;
ALTER TABLE passages ADD COLUMN flags TEXT;          -- JSON array of quality warnings, e.g. ["low_confidence","math_unverified"]
ALTER TABLE passages ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0; -- 1 when a warning must be cleared by a reviewer before students can see it
ALTER TABLE passages ADD COLUMN provenance TEXT;     -- how the text arrived: 'admin_import', 'ocr_pack', 'checked_seed', 'review_edit'
ALTER TABLE passages ADD COLUMN original_text TEXT;  -- the extracted text before the first human correction
ALTER TABLE passages ADD COLUMN reviewed_by TEXT;
ALTER TABLE passages ADD COLUMN reviewed_at TEXT;
ALTER TABLE passages ADD COLUMN confidence REAL;     -- OCR confidence of the page it came from, when known
CREATE INDEX IF NOT EXISTS passages_publish ON passages (textbook_id, publish_status);

-- The 16 checked passages were already searchable by students; record that, without changing their verification level.
UPDATE passages SET publish_status = 'published', provenance = 'checked_seed' WHERE review_status = 'checked' AND publish_status IS NULL;

-- Every review action on a passage, with who did it and what changed.
CREATE TABLE IF NOT EXISTS passage_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id INTEGER NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  actor_id TEXT,
  action TEXT NOT NULL,
  from_review TEXT,
  to_review TEXT,
  from_publish TEXT,
  to_publish TEXT,
  old_hash TEXT,
  new_hash TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS passage_reviews_passage ON passage_reviews (passage_id, id);

-- History for the 16 checked passages, as it actually happened (recorded in migration 0009's review_note).
INSERT INTO passage_reviews (passage_id, actor_id, action, from_review, to_review, from_publish, to_publish, new_hash, note, created_at)
SELECT p.id, NULL, 'seed_checked', NULL, 'checked', NULL, 'published', p.content_hash,
       COALESCE(p.review_note, 'Checked against the page image by the IntelliHorizon team; not yet reviewed by a teacher'), '2026-11-15T00:00:00Z'
  FROM passages p
 WHERE p.provenance = 'checked_seed'
   AND NOT EXISTS (SELECT 1 FROM passage_reviews r WHERE r.passage_id = p.id AND r.action = 'seed_checked');

-- AI explanation requests. Metadata only: no question text, no answer text, no student name.
CREATE TABLE IF NOT EXISTS ai_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,            -- 'explain', 'explain_back', 'image_read'
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL,             -- 'ok', 'insufficient', 'rejected', 'timeout', 'rate_limited', 'provider_error', 'bad_response', 'auth_failed', 'limit'
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  sources INTEGER,
  checks TEXT,                      -- JSON counts of what validation removed
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_requests_user ON ai_requests (user_id, created_at);

-- Homework photos. Stored privately in R2 under the student's id; served only to their owner; deleted after 30 days.
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('stored', 'read', 'unreadable', 'failed', 'deleted')),
  extracted_text TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS uploads_user ON uploads (user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uploads_user_hash ON uploads (user_id, sha256);

-- Explain It Back: the AI's second opinion (ideas recognised in the student's own words, possible misunderstandings).
ALTER TABLE explanations ADD COLUMN ai_feedback TEXT;
