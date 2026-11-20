// Applies supabase/migrations/*.sql in order to a Postgres database (local tests, or a fresh Supabase project).
// Tracks applied files in ih_migrations. Usage: DATABASE_URL=... node migrate.mjs <dir> [--fresh]
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
const dir = process.argv[2];
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
if (process.argv.includes("--fresh")) await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;");
for (const r of ["anon", "authenticated"]) await c.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${r}') THEN CREATE ROLE ${r} NOLOGIN; END IF; END $$;`);
await c.query("CREATE TABLE IF NOT EXISTS ih_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
const done = new Set((await c.query("SELECT name FROM ih_migrations")).rows.map((r) => r.name));
let n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  if (done.has(f)) continue;
  await c.query("BEGIN");
  try { await c.query(readFileSync(`${dir}/${f}`, "utf8")); await c.query("INSERT INTO ih_migrations VALUES ($1, $2)", [f, new Date().toISOString()]); await c.query("COMMIT"); n++; }
  catch (e) { await c.query("ROLLBACK"); console.error("FAILED", f, e.message); process.exit(1); }
}
console.log(`MIGRATED ${n} new, ${done.size} already applied`);
await c.end();
