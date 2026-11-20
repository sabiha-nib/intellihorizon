// Server functions for the student's learning universe: dashboard, Learning Sessions, explain-it-back, progress, mistakes,
// mastery, knowledge map and missions. Every function reads or writes only the signed-in student's own rows.
import { createServerFn } from "@tanstack/react-start";
import { BOX_DAYS } from "../curriculum/text";
import { evaluateExplanation } from "../ai/explain.server";
import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";

import { currentUser, rateLimit, sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { ACTIVE_VERSION } from "../curriculum/config";
import { catalog, studentContext, type CatalogBook } from "../curriculum/student.server";
import { SUBJECTS, offeringFor } from "../curriculum/registry";
import {
  DAY_SHIFT,
  awardXp,
  computeStats,
  grantAchievements,
  learningDays,
  localDay,
  recordAttempt,
  totalXp,
} from "../learning/engine.server";
import { LESSONS } from "../learning/lessons";
import { buildPlan } from "../learning/plan.server";
import {
  PRACTICE_LEVEL,
  patternConfidence,
  practiceLevel,
  type PracticeLevel,
  ACHIEVEMENTS,
  explainCoverage,
  levelInfo,
  masteryStatus,
  missionsFor,
  pickSessionQuestions,
  radar,
  streakInfo,
  type MasteryStatus,
} from "../learning/rules";

type Fail = { ok: false; code: string };
const fail = (code: string): Fail => ({ ok: false, code });
const nowIso = () => new Date().toISOString();

async function guard(mutation: boolean) {
  const { DB } = bindings();
  if (!DB) return { error: fail("unavailable_now") } as const;
  if (mutation && !sameOrigin()) return { error: fail("bad_origin") } as const;
  const me = await currentUser();
  if (!me) return { error: fail("signed_out") } as const;
  return { DB, me, error: null } as const;
}

/* ─────────── Shared reads ─────────── */

type ChapterInfo = {
  id: string;
  title: string;
  position: number;
  label: string | null;
  textbook_id: string;
  book_title: string;
  subject_key: string;
  language: string;
  start_page: number | null;
  end_page: number | null;
  page_offset: number | null;
  book_status: string;
};
async function chapterInfo(DB: D1Database, id: string): Promise<ChapterInfo | null> {
  return DB.prepare(
    `SELECT c.id, c.title, c.position, c.label, c.textbook_id, t.title AS book_title, t.subject_key, t.language, c.start_page, c.end_page, t.page_offset, t.status AS book_status
       FROM chapters c JOIN textbooks t ON t.id = c.textbook_id WHERE c.id = ? AND t.status != 'retired' AND t.subject_key IN (SELECT subject_id FROM subject_offerings)`,
  )
    .bind(id)
    .first<ChapterInfo>();
}

async function todaySummary(DB: D1Database, userId: string) {
  const day = localDay();
  const r = await DB.prepare(
    `SELECT (SELECT COUNT(*) FROM attempts WHERE user_id = ?1 AND date(created_at, '${DAY_SHIFT}') = ?2) AS answered,
            (SELECT COALESCE(SUM(correct), 0) FROM attempts WHERE user_id = ?1 AND date(created_at, '${DAY_SHIFT}') = ?2) AS correct,
            (SELECT COUNT(*) FROM xp_events WHERE user_id = ?1 AND kind = 'chapter_opened' AND date(created_at, '${DAY_SHIFT}') = ?2) AS newChapters,
            (SELECT COUNT(*) FROM attempts WHERE user_id = ?1 AND mode = 'review' AND date(created_at, '${DAY_SHIFT}') = ?2) AS reviewsDone,
            (SELECT COUNT(*) FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ?1 AND rs.due_at <= ?3 AND q.status = 'published') AS reviewsDue,
            (SELECT COUNT(*) FROM xp_events WHERE user_id = ?1 AND kind = 'explain' AND date(created_at, '${DAY_SHIFT}') = ?2) AS explained,
            (SELECT COUNT(*) FROM learning_sessions WHERE user_id = ?1 AND status = 'completed' AND date(completed_at, '${DAY_SHIFT}') = ?2) AS sessions,
            (SELECT COALESCE(SUM(xp), 0) FROM xp_events WHERE user_id = ?1 AND date(created_at, '${DAY_SHIFT}') = ?2) AS xpToday`,
  )
    .bind(userId, day, nowIso())
    .first<{
      answered: number;
      correct: number;
      newChapters: number;
      reviewsDone: number;
      reviewsDue: number;
      explained: number;
      sessions: number;
      xpToday: number;
    }>();
  return {
    day,
    answered: r?.answered ?? 0,
    correct: r?.correct ?? 0,
    newChapters: r?.newChapters ?? 0,
    reviewsDone: r?.reviewsDone ?? 0,
    reviewsDue: r?.reviewsDue ?? 0,
    explained: r?.explained ?? 0,
    sessions: r?.sessions ?? 0,
    xpToday: r?.xpToday ?? 0,
  };
}

async function dailyGoal(DB: D1Database, userId: string): Promise<number> {
  try {
    const r = await DB.prepare("SELECT daily_goal FROM profiles WHERE user_id = ?")
      .bind(userId)
      .first<{ daily_goal: number | null }>();
    return r?.daily_goal ?? 5;
  } catch {
    return 5;
  }
}

/** The chapter with the most checked questions in this student's books: an honest first step when there's no history. */
async function starterChapter(
  DB: D1Database,
  grade: number | null,
  medium: "bangla" | "english" | null,
) {
  if (grade === null || medium === null) return null;
  return DB.prepare(
    `SELECT c.id, c.title, t.subject_key, t.title AS book_title, COUNT(q.id) AS questions FROM chapters c JOIN textbooks t ON t.id = c.textbook_id JOIN questions q ON q.chapter_id = c.id AND q.status = 'published'
      WHERE t.version_id = ? AND t.grade = ? AND t.medium = ? AND t.status != 'retired' GROUP BY c.id ORDER BY questions DESC, c.position LIMIT 1`,
  )
    .bind(ACTIVE_VERSION, grade, medium)
    .first<{
      id: string;
      title: string;
      subject_key: string;
      book_title: string;
      questions: number;
    }>();
}

/* ─────────── Dashboard ─────────── */

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const { DB, me } = g;
  const ctx = await studentContext(DB, me.id);
  await buildPlan(DB, me.id, localDay());
  const [
    stats,
    days,
    today,
    goal,
    activeSession,
    lastChapter,
    books,
    perSubject,
    recentRaw,
    achieved,
    planRows,
  ] = await Promise.all([
    computeStats(DB, me.id),
    learningDays(DB, me.id),
    todaySummary(DB, me.id),
    dailyGoal(DB, me.id),
    DB.prepare(
      `SELECT s.id, s.chapter_id, s.started_at, s.question_ids, c.title, t.subject_key, t.title AS book_title,
              (SELECT COUNT(DISTINCT a.question_id) FROM attempts a WHERE a.session_id = s.id) AS answered
         FROM learning_sessions s JOIN chapters c ON c.id = s.chapter_id JOIN textbooks t ON t.id = c.textbook_id
        WHERE s.user_id = ? AND s.status = 'active' ORDER BY s.started_at DESC LIMIT 1`,
    )
      .bind(me.id)
      .first<{
        id: string;
        chapter_id: string;
        started_at: string;
        question_ids: string;
        title: string;
        subject_key: string;
        book_title: string;
        answered: number;
      }>(),
    DB.prepare(
      `SELECT ca.chapter_id, ca.last_opened_at, c.title, c.position, t.title AS book_title, t.subject_key,
              (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published') AS questions
         FROM chapter_activity ca JOIN chapters c ON c.id = ca.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE ca.user_id = ? ORDER BY ca.last_opened_at DESC LIMIT 1`,
    )
      .bind(me.id)
      .first<{
        chapter_id: string;
        last_opened_at: string;
        title: string;
        position: number;
        book_title: string;
        subject_key: string;
        questions: number;
      }>(),
    ctx.grade !== null && ctx.medium !== null
      ? catalog(DB, ctx.grade, ctx.medium)
      : Promise.resolve([] as CatalogBook[]),
    DB.prepare(
      `SELECT t.subject_key, COUNT(a.id) AS attempts, COALESCE(SUM(a.correct), 0) AS correct, MAX(a.created_at) AS last,
              (SELECT c2.title FROM chapter_activity ca JOIN chapters c2 ON c2.id = ca.chapter_id JOIN textbooks t2 ON t2.id = c2.textbook_id WHERE ca.user_id = ?1 AND t2.subject_key = t.subject_key ORDER BY ca.last_opened_at DESC LIMIT 1) AS last_chapter
         FROM attempts a JOIN chapters c ON c.id = a.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE a.user_id = ?1 GROUP BY t.subject_key`,
    )
      .bind(me.id)
      .all<{
        subject_key: string;
        attempts: number;
        correct: number;
        last: string;
        last_chapter: string | null;
      }>(),
    DB.prepare(
      `SELECT * FROM (
         SELECT 'chapter' AS kind, ca.chapter_id AS id, c.title AS title, t.subject_key AS subject, ca.last_opened_at AS at FROM chapter_activity ca JOIN chapters c ON c.id = ca.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE ca.user_id = ?1
         UNION ALL SELECT 'session', s.id, c.title, t.subject_key, COALESCE(s.completed_at, s.started_at) FROM learning_sessions s JOIN chapters c ON c.id = s.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE s.user_id = ?1
         UNION ALL SELECT 'tutor', th.id, th.title, th.subject_key, th.updated_at FROM tutor_threads th WHERE th.user_id = ?1
         UNION ALL SELECT 'saved', si.id, COALESCE(si.note, substr(si.excerpt, 1, 80)), si.subject_key, si.created_at FROM saved_items si WHERE si.user_id = ?1
       ) ORDER BY at DESC LIMIT 6`,
    )
      .bind(me.id)
      .all<{
        kind: "chapter" | "session" | "tutor" | "saved";
        id: string;
        title: string | null;
        subject: string | null;
        at: string;
      }>(),
    DB.prepare(
      "SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ? ORDER BY earned_at DESC",
    )
      .bind(me.id)
      .all<{ achievement_id: string; earned_at: string }>(),
    planToday(DB, me.id, localDay()),
  ]);
  const xp = levelInfo(stats.xp);
  const streak = streakInfo(days, today.day);
  const act = new Map((perSubject.results ?? []).map((r) => [r.subject_key, r]));
  const subjects = SUBJECTS.map((s) => {
    const bs = books.filter((b) => b.subject_key === s.id);
    const a = act.get(s.id);
    return {
      id: s.id,
      label: s.label,
      short: s.short,
      hue: s.hue,
      books: bs.length,
      ready: bs.filter((b) => b.status === "indexed").length,
      questions: bs.reduce((n, b) => n + b.questions, 0),
      attempts: a?.attempts ?? 0,
      correct: a?.correct ?? 0,
      last: a?.last ?? null,
      lastChapter: a?.last_chapter ?? null,
    };
  });

  // Continue Learning: an unfinished session, else the last chapter opened, else an honest first step.
  let resume: {
    kind: "session" | "chapter" | "start";
    id: string;
    title: string;
    subject: string;
    book: string;
    detail: { answered?: number; total?: number; questions?: number };
  } | null = null;
  if (activeSession)
    resume = {
      kind: "session",
      id: activeSession.id,
      title: activeSession.title,
      subject: activeSession.subject_key,
      book: activeSession.book_title,
      detail: {
        answered: activeSession.answered,
        total: (JSON.parse(activeSession.question_ids) as string[]).length,
      },
    };
  else if (lastChapter)
    resume = {
      kind: "chapter",
      id: lastChapter.chapter_id,
      title: lastChapter.title,
      subject: lastChapter.subject_key,
      book: lastChapter.book_title,
      detail: { questions: lastChapter.questions },
    };
  else {
    const s = await starterChapter(DB, ctx.grade, ctx.medium);
    if (s)
      resume = {
        kind: "start",
        id: s.id,
        title: s.title,
        subject: s.subject_key,
        book: s.book_title,
        detail: { questions: s.questions },
      };
  }

  // Insights: only statements the record supports, each with the reason it appears.
  const insights: {
    id: string;
    kind: "due" | "weak" | "pattern" | "improving" | "start";
    title: string | null;
    subject: string | null;
    chapterId: string | null;
    n: number;
    m: number;
    tag?: string;
  }[] = [];
  if (today.reviewsDue > 0)
    insights.push({
      id: "due",
      kind: "due",
      title: null,
      subject: null,
      chapterId: null,
      n: today.reviewsDue,
      m: 0,
    });
  const weak = await DB.prepare(
    `SELECT a.chapter_id, c.title, t.subject_key, COUNT(*) AS n, SUM(a.correct) AS ok FROM (SELECT * FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT 60) a
       JOIN chapters c ON c.id = a.chapter_id JOIN textbooks t ON t.id = c.textbook_id GROUP BY a.chapter_id HAVING n >= 3 AND (1.0 * ok / n) < 0.6 ORDER BY n DESC LIMIT 1`,
  )
    .bind(me.id)
    .first<{ chapter_id: string; title: string; subject_key: string; n: number; ok: number }>();
  if (weak)
    insights.push({
      id: "weak",
      kind: "weak",
      title: weak.title,
      subject: weak.subject_key,
      chapterId: weak.chapter_id,
      n: weak.ok,
      m: weak.n,
    });
  const tags = await DB.prepare(
    "SELECT misconception, COUNT(DISTINCT question_id) AS qs FROM attempts WHERE user_id = ? AND correct = 0 AND misconception IS NOT NULL GROUP BY misconception HAVING qs >= 2 ORDER BY qs DESC LIMIT 1",
  )
    .bind(me.id)
    .first<{ misconception: string; qs: number }>();
  if (tags)
    insights.push({
      id: "pattern",
      kind: "pattern",
      title: null,
      subject: null,
      chapterId: null,
      n: tags.qs,
      m: 0,
      tag: tags.misconception,
    });
  if (stats.improved > 0)
    insights.push({
      id: "improving",
      kind: "improving",
      title: null,
      subject: null,
      chapterId: null,
      n: stats.improved,
      m: 0,
    });
  if (!stats.attempts && resume?.kind === "start")
    insights.push({
      id: "start",
      kind: "start",
      title: resume.title,
      subject: resume.subject,
      chapterId: resume.id,
      n: resume.detail.questions ?? 0,
      m: 0,
    });

  const chapterStatuses = await masteryByChapter(DB, me.id);
  const counts: Record<MasteryStatus, number> = {
    none: 0,
    practising: 0,
    developing: 0,
    demonstrated: 0,
  };
  for (const c of chapterStatuses) counts[c.status]++;

  return {
    ok: true as const,
    name: ctx.fullName.split(/\s+/)[0] || "",
    ctx,
    offering: offeringFor(ctx.grade, ctx.medium),
    level: xp,
    streak,
    today,
    goal,
    missions: missionsFor(today, goal),
    resume,
    plan: planRows,
    subjects,
    insights: insights.slice(0, 3),
    progress: {
      learningDays: stats.learningDays,
      attempts: stats.attempts,
      correctQuestions: stats.correctQuestions,
      sessions: stats.sessionsCompleted,
      chaptersOpened: stats.chaptersOpened,
      mastery: counts,
      due: today.reviewsDue,
    },
    recent: recentRaw.results ?? [],
    achievements: {
      earned: (achieved.results ?? []).length,
      total: ACHIEVEMENTS.length,
      latest: (achieved.results ?? [])[0] ?? null,
    },
  };
});

