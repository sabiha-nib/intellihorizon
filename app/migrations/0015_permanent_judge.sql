-- Phase 6: judge access no longer expires. Additive: one new nullable column and an index. The UPDATE only clears the
-- old 24-hour end time on judge-demo workspaces (no data is deleted); student accounts are untouched.
-- A judge's browser keeps a random "resume" token (only its SHA-256 hash is stored here), so signing in again with the
-- judge credential on the same browser returns to the same workspace; another browser gets its own workspace.
ALTER TABLE users ADD COLUMN demo_resume_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_demo_resume ON users (demo_resume_hash) WHERE demo_resume_hash IS NOT NULL;
UPDATE users SET demo_expires_at = NULL WHERE is_demo = 1;
