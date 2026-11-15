// Learner context: a small, explainable view of one student's evidence for the task at hand.
// Only the signed-in student's own rows are read (every query is keyed by their user id), and only what the current
// question needs: the chapter in focus, not the whole history.
import type { D1Database } from "@cloudflare/workers-types";

import { MISCONCEPTIONS } from "./lessons";

export type LearnerContext = {
  grade: number | null;
  medium: "bangla" | "english" | null;
  lang: "en" | "bn";
  chapter: { id: string; title: string } | null;
  /** Practice on this chapter in the last 30 days. */
  recent: { attempted: number; correct: number } | null;
  /** Mistake patterns seen at least twice on this chapter in the last 30 days, most frequent first. */
  misconceptions: { id: string; label: string; count: number; last: string }[];
  /** Revision items for this chapter that are due now. */
  dueRevision: number;
};

export async function learnerContext(DB: D1Database, userId: string, opts: { chapterId: string | null; grade: number | null; medium: "bangla" | "english" | null; lang: "en" | "bn" }): Promise<LearnerContext> {
  const base: LearnerContext = { grade: opts.grade, medium: opts.medium, lang: opts.lang, chapter: null, recent: null, misconceptions: [], dueRevision: 0 };
  if (!opts.chapterId) return base;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [ch, rec, mis, due] = await Promise.all([
    DB.prepare("SELECT id, title FROM chapters WHERE id = ?").bind(opts.chapterId).first<{ id: string; title: string }>(),
    DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(correct), 0) AS c FROM attempts WHERE user_id = ? AND chapter_id = ? AND created_at > ?").bind(userId, opts.chapterId, since).first<{ n: number; c: number }>(),
    DB.prepare("SELECT misconception AS id, COUNT(*) AS n, MAX(created_at) AS last FROM attempts WHERE user_id = ? AND chapter_id = ? AND correct = 0 AND misconception IS NOT NULL AND created_at > ? GROUP BY misconception HAVING COUNT(*) >= 2 ORDER BY n DESC LIMIT 3")
      .bind(userId, opts.chapterId, since).all<{ id: string; n: number; last: string }>(),
    DB.prepare("SELECT COUNT(*) AS n FROM review_state r JOIN questions q ON q.id = r.question_id WHERE r.user_id = ? AND q.chapter_id = ? AND r.due_at <= ?").bind(userId, opts.chapterId, new Date().toISOString()).first<{ n: number }>(),
  ]);
  return {
    ...base,
    chapter: ch ?? null,
    recent: rec && rec.n > 0 ? { attempted: rec.n, correct: rec.c } : null,
    misconceptions: (mis.results ?? []).map((m) => ({ id: m.id, label: MISCONCEPTIONS[m.id]?.[opts.lang] ?? m.id, count: m.n, last: m.last })),
    dueRevision: due?.n ?? 0,
  };
}
