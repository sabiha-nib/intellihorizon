import { createServerFn } from "@tanstack/react-start";
import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";

import { currentUser, rateLimit, sameOrigin } from "../auth/session.server";
import { awardXp, grantAchievements, recordAttempt } from "../learning/engine.server";
import { buildPlan } from "../learning/plan.server";
import { bindings } from "../bindings.server";
import { ACTIVE_VERSION } from "../curriculum/config";
import { STUDENT_VISIBLE } from "../curriculum/retrieval.server";
import { catalog, clientToday, isoDate, studentContext, type CatalogBook } from "../curriculum/student.server";

import { SUBJECTS, SUBJECT_IDS, SUPPORTED_GRADES, offeringFor, subjectById } from "../curriculum/registry";

type Fail = { ok: false; code: string };
const fail = (code: string): Fail => ({ ok: false, code });
const now = () => new Date().toISOString();

async function guard(mutation = true) {
  const { DB } = bindings();
  if (!DB) return { error: fail("unavailable_now") } as const;
  if (mutation && !sameOrigin()) return { error: fail("bad_origin") } as const;
  const me = await currentUser();
  if (!me) return { error: fail("signed_out") } as const;
  return { DB, me, error: null } as const;
}

/* ─────────── Curriculum explorer (catalogue data is public; activity is the student's own) ─────────── */

export const getCatalog = createServerFn({ method: "POST" })
  .inputValidator(z.object({ grade: z.number().int().min(1).max(12).nullable(), medium: z.enum(["bangla", "english"]).nullable() }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    const me = await currentUser();
    const ctx = me ? await studentContext(DB, me.id) : null;
    // Only registered offerings are browsable. Today that is Class 7 (Bangla medium, and English version without books).
    const grade = data.grade ?? (ctx?.grade && SUPPORTED_GRADES.includes(ctx.grade) ? ctx.grade : SUPPORTED_GRADES[0]);
    const medium = data.medium ?? ctx?.medium ?? "bangla";
    const offering = offeringFor(grade, medium);
    const books: CatalogBook[] = offering ? await catalog(DB, grade, medium) : [];
    const subjects = SUBJECTS.map((s) => ({ id: s.id, label: s.label, short: s.short, hue: s.hue, books: books.filter((b) => b.subject_key === s.id) }));
    return { ok: true as const, grade, medium, offering, supportedGrades: SUPPORTED_GRADES, profileGrade: ctx?.grade ?? null, profileCurriculum: ctx?.curriculum ?? null, subjects, books };
  });

