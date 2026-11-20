// Test-only stand-in for `wrangler d1 execute DB --local [--config X] --json (--command SQL | --file F)`, running the
// SQL on the local Postgres (DATABASE_URL) through the app's own SQLite->Postgres translation. Prints the same JSON
// shape as wrangler ([{ results, success }] per statement), so the e2e tests' assertions are unchanged.
import { readFileSync } from "node:fs";
import pg from "pg";

import { translate } from "../../src/lib/db/translate";

pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
const args = process.argv.slice(2);
const at = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const sql = at("--command") ?? (at("--file") ? readFileSync(at("--file")!, "utf8") : "");
// Split on semicolons outside single-quoted strings, $$ bodies and -- comments.
function split(s: string): string[] {
  const out: string[] = []; let cur = ""; let q = false; let dollar = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!q && s.startsWith("$$", i)) { dollar = !dollar; cur += "$$"; i++; continue; }
    // -- comments run to the end of the line (a ";" inside one is not a statement end).
    if (!q && !dollar && s.startsWith("--", i)) { const nl = s.indexOf("\n", i); i = nl < 0 ? s.length : nl; cur += "\n"; continue; }
    if (!dollar && ch === "'") q = !q;
    if (!q && !dollar && ch === ";") { if (cur.trim()) out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.replace(/^(\s*--[^\n]*\n)+/g, "").trim()).filter(Boolean);
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:local-test-only@127.0.0.1:54329/postgres" });
await c.connect();
const res: { results: unknown[]; success: boolean }[] = [];
try {
  for (const st of split(sql)) {
    const r = await c.query(translate(st));
    const rows = (r.rows ?? []).map((row: Record<string, unknown>) => { for (const k in row) if (typeof row[k] === "boolean") row[k] = row[k] ? 1 : 0; return row; });
    res.push({ results: rows, success: true });
  }
} catch (e) {
  console.error((e as Error).message);
  await c.end();
  process.exit(1);
}
await c.end();
if (args.includes("--json")) console.log(JSON.stringify(res));