/* ─────────── Today's plan: tasks complete themselves from recorded events ─────────── */

type PlanTask = {
  id: string;
  kind: string;
  chapter_id: string | null;
  title: string;
  reason: string | null;
  status: string;
  done_by: string | null;
};
async function planToday(DB: D1Database, userId: string, day: string): Promise<PlanTask[]> {
  const rows =
    (
      await DB.prepare(
        "SELECT id, kind, chapter_id, title, reason, status FROM plan_tasks WHERE user_id = ? AND due_date = ? ORDER BY created_at",
      )
        .bind(userId, day)
        .all<Omit<PlanTask, "done_by">>()
    ).results ?? [];
  const out: PlanTask[] = [];
  for (const t of rows) {
    let doneBy: string | null = null;
    if (t.status !== "done") {
      if (t.kind === "review_due") {
        const r = await DB.prepare(
          `SELECT (SELECT COUNT(*) FROM attempts WHERE user_id = ?1 AND mode = 'review' AND date(created_at, '${DAY_SHIFT}') = ?2) AS done, (SELECT COUNT(*) FROM review_state WHERE user_id = ?1 AND due_at <= ?3) AS left`,
        )
          .bind(userId, day, nowIso())
          .first<{ done: number; left: number }>();
        if (r && r.done > 0 && r.left === 0) doneBy = "reviews_cleared";
      } else if (t.kind === "practice_chapter" && t.chapter_id) {
        const r = await DB.prepare(
          `SELECT COUNT(*) AS n FROM attempts WHERE user_id = ? AND chapter_id = ? AND date(created_at, '${DAY_SHIFT}') = ?`,
        )
          .bind(userId, t.chapter_id, day)
          .first<{ n: number }>();
        if ((r?.n ?? 0) >= 3) doneBy = "answered_3";
      } else if (t.kind === "study_chapter" && t.chapter_id) {
        const r = await DB.prepare(
          `SELECT (SELECT COUNT(*) FROM learning_sessions WHERE user_id = ?1 AND chapter_id = ?2 AND status = 'completed' AND date(completed_at, '${DAY_SHIFT}') = ?3) + (SELECT COUNT(*) FROM explanations WHERE user_id = ?1 AND chapter_id = ?2 AND date(created_at, '${DAY_SHIFT}') = ?3) AS n`,
        )
          .bind(userId, t.chapter_id, day)
          .first<{ n: number }>();
        if ((r?.n ?? 0) > 0) doneBy = "session_or_explain";
      } else if (t.kind === "ask_tutor") {
        const r = await DB.prepare(
          `SELECT COUNT(*) AS n FROM tutor_messages m JOIN tutor_threads th ON th.id = m.thread_id WHERE th.user_id = ? AND m.role = 'student' AND date(m.created_at, '${DAY_SHIFT}') = ?`,
        )
          .bind(userId, day)
          .first<{ n: number }>();
        if ((r?.n ?? 0) > 0) doneBy = "asked";
      }
      if (doneBy)
        await DB.prepare(
          "UPDATE plan_tasks SET status = 'done', completed_at = ? WHERE id = ? AND user_id = ?",
        )
          .bind(nowIso(), t.id, userId)
          .run();
    }
    out.push({ ...t, status: doneBy ? "done" : t.status, done_by: doneBy });
  }
  return out;
}