/** One subject: its books (Bangla 1st Paper has two), chapters, and the signed-in student's own activity in it. */
export const getSubject = createServerFn({ method: "POST" })
  .inputValidator(z.object({ subjectId: z.enum(SUBJECT_IDS), medium: z.enum(["bangla", "english"]).nullable().default(null) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    const subject = subjectById(data.subjectId)!;
    const me = await currentUser();
    const ctx = me ? await studentContext(DB, me.id) : null;
    const grade = ctx?.grade && SUPPORTED_GRADES.includes(ctx.grade) ? ctx.grade : SUPPORTED_GRADES[0];
    const medium = data.medium ?? ctx?.medium ?? "bangla";
    const offering = offeringFor(grade, medium);
    const books = (offering ? await catalog(DB, grade, medium) : []).filter((b) => b.subject_key === subject.id);
    const ids = books.map((b) => b.id);
    const chapters = ids.length
      ? (await DB.prepare(
          `SELECT c.id, c.textbook_id, c.position, c.label, c.title, c.start_page, c.end_page,
                  (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published') AS questions
             FROM chapters c WHERE c.textbook_id IN (${ids.map(() => "?").join(",")}) ORDER BY c.textbook_id, c.position`,
        ).bind(...ids).all<{ id: string; textbook_id: string; position: number; label: string | null; title: string; start_page: number | null; end_page: number | null; questions: number }>()).results ?? []
      : [];
    let mine: { attempts: number; correct: number; due: number; threads: number; saved: number; opened: string[]; stats: Record<string, { attempts: number; correct: number; last: string }> } | null = null;
    if (me) {
      const stats = await myChapterStats(DB, me.id, chapters.map((c) => c.id));
      const [due, threads, saved, opened] = await Promise.all([
        DB.prepare("SELECT COUNT(*) AS n FROM review_state rs JOIN questions q ON q.id = rs.question_id JOIN chapters c ON c.id = q.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE rs.user_id = ? AND rs.due_at <= ? AND t.subject_key = ?").bind(me.id, now(), subject.id).first<{ n: number }>(),
        DB.prepare("SELECT COUNT(*) AS n FROM tutor_threads th LEFT JOIN textbooks t ON t.id = th.textbook_id WHERE th.user_id = ? AND COALESCE(th.subject_key, t.subject_key) = ?").bind(me.id, subject.id).first<{ n: number }>(),
        DB.prepare("SELECT COUNT(*) AS n FROM saved_items WHERE user_id = ? AND subject_key = ?").bind(me.id, subject.id).first<{ n: number }>(),
        ids.length ? DB.prepare(`SELECT ca.chapter_id FROM chapter_activity ca JOIN chapters c ON c.id = ca.chapter_id WHERE ca.user_id = ? AND c.textbook_id IN (${ids.map(() => "?").join(",")})`).bind(me.id, ...ids).all<{ chapter_id: string }>() : Promise.resolve({ results: [] as { chapter_id: string }[] }),
      ]);
      const all = [...stats.values()];
      mine = {
        attempts: all.reduce((n, x) => n + x.attempts, 0), correct: all.reduce((n, x) => n + x.correct, 0), due: due?.n ?? 0, threads: threads?.n ?? 0, saved: saved?.n ?? 0,
        opened: (opened.results ?? []).map((r) => r.chapter_id), stats: Object.fromEntries(stats),
      };
    }
    return { ok: true as const, subject, grade, medium, offering, books, chapters, mine };
  });

type ChapterRow = { id: string; textbook_id: string; position: number; label: string | null; title: string; start_page: number | null; end_page: number | null; objectives: number; questions: number };

async function myChapterStats(DB: D1Database, userId: string, chapterIds: string[]) {
  if (!chapterIds.length) return new Map<string, { attempts: number; correct: number; last: string }>();
  const r = await DB.prepare(`SELECT chapter_id, COUNT(*) AS attempts, SUM(correct) AS correct, MAX(created_at) AS last FROM attempts WHERE user_id = ? AND chapter_id IN (${chapterIds.map(() => "?").join(",")}) GROUP BY chapter_id`)
    .bind(userId, ...chapterIds).all<{ chapter_id: string; attempts: number; correct: number; last: string }>();
  return new Map((r.results ?? []).map((x) => [x.chapter_id, { attempts: x.attempts, correct: x.correct, last: x.last }]));
}

export const getBook = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    const book = await DB.prepare("SELECT id, grade, medium, subject_key, subject_name, paper, title, language, publisher, edition, official_url, license_status, status, page_count, page_offset FROM textbooks WHERE id = ? AND status != 'retired'")
      .bind(data.id).first<CatalogBook & { publisher: string; page_offset: number | null }>();
    if (!book) return fail("not_found");
    const ch = await DB.prepare(
      `SELECT c.id, c.textbook_id, c.position, c.label, c.title, c.start_page, c.end_page,
              (SELECT COUNT(*) FROM objectives o WHERE o.chapter_id = c.id) AS objectives,
              (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published') AS questions
         FROM chapters c WHERE c.textbook_id = ? ORDER BY c.position`,
    ).bind(data.id).all<ChapterRow>();
    const chapters = ch.results ?? [];
    const me = await currentUser();
    const stats = me ? await myChapterStats(DB, me.id, chapters.map((c) => c.id)) : new Map();
    return { ok: true as const, book, chapters: chapters.map((c) => ({ ...c, mine: stats.get(c.id) ?? null })) };
  });

