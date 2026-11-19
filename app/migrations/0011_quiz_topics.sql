-- 0011: IntelliQuiz practice sets and TopicWise topics. Additive only.

-- A practice set: which questions, in which mode, and the result once submitted. Questions are chosen on the server.
CREATE TABLE IF NOT EXISTS quiz_sets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('quick', 'chapter', 'topic', 'mistakes', 'weakness', 'daily', 'exam')),
  chapter_id TEXT,
  topic_id TEXT,
  question_ids TEXT NOT NULL,
  feedback TEXT NOT NULL CHECK (feedback IN ('immediate', 'deferred')),
  time_limit_sec INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted')),
  day TEXT,
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  result TEXT
);
CREATE INDEX IF NOT EXISTS quiz_sets_user ON quiz_sets (user_id, started_at);
-- One Daily Five per student per day.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_sets_daily ON quiz_sets (user_id, day) WHERE mode = 'daily';

-- The student's current answer and review flag for each question of a set. Graded attempts go to `attempts` as before.
CREATE TABLE IF NOT EXISTS quiz_responses (
  set_id TEXT NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  response TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,
  graded INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (set_id, question_id)
);

-- Topics inside a chapter. Created and reviewed by admins; students see only checked or teacher-reviewed topics.
-- `skill` links a topic to the practice questions tagged with that skill.
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  title_en TEXT,
  skill TEXT,
  source_passage_id INTEGER,
  printed_page INTEGER,
  provenance TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'checked', 'teacher_reviewed', 'rejected')),
  review_note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  UNIQUE (chapter_id, title)
);
CREATE INDEX IF NOT EXISTS topics_chapter ON topics (chapter_id, position);

-- Seed: Mathematics, Chapter 2 only, from headings that appear in the checked passages (migration 0009) and the
-- chapter title in the book's contents. Status 'checked' because the heading text was checked against the page image;
-- none is teacher reviewed. Other skills in this chapter's exercises have no checked heading and are not given a topic.
INSERT OR IGNORE INTO topics (id, chapter_id, position, title, title_en, skill, source_passage_id, printed_page, provenance, review_status, created_at) VALUES
  ('a1d7c7a0-0b1e-4c2e-9d41-2a1f00000001', 'f9c3f216-a09e-5c02-979e-497b60f8333a', 1, 'বহুরাশিক অনুপাত', 'Ratio of several quantities', NULL,
   (SELECT id FROM passages WHERE textbook_id = '95402820-a31b-54ab-83e6-55a0dabe844b' AND page = 23 AND seq = 902), 18,
   'Heading in a checked passage, printed page 18', 'checked', '2026-11-19T00:00:00Z'),
  ('a1d7c7a0-0b1e-4c2e-9d41-2a1f00000002', 'f9c3f216-a09e-5c02-979e-497b60f8333a', 2, 'ধারাবাহিক অনুপাত', 'Continued ratio', 'continued-ratio',
   (SELECT id FROM passages WHERE textbook_id = '95402820-a31b-54ab-83e6-55a0dabe844b' AND page = 23 AND seq = 903), 18,
   'Heading in a checked passage, printed page 18', 'checked', '2026-11-19T00:00:00Z'),
  ('a1d7c7a0-0b1e-4c2e-9d41-2a1f00000003', 'f9c3f216-a09e-5c02-979e-497b60f8333a', 3, 'সমানুপাত', 'Proportion', 'proportion',
   (SELECT id FROM passages WHERE textbook_id = '95402820-a31b-54ab-83e6-55a0dabe844b' AND page = 24 AND seq = 902), 19,
   'Heading in a checked passage, printed page 19', 'checked', '2026-11-19T00:00:00Z'),
  ('a1d7c7a0-0b1e-4c2e-9d41-2a1f00000004', 'f9c3f216-a09e-5c02-979e-497b60f8333a', 4, 'লাভ-ক্ষতি', 'Profit and loss', 'profit-loss',
   NULL, NULL, 'Named in the chapter title (book contents page); no checked passage yet', 'checked', '2026-11-19T00:00:00Z');
