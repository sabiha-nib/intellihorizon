// IntelliQuiz: practice sets with modes, navigation, deferred or immediate feedback and post-practice analysis.
// Questions are chosen on the server from published questions only. Every graded answer goes through recordAttempt
// (the same path as Learning Sessions) with a per-set event id, so XP, revision scheduling and mistake records stay
// server-decided and can't be paid twice.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { currentUser, rateLimit, sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { localDay, recordAttempt, rebrand } from "../learning/engine.server";
import { EXAM_SECONDS_PER_QUESTION, QUIZ_MODES, analyseQuiz, feedbackFor, pickQuiz, type History, type QuizMode } from "../learning/quiz";
import { displayAnswer } from "../learning/rules";

type Fail = { ok: false; code: string };
const fail = (code: string): Fail => ({ ok: false, code });
const now = () => new Date().toISOString();
const GRACE_SEC = 30;

async function guard(mutation: boolean) {
  const { DB } = bindings();
  if (!DB) return { error: fail("unavailable_now") } as const;
  if (mutation && !sameOrigin()) return { error: fail("bad_origin") } as const;
  const me = await currentUser();
  if (!me) return { error: fail("signed_out") } as const;
  return { DB, me, error: null } as const;
}

type QRow = { id: string; chapter_id: string; type: "mcq" | "numeric" | "short"; answer_kind: string | null; prompt: string; options: string | null; hint: string | null; unit: string | null; language: string; source: string; provenance: string | null; skill: string | null; difficulty: number | null; answer: string; explanation: string | null; source_page: number | null; misconceptions: string | null };

/** What a question's origin is, said plainly. There are no AI-generated questions in the bank yet; if any are added they carry their own label. */
function origin(q: QRow): "textbook_exercise" | "intellihorizon_reviewed" | "ai_generated" {
  if (q.source === "textbook_exercise") return "textbook_exercise";
  if (q.source === "ai_generated") return "ai_generated";
  return "intellihorizon_reviewed";
}
function toClient(q: QRow) {
  let prov: Record<string, unknown> = {};
  try { prov = q.provenance ? JSON.parse(rebrand(q.provenance)) : {}; } catch { prov = {}; }
  return {
    id: q.id, type: q.type, answerKind: q.answer_kind, prompt: q.prompt, options: q.options ? (JSON.parse(q.options) as { id: string; text: string }[]) : null,
    hint: q.hint, unit: q.unit, language: q.language, skill: q.skill, difficulty: q.difficulty, origin: origin(q),
    printedPage: typeof prov.printedPage === "number" ? prov.printedPage : null, exercise: typeof prov.exercise === "string" ? prov.exercise : null,
  };
}
export type QuizQuestion = ReturnType<typeof toClient>;
const feedbackOf = (q: QRow) => ({ correctAnswer: displayAnswer(q as never), explanation: q.explanation });

const SELECT_Q = "SELECT id, chapter_id, type, answer_kind, prompt, options, hint, unit, language, source, provenance, skill, difficulty, answer, explanation, source_page, misconceptions FROM questions WHERE status = 'published'";

async function history(DB: D1, userId: string): Promise<History> {
  const rows = (await DB.prepare("SELECT question_id, correct, created_at FROM attempts WHERE user_id = ? ORDER BY id").bind(userId).all<{ question_id: string; correct: number }>()).results ?? [];
  const due = new Set(((await DB.prepare("SELECT question_id FROM review_state WHERE user_id = ? AND due_at <= ?").bind(userId, now()).all<{ question_id: string }>()).results ?? []).map((r) => r.question_id));
  const h: History = new Map();
  for (const r of rows) {
    const x = h.get(r.question_id) ?? { wrong: 0, correct: 0, due: due.has(r.question_id), lastCorrect: false };
    if (r.correct) x.correct++; else x.wrong++;
    x.lastCorrect = !!r.correct;
    h.set(r.question_id, x);
  }
  return h;
}
type D1 = NonNullable<ReturnType<typeof bindings>["DB"]>;

/* ─────────── Home: what each mode can offer right now ─────────── */