export const getChapter = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    const c = await DB.prepare(
      `SELECT c.id, c.textbook_id, c.position, c.label, c.title, c.start_page, c.end_page, t.title AS book_title, t.subject_key, t.subject_name, t.paper, t.grade, t.medium,
              t.language, t.status AS book_status, t.official_url, t.page_offset, t.license_status,
              (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published') AS questions,
              (SELECT COUNT(*) FROM passages p WHERE p.textbook_id = c.textbook_id AND p.page BETWEEN c.start_page AND c.end_page) AS passages,
              (SELECT COUNT(*) FROM passages p WHERE p.textbook_id = c.textbook_id AND p.page BETWEEN c.start_page AND c.end_page AND ${STUDENT_VISIBLE}) AS searchable
         FROM chapters c JOIN textbooks t ON t.id = c.textbook_id WHERE c.id = ? AND t.status != 'retired'`,
    ).bind(data.id).first<Record<string, string | number | null>>();
    if (!c) return fail("not_found");
    const obj = await DB.prepare("SELECT id, position, text, source_page, bloom FROM objectives WHERE chapter_id = ? ORDER BY position").bind(data.id)
      .all<{ id: string; position: number; text: string; source_page: number | null; bloom: string | null }>();
    const siblings = await DB.prepare("SELECT id, position, title FROM chapters WHERE textbook_id = ? ORDER BY position").bind(c.textbook_id as string).all<{ id: string; position: number; title: string }>();
    const me = await currentUser();
    const stats = me ? (await myChapterStats(DB, me.id, [data.id])).get(data.id) ?? null : null;
    return { ok: true as const, chapter: c, objectives: obj.results ?? [], siblings: siblings.results ?? [], mine: stats, signedIn: !!me };
  });

export const markChapterOpened = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const ok = await g.DB.prepare("SELECT id FROM chapters WHERE id = ?").bind(data.chapterId).first();
    if (!ok) return fail("not_found");
    await g.DB.prepare("INSERT INTO chapter_activity (user_id, chapter_id, last_opened_at) VALUES (?, ?, ?) ON CONFLICT (user_id, chapter_id) DO UPDATE SET last_opened_at = excluded.last_opened_at")
      .bind(g.me.id, data.chapterId, now()).run();
    const xp = await awardXp(g.DB, g.me.id, "chapter_opened", data.chapterId, null);
    if (xp) await grantAchievements(g.DB, g.me.id);
    return { ok: true as const, xp };
  });

/* ─────────── Practice: answer keys never leave the server until after an attempt ─────────── */

export type PracticeQuestion = { id: string; chapterId: string; type: "mcq" | "numeric" | "short"; prompt: string; options: { id: string; text: string }[] | null; source: string; sourcePage: number | null; bloom: string | null; difficulty: number | null; language: string; why: string };

type QRow = { id: string; chapter_id: string; type: "mcq" | "numeric" | "short"; prompt: string; options: string | null; source: string; source_page: number | null; bloom: string | null; difficulty: number | null; language: string };
const toPQ = (q: QRow, why: string): PracticeQuestion => ({ id: q.id, chapterId: q.chapter_id, type: q.type, prompt: q.prompt, options: q.options ? JSON.parse(q.options) : null, source: q.source, sourcePage: q.source_page, bloom: q.bloom, difficulty: q.difficulty, language: q.language, why });

