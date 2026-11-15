-- Curriculum knowledge model, grounded tutor, practice and planning. Additive only.

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE profiles ADD COLUMN explain_lang TEXT;
ALTER TABLE profiles ADD COLUMN goals TEXT;

CREATE TABLE IF NOT EXISTS curricula (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT NOT NULL,
  country TEXT NOT NULL
);
INSERT OR IGNORE INTO curricula (id, name, authority, country) VALUES ('nctb', 'National Curriculum (Bangladesh)', 'National Curriculum and Textbook Board (NCTB)', 'BD');

CREATE TABLE IF NOT EXISTS curriculum_versions (
  id TEXT PRIMARY KEY,
  curriculum_id TEXT NOT NULL REFERENCES curricula(id),
  label TEXT NOT NULL,
  academic_year INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO curriculum_versions (id, curriculum_id, label, academic_year, notes, created_at)
VALUES ('nctb-2026', 'nctb', 'NCTB textbooks, 2026 academic year', 2026, 'NCTB published online editions of its 2026 textbooks on its website on 28 December 2025. Edition details are recorded per book as printed.', '2026-10-15T00:00:00Z');

CREATE TABLE IF NOT EXISTS textbooks (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES curriculum_versions(id),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  medium TEXT NOT NULL CHECK (medium IN ('bangla', 'english')),
  subject_key TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  paper TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('bn', 'en')),
  publisher TEXT NOT NULL DEFAULT 'National Curriculum and Textbook Board (NCTB)',
  edition TEXT,
  official_url TEXT,
  license_status TEXT NOT NULL DEFAULT 'permission_pending' CHECK (license_status IN ('permission_pending', 'permitted', 'restricted')),
  license_note TEXT,
  file_sha256 TEXT,
  page_count INTEGER,
  page_offset INTEGER,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'processing', 'needs_review', 'indexed', 'failed', 'retired')),
  approved_by TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (version_id, grade, medium, subject_key, paper)
);
CREATE INDEX IF NOT EXISTS textbooks_lookup ON textbooks (version_id, grade, medium, status);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  textbook_id TEXT NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label TEXT,
  title TEXT NOT NULL,
  start_page INTEGER,
  end_page INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (textbook_id, position)
);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  source_page INTEGER,
  bloom TEXT CHECK (bloom IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS objectives_chapter ON objectives (chapter_id, position);

CREATE TABLE IF NOT EXISTS source_pages (
  textbook_id TEXT NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  bangla_ratio REAL NOT NULL,
  quality TEXT NOT NULL CHECK (quality IN ('ok', 'empty', 'low_text', 'legacy_font', 'garbled')),
  content_hash TEXT NOT NULL,
  PRIMARY KEY (textbook_id, page)
);

CREATE TABLE IF NOT EXISTS passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  textbook_id TEXT NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE (textbook_id, page, seq)
);
CREATE INDEX IF NOT EXISTS passages_book_page ON passages (textbook_id, page);
CREATE VIRTUAL TABLE IF NOT EXISTS passages_fts USING fts5(text, content='passages', content_rowid='id', tokenize='trigram');
CREATE TRIGGER IF NOT EXISTS passages_ai AFTER INSERT ON passages BEGIN
  INSERT INTO passages_fts (rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER IF NOT EXISTS passages_ad AFTER DELETE ON passages BEGIN
  INSERT INTO passages_fts (passages_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;
CREATE TRIGGER IF NOT EXISTS passages_au AFTER UPDATE ON passages BEGIN
  INSERT INTO passages_fts (passages_fts, rowid, text) VALUES ('delete', old.id, old.text);
  INSERT INTO passages_fts (rowid, text) VALUES (new.id, new.text);
END;

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  textbook_id TEXT NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
  started_by TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'completed_with_issues', 'failed')),
  file_sha256 TEXT,
  pages_total INTEGER NOT NULL DEFAULT 0,
  pages_received INTEGER NOT NULL DEFAULT 0,
  pages_ok INTEGER NOT NULL DEFAULT 0,
  pages_empty INTEGER NOT NULL DEFAULT 0,
  pages_low INTEGER NOT NULL DEFAULT 0,
  pages_legacy INTEGER NOT NULL DEFAULT 0,
  pages_duplicate INTEGER NOT NULL DEFAULT 0,
  passages INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS import_jobs_book ON import_jobs (textbook_id, started_at);

CREATE TABLE IF NOT EXISTS tutor_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  textbook_id TEXT,
  chapter_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tutor_threads_user ON tutor_threads (user_id, updated_at);

CREATE TABLE IF NOT EXISTS tutor_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL REFERENCES tutor_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'tutor')),
  text TEXT NOT NULL,
  payload TEXT,
  feedback INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tutor_messages_thread ON tutor_messages (thread_id, id);

CREATE TABLE IF NOT EXISTS saved_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('excerpt', 'question')),
  passage_id INTEGER,
  question_id TEXT,
  excerpt TEXT,
  source TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS saved_items_user ON saved_items (user_id, created_at);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'numeric', 'short')),
  prompt TEXT NOT NULL,
  options TEXT,
  answer TEXT NOT NULL,
  tolerance REAL,
  explanation TEXT,
  source TEXT NOT NULL CHECK (source IN ('textbook_exercise', 'educerro_authored')),
  source_page INTEGER,
  objective_id TEXT,
  bloom TEXT CHECK (bloom IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 3),
  language TEXT NOT NULL CHECK (language IN ('bn', 'en')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS questions_chapter ON questions (chapter_id, status);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL,
  correct INTEGER NOT NULL,
  response TEXT,
  confidence INTEGER,
  mode TEXT NOT NULL DEFAULT 'practice',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_user ON attempts (user_id, created_at);
CREATE INDEX IF NOT EXISTS attempts_user_chapter ON attempts (user_id, chapter_id);

CREATE TABLE IF NOT EXISTS review_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  box INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  last_correct INTEGER NOT NULL,
  lapses INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS review_due ON review_state (user_id, due_at);

CREATE TABLE IF NOT EXISTS plan_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('review_due', 'practice_chapter', 'study_chapter', 'ask_tutor', 'custom')),
  chapter_id TEXT,
  title TEXT NOT NULL,
  reason TEXT,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'skipped')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS plan_tasks_user ON plan_tasks (user_id, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS plan_tasks_dedupe ON plan_tasks (user_id, kind, COALESCE(chapter_id, ''), due_date);

CREATE TABLE IF NOT EXISTS chapter_activity (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  last_opened_at TEXT NOT NULL,
  PRIMARY KEY (user_id, chapter_id)
);