/* ─────────── Mastery by chapter ─────────── */

async function masteryByChapter(DB: D1Database, userId: string) {
  const r = await DB.prepare(
    `SELECT a.question_id, a.chapter_id, a.correct, a.created_at, a.mode, c.title, c.position, t.subject_key, t.title AS book_title,
            (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = a.chapter_id AND q.status = 'published') AS published
       FROM attempts a JOIN chapters c ON c.id = a.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE a.user_id = ? ORDER BY a.id`,
  )
    .bind(userId)
    .all<{
      question_id: string;
      chapter_id: string;
      correct: number;
      created_at: string;
      mode: string;
      title: string;
      position: number;
      subject_key: string;
      book_title: string;
      published: number;
    }>();
  const by = new Map<string, (typeof r.results)[number][]>();
  for (const a of r.results ?? []) by.set(a.chapter_id, [...(by.get(a.chapter_id) ?? []), a]);
  return [...by.entries()].map(([chapterId, list]) => {
    const m = masteryStatus(list);
    return {
      chapterId,
      title: list[0].title,
      position: list[0].position,
      subject: list[0].subject_key,
      book: list[0].book_title,
      published: list[0].published,
      attempts: list.length,
      last: list[list.length - 1].created_at,
      ...m,
    };
  });
}

export const getMastery = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  return { ok: true as const, chapters: await masteryByChapter(g.DB, g.me.id) };
});

/* ─────────── Mistake radar ─────────── */

export const getMistakes = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const r = await g.DB.prepare(
    `SELECT a.question_id, a.correct, a.created_at, a.mode, a.misconception, q.skill, q.prompt, q.language, q.chapter_id, c.title AS chapter_title, t.subject_key
       FROM attempts a JOIN questions q ON q.id = a.question_id JOIN chapters c ON c.id = q.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE a.user_id = ? ORDER BY a.id`,
  )
    .bind(g.me.id)
    .all<{
      question_id: string;
      correct: number;
      created_at: string;
      mode: string;
      misconception: string | null;
      skill: string | null;
      prompt: string;
      language: string;
      chapter_id: string;
      chapter_title: string;
      subject_key: string;
    }>();
  const rows = r.results ?? [];
  const rad = radar(rows);
  const info = new Map(
    rows.map((x) => [
      x.question_id,
      {
        prompt: x.prompt,
        language: x.language,
        chapterId: x.chapter_id,
        chapter: x.chapter_title,
        subject: x.subject_key,
        skill: x.skill,
      },
    ]),
  );
  const wrongCount = (qid: string) =>
    rows.filter((x) => x.question_id === qid && !x.correct).length;
  return {
    ok: true as const,
    attempts: rows.length,
    confirmed: rad.confirmed.map((id) => ({ id, wrong: wrongCount(id), ...info.get(id)! })),
    // A pattern is a possibility, never a verdict: it carries its evidence, a cautious confidence, and whether it is improving.
    patterns: rad.patterns.map((p) => {
      const lastRight = (qid: string) => !!rows.filter((x) => x.question_id === qid).at(-1)?.correct;
      const fixedNow = p.questions.filter(lastRight).length;
      return {
        tag: p.tag,
        confidence: patternConfidence(p.questions.length),
        lastSeen: rows.filter((x) => !x.correct && x.misconception === p.tag).at(-1)?.created_at ?? null,
        followUpOpen: new Set(rows.filter((x) => p.questions.includes(x.question_id)).map((x) => x.chapter_id)).size,
        wrongAnswers: rows.filter((x) => !x.correct && x.misconception === p.tag).length,
        improved: fixedNow,
        status: fixedNow === p.questions.length ? ("resolved" as const) : fixedNow > 0 ? ("improving" as const) : ("open" as const),
        questions: p.questions.map((id) => ({ id, fixed: lastRight(id), ...info.get(id)! })),
      };
    }),
    weakSkills: rad.weakSkills,
    fixed: rad.fixed.map((id) => ({ id, ...info.get(id)! })),
  };
});