export const quizHome = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const [chapters, topics, recent] = await Promise.all([
    g.DB.prepare(`SELECT c.id, c.position, c.title, t.subject_key, t.title AS book, COUNT(q.id) AS n FROM questions q JOIN chapters c ON c.id = q.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE q.status = 'published' GROUP BY c.id ORDER BY t.subject_key, c.position`).all<{ id: string; position: number; title: string; subject_key: string; book: string; n: number }>(),
    g.DB.prepare(`SELECT tp.id, tp.title, tp.title_en, tp.skill, tp.chapter_id, (SELECT COUNT(*) FROM questions q WHERE q.status = 'published' AND q.chapter_id = tp.chapter_id AND q.skill = tp.skill) AS n FROM topics tp WHERE tp.review_status IN ('checked', 'teacher_reviewed') ORDER BY tp.chapter_id, tp.position`).all<{ id: string; title: string; title_en: string | null; skill: string | null; chapter_id: string; n: number }>(),
    g.DB.prepare("SELECT id, mode, status, started_at, submitted_at, result FROM quiz_sets WHERE user_id = ? ORDER BY started_at DESC LIMIT 10").bind(g.me.id).all<{ id: string; mode: string; status: string; started_at: string; submitted_at: string | null; result: string | null }>(),
  ]);
  const h = await history(g.DB, g.me.id);
  const mistakes = [...h.values()].filter((x) => !x.lastCorrect).length;
  const daily = await g.DB.prepare("SELECT id, status FROM quiz_sets WHERE user_id = ? AND mode = 'daily' AND day = ?").bind(g.me.id, localDay()).first<{ id: string; status: string }>();
  return {
    ok: true as const,
    chapters: chapters.results ?? [],
    topics: (topics.results ?? []).filter((t) => t.n > 0),
    mistakes,
    daily: daily ?? null,
    total: (chapters.results ?? []).reduce((n, c) => n + c.n, 0),
    recent: (recent.results ?? []).map((r) => {
      const res = r.result ? (JSON.parse(r.result) as { correct: number; total: number; attempted: number }) : null;
      return { id: r.id, mode: r.mode, status: r.status, startedAt: r.started_at, submittedAt: r.submitted_at, correct: res?.correct ?? null, attempted: res?.attempted ?? null, total: res?.total ?? null };
    }),
  };
});

/* ─────────── Start ─────────── */

export const startQuiz = createServerFn({ method: "POST" })
  .inputValidator(z.object({ mode: z.enum(QUIZ_MODES), chapterId: z.string().uuid().nullable().default(null), topicId: z.string().uuid().nullable().default(null), count: z.number().int().min(3).max(30).default(5) }))
  .handler(async ({ data }) => {
    const g = await guard(true);
    if (g.error) return g.error;
    if (!(await rateLimit(`quiz:${g.me.id}`, 60, 3600))) return fail("rate_limited");
    const mode = data.mode as QuizMode;
    const day = localDay();
    if (mode === "daily") {
      const existing = await g.DB.prepare("SELECT id FROM quiz_sets WHERE user_id = ? AND mode = 'daily' AND day = ?").bind(g.me.id, day).first<{ id: string }>();
      if (existing) return { ok: true as const, id: existing.id, resumed: true };
    }
    let skill: string | null = null;
    let chapterId = data.chapterId;
    if (mode === "topic") {
      if (!data.topicId) return fail("topic_required");
      const t = await g.DB.prepare("SELECT chapter_id, skill FROM topics WHERE id = ? AND review_status IN ('checked', 'teacher_reviewed')").bind(data.topicId).first<{ chapter_id: string; skill: string | null }>();
      if (!t || !t.skill) return fail("no_questions");
      skill = t.skill;
      chapterId = t.chapter_id;
    }
    if (mode === "chapter" && !chapterId) return fail("chapter_required");
    const pool = (await g.DB.prepare(`SELECT id, difficulty, skill, chapter_id FROM questions WHERE status = 'published' ${chapterId ? "AND chapter_id = ?" : ""}`).bind(...(chapterId ? [chapterId] : [])).all<{ id: string; difficulty: number | null; skill: string | null; chapter_id: string }>()).results ?? [];
    const count = mode === "daily" ? 5 : data.count;
    const ids = pickQuiz(mode, pool, await history(g.DB, g.me.id), count, () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32, { skill });
    if (!ids.length) return fail(mode === "mistakes" ? "no_mistakes" : mode === "weakness" ? "no_weakness" : "no_questions");
    const id = crypto.randomUUID();
    try {
      await g.DB.prepare("INSERT INTO quiz_sets (id, user_id, mode, chapter_id, topic_id, question_ids, feedback, time_limit_sec, status, day, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)")
        .bind(id, g.me.id, mode, chapterId, data.topicId, JSON.stringify(ids), feedbackFor(mode), mode === "exam" ? ids.length * EXAM_SECONDS_PER_QUESTION : null, mode === "daily" ? day : null, now()).run();
    } catch {
      // Two Daily Five requests at once: the unique index keeps one; return it.
      const existing = await g.DB.prepare("SELECT id FROM quiz_sets WHERE user_id = ? AND mode = 'daily' AND day = ?").bind(g.me.id, day).first<{ id: string }>();
      if (existing) return { ok: true as const, id: existing.id, resumed: true };
      return fail("unavailable_now");
    }
    return { ok: true as const, id, resumed: false };
  });

