// A Postgres-backed implementation of the small part of Cloudflare's D1 API this app uses (prepare/bind/first/all/
// run and batch). It lets the existing server code run on Supabase Postgres unchanged: SQL is translated from the
// SQLite dialect (./translate.ts), parameters and results are normalised the way D1 returns them (integers as numbers,
// booleans as 1/0), and batch() runs as one transaction like D1's.
import pg from "pg";

import { needsReturning, translate } from "./translate";

pg.types.setTypeParser(20, (v) => Number(v)); // int8 (COUNT, BIGINT ids) -> number, as D1 returns
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric (SUM, AVG of integers) -> number

type Row = Record<string, unknown>;
type Meta = { changes: number; last_row_id: number; rows_read: number; rows_written: number; duration: number };
export type D1Result<T = Row> = { results: T[]; success: true; meta: Meta };

const cache = new Map<string, { text: string; returning: boolean }>();
function prepared(sql: string) {
  let p = cache.get(sql);
  if (!p) {
    const text = translate(sql);
    const returning = needsReturning(text);
    p = { text: returning ? `${text.replace(/[\s;]+$/, "")} RETURNING *` : text, returning };
    if (cache.size > 2000) cache.clear();
    cache.set(sql, p);
  }
  return p;
}

function param(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  // SQLite keeps NUL characters in text; Postgres rejects them. They carry no meaning in this app's text (e.g. PDF
  // extraction artefacts), so they are dropped.
  if (typeof v === "string" && v.includes("\u0000")) return v.replace(/\u0000/g, "");
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  return v;
}
function normalise(row: Row): Row {
  for (const k in row) {
    const v = row[k];
    if (typeof v === "boolean") row[k] = v ? 1 : 0;
    else if (v instanceof Buffer) row[k] = new Uint8Array(v).buffer;
  }
  return row;
}

/** Errors keep D1/SQLite wording for the cases the app checks ("UNIQUE constraint failed"). */
function d1Error(e: unknown, sql: string): Error {
  const err = e as { code?: string; message?: string; constraint?: string; table?: string; detail?: string };
  if (process.env.DB_DEBUG) console.error("[db]", err.code, err.message, "::", sql.slice(0, 400));
  if (err.code === "23505") {
    // SQLite says "UNIQUE constraint failed: profiles.username"; rebuild that from Postgres's table and key detail.
    const cols = /Key \(([^)]+)\)=/.exec(err.detail ?? "")?.[1]?.split(/,\s*/) ?? [];
    return new Error(`UNIQUE constraint failed: ${cols.length && err.table ? cols.map((c) => `${err.table}.${c}`).join(", ") : err.constraint ?? ""}`);
  }
  if (err.code === "23503") return new Error(`FOREIGN KEY constraint failed: ${err.constraint ?? ""}`);
  if (err.code === "23514") return new Error(`CHECK constraint failed: ${err.constraint ?? ""}`);
  const msg = err.message ?? String(e);
  return new Error(process.env.DB_DEBUG ? `${msg} [${sql.slice(0, 300)}]` : msg);
}

type Runner = { query: (text: string, values: unknown[]) => Promise<pg.QueryResult> };

async function exec(run: Runner, sql: string, params: unknown[]): Promise<D1Result> {
  const p = prepared(sql);
  const t0 = Date.now();
  let r: pg.QueryResult;
  try { r = await run.query(p.text, params.map(param)); } catch (e) { throw d1Error(e, p.text); }
  const rows = (r.rows as Row[]).map(normalise);
  const last = rows.length ? rows[rows.length - 1] : null;
  const id = last && typeof last.id === "number" ? last.id : 0;
  const changes = r.command === "SELECT" ? 0 : r.rowCount ?? 0;
  return { results: p.returning ? [] : rows, success: true, meta: { changes, last_row_id: id, rows_read: rows.length, rows_written: changes, duration: Date.now() - t0 } };
}

class Statement {
  constructor(private db: PgD1, readonly sql: string, readonly params: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.db, this.sql, values); }
  async all<T = Row>() { return (await exec(this.db.pool, this.sql, this.params)) as unknown as D1Result<T>; }
  async run<T = Row>() { return (await exec(this.db.pool, this.sql, this.params)) as unknown as D1Result<T>; }
  async first<T = Row>(column?: string): Promise<T | null> {
    const r = await exec(this.db.pool, this.sql, this.params);
    const row = r.results[0] as Row | undefined;
    if (!row) return null;
    return (column ? (row[column] ?? null) : row) as T;
  }
  async raw<T = unknown[]>() { const r = await exec(this.db.pool, this.sql, this.params); return r.results.map((x) => Object.values(x)) as T[]; }
}

export class PgD1 {
  constructor(readonly pool: pg.Pool) {}
  prepare(sql: string) { return new Statement(this, sql); }
  async batch(statements: Statement[]): Promise<D1Result[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const out: D1Result[] = [];
      for (const s of statements) out.push(await exec(client, s.sql, s.params));
      await client.query("COMMIT");
      return out;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
  async exec(sql: string) { await this.pool.query(sql); return { count: 1, duration: 0 }; }
}

let shared: PgD1 | null = null;
/** One pool per server instance. Supabase: use the transaction pooler URL (port 6543); no prepared statements are named. */
export function pgDatabase(url: string): PgD1 {
  if (shared) return shared;
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? false : { rejectUnauthorized: false },
  });
  pool.on("error", () => undefined);
  shared = new PgD1(pool);
  return shared;
}