export const getPracticeSet = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid().nullable(), review: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    const g = await guard(false);
    if (g.error) return g.error;
    if (data.review) {
      const r = await g.DB.prepare(
        `SELECT q.id, q.chapter_id, q.type, q.prompt, q.options, q.source, q.source_page, q.bloom, q.difficulty, q.language, rs.box, rs.last_correct, rs.last_at
           FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ? AND rs.due_at <= ? AND q.status = 'published' ORDER BY rs.due_at LIMIT 15`,
      ).bind(g.me.id, now()).all<QRow & { box: number; last_correct: number; last_at: string }>();
      return { ok: true as const, questions: (r.results ?? []).map((q) => toPQ(q, q.last_correct ? `review_correct:${q.box}` : "review_wrong")) };
    }
    if (!data.chapterId) return fail("chapter_required");
    const r = await g.DB.prepare(
      `SELECT q.id, q.chapter_id, q.type, q.prompt, q.options, q.source, q.source_page, q.bloom, q.difficulty, q.language,
              (SELECT COUNT(*) FROM attempts a WHERE a.user_id = ? AND a.question_id = q.id) AS tries,
              (SELECT a.correct FROM attempts a WHERE a.user_id = ? AND a.question_id = q.id ORDER BY a.id DESC LIMIT 1) AS last_correct
         FROM questions q WHERE q.chapter_id = ? AND q.status = 'published'`,
    ).bind(g.me.id, g.me.id, data.chapterId).all<QRow & { tries: number; last_correct: number | null }>();
    const rows = r.results ?? [];
    // Unseen first, then ones answered wrong last time, then the rest; easier before harder within each group.
    const order = (q: (typeof rows)[number]) => (q.tries === 0 ? 0 : q.last_correct === 0 ? 1 : 2) * 10 + (q.difficulty ?? 2);
    rows.sort((a, b) => order(a) - order(b));
    return { ok: true as const, questions: rows.slice(0, 10).map((q) => toPQ(q, q.tries === 0 ? "new" : q.last_correct === 0 ? "retry" : "again")) };
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ questionId: z.string().uuid(), response: z.string().max(500), confidence: z.number().int().min(1).max(3).nullable(), mode: z.enum(["practice", "review"]), clientEventId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/).nullable().default(null) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    if (!(await rateLimit(`answer:${g.me.id}`, 240, 3600))) return fail("rate_limited");
    return recordAttempt(g.DB, g.me.id, { ...data, sessionId: null });
  });

/* ─────────── Learning plan ─────────── */

type Task = { id: string; kind: string; chapter_id: string | null; title: string; reason: string | null; due_date: string; status: string; chapter_title: string | null };

async function planFor(DB: D1Database, userId: string, date: string): Promise<Task[]> {
  const r = await DB.prepare(
    `SELECT pt.id, pt.kind, pt.chapter_id, pt.title, pt.reason, pt.due_date, pt.status, c.title AS chapter_title FROM plan_tasks pt LEFT JOIN chapters c ON c.id = pt.chapter_id
      WHERE pt.user_id = ? AND (pt.due_date = ? OR (pt.due_date < ? AND pt.status = 'todo')) ORDER BY pt.due_date, pt.created_at`,
  ).bind(userId, date, date).all<Task>();
  return r.results ?? [];
}

export const getPlan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ date: z.string().max(10) }))
  .handler(async ({ data }) => {
    const g = await guard(false);
    if (g.error) return g.error;
    const date = clientToday(data.date);
    await buildPlan(g.DB, g.me.id, date);
    return { ok: true as const, date, tasks: await planFor(g.DB, g.me.id, date) };
  });

export const updateTask = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["todo", "done", "skipped"]).nullable(), dueDate: z.string().max(10).nullable() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    if (data.dueDate) {
      const today = new Date().toISOString().slice(0, 10);
      const max = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      if (!isoDate(data.dueDate) || data.dueDate < new Date(Date.now() - 86400000).toISOString().slice(0, 10) || data.dueDate > max) return fail("date_invalid");
      void today;
    }
    try {
      const r = await g.DB.prepare("UPDATE plan_tasks SET status = COALESCE(?, status), due_date = COALESCE(?, due_date), completed_at = CASE WHEN ? = 'done' THEN ? ELSE completed_at END WHERE id = ? AND user_id = ?")
        .bind(data.status, data.dueDate, data.status, now(), data.id, g.me.id).run();
      return (r.meta?.changes ?? 0) > 0 ? { ok: true as const } : fail("not_found");
    } catch {
      return fail("already_planned");
    }
  });

export const addChapterToPlan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid(), date: z.string().max(10) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    if (!isoDate(data.date)) return fail("date_invalid");
    const c = await g.DB.prepare("SELECT title FROM chapters WHERE id = ?").bind(data.chapterId).first<{ title: string }>();
    if (!c) return fail("not_found");
    await g.DB.prepare("INSERT OR IGNORE INTO plan_tasks (id, user_id, kind, chapter_id, title, reason, due_date, status, created_at) VALUES (?, ?, 'study_chapter', ?, ?, 'chosen', ?, 'todo', ?)")
      .bind(crypto.randomUUID(), g.me.id, data.chapterId, c.title, data.date, now()).run();
    return { ok: true as const };
  });