/* ─────────── Learning Sessions ─────────── */

export const startLearningSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard(true);
    if (g.error) return g.error;
    if (!(await rateLimit(`session:${g.me.id}`, 30, 3600))) return fail("rate_limited");
    const ch = await chapterInfo(g.DB, data.chapterId);
    if (!ch) return fail("not_found");
    // Reuse an unfinished session in the same chapter instead of starting a second one.
    const open = await g.DB.prepare(
      "SELECT id FROM learning_sessions WHERE user_id = ? AND chapter_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1",
    )
      .bind(g.me.id, ch.id)
      .first<{ id: string }>();
    if (open) return { ok: true as const, id: open.id, resumed: true };
    const [pool, hist] = await Promise.all([
      g.DB.prepare(
        "SELECT id, difficulty FROM questions WHERE chapter_id = ? AND status = 'published'",
      )
        .bind(ch.id)
        .all<{ id: string; difficulty: number | null }>(),
      g.DB.prepare(
        `SELECT q.id, COALESCE(SUM(a.correct), 0) AS ok, COUNT(a.id) - COALESCE(SUM(a.correct), 0) AS wrong, MAX(CASE WHEN rs.due_at <= ?3 THEN 1 ELSE 0 END) AS due
           FROM questions q JOIN attempts a ON a.question_id = q.id AND a.user_id = ?1 LEFT JOIN review_state rs ON rs.question_id = q.id AND rs.user_id = ?1
          WHERE q.chapter_id = ?2 GROUP BY q.id`,
      )
        .bind(g.me.id, ch.id, nowIso())
        .all<{ id: string; ok: number; wrong: number; due: number }>(),
    ]);
    const h = new Map(
      (hist.results ?? []).map((x) => [x.id, { correct: x.ok, wrong: x.wrong, due: !!x.due }]),
    );
    // Adaptive practice: the level comes from this student's last answers in this chapter, by a published rule.
    const recent =
      (
        await g.DB.prepare(
          "SELECT correct FROM (SELECT id, correct FROM attempts WHERE user_id = ? AND chapter_id = ? ORDER BY id DESC LIMIT 8) ORDER BY id",
        )
          .bind(g.me.id, ch.id)
          .all<{ correct: number }>()
      ).results ?? [];
    const lv = practiceLevel(recent);
    const ids = pickSessionQuestions(pool.results ?? [], h, 5, PRACTICE_LEVEL[lv.level].difficulty);
    const id = crypto.randomUUID();
    await g.DB.prepare(
      "INSERT INTO learning_sessions (id, user_id, chapter_id, question_ids, status, started_at, level, level_basis) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)",
    )
      .bind(id, g.me.id, ch.id, JSON.stringify(ids), nowIso(), lv.level, JSON.stringify({ right: lv.right, of: lv.of }))
      .run();
    await g.DB.prepare(
      "INSERT INTO chapter_activity (user_id, chapter_id, last_opened_at) VALUES (?, ?, ?) ON CONFLICT (user_id, chapter_id) DO UPDATE SET last_opened_at = excluded.last_opened_at",
    )
      .bind(g.me.id, ch.id, nowIso())
      .run();
    await awardXp(g.DB, g.me.id, "chapter_opened", ch.id, id);
    return { ok: true as const, id, resumed: false };
  });

export type SessionQuestion = {
  id: string;
  type: "mcq" | "numeric" | "short";
  answerKind: string | null;
  prompt: string;
  options: { id: string; text: string }[] | null;
  hint: string | null;
  unit: string | null;
  language: string;
  source: string;
  printedPage: number | null;
  exercise: string | null;
  why: "due" | "missed" | "new" | "again";
};

export const getLearningSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard(false);
    if (g.error) return g.error;
    // Ownership is part of the lookup: another student's session id simply isn't found.
    const s = await g.DB.prepare(
      "SELECT id, chapter_id, question_ids, status, started_at, completed_at, level, level_basis FROM learning_sessions WHERE id = ? AND user_id = ?",
    )
      .bind(data.id, g.me.id)
      .first<{
        id: string;
        chapter_id: string;
        question_ids: string;
        status: "active" | "completed";
        started_at: string;
        level: string | null;
        level_basis: string | null;
        completed_at: string | null;
      }>();
    if (!s) return fail("not_found");
    const ch = await chapterInfo(g.DB, s.chapter_id);
    if (!ch) return fail("not_found");
    const ids = JSON.parse(s.question_ids) as string[];
    const [qs, objectives, answered, history] = await Promise.all([
      ids.length
        ? g.DB.prepare(
            `SELECT id, type, answer_kind, prompt, options, hint, unit, language, source, provenance FROM questions WHERE status = 'published' AND id IN (${ids.map(() => "?").join(",")})`,
          )
            .bind(...ids)
            .all<{
              id: string;
              type: "mcq" | "numeric" | "short";
              answer_kind: string | null;
              prompt: string;
              options: string | null;
              hint: string | null;
              unit: string | null;
              language: string;
              source: string;
              provenance: string | null;
            }>()
        : Promise.resolve({ results: [] }),
      g.DB.prepare(
        "SELECT id, position, text, source_page FROM objectives WHERE chapter_id = ? ORDER BY position",
      )
        .bind(ch.id)
        .all<{ id: string; position: number; text: string; source_page: number | null }>(),
      g.DB.prepare(
        "SELECT question_id, correct, misconception FROM attempts WHERE session_id = ? AND user_id = ? ORDER BY id",
      )
        .bind(s.id, g.me.id)
        .all<{ question_id: string; correct: number; misconception: string | null }>(),
      ids.length
        ? g.DB.prepare(
            `SELECT a.question_id, SUM(a.correct) AS ok, COUNT(*) AS n, MAX(CASE WHEN rs.due_at <= ? THEN 1 ELSE 0 END) AS due FROM attempts a LEFT JOIN review_state rs ON rs.user_id = a.user_id AND rs.question_id = a.question_id WHERE a.user_id = ? AND (a.session_id IS NULL OR a.session_id != ?) AND a.question_id IN (${ids.map(() => "?").join(",")}) GROUP BY a.question_id`,
          )
            .bind(nowIso(), g.me.id, s.id, ...ids)
            .all<{ question_id: string; ok: number; n: number; due: number }>()
        : Promise.resolve({ results: [] }),
    ]);
    const hist = new Map((history.results ?? []).map((x) => [x.question_id, x]));
    const byId = new Map((qs.results ?? []).map((q) => [q.id, q]));
    const questions: SessionQuestion[] = ids
      .filter((id) => byId.has(id))
      .map((id) => {
        const q = byId.get(id)!;
        let prov: Record<string, unknown> = {};
        try {
          prov = q.provenance ? JSON.parse(q.provenance) : {};
        } catch {
          prov = {};
        }
        const h = hist.get(id);
        return {
          id,
          type: q.type,
          answerKind: q.answer_kind,
          prompt: q.prompt,
          options: q.options ? JSON.parse(q.options) : null,
          hint: q.hint,
          unit: q.unit,
          language: q.language,
          source: q.source,
          printedPage: typeof prov.printedPage === "number" ? prov.printedPage : null,
          exercise: typeof prov.exercise === "string" ? prov.exercise : null,
          why: !h ? "new" : h.due ? "due" : !h.ok ? "missed" : "again",
        };
      });
    const lesson = LESSONS[ch.id] ?? null;
    const xp = await g.DB.prepare(
      "SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_events WHERE user_id = ? AND session_id = ?",
    )
      .bind(g.me.id, s.id)
      .first<{ xp: number }>();
    return {
      ok: true as const,
      session: {
        id: s.id,
        status: s.status,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        xp: xp?.xp ?? 0,
        level: (s.level as PracticeLevel | null) ?? null,
        levelBasis: (() => {
          try {
            return s.level_basis ? (JSON.parse(s.level_basis) as { right: number; of: number }) : null;
          } catch {
            return null;
          }
        })(),
      },
      chapter: {
        id: ch.id,
        title: ch.title,
        position: ch.position,
        label: ch.label,
        bookTitle: ch.book_title,
        textbookId: ch.textbook_id,
        subject: ch.subject_key,
        language: ch.language,
        bookReady: ch.book_status === "indexed",
        printedPages:
          ch.start_page && ch.end_page && ch.page_offset !== null
            ? [ch.start_page - ch.page_offset, ch.end_page - ch.page_offset]
            : null,
      },
      objectives: (objectives.results ?? []).map((o) => ({
        ...o,
        printedPage:
          o.source_page !== null && ch.page_offset !== null ? o.source_page - ch.page_offset : null,
      })),
      lesson: lesson
        ? {
            pages: lesson.pages,
            steps: lesson.steps,
            keyIdeas: lesson.keyIdeas.map((k) => ({ id: k.id, label: k.label })),
            interactive: lesson.interactive ?? null,
            recap: lesson.recap,
          }
        : null,
      questions,
      answered: answered.results ?? [],
    };
  });

