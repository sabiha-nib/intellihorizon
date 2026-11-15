-- Owner choice: the first account registered after this migration runs becomes the admin.
-- Accounts that existed before are never promoted automatically.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('admin_bootstrap_open', '1');