/* ─────────── Dashboard and insights: computed only from this student's stored records ─────────── */

export const getHome = createServerFn({ method: "POST" })
  .inputValidator(z.object({ date: z.string().max(10) }))
  .handler(async ({ data }) => {
    const g = await guard(false);
    if (g.error) return g.error;
    const date = clientToday(data.date);
    const ctx = await studentContext(g.DB, g.me.id);
    await buildPlan(g.DB, g.me.id, date);
    const [tasks, books, lastThread, lastChapter, due, totals, activity] = await Promise.all([
      planFor(g.DB, g.me.id, date),
      ctx.grade !== null && ctx.medium !== null ? catalog(g.DB, ctx.grade, ctx.medium) : Promise.resolve([] as CatalogBook[]),
      g.DB.prepare("SELECT id, title, updated_at FROM tutor_threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1").bind(g.me.id).first<{ id: string; title: string; updated_at: string }>(),
      g.DB.prepare("SELECT ca.chapter_id, ca.last_opened_at, c.title, c.position, t.title AS book_title FROM chapter_activity ca JOIN chapters c ON c.id = ca.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE ca.user_id = ? ORDER BY ca.last_opened_at DESC LIMIT 1")
        .bind(g.me.id).first<{ chapter_id: string; last_opened_at: string; title: string; position: number; book_title: string }>(),
      g.DB.prepare("SELECT COUNT(*) AS n FROM review_state WHERE user_id = ? AND due_at <= ?").bind(g.me.id, now()).first<{ n: number }>(),
      g.DB.prepare("SELECT (SELECT COUNT(*) FROM attempts WHERE user_id = ?1) AS attempts, (SELECT COUNT(*) FROM tutor_messages m JOIN tutor_threads th ON th.id = m.thread_id WHERE th.user_id = ?1 AND m.role = 'student') AS asked")
        .bind(g.me.id).first<{ attempts: number; asked: number }>(),
      g.DB.prepare(`SELECT t.subject_key, COUNT(*) AS attempts, SUM(a.correct) AS correct, MAX(a.created_at) AS last FROM attempts a JOIN chapters c ON c.id = a.chapter_id JOIN textbooks t ON t.id = c.textbook_id
                    WHERE a.user_id = ? GROUP BY t.subject_key`).bind(g.me.id).all<{ subject_key: string; attempts: number; correct: number; last: string }>(),
    ]);
    const offering = offeringFor(ctx.grade, ctx.medium);
    const act = new Map((activity.results ?? []).map((r) => [r.subject_key, r]));
    const subjects = SUBJECTS.map((s) => {
      const bs = books.filter((b) => b.subject_key === s.id);
      const a = act.get(s.id);
      return { id: s.id, label: s.label, short: s.short, hue: s.hue, books: bs.map((b) => ({ id: b.id, title: b.title, status: b.status })), ready: bs.filter((b) => b.status === "indexed").length, attempts: a?.attempts ?? 0, correct: a?.correct ?? 0, last: a?.last ?? null };
    });
    return { ok: true as const, date, ctx, offering, subjects, tasks, books, lastThread, lastChapter, due: due?.n ?? 0, totals: totals ?? { attempts: 0, asked: 0 } };
  });