export const answerQuestion = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      questionId: z.string().uuid(),
      response: z.string().max(500),
      confidence: z.number().int().min(1).max(3).nullable(),
      mode: z.enum(["practice", "review"]),
      clientEventId: z
        .string()
        .regex(/^[A-Za-z0-9-]{8,64}$/)
        .nullable(),
      sessionId: z.string().uuid().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const g = await guard(true);
    if (g.error) return g.error;
    if (!(await rateLimit(`answer:${g.me.id}`, 240, 3600))) return fail("rate_limited");
    return recordAttempt(g.DB, g.me.id, data);
  });

export const completeLearningSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard(true);
    if (g.error) return g.error;
    const s = await g.DB.prepare(
      "SELECT id, chapter_id, question_ids, status FROM learning_sessions WHERE id = ? AND user_id = ?",
    )
      .bind(data.id, g.me.id)
      .first<{ id: string; chapter_id: string; question_ids: string; status: string }>();
    if (!s) return fail("not_found");
    const xpBefore = await totalXp(g.DB, g.me.id);
    const att =
      (
        await g.DB.prepare(
          "SELECT question_id, correct, misconception FROM attempts WHERE session_id = ? AND user_id = ? ORDER BY id",
        )
          .bind(s.id, g.me.id)
          .all<{ question_id: string; correct: number; misconception: string | null }>()
      ).results ?? [];
    const distinct = new Set(att.map((a) => a.question_id));
    if (s.status === "active") {
      await g.DB.prepare(
        "UPDATE learning_sessions SET status = 'completed', completed_at = ? WHERE id = ? AND user_id = ? AND status = 'active'",
      )
        .bind(nowIso(), s.id, g.me.id)
        .run();
      // The session reward needs at least three answered questions, or an explanation counted for this chapter in this session.
      const explained = await g.DB.prepare(
        "SELECT COUNT(*) AS n FROM explanations WHERE session_id = ? AND user_id = ?",
      )
        .bind(s.id, g.me.id)
        .first<{ n: number }>();
      if (
        distinct.size >= 3 ||
        ((JSON.parse(s.question_ids) as string[]).length === 0 && (explained?.n ?? 0) > 0)
      )
        await awardXp(g.DB, g.me.id, "session_complete", s.id, s.id);
    }
    const newAchievements = await grantAchievements(g.DB, g.me.id);
    const xpAfter = await totalXp(g.DB, g.me.id);
    const sessionXp = await g.DB.prepare(
      "SELECT kind, SUM(xp) AS xp FROM xp_events WHERE user_id = ? AND session_id = ? GROUP BY kind",
    )
      .bind(g.me.id, s.id)
      .all<{ kind: string; xp: number }>();
    // Still needs work: questions whose last answer in this session was wrong.
    const last = new Map<string, number>();
    for (const a of att) last.set(a.question_id, a.correct);
    const needsWork = [...last].filter(([, c]) => !c).map(([q]) => q);
    const prompts = needsWork.length
      ? ((
          await g.DB.prepare(
            `SELECT id, prompt, language FROM questions WHERE id IN (${needsWork.map(() => "?").join(",")})`,
          )
            .bind(...needsWork)
            .all<{ id: string; prompt: string; language: string }>()
        ).results ?? [])
      : [];
    const next = await nextStep(g.DB, g.me.id, s.chapter_id, needsWork.length);
    // Time is reported only when it is believable: one sitting of under 90 minutes. Otherwise it is left out, not guessed.
    const timing = await g.DB.prepare("SELECT started_at, completed_at, summary FROM learning_sessions WHERE id = ? AND user_id = ?")
      .bind(s.id, g.me.id)
      .first<{ started_at: string; completed_at: string | null; summary: string | null }>();
    const secs = timing?.completed_at ? Math.round((Date.parse(timing.completed_at) - Date.parse(timing.started_at)) / 1000) : null;
    const minutes = secs !== null && secs > 0 && secs < 90 * 60 ? Math.max(1, Math.round(secs / 60)) : null;
    const misconceptions = [...new Set(att.filter((a) => !a.correct && a.misconception).map((a) => a.misconception as string))];
    if (timing && !timing.summary) {
      // Written once, when the session is first completed: the durable record of what this session showed.
      await g.DB.prepare("UPDATE learning_sessions SET summary = ? WHERE id = ? AND user_id = ? AND summary IS NULL")
        .bind(
          JSON.stringify({
            attempted: distinct.size,
            correctFirstTry: [...distinct].filter((q) => att.find((a) => a.question_id === q)?.correct).length,
            correctAtEnd: [...last.values()].filter(Boolean).length,
            incorrectAtEnd: needsWork.length,
            misconceptions,
            xp: (sessionXp.results ?? []).reduce((n, r) => n + r.xp, 0),
            minutes,
            next: { kind: next.kind, chapterId: next.chapterId },
          }),
          s.id,
          g.me.id,
        )
        .run();
    }
    return {
      ok: true as const,
      minutes,
      misconceptions,
      answered: distinct.size,
      correctFirstTry: [...distinct].filter((q) => att.find((a) => a.question_id === q)?.correct)
        .length,
      correctNow: [...last.values()].filter(Boolean).length,
      needsWork: prompts,
      xp: {
        session: (sessionXp.results ?? []).reduce((n, r) => n + r.xp, 0),
        byKind: sessionXp.results ?? [],
        total: xpAfter,
        levelBefore: levelInfo(xpBefore).level,
        levelAfter: levelInfo(xpAfter).level,
      },
      level: levelInfo(xpAfter),
      newAchievements,
      next,
    };
  });

