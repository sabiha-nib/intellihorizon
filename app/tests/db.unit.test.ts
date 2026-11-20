// SQLite -> Postgres translation used by the Supabase adapter. Every test must pass.
import { describe, expect, test } from "bun:test";

import { needsReturning, translate } from "../src/lib/db/translate";

describe("translate", () => {
  test("plain ? placeholders are numbered in order", () => {
    expect(translate("SELECT a FROM t WHERE x = ? AND y = ?")).toBe("SELECT a FROM t WHERE x = $1 AND y = $2");
  });
  test("numbered ?N placeholders keep their number (no $11 from ?1)", () => {
    expect(translate("SELECT a FROM t WHERE x = ?1 AND y = ?2 AND z = ?1")).toBe("SELECT a FROM t WHERE x = $1 AND y = $2 AND z = $1");
  });
  test("question marks inside string literals are untouched", () => {
    expect(translate("SELECT 'why?' AS q FROM t WHERE x = ?")).toBe("SELECT 'why?' AS q FROM t WHERE x = $1");
  });
  test("INSERT OR IGNORE becomes ON CONFLICT DO NOTHING", () => {
    expect(translate("INSERT OR IGNORE INTO xp_events (user_id, kind, ref) VALUES (?, ?, ?)")).toBe("INSERT INTO xp_events (user_id, kind, ref) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING");
  });
  test("INSERT OR REPLACE becomes an upsert on the table's primary key", () => {
    const s = translate("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)");
    expect(s).toBe("INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
  });
  test("mixed-case aliases are quoted so Postgres keeps their case", () => {
    expect(translate("SELECT COUNT(*) AS chaptersOpened FROM t ORDER BY chaptersOpened")).toBe('SELECT COUNT(*) AS "chaptersOpened" FROM t ORDER BY "chaptersOpened"');
  });
  test("GROUP_CONCAT with and without a separator", () => {
    expect(translate("SELECT group_concat(p.text, ' ') AS t FROM p")).toBe("SELECT string_agg(CAST(p.text AS TEXT), ' ') AS t FROM p");
    expect(translate("SELECT GROUP_CONCAT(id) AS ids FROM t")).toBe("SELECT string_agg(CAST(id AS TEXT), ',') AS ids FROM t");
  });
  test("LIKE is case-insensitive as in SQLite", () => {
    expect(translate("SELECT 1 FROM t WHERE name LIKE ?")).toBe("SELECT 1 FROM t WHERE name ILIKE $1");
  });
  test("inserts get RETURNING so last_row_id can be reported", () => {
    expect(needsReturning("INSERT INTO t (a) VALUES ($1)")).toBe(true);
    expect(needsReturning("INSERT INTO t (a) VALUES ($1) RETURNING id")).toBe(false);
    expect(needsReturning("UPDATE t SET a = $1")).toBe(false);
  });
});