export const getInsights = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const since = new Date(Date.now() - 56 * 86400000).toISOString();
  const [bySubject, weekly, asked, weak, revision, plan, radar, evidence] = await Promise.all([
    g.DB.prepare(`SELECT t.subject_key, t.subject_name, COUNT(*) AS attempts, SUM(a.correct) AS correct FROM attempts a JOIN chapters c ON c.id = a.chapter_id JOIN textbooks t ON t.id = c.textbook_id
                  WHERE a.user_id = ? GROUP BY t.subject_key, t.subject_name ORDER BY attempts DESC`).bind(g.me.id).all<{ subject_key: string; subject_name: string; attempts: number; correct: number }>(),
    g.DB.prepare(`SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS attempts, SUM(correct) AS correct FROM attempts WHERE user_id = ? AND created_at >= ? GROUP BY week ORDER BY week`).bind(g.me.id, since).all<{ week: string; attempts: number; correct: number }>(),
    g.DB.prepare(`SELECT strftime('%Y-%W', m.created_at) AS week, COUNT(*) AS asked FROM tutor_messages m JOIN tutor_threads th ON th.id = m.thread_id
                  WHERE th.user_id = ? AND m.role = 'student' AND m.created_at >= ? GROUP BY week`).bind(g.me.id, since).all<{ week: string; asked: number }>(),
    g.DB.prepare(`SELECT a.chapter_id, c.title, t.title AS book_title, COUNT(*) AS attempts, SUM(a.correct) AS correct FROM attempts a JOIN chapters c ON c.id = a.chapter_id JOIN textbooks t ON t.id = c.textbook_id
                  WHERE a.user_id = ? GROUP BY a.chapter_id HAVING attempts >= 3 AND (1.0 * correct / attempts) < 0.6 ORDER BY attempts DESC LIMIT 5`).bind(g.me.id).all<{ chapter_id: string; title: string; book_title: string; attempts: number; correct: number }>(),
    g.DB.prepare("SELECT SUM(CASE WHEN due_at <= ? THEN 1 ELSE 0 END) AS due, COUNT(*) AS scheduled, SUM(CASE WHEN box >= 4 THEN 1 ELSE 0 END) AS long_term FROM review_state WHERE user_id = ?").bind(now(), g.me.id).first<{ due: number; scheduled: number; long_term: number }>(),
    g.DB.prepare("SELECT SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done, COUNT(*) AS total FROM plan_tasks WHERE user_id = ? AND due_date >= ?").bind(g.me.id, since.slice(0, 10)).first<{ done: number; total: number }>(),
    // Mistake radar: questions this student has got wrong more than once (real lapses in the review schedule).
    g.DB.prepare(`SELECT q.id, q.prompt, q.language, rs.lapses, rs.box, rs.last_correct, c.id AS chapter_id, c.title AS chapter_title, t.title AS book_title, t.subject_key
                    FROM review_state rs JOIN questions q ON q.id = rs.question_id JOIN chapters c ON c.id = q.chapter_id JOIN textbooks t ON t.id = c.textbook_id
                   WHERE rs.user_id = ? AND rs.lapses >= 2 ORDER BY rs.lapses DESC, rs.last_at DESC LIMIT 8`).bind(g.me.id)
      .all<{ id: string; prompt: string; language: string; lapses: number; box: number; last_correct: number; chapter_id: string; chapter_title: string; book_title: string; subject_key: string }>(),
    // Mastery evidence: for each chapter practised, what the record actually shows.
    g.DB.prepare(`SELECT c.id AS chapter_id, c.title, t.title AS book_title, t.subject_key, COUNT(a.id) AS attempts, SUM(a.correct) AS correct, MAX(a.created_at) AS last,
                         (SELECT COUNT(*) FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ?1 AND q.chapter_id = c.id AND rs.box >= 4) AS retained,
                         (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published') AS questions
                    FROM attempts a JOIN chapters c ON c.id = a.chapter_id JOIN textbooks t ON t.id = c.textbook_id
                   WHERE a.user_id = ?1 GROUP BY c.id ORDER BY last DESC LIMIT 30`).bind(g.me.id)
      .all<{ chapter_id: string; title: string; book_title: string; subject_key: string; attempts: number; correct: number; last: string; retained: number; questions: number }>(),
  ]);
  const got = new Map((bySubject.results ?? []).map((r) => [r.subject_key, r]));
  return {
    ok: true as const,
    // Always all eight subjects, in registry order, so a subject with no activity shows as zero rather than disappearing.
    bySubject: SUBJECTS.map((s) => ({ subject_key: s.id, subject_name: s.label.en, label: s.label, hue: s.hue, attempts: got.get(s.id)?.attempts ?? 0, correct: got.get(s.id)?.correct ?? 0 })),
    radar: radar.results ?? [],
    evidence: evidence.results ?? [],
    weekly: weekly.results ?? [],
    asked: asked.results ?? [],
    weak: weak.results ?? [],
    revision: { due: revision?.due ?? 0, scheduled: revision?.scheduled ?? 0, longTerm: revision?.long_term ?? 0 },
    plan: { done: plan?.done ?? 0, total: plan?.total ?? 0 },
  };
});

