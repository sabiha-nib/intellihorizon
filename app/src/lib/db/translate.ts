// Translates the app's SQLite/D1-dialect SQL to Postgres. Pure and unit-tested. Only constructs the app actually uses
// are handled; string literals are never modified.
import { PRIMARY_KEYS } from "./primary-keys";

/** Splits SQL into alternating [code, 'literal', code, ...] segments (single-quoted strings with '' escapes). */
function segments(sql: string): string[] {
  return sql.split(/('(?:[^']|'')*')/);
}
const mapCode = (sql: string, fn: (code: string) => string) => segments(sql).map((s, i) => (i % 2 ? s : fn(s))).join("");

function withSuffix(sql: string, suffix: string): string {
  const m = /\bRETURNING\b/i.exec(sql);
  return m ? `${sql.slice(0, m.index)}${suffix} ${sql.slice(m.index)}` : `${sql.replace(/[\s;]+$/, "")}${suffix}`;
}

export function translate(sqlIn: string): string {
  let sql = sqlIn;
  // INSERT OR IGNORE -> ON CONFLICT DO NOTHING
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql)) {
    sql = withSuffix(sql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO"), " ON CONFLICT DO NOTHING");
  }
  // INSERT OR REPLACE INTO t (cols) -> ON CONFLICT (pk) DO UPDATE SET col = EXCLUDED.col
  const rep = /^\s*INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]*)\)/i.exec(sql);
  if (rep) {
    const table = rep[1];
    const cols = rep[2].split(",").map((c) => c.trim());
    const pk = PRIMARY_KEYS[table];
    if (!pk?.length) throw new Error(`translate: no primary key known for ${table}`);
    const rest = cols.filter((c) => !pk.includes(c));
    sql = sql.replace(/^\s*INSERT\s+OR\s+REPLACE\s+INTO\b/i, "INSERT INTO");
    sql = withSuffix(sql, rest.length ? ` ON CONFLICT (${pk.join(", ")}) DO UPDATE SET ${rest.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}` : ` ON CONFLICT (${pk.join(", ")}) DO NOTHING`);
  }
  // GROUP_CONCAT(expr, 'sep') -> string_agg(CAST(expr AS TEXT), 'sep') (the separator is a string literal, so this runs
  // before code/literal splitting). The one-argument form is handled below.
  sql = sql.replace(/\bGROUP_CONCAT\s*\(\s*([^(),']+?)\s*,\s*('(?:[^']|'')*')\s*\)/gi, "string_agg(CAST($1 AS TEXT), $2)");
  // Mixed-case output aliases: Postgres folds unquoted names to lower case, SQLite keeps them. Quote the alias and every
  // later bare use of it (ORDER BY, HAVING).
  const aliases = new Set<string>();
  mapCode(sql, (code) => { for (const m of code.matchAll(/\bAS\s+([A-Za-z_]\w*)/gi)) if (/[A-Z]/.test(m[1]) && !/^[A-Z_]+$/.test(m[1])) aliases.add(m[1]); return code; });
  let n = 0;
  sql = mapCode(sql, (code) => {
    // SQLite numbered parameters (?1, ?2) keep their number; plain ? are numbered in order.
    let c = code.replace(/\?(\d+)?/g, (_m, d: string | undefined) => (d ? `$${d}` : `$${++n}`));
    c = c.replace(/\bLIKE\b/g, "ILIKE").replace(/\blike\b/g, "ILIKE");
    c = c.replace(/\bGROUP_CONCAT\s*\(\s*([^(),]+)\s*\)/gi, "string_agg(CAST($1 AS TEXT), ',')");
    for (const a of aliases) c = c.replace(new RegExp(`(?<![."\\w])${a}(?![\\w"])`, "g"), `"${a}"`);
    return c;
  });
  return sql;
}

/** Whether a statement is an INSERT without RETURNING (we add RETURNING * to report last_row_id like D1). */
export function needsReturning(sql: string): boolean {
  return /^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql);
}