async function nextStep(DB: D1Database, userId: string, chapterId: string, missed: number) {
  const due = await DB.prepare(
    "SELECT COUNT(*) AS n FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ? AND rs.due_at <= ? AND q.status = 'published'",
  )
    .bind(userId, nowIso())
    .first<{ n: number }>();
  if ((due?.n ?? 0) > 0)
    return { kind: "revise" as const, n: due!.n, chapterId: null, title: null };
  if (missed > 0) return { kind: "retry" as const, n: missed, chapterId, title: null };
  const fresh = await DB.prepare(
    "SELECT COUNT(*) AS n FROM questions q WHERE q.chapter_id = ? AND q.status = 'published' AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = ? AND a.question_id = q.id)",
  )
    .bind(chapterId, userId)
    .first<{ n: number }>();
  if ((fresh?.n ?? 0) > 0)
    return { kind: "continue" as const, n: fresh!.n, chapterId, title: null };
  const other = await DB.prepare(
    `SELECT c.id, c.title FROM chapters c JOIN questions q ON q.chapter_id = c.id AND q.status = 'published' WHERE c.id != ? AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = ? AND a.chapter_id = c.id) GROUP BY c.id LIMIT 1`,
  )
    .bind(chapterId, userId)
    .first<{ id: string; title: string }>();
  if (other) return { kind: "other" as const, n: 0, chapterId: other.id, title: other.title };
  return { kind: "explore" as const, n: 0, chapterId: null, title: null };
}

/* ─────────── Explain It Back ─────────── */

export const submitExplanation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      chapterId: z.string().uuid(),
      sessionId: z.string().uuid().nullable(),
      text: z.string().max(1500),
    }),
  )
  .handler(async ({ data }) => {
    const g = await guard(true);
    if (g.error) return g.error;
    if (!(await rateLimit(`explain:${g.me.id}`, 40, 3600))) return fail("rate_limited");
    const lesson = LESSONS[data.chapterId];
    if (!lesson) return fail("no_key_ideas");
    const text = data.text.trim();
    if (text.length < 10) return fail("too_short");
    if (data.sessionId) {
      const s = await g.DB.prepare(
        "SELECT id FROM learning_sessions WHERE id = ? AND user_id = ? AND chapter_id = ?",
      )
        .bind(data.sessionId, g.me.id, data.chapterId)
        .first();
      if (!s) return fail("not_found");
    }
    const keyword = explainCoverage(text, lesson.keyIdeas);
    // Second opinion from the AI, when configured: ideas explained in the student's own words also count.
    const lang: "en" | "bn" = /[\u0980-\u09FF]/.test(text) ? "bn" : "en";
    const chRow = await g.DB.prepare("SELECT title FROM chapters WHERE id = ?").bind(data.chapterId).first<{ title: string }>();
    const ai = await evaluateExplanation(g.DB, bindings() as unknown as Record<string, string | undefined>, { userId: g.me.id, chapter: chRow?.title ?? "", lang, ideas: lesson.keyIdeas.map((k) => ({ id: k.id, label: `${k.label.en} / ${k.label.bn}` })), text });
    const coveredIds = [...new Set([...keyword.covered, ...ai.recognised])];
    const cov = { ...keyword, covered: lesson.keyIdeas.map((k) => k.id).filter((x) => coveredIds.includes(x)), missing: lesson.keyIdeas.map((k) => k.id).filter((x) => !coveredIds.includes(x)), counts: coveredIds.length >= Math.min(2, lesson.keyIdeas.length) && keyword.words >= 12 };
    const id = crypto.randomUUID();
    await g.DB.prepare(
      "INSERT INTO explanations (id, user_id, chapter_id, session_id, text, covered, created_at, ai_feedback) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        g.me.id,
        data.chapterId,
        data.sessionId,
        text,
        JSON.stringify(cov.covered),
        nowIso(),
        ai.status === "ok" ? JSON.stringify(ai) : null,
      )
      .run();
    const gained = cov.counts
      ? await awardXp(g.DB, g.me.id, "explain", `${data.chapterId}:${localDay()}`, data.sessionId)
      : 0;
    const newAchievements = await grantAchievements(g.DB, g.me.id);
    return {
      ok: true as const,
      covered: cov.covered,
      missing: cov.missing,
      words: cov.words,
      counts: cov.counts,
      xpGained: gained,
      newAchievements,
      ideas: lesson.keyIdeas.map((k) => ({ id: k.id, label: k.label })),
      byKeyword: keyword.covered,
      ai,
    };
  });

/* ─────────── Progress, achievements, missions, history ─────────── */

export const getProgression = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const { DB, me } = g;
  const [stats, days, today, goal, earned, ledger, weekly, firstVsRecent] = await Promise.all([
    computeStats(DB, me.id),
    learningDays(DB, me.id),
    todaySummary(DB, me.id),
    dailyGoal(DB, me.id),
    DB.prepare("SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?")
      .bind(me.id)
      .all<{ achievement_id: string; earned_at: string }>(),
    DB.prepare(
      `SELECT x.kind, x.ref, x.xp, x.created_at, c.title AS chapter_title FROM xp_events x LEFT JOIN questions q ON q.id = substr(x.ref, 1, 36) LEFT JOIN chapters c ON c.id = COALESCE(q.chapter_id, substr(x.ref, 1, 36)) WHERE x.user_id = ? ORDER BY x.id DESC LIMIT 20`,
    )
      .bind(me.id)
      .all<{
        kind: string;
        ref: string;
        xp: number;
        created_at: string;
        chapter_title: string | null;
      }>(),
    DB.prepare(
      `SELECT strftime('%Y-%W', created_at, '${DAY_SHIFT}') AS week, COUNT(*) AS attempts, SUM(correct) AS correct FROM attempts WHERE user_id = ? AND created_at >= ? GROUP BY week ORDER BY week`,
    )
      .bind(me.id, new Date(Date.now() - 56 * 86400000).toISOString())
      .all<{ week: string; attempts: number; correct: number }>(),
    // Personal best: first-ever answers to each question compared with the latest answer to the same questions.
    DB.prepare(
      `SELECT COUNT(*) AS n, SUM(f.correct) AS first_ok, SUM(l.correct) AS last_ok FROM
         (SELECT question_id, MIN(id) AS fid, MAX(id) AS lid FROM attempts WHERE user_id = ? GROUP BY question_id HAVING COUNT(*) >= 2) x
         JOIN attempts f ON f.id = x.fid JOIN attempts l ON l.id = x.lid`,
    )
      .bind(me.id)
      .first<{ n: number; first_ok: number | null; last_ok: number | null }>(),
  ]);
  const got = new Map((earned.results ?? []).map((r) => [r.achievement_id, r.earned_at]));
  return {
    ok: true as const,
    level: levelInfo(stats.xp),
    streak: streakInfo(days, today.day),
    stats,
    today,
    goal,
    missions: missionsFor(today, goal),
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id,
      category: a.category,
      title: a.title,
      how: a.how,
      target: a.target,
      value: Math.min(a.value(stats), a.target),
      earnedAt: got.get(a.id) ?? null,
    })),
    ledger: ledger.results ?? [],
    weekly: weekly.results ?? [],
    retake:
      firstVsRecent && firstVsRecent.n > 0
        ? {
            questions: firstVsRecent.n,
            firstRight: firstVsRecent.first_ok ?? 0,
            nowRight: firstVsRecent.last_ok ?? 0,
          }
        : null,
    days: days.slice(-42),
  };
});

