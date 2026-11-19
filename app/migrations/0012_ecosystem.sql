-- 0012: tutor memory and semantic retrieval, plus MemoryCards, SmartNotes, FormulaVault, ConceptConnect, Reflection,
-- teacher/parent sharing and Learning Twin corrections. Additive only; nothing existing is changed.

-- Semantic retrieval: one embedding per passage per model. Rebuilt when the passage text changes (content_hash).
CREATE TABLE IF NOT EXISTS passage_embeddings (
  passage_id INTEGER NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  vec TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (passage_id, model)
);

-- MemoryCards: a student's own flashcards with spaced scheduling (Again/Hard/Good/Easy).
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'definition', 'excerpt', 'formula')),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  lang TEXT,
  source_passage_id INTEGER,
  formula_id TEXT,
  chapter_id TEXT,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL,
  last_grade TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cards_user_due ON cards (user_id, due_at);
CREATE UNIQUE INDEX IF NOT EXISTS cards_user_source ON cards (user_id, kind, source_passage_id, front) WHERE source_passage_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS card_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('again', 'hard', 'good', 'easy')),
  client_event_id TEXT,
  at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS card_reviews_event ON card_reviews (user_id, client_event_id) WHERE client_event_id IS NOT NULL;

-- SmartNotes: the student's own notes (private), optionally tied to a chapter and a source passage.
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  subject_key TEXT,
  chapter_id TEXT,
  source_passage_id INTEGER,
  highlight INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_user ON notes (user_id, updated_at);

-- FormulaVault: formulas taken from the book, each tied to the passage it appears in and reviewed before students see it.
CREATE TABLE IF NOT EXISTS formulas (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  expression TEXT NOT NULL,
  variables TEXT,
  units TEXT,
  explanation TEXT,
  example TEXT,
  source_passage_id INTEGER,
  printed_page INTEGER,
  provenance TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'checked', 'teacher_reviewed', 'rejected')),
  created_by TEXT,
  created_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT
);

-- ConceptConnect: reviewed links between topics, each with a written justification and (where possible) a source passage.
CREATE TABLE IF NOT EXISTS concept_links (
  id TEXT PRIMARY KEY,
  from_topic TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  to_topic TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('prerequisite', 'related', 'application', 'contrast')),
  justification TEXT NOT NULL,
  source_passage_id INTEGER,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'checked', 'teacher_reviewed', 'rejected')),
  created_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (from_topic, to_topic, kind)
);

-- Learning Reflection: what the student says about their own learning. Never counted as mastery evidence.
CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learned TEXT,
  difficult TEXT,
  can_explain TEXT,
  revisit TEXT,
  next_goal TEXT,
  context TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reflections_user ON reflections (user_id, created_at);

-- Teacher and parent access: created by the student, shown once as a code, stored only as a hash, revocable, expiring.
-- A grant shows a progress summary only: never tutor conversations, notes, reflections or uploads.
CREATE TABLE IF NOT EXISTS share_grants (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'parent')),
  label TEXT,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_viewed_at TEXT,
  views INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS share_grants_student ON share_grants (student_id);

-- Learning Twin corrections: "this isn't right about me". Recorded and answered with a check, never by editing evidence.
CREATE TABLE IF NOT EXISTS twin_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  claim TEXT NOT NULL CHECK (claim IN ('know_it', 'dont_know_it')),
  note TEXT,
  created_at TEXT NOT NULL
);

-- Tutor learning memory: the student's preferred explanation language for the tutor (separate from the interface language).
ALTER TABLE profiles ADD COLUMN tutor_lang TEXT;

-- Seed: one reviewed concept link, justified by the book's own words (checked passage on printed page 18:
-- "to convert two ratios into a continued ratio, make the consequent of the first equal to the antecedent of the second").
INSERT OR IGNORE INTO concept_links (id, from_topic, to_topic, kind, justification, source_passage_id, review_status, created_at)
SELECT 'b2c1d7a0-0b1e-4c2e-9d41-2a1f00000001', 'a1d7c7a0-0b1e-4c2e-9d41-2a1f00000001', 'a1d7c7a0-0b1e-4c2e-9d41-2a1f00000002', 'related',
       'Both are introduced on printed page 18 as ways of comparing more than two quantities.',
       (SELECT id FROM passages WHERE textbook_id = '95402820-a31b-54ab-83e6-55a0dabe844b' AND page = 23 AND seq = 903), 'checked', '2026-11-19T00:00:00Z'
 WHERE EXISTS (SELECT 1 FROM topics WHERE id = 'a1d7c7a0-0b1e-4c2e-9d41-2a1f00000002');

-- Seed: two formulas, each a rule stated in a checked passage. The symbolic form is IntelliHorizon's notation of the
-- book's words (recorded in provenance); the example is the book's own worked example (printed page 19).
INSERT OR IGNORE INTO formulas (id, chapter_id, name, name_en, expression, variables, units, explanation, example, source_passage_id, printed_page, provenance, review_status, created_at) VALUES
  ('c3d1e7a0-0b1e-4c2e-9d41-2a1f00000001', 'f9c3f216-a09e-5c02-979e-497b60f8333a', 'দুটি অনুপাতকে ধারাবাহিক অনুপাতে রূপান্তর', 'Joining two ratios into a continued ratio',
   '$a : b$ ও $c : d$ থেকে $a \times c : b \times c : b \times d$',
   '[{"symbol":"a : b","meaning":"প্রথম অনুপাত"},{"symbol":"c : d","meaning":"দ্বিতীয় অনুপাত"}]', NULL,
   'প্রথম অনুপাতের উভয় রাশিকে দ্বিতীয় অনুপাতের পূর্ব রাশি দিয়ে, আর দ্বিতীয় অনুপাতের উভয় রাশিকে প্রথম অনুপাতের উত্তর রাশি দিয়ে গুণ করলে মাঝের রাশি সমান হয়।',
   '৭ : ৫ ও ৮ : ৯ থেকে ৫৬ : ৪০ : ৪৫ (পাঠ্যবইয়ের উদাহরণ ১, পৃষ্ঠা ১৯)',
   (SELECT id FROM passages WHERE textbook_id = '95402820-a31b-54ab-83e6-55a0dabe844b' AND page = 23 AND seq = 904), 18,
   'Rule stated in words in a checked passage, printed page 18; symbols are IntelliHorizon notation of that rule', 'checked', '2026-11-19T00:00:00Z'),
  ('c3d1e7a0-0b1e-4c2e-9d41-2a1f00000002', 'f9c3f216-a09e-5c02-979e-497b60f8333a', 'সমানুপাত', 'Proportion',
   '$a : b = c : d$',
   '[{"symbol":"a, b, c, d","meaning":"চারটি রাশি; প্রত্যেকটিকে সমানুপাতী বলে"}]', NULL,
   '১ম ও ২য় রাশির অনুপাত এবং ৩য় ও ৪র্থ রাশির অনুপাত সমান হলে রাশি চারটি সমানুপাত তৈরি করে।',
   NULL,
   (SELECT id FROM passages WHERE textbook_id = '95402820-a31b-54ab-83e6-55a0dabe844b' AND page = 24 AND seq = 903), 19,
   'Definition stated in a checked passage, printed page 19; symbols are IntelliHorizon notation of that definition', 'checked', '2026-11-19T00:00:00Z');
