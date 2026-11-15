// Builds a student's daily plan from their own records: due revision, a weak chapter, the last chapter opened.
import type { D1Database } from "@cloudflare/workers-types";

const now = () => new Date().toISOString();

export async function buildPlan(DB: D1Database, userId: string, date: string) {
  const existing = await DB.prepare(
    "SELECT COUNT(*) AS n FROM plan_tasks WHERE user_id = ? AND due_date = ? AND kind != 'custom'",
  )
    .bind(userId, date)
    .first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) return;
  const ts = now();
  const tasks: { kind: string; chapterId: string | null; title: string; reason: string }[] = [];
  const due = await DB.prepare(
    "SELECT COUNT(*) AS n FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ? AND rs.due_at <= ? AND q.status = 'published'",
  )
    .bind(userId, date + "T23:59:59Z")
    .first<{ n: number }>();
  if ((due?.n ?? 0) > 0)
    tasks.push({
      kind: "review_due",
      chapterId: null,
      title: `review:${due!.n}`,
      reason: "review_due",
    });
  const weak = await DB.prepare(
    `SELECT a.chapter_id, c.title, COUNT(*) AS n, SUM(a.correct) AS ok FROM attempts a JOIN chapters c ON c.id = a.chapter_id
      WHERE a.user_id = ? AND a.created_at >= ? GROUP BY a.chapter_id HAVING n >= 2 AND (1.0 * ok / n) < 0.6 ORDER BY MAX(a.created_at) DESC LIMIT 1`,
  )
    .bind(userId, new Date(Date.now() - 14 * 86400000).toISOString())
    .first<{ chapter_id: string; title: string; n: number; ok: number }>();
  if (weak)
    tasks.push({
      kind: "practice_chapter",
      chapterId: weak.chapter_id,
      title: weak.title,
      reason: `weak:${weak.ok}:${weak.n}`,
    });
  const recent = await DB.prepare(
    `SELECT ca.chapter_id, c.title FROM chapter_activity ca JOIN chapters c ON c.id = ca.chapter_id WHERE ca.user_id = ? ${weak ? "AND ca.chapter_id != ?" : ""} ORDER BY ca.last_opened_at DESC LIMIT 1`,
  )
    .bind(...(weak ? [userId, weak.chapter_id] : [userId]))
    .first<{ chapter_id: string; title: string }>();
  if (recent)
    tasks.push({
      kind: "study_chapter",
      chapterId: recent.chapter_id,
      title: recent.title,
      reason: "continue",
    });
  if (tasks.length < 3)
    tasks.push({
      kind: "ask_tutor",
      chapterId: recent?.chapter_id ?? weak?.chapter_id ?? null,
      title: recent?.title ?? weak?.title ?? "",
      reason: "ask",
    });
  if (!tasks.length) return;
  await DB.batch(
    tasks.map((t) =>
      DB.prepare(
        "INSERT OR IGNORE INTO plan_tasks (id, user_id, kind, chapter_id, title, reason, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', ?)",
      ).bind(crypto.randomUUID(), userId, t.kind, t.chapterId, t.title, t.reason, date, ts),
    ),
  );
}