export const getPracticeOverview = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const ctx = await studentContext(g.DB, g.me.id);
  const due = await g.DB.prepare("SELECT COUNT(*) AS n, MIN(due_at) AS next FROM review_state WHERE user_id = ? AND due_at <= ?").bind(g.me.id, now()).first<{ n: number; next: string | null }>();
  const upcoming = await g.DB.prepare("SELECT MIN(due_at) AS next FROM review_state WHERE user_id = ? AND due_at > ?").bind(g.me.id, now()).first<{ next: string | null }>();
  if (ctx.grade === null || ctx.medium === null) return { ok: true as const, ctx, due: due?.n ?? 0, nextDue: upcoming?.next ?? null, chapters: [] };
  const r = await g.DB.prepare(
    `SELECT c.id, c.position, c.title, t.id AS book_id, t.title AS book_title, t.subject_key, t.subject_name, t.paper, t.language,
            (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published') AS questions,
            (SELECT COUNT(*) FROM attempts a WHERE a.chapter_id = c.id AND a.user_id = ?) AS attempts,
            (SELECT COALESCE(SUM(a.correct), 0) FROM attempts a WHERE a.chapter_id = c.id AND a.user_id = ?) AS correct
       FROM chapters c JOIN textbooks t ON t.id = c.textbook_id
      WHERE t.version_id = ? AND t.grade = ? AND t.medium = ? AND t.status != 'retired'
        AND EXISTS (SELECT 1 FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published')
      ORDER BY t.subject_key, t.paper, c.position`,
  ).bind(g.me.id, g.me.id, ACTIVE_VERSION, ctx.grade, ctx.medium).all<{ id: string; position: number; title: string; book_id: string; book_title: string; subject_key: string; subject_name: string; paper: string; language: string; questions: number; attempts: number; correct: number }>();
  return { ok: true as const, ctx, due: due?.n ?? 0, nextDue: upcoming?.next ?? null, chapters: r.results ?? [] };
});

/** Public, aggregate-only coverage numbers for the landing page. No student data. */
export const publicCoverage = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  if (!DB) return { indexed: 0, total: 0, subjects: [] as { subject_key: string; books: number; indexed: number; chapters: number; questions: number }[] };
  const r = await DB.prepare("SELECT SUM(CASE WHEN status = 'indexed' THEN 1 ELSE 0 END) AS indexed, COUNT(*) AS total FROM textbooks WHERE version_id = ? AND status != 'retired'").bind(ACTIVE_VERSION).first<{ indexed: number | null; total: number }>();
  const subjects = await DB.prepare(
    `SELECT t.subject_key, COUNT(DISTINCT t.id) AS books, COUNT(DISTINCT CASE WHEN t.status = 'indexed' THEN t.id END) AS indexed, COUNT(DISTINCT c.id) AS chapters,
            (SELECT COUNT(*) FROM questions q JOIN chapters c2 ON c2.id = q.chapter_id JOIN textbooks t2 ON t2.id = c2.textbook_id WHERE t2.subject_key = t.subject_key AND q.status = 'published') AS questions
       FROM textbooks t LEFT JOIN chapters c ON c.textbook_id = t.id WHERE t.version_id = ? AND t.status != 'retired' AND t.medium = 'bangla' GROUP BY t.subject_key`,
  ).bind(ACTIVE_VERSION).all<{ subject_key: string; books: number; indexed: number; chapters: number; questions: number }>();
  return { indexed: r?.indexed ?? 0, total: r?.total ?? 0, subjects: subjects.results ?? [] };
});