/* ─────────── Read a set ─────────── */

async function loadSet(DB: D1, userId: string, id: string) {
  return DB.prepare("SELECT * FROM quiz_sets WHERE id = ? AND user_id = ?").bind(id, userId).first<{ id: string; mode: QuizMode; chapter_id: string | null; topic_id: string | null; question_ids: string; feedback: "immediate" | "deferred"; time_limit_sec: number | null; status: "active" | "submitted"; started_at: string; submitted_at: string | null; result: string | null }>();
}
async function loadQuestions(DB: D1, ids: string[]) {
  if (!ids.length) return new Map<string, QRow>();
  const rows = (await DB.prepare(`${SELECT_Q.replace("WHERE status = 'published'", "WHERE 1 = 1")} AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<QRow>()).results ?? [];
  return new Map(rows.map((r) => [r.id, r]));
}
const secondsLeft = (s: { time_limit_sec: number | null; started_at: string }) => (s.time_limit_sec ? Math.max(0, Math.round(s.time_limit_sec - (Date.now() - Date.parse(s.started_at)) / 1000)) : null);

export const getQuiz = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard(false);
    if (g.error) return g.error;
    const s = await loadSet(g.DB, g.me.id, data.id);
    if (!s) return fail("not_found");
    const ids = JSON.parse(s.question_ids) as string[];
    const qs = await loadQuestions(g.DB, ids);
    const resp = new Map(((await g.DB.prepare("SELECT question_id, response, flagged, graded FROM quiz_responses WHERE set_id = ?").bind(s.id).all<{ question_id: string; response: string | null; flagged: number; graded: number }>()).results ?? []).map((r) => [r.question_id, r]));
    const att = new Map(((await g.DB.prepare("SELECT question_id, correct, misconception FROM attempts WHERE user_id = ? AND client_event_id LIKE ?").bind(g.me.id, `quiz:${s.id}:%`).all<{ question_id: string; correct: number; misconception: string | null }>()).results ?? []).map((r) => [r.question_id, r]));
    const showFeedback = (qid: string) => s.status === "submitted" || (s.feedback === "immediate" && !!resp.get(qid)?.graded);
    return {
      ok: true as const,
      set: { id: s.id, mode: s.mode, feedback: s.feedback, status: s.status, startedAt: s.started_at, submittedAt: s.submitted_at, secondsLeft: s.status === "active" ? secondsLeft(s) : null, timeLimit: s.time_limit_sec },
      questions: ids.filter((id) => qs.has(id)).map((id) => {
        const q = qs.get(id)!;
        const r = resp.get(id);
        const a = att.get(id);
        return { ...toClient(q), response: r?.response ?? null, flagged: !!r?.flagged, result: showFeedback(id) && a ? { correct: !!a.correct, misconception: a.misconception, ...feedbackOf(q) } : null };
      }),
      result: s.result ? JSON.parse(s.result) : null,
    };
  });

/* ─────────── Answer, flag ─────────── */

export const answerQuiz = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), questionId: z.string().min(1).max(80), response: z.string().max(200).nullable(), flagged: z.boolean().default(false), check: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    const g = await guard(true);
    if (g.error) return g.error;
    if (!(await rateLimit(`quiz-answer:${g.me.id}`, 600, 3600))) return fail("rate_limited");
    const s = await loadSet(g.DB, g.me.id, data.id);
    if (!s) return fail("not_found");
    if (s.status !== "active") return fail("already_submitted");
    if (!(JSON.parse(s.question_ids) as string[]).includes(data.questionId)) return fail("not_in_set");
    const left = secondsLeft(s);
    if (left !== null && left <= 0 && (Date.now() - Date.parse(s.started_at)) / 1000 > (s.time_limit_sec ?? 0) + GRACE_SEC) return fail("time_up");
    const prior = await g.DB.prepare("SELECT graded FROM quiz_responses WHERE set_id = ? AND question_id = ?").bind(s.id, data.questionId).first<{ graded: number }>();
    // In immediate mode a checked answer is final; flags can still change.
    const locked = !!prior?.graded;
    const response = data.response?.normalize("NFC").trim() || null;
    await g.DB.prepare(`INSERT INTO quiz_responses (set_id, question_id, response, flagged, graded, updated_at) VALUES (?, ?, ?, ?, 0, ?)
      ON CONFLICT (set_id, question_id) DO UPDATE SET response = CASE WHEN quiz_responses.graded = 1 THEN quiz_responses.response ELSE excluded.response END, flagged = excluded.flagged, updated_at = excluded.updated_at`)
      .bind(s.id, data.questionId, response, data.flagged ? 1 : 0, now()).run();
    if (s.feedback === "immediate" && data.check && response && !locked) {
      const r = await recordAttempt(g.DB, g.me.id, { questionId: data.questionId, response, confidence: null, mode: "practice", clientEventId: `quiz:${s.id}:${data.questionId}`, sessionId: null });
      if (!r.ok) return r;
      await g.DB.prepare("UPDATE quiz_responses SET graded = 1 WHERE set_id = ? AND question_id = ?").bind(s.id, data.questionId).run();
      return { ok: true as const, saved: true, result: { correct: r.correct, misconception: r.misconception, correctAnswer: r.correctAnswer, explanation: r.explanation ?? null }, xp: r.xp.gained };
    }
    return { ok: true as const, saved: true, result: null, xp: 0 };
  });

/* ─────────── Submit ─────────── */

export const submitQuiz = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard(true);
    if (g.error) return g.error;
    const s = await loadSet(g.DB, g.me.id, data.id);
    if (!s) return fail("not_found");
    if (s.status === "submitted" && s.result) return { ok: true as const, result: JSON.parse(s.result), already: true };
    const ids = JSON.parse(s.question_ids) as string[];
    const qs = await loadQuestions(g.DB, ids);
    const resp = new Map(((await g.DB.prepare("SELECT question_id, response, flagged, graded FROM quiz_responses WHERE set_id = ?").bind(s.id).all<{ question_id: string; response: string | null; flagged: number; graded: number }>()).results ?? []).map((r) => [r.question_id, r]));
    let xp = 0;
    // Grade every saved, not-yet-graded answer. The per-set event id makes this safe to repeat.
    for (const qid of ids) {
      const r = resp.get(qid);
      if (!r?.response || r.graded) continue;
      const a = await recordAttempt(g.DB, g.me.id, { questionId: qid, response: r.response, confidence: null, mode: "practice", clientEventId: `quiz:${s.id}:${qid}`, sessionId: null });
      if (a.ok) xp += a.xp.gained;
    }
    await g.DB.prepare("UPDATE quiz_responses SET graded = 1 WHERE set_id = ? AND response IS NOT NULL").bind(s.id).run();
    const att = new Map(((await g.DB.prepare("SELECT question_id, correct, misconception FROM attempts WHERE user_id = ? AND client_event_id LIKE ?").bind(g.me.id, `quiz:${s.id}:%`).all<{ question_id: string; correct: number; misconception: string | null }>()).results ?? []).map((r) => [r.question_id, r]));
    const analysis = analyseQuiz(ids.filter((id) => qs.has(id)).map((id) => {
      const q = qs.get(id)!;
      const a = att.get(id);
      return { questionId: id, skill: q.skill, difficulty: q.difficulty, correct: a ? !!a.correct : null, misconception: a?.misconception ?? null, flagged: !!resp.get(id)?.flagged };
    }));
    const ts = now();
    // Time is measured by the server from start to submission, so it is reported; per-question time is not measured.
    const result = { ...analysis, seconds: Math.round((Date.parse(ts) - Date.parse(s.started_at)) / 1000), xp, mode: s.mode };
    await g.DB.prepare("UPDATE quiz_sets SET status = 'submitted', submitted_at = ?, result = ? WHERE id = ? AND user_id = ? AND status = 'active'").bind(ts, JSON.stringify(result), s.id, g.me.id).run();
    const stored = await loadSet(g.DB, g.me.id, s.id);
    return { ok: true as const, result: stored?.result ? JSON.parse(stored.result) : result, already: false };
  });