export const saveDailyGoal = createServerFn({ method: "POST" })
  .inputValidator(z.object({ goal: z.number().int().min(3).max(20) }))
  .handler(async ({ data }) => {
    const g = await guard(true);
    if (g.error) return g.error;
    await g.DB.prepare("UPDATE profiles SET daily_goal = ?, updated_at = ? WHERE user_id = ?")
      .bind(data.goal, nowIso(), g.me.id)
      .run();
    return { ok: true as const };
  });

export const getHistory = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const r = await g.DB.prepare(
    `SELECT * FROM (
       SELECT 'session' AS kind, s.id AS id, c.title AS title, t.subject_key AS subject, COALESCE(s.completed_at, s.started_at) AS at, s.status AS detail FROM learning_sessions s JOIN chapters c ON c.id = s.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE s.user_id = ?1
       UNION ALL SELECT 'chapter', ca.chapter_id, c.title, t.subject_key, ca.last_opened_at, NULL FROM chapter_activity ca JOIN chapters c ON c.id = ca.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE ca.user_id = ?1
       UNION ALL SELECT 'tutor', th.id, th.title, th.subject_key, th.updated_at, NULL FROM tutor_threads th WHERE th.user_id = ?1
       UNION ALL SELECT 'explain', e.chapter_id, c.title, t.subject_key, e.created_at, e.covered FROM explanations e JOIN chapters c ON c.id = e.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE e.user_id = ?1
       UNION ALL SELECT 'saved', si.id, COALESCE(si.note, substr(si.excerpt, 1, 80)), si.subject_key, si.created_at, NULL FROM saved_items si WHERE si.user_id = ?1
     ) ORDER BY at DESC LIMIT 60`,
  )
    .bind(g.me.id)
    .all<{
      kind: string;
      id: string;
      title: string | null;
      subject: string | null;
      at: string;
      detail: string | null;
    }>();
  return { ok: true as const, items: r.results ?? [] };
});

/* ─────────── Knowledge map: the student's books, chapters and evidence (no invented prerequisites) ─────────── */

export const getKnowledgeMap = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const ctx = await studentContext(g.DB, g.me.id);
  const books =
    ctx.grade !== null && ctx.medium !== null ? await catalog(g.DB, ctx.grade, ctx.medium) : [];
  const ids = books.map((b) => b.id);
  const chapters = ids.length
    ? ((
        await g.DB.prepare(
          `SELECT c.id, c.textbook_id, c.position, c.title, (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published') AS questions, (SELECT COUNT(*) FROM objectives o WHERE o.chapter_id = c.id) AS objectives FROM chapters c WHERE c.textbook_id IN (${ids.map(() => "?").join(",")}) ORDER BY c.position`,
        )
          .bind(...ids)
          .all<{
            id: string;
            textbook_id: string;
            position: number;
            title: string;
            questions: number;
            objectives: number;
          }>()
      ).results ?? [])
    : [];
  const evidence = new Map((await masteryByChapter(g.DB, g.me.id)).map((m) => [m.chapterId, m]));
  const dueBy = new Map(
    (
      (
        await g.DB.prepare(
          "SELECT q.chapter_id, COUNT(*) AS n FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ? AND rs.due_at <= ? AND q.status = 'published' GROUP BY q.chapter_id",
        )
          .bind(g.me.id, nowIso())
          .all<{ chapter_id: string; n: number }>()
      ).results ?? []
    ).map((r) => [r.chapter_id, r.n]),
  );
  const opened = new Set(
    (
      (
        await g.DB.prepare("SELECT chapter_id FROM chapter_activity WHERE user_id = ?")
          .bind(g.me.id)
          .all<{ chapter_id: string }>()
      ).results ?? []
    ).map((r) => r.chapter_id),
  );
  return {
    ok: true as const,
    subjects: SUBJECTS.map((s) => ({
      id: s.id,
      label: s.label,
      short: s.short,
      hue: s.hue,
      books: books
        .filter((b) => b.subject_key === s.id)
        .map((b) => ({
          id: b.id,
          title: b.title,
          language: b.language,
          chapters: chapters
            .filter((c) => c.textbook_id === b.id)
            .map((c) => ({
              id: c.id,
              position: c.position,
              title: c.title,
              questions: c.questions,
              objectives: c.objectives,
              opened: opened.has(c.id),
              // Six node states, each decided by stored evidence. Opening a chapter is "introduced", never more.
              status: ((): "none" | "introduced" | "practising" | "developing" | "demonstrated" | "needs_revision" => {
                const m = evidence.get(c.id)?.status ?? "none";
                if (m === "none") return opened.has(c.id) ? "introduced" : "none";
                return dueBy.has(c.id) ? "needs_revision" : m;
              })(),
              mastery: evidence.get(c.id)?.status ?? "none",
              due: dueBy.get(c.id) ?? 0,
              evidence: evidence.has(c.id)
                ? {
                    distinct: evidence.get(c.id)!.distinct,
                    distinctCorrect: evidence.get(c.id)!.distinctCorrect,
                    recentRate: evidence.get(c.id)!.recentRate,
                    reviewCorrect: evidence.get(c.id)!.reviewCorrect,
                  }
                : null,
              hasLesson: !!LESSONS[c.id],
            })),
        })),
    })),
  };
});

/* ─────────── Revision queue: due questions, in the order they fell due ─────────── */

export const getRevisionQueue = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const r = await g.DB.prepare(
    `SELECT q.id, q.type, q.answer_kind, q.prompt, q.options, q.hint, q.unit, q.language, q.source, q.provenance, rs.box, rs.last_correct, rs.due_at, rs.last_at, rs.lapses, c.title AS chapter_title
       FROM review_state rs JOIN questions q ON q.id = rs.question_id JOIN chapters c ON c.id = q.chapter_id WHERE rs.user_id = ? AND rs.due_at <= ? AND q.status = 'published' ORDER BY rs.due_at LIMIT 15`,
  )
    .bind(g.me.id, nowIso())
    .all<{
      id: string;
      type: "mcq" | "numeric" | "short";
      answer_kind: string | null;
      prompt: string;
      options: string | null;
      hint: string | null;
      unit: string | null;
      language: string;
      source: string;
      provenance: string | null;
      box: number;
      last_correct: number;
      due_at: string;
      last_at: string;
      lapses: number;
      chapter_title: string;
    }>();
  const upcoming = await g.DB.prepare(
    "SELECT MIN(due_at) AS next, COUNT(*) AS n FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ? AND rs.due_at > ? AND q.status = 'published'",
  )
    .bind(g.me.id, nowIso())
    .first<{ next: string | null; n: number }>();
  const questions: (SessionQuestion & { chapterTitle: string; reason: { lastAt: string; lastCorrect: boolean; lapses: number; gapDays: number } })[] = (r.results ?? []).map((q) => {
    let prov: Record<string, unknown> = {};
    try {
      prov = q.provenance ? JSON.parse(q.provenance) : {};
    } catch {
      prov = {};
    }
    return {
      id: q.id,
      type: q.type,
      answerKind: q.answer_kind,
      prompt: q.prompt,
      options: q.options ? JSON.parse(q.options) : null,
      hint: q.hint,
      unit: q.unit,
      language: q.language,
      source: q.source,
      printedPage: typeof prov.printedPage === "number" ? prov.printedPage : null,
      exercise: typeof prov.exercise === "string" ? prov.exercise : null,
      why: q.last_correct ? "due" : "missed",
      chapterTitle: q.chapter_title,
      // Why it is due, from this student's own record: when it was last answered, whether right, how often missed, and the gap used.
      reason: { lastAt: q.last_at, lastCorrect: !!q.last_correct, lapses: q.lapses, gapDays: BOX_DAYS[Math.max(0, q.box - 1)] ?? 1 },
    };
  });
  return {
    ok: true as const,
    questions,
    nextDue: upcoming?.next ?? null,
    scheduled: upcoming?.n ?? 0,
  };
});