/**
 * Product scope matrix (Classes 6–10 × Bangla Version / English Version) with availability computed from real counts:
 * registered books, chapters, books with published student-visible text, published passages, questions and topics.
 */
export const curriculumMatrix = createServerFn({ method: "GET" }).handler(async () => {
  const { buildMatrix } = await import("../curriculum/scope");
  const { DB } = bindings();
  if (!DB) return { ok: true as const, cells: buildMatrix([]) };
  type G = { grade: number; medium: string; n: number };
  const live = "t.version_id = ? AND t.status != 'retired'";
  const q = (sql: string) => DB.prepare(sql).bind(ACTIVE_VERSION).all<G>().then((r) => r.results ?? []);
  const [books, chapters, withText, passages, questions, topics] = await Promise.all([
    q(`SELECT t.grade, t.medium, COUNT(*) AS n FROM textbooks t WHERE ${live} GROUP BY t.grade, t.medium`),
    q(`SELECT t.grade, t.medium, COUNT(*) AS n FROM chapters c JOIN textbooks t ON t.id = c.textbook_id WHERE ${live} GROUP BY t.grade, t.medium`),
    q(`SELECT t.grade, t.medium, COUNT(DISTINCT p.textbook_id) AS n FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE ${live} AND ${STUDENT_VISIBLE} GROUP BY t.grade, t.medium`),
    q(`SELECT t.grade, t.medium, COUNT(*) AS n FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE ${live} AND ${STUDENT_VISIBLE} GROUP BY t.grade, t.medium`),
    q(`SELECT t.grade, t.medium, COUNT(*) AS n FROM questions x JOIN chapters c ON c.id = x.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE ${live} AND x.status = 'published' GROUP BY t.grade, t.medium`),
    q(`SELECT t.grade, t.medium, COUNT(*) AS n FROM topics x JOIN chapters c ON c.id = x.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE ${live} AND x.review_status IN ('checked', 'teacher_reviewed') GROUP BY t.grade, t.medium`),
  ]);
  const keyOf = (r: { grade: number; medium: string }) => `${r.grade}:${r.medium}`;
  const merged = new Map<string, Record<string, number | string>>();
  const add = (list: G[], field: string) => { for (const r of list) { const k = keyOf(r); const m = merged.get(k) ?? { grade: r.grade, medium: r.medium }; m[field] = r.n; merged.set(k, m); } };
  add(books, "books"); add(chapters, "chapters"); add(withText, "booksWithText"); add(passages, "publishedPassages"); add(questions, "publishedQuestions"); add(topics, "topics");
  const rows = { results: [...merged.values()] as unknown as { grade: number; medium: string }[] };
  return { ok: true as const, cells: buildMatrix(rows.results ?? []) };
});

/** Sets the student's class and textbook medium (onboarding and Settings). Interface language is not touched. */
export const setCurriculum = createServerFn({ method: "POST" })
  .inputValidator(z.object({ grade: z.number().int().min(6).max(10), medium: z.enum(["bangla", "english"]) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return { ok: false as const, code: "unavailable_now" };
    const { currentUser, sameOrigin } = await import("../auth/session.server");
    if (!sameOrigin()) return { ok: false as const, code: "bad_origin" };
    const me = await currentUser();
    if (!me) return { ok: false as const, code: "signed_out" };
    const ts = new Date().toISOString();
    await DB.batch([
      DB.prepare("UPDATE profiles SET grade = ?, curriculum = ?, curriculum_other = NULL, curriculum_other_text = NULL, updated_at = ? WHERE user_id = ?").bind(data.grade, data.medium === "bangla" ? "nctb-bangla" : "nctb-english", ts, me.id),
      DB.prepare("UPDATE learners SET grade = ?, medium = ? WHERE user_id = ?").bind(data.grade, data.medium, me.id),
    ]);
    return { ok: true as const };
  });

/** Public, non-secret: whether AI explanations are switched on (any provider configured). Used for honest copy. */
export const homeStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { aiAvailable } = await import("../ai/orchestrator.server");
  return { aiOn: aiAvailable(bindings() as unknown as Record<string, string | undefined>) };
});
