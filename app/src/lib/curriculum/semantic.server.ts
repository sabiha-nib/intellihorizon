// Semantic retrieval over student-visible passages. Embeddings are stored per passage and model; the query is
// embedded at ask time and compared by cosine similarity. Only passages that pass the same trust rule as keyword
// retrieval (STUDENT_VISIBLE + scope) are ever considered. With no embedding provider this returns { active: false }.
import type { D1Database } from "@cloudflare/workers-types";

import { type EmbedConfig, cosine, embed } from "../ai/provider";
import { STUDENT_VISIBLE, type Scope, scopeSql } from "./retrieval.server";

export type SemanticResult = { active: boolean; reason?: string; hits: { id: number; sim: number }[]; indexed: number };

export async function semanticSearch(DB: D1Database, cfg: EmbedConfig | null, scope: Scope, query: string, fetcher?: typeof fetch): Promise<SemanticResult> {
  if (!cfg) return { active: false, reason: "not_configured", hits: [], indexed: 0 };
  const { sql, args } = scopeSql(scope);
  const rows = (await DB.prepare(`SELECT e.passage_id AS id, e.vec FROM passage_embeddings e JOIN passages p ON p.id = e.passage_id AND e.content_hash = p.content_hash JOIN textbooks t ON t.id = p.textbook_id WHERE e.model = ? AND ${sql}`)
    .bind(cfg.model, ...args).all<{ id: number; vec: string }>()).results ?? [];
  if (!rows.length) return { active: false, reason: "no_index", hits: [], indexed: 0 };
  const q = await embed(cfg, [query], fetcher);
  if (!q.ok) return { active: false, reason: q.code, hits: [], indexed: rows.length };
  const hits = rows.map((r) => ({ id: r.id, sim: cosine(q.vectors[0], JSON.parse(r.vec) as number[]) })).filter((h) => h.sim >= cfg.minSim).sort((a, b) => b.sim - a.sim).slice(0, 8);
  return { active: true, hits, indexed: rows.length };
}

/** Embeds student-visible passages that have no current embedding for this model. Call repeatedly until done = true. */
export async function buildEmbeddings(DB: D1Database, cfg: EmbedConfig, batch = 16, fetcher?: typeof fetch) {
  const todo = (await DB.prepare(`SELECT p.id, p.text, p.content_hash FROM passages p JOIN textbooks t ON t.id = p.textbook_id
      WHERE ${STUDENT_VISIBLE} AND NOT EXISTS (SELECT 1 FROM passage_embeddings e WHERE e.passage_id = p.id AND e.model = ? AND e.content_hash = p.content_hash) LIMIT ?`)
    .bind(cfg.model, batch).all<{ id: number; text: string; content_hash: string }>()).results ?? [];
  if (!todo.length) return { ok: true as const, embedded: 0, done: true };
  const r = await embed(cfg, todo.map((t) => t.text.slice(0, 2000)), fetcher);
  if (!r.ok) return { ok: false as const, code: r.code };
  const now = new Date().toISOString();
  await DB.batch(todo.map((t, i) => DB.prepare("INSERT OR REPLACE INTO passage_embeddings (passage_id, model, dim, content_hash, vec, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(t.id, cfg.model, r.vectors[i].length, t.content_hash, JSON.stringify(r.vectors[i].map((x) => Math.round(x * 1e5) / 1e5)), now)));
  return { ok: true as const, embedded: todo.length, done: todo.length < batch };
}