/* ─────────── Horizon Path: one student's journey, in order, built only from their own records ─────────── */

export const getHorizonPath = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard(false);
  if (g.error) return g.error;
  const { DB, me } = g;
  const ctx = await studentContext(DB, me.id);
  const [stats, sessions, active, lastChapter, due, upcoming, earned, mastery] = await Promise.all([
    computeStats(DB, me.id),
    DB.prepare(
      `SELECT s.id, s.completed_at, s.level, s.summary, c.title, t.subject_key FROM learning_sessions s JOIN chapters c ON c.id = s.chapter_id JOIN textbooks t ON t.id = c.textbook_id
        WHERE s.user_id = ? AND s.status = 'completed' ORDER BY s.completed_at DESC LIMIT 6`,
    ).bind(me.id).all<{ id: string; completed_at: string; level: string | null; summary: string | null; title: string; subject_key: string }>(),
    DB.prepare(
      `SELECT s.id, s.chapter_id, s.question_ids, c.title, t.subject_key, (SELECT COUNT(DISTINCT a.question_id) FROM attempts a WHERE a.session_id = s.id) AS answered
         FROM learning_sessions s JOIN chapters c ON c.id = s.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE s.user_id = ? AND s.status = 'active' ORDER BY s.started_at DESC LIMIT 1`,
    ).bind(me.id).first<{ id: string; chapter_id: string; question_ids: string; title: string; subject_key: string; answered: number }>(),
    DB.prepare(
      `SELECT ca.chapter_id, c.title, c.position, c.textbook_id, t.subject_key FROM chapter_activity ca JOIN chapters c ON c.id = ca.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE ca.user_id = ? ORDER BY ca.last_opened_at DESC LIMIT 1`,
    ).bind(me.id).first<{ chapter_id: string; title: string; position: number; textbook_id: string; subject_key: string }>(),
    DB.prepare("SELECT COUNT(*) AS n FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ? AND rs.due_at <= ? AND q.status = 'published'").bind(me.id, nowIso()).first<{ n: number }>(),
    DB.prepare(`SELECT date(rs.due_at, '${DAY_SHIFT}') AS day, COUNT(*) AS n FROM review_state rs JOIN questions q ON q.id = rs.question_id WHERE rs.user_id = ? AND rs.due_at > ? AND q.status = 'published' GROUP BY day ORDER BY day LIMIT 4`).bind(me.id, nowIso()).all<{ day: string; n: number }>(),
    DB.prepare("SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ? ORDER BY earned_at DESC").bind(me.id).all<{ achievement_id: string; earned_at: string }>(),
    masteryByChapter(DB, me.id),
  ]);

  // Recommended next: every item carries the record it is based on.
  const ahead: { kind: "resume" | "revise" | "strengthen" | "practise_new" | "next_chapter" | "start"; chapterId: string | null; sessionId: string | null; title: string | null; subject: string | null; n: number; m: number }[] = [];
  if (active) ahead.push({ kind: "resume", chapterId: active.chapter_id, sessionId: active.id, title: active.title, subject: active.subject_key, n: active.answered, m: (JSON.parse(active.question_ids) as string[]).length });
  if ((due?.n ?? 0) > 0) ahead.push({ kind: "revise", chapterId: null, sessionId: null, title: null, subject: null, n: due!.n, m: 0 });
  const weak = mastery.filter((c) => c.attempts >= 3 && c.recentRate < 0.6).sort((a, b) => a.recentRate - b.recentRate)[0];
  if (weak) ahead.push({ kind: "strengthen", chapterId: weak.chapterId, sessionId: null, title: weak.title, subject: weak.subject, n: Math.round(weak.recentRate * 100), m: weak.attempts });
  const unfinished = mastery.filter((c) => c.status !== "demonstrated" && c.distinct < c.published && c.chapterId !== weak?.chapterId && c.chapterId !== active?.chapter_id)[0];
  if (unfinished) ahead.push({ kind: "practise_new", chapterId: unfinished.chapterId, sessionId: null, title: unfinished.title, subject: unfinished.subject, n: unfinished.published - unfinished.distinct, m: 0 });
  if (lastChapter) {
    const nx = await DB.prepare("SELECT id, title FROM chapters WHERE textbook_id = ? AND position > ? ORDER BY position LIMIT 1").bind(lastChapter.textbook_id, lastChapter.position).first<{ id: string; title: string }>();
    if (nx) ahead.push({ kind: "next_chapter", chapterId: nx.id, sessionId: null, title: nx.title, subject: lastChapter.subject_key, n: 0, m: 0 });
  }
  if (!ahead.length) {
    const s = await starterChapter(DB, ctx.grade, ctx.medium);
    if (s) ahead.push({ kind: "start", chapterId: s.id, sessionId: null, title: s.title, subject: s.subject_key, n: s.questions, m: 0 });
  }

  const got = new Set((earned.results ?? []).map((r) => r.achievement_id));
  const nextAchievements = ACHIEVEMENTS.filter((a) => !got.has(a.id))
    .map((a) => ({ id: a.id, title: a.title, how: a.how, target: a.target, value: Math.min(a.value(stats), a.target) }))
    .sort((a, b) => b.value / b.target - a.value / a.target)
    .slice(0, 2);
  return {
    ok: true as const,
    level: levelInfo(stats.xp),
    behind: (sessions.results ?? []).map((x) => {
      let sum: { attempted?: number; correctAtEnd?: number; xp?: number; minutes?: number | null } = {};
      try { sum = x.summary ? JSON.parse(x.summary) : {}; } catch { sum = {}; }
      return { id: x.id, title: x.title, subject: x.subject_key, at: x.completed_at, level: x.level, attempted: sum.attempted ?? null, correct: sum.correctAtEnd ?? null, xp: sum.xp ?? null, minutes: sum.minutes ?? null };
    }),
    earned: (earned.results ?? []).slice(0, 3).map((r) => ({ id: r.achievement_id, at: r.earned_at, title: ACHIEVEMENTS.find((a) => a.id === r.achievement_id)?.title ?? null })),
    // Finished IntelliQuiz sets, from their stored results.
    practice: ((await DB.prepare("SELECT id, mode, submitted_at, result FROM quiz_sets WHERE user_id = ? AND status = 'submitted' ORDER BY submitted_at DESC LIMIT 4").bind(me.id).all<{ id: string; mode: string; submitted_at: string; result: string | null }>()).results ?? []).map((q) => {
      let r: { correct?: number; attempted?: number; total?: number } = {};
      try { r = q.result ? JSON.parse(q.result) : {}; } catch { r = {}; }
      return { id: q.id, mode: q.mode, at: q.submitted_at, correct: r.correct ?? 0, attempted: r.attempted ?? 0, total: r.total ?? 0 };
    }),
    ahead: ahead.slice(0, 4),
    checkpoints: upcoming.results ?? [],
    nextAchievements,
    totals: { sessions: stats.sessionsCompleted, demonstrated: stats.demonstratedChapters },
  };
});
