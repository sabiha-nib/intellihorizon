// Server-side learning engine: records attempts, schedules revision, awards XP from the ledger and grants achievements.
// The client never decides correctness or rewards; it only sends an answer and receives what was recorded.
import type { D1Database } from "@cloudflare/workers-types";

import { BOX_DAYS, nextReview } from "../curriculum/text";
import {
  ACHIEVEMENTS,
  XP,
  answerReward,
  displayAnswer,
  grade,
  levelInfo,
  masteryStatus,
  streakInfo,
  type Stats,
  type XpKind,
} from "./rules";

/** IntelliHorizon serves Bangladesh: learning days are counted in Asia/Dhaka time (UTC+6, no daylight saving). */
export const DAY_SHIFT = "+6 hours";
export const localDay = (d = new Date()) =>
  new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

export type QuestionRow = {
  id: string;
  chapter_id: string;
  type: "mcq" | "numeric" | "short";
  answer: string;
  options: string | null;
  explanation: string | null;
  hint: string | null;
  source: string;
  source_page: number | null;
  language: string;
  answer_kind: string | null;
  misconceptions: string | null;
  provenance: string | null;
  skill: string | null;
  unit: string | null;
};

export async function awardXp(
  DB: D1Database,
  userId: string,
  kind: XpKind,
  ref: string,
  sessionId: string | null,
): Promise<number> {
  const r = await DB.prepare(
    "INSERT OR IGNORE INTO xp_events (user_id, kind, ref, xp, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(userId, kind, ref, XP[kind], sessionId, nowIso())
    .run();
  return (r.meta?.changes ?? 0) > 0 ? XP[kind] : 0;
}

export async function totalXp(DB: D1Database, userId: string): Promise<number> {
  const r = await DB.prepare("SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_events WHERE user_id = ?")
    .bind(userId)
    .first<{ xp: number }>();
  return r?.xp ?? 0;
}

export async function learningDays(DB: D1Database, userId: string): Promise<string[]> {
  const r = await DB.prepare(
    `SELECT DISTINCT d FROM (
       SELECT date(created_at, '${DAY_SHIFT}') AS d FROM attempts WHERE user_id = ?1
       UNION SELECT date(created_at, '${DAY_SHIFT}') FROM explanations WHERE user_id = ?1
       UNION SELECT date(completed_at, '${DAY_SHIFT}') FROM learning_sessions WHERE user_id = ?1 AND completed_at IS NOT NULL)
     ORDER BY d`,
  )
    .bind(userId)
    .all<{ d: string }>();
  return (r.results ?? []).map((x) => x.d).filter(Boolean);
}

export async function computeStats(
  DB: D1Database,
  userId: string,
): Promise<Stats & { xp: number }> {
  const [row, days, att] = await Promise.all([
    DB.prepare(
      `SELECT (SELECT COUNT(*) FROM chapter_activity WHERE user_id = ?1) AS chaptersOpened,
              (SELECT COUNT(DISTINCT t.subject_key) FROM chapter_activity ca JOIN chapters c ON c.id = ca.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE ca.user_id = ?1) AS subjectsOpened,
              (SELECT COUNT(DISTINCT question_id) FROM attempts WHERE user_id = ?1 AND correct = 1) AS correctQuestions,
              (SELECT COUNT(*) FROM attempts WHERE user_id = ?1) AS attempts,
              (SELECT COUNT(*) FROM xp_events WHERE user_id = ?1 AND kind = 'improved') AS improved,
              (SELECT COUNT(*) FROM xp_events WHERE user_id = ?1 AND kind = 'revision') AS reviewsCorrect,
              (SELECT COUNT(*) FROM learning_sessions WHERE user_id = ?1 AND status = 'completed') AS sessionsCompleted,
              (SELECT COUNT(DISTINCT substr(ref, 1, 36)) FROM xp_events WHERE user_id = ?1 AND kind = 'explain') AS explanations,
              (SELECT COALESCE(SUM(xp), 0) FROM xp_events WHERE user_id = ?1) AS xp`,
    )
      .bind(userId)
      .first<
        Omit<Stats, "learningDays" | "bestStreak" | "demonstratedChapters"> & { xp: number }
      >(),
    learningDays(DB, userId),
    DB.prepare(
      "SELECT question_id, chapter_id, correct, created_at, mode FROM attempts WHERE user_id = ? ORDER BY id",
    )
      .bind(userId)
      .all<{
        question_id: string;
        chapter_id: string;
        correct: number;
        created_at: string;
        mode: string;
      }>(),
  ]);
  const byChapter = new Map<
    string,
    { question_id: string; correct: number; created_at: string; mode: string }[]
  >();
  for (const a of att.results ?? [])
    byChapter.set(a.chapter_id, [...(byChapter.get(a.chapter_id) ?? []), a]);
  const demonstratedChapters = [...byChapter.values()].filter(
    (l) => masteryStatus(l).status === "demonstrated",
  ).length;
  const streak = streakInfo(days, localDay());
  return {
    chaptersOpened: row?.chaptersOpened ?? 0,
    subjectsOpened: row?.subjectsOpened ?? 0,
    correctQuestions: row?.correctQuestions ?? 0,
    attempts: row?.attempts ?? 0,
    improved: row?.improved ?? 0,
    reviewsCorrect: row?.reviewsCorrect ?? 0,
    sessionsCompleted: row?.sessionsCompleted ?? 0,
    explanations: row?.explanations ?? 0,
    learningDays: days.length,
    bestStreak: streak.best,
    demonstratedChapters,
    xp: row?.xp ?? 0,
  };
}

/** Grants any achievement the stored record now supports. Returns only the ones granted by this call. */
export async function grantAchievements(
  DB: D1Database,
  userId: string,
  stats?: Stats,
): Promise<string[]> {
  const s = stats ?? (await computeStats(DB, userId));
  const have = new Set(
    (
      (
        await DB.prepare("SELECT achievement_id FROM user_achievements WHERE user_id = ?")
          .bind(userId)
          .all<{ achievement_id: string }>()
      ).results ?? []
    ).map((r) => r.achievement_id),
  );
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id) || a.value(s) < a.target) continue;
    const r = await DB.prepare(
      "INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, earned_at) VALUES (?, ?, ?)",
    )
      .bind(userId, a.id, nowIso())
      .run();
    if ((r.meta?.changes ?? 0) > 0) fresh.push(a.id);
  }
  return fresh;
}

/** Where a question and its answer came from, as stored with the question. */
export type Provenance = Record<string, string | number | null>;

/** Records written before the rename say "Educerro". They are shown under the current name; the stored rows are left as they are. */
export const rebrand = (s: string) => s.replace(/Educerro/g, "IntelliHorizon");

export type AttemptInput = {
  questionId: string;
  response: string;
  confidence: number | null;
  mode: "practice" | "review";
  clientEventId: string | null;
  sessionId: string | null;
};
export type AttemptResult = {
  ok: true;
  duplicate: boolean;
  correct: boolean;
  correctAnswer: string;
  explanation: string | null;
  hint: string | null;
  misconception: string | null;
  skill: string | null;
  source: string;
  sourcePage: number | null;
  printedPage: number | null;
  provenance: Provenance | null;
  nextReviewDays: number;
  xp: {
    gained: number;
    kind: XpKind | null;
    total: number;
    levelBefore: number;
    levelAfter: number;
  };
  newAchievements: string[];
};
type Fail = { ok: false; code: string };

function feedback(q: QuestionRow) {
  let provenance: Provenance | null = null;
  try {
    provenance = q.provenance ? (JSON.parse(rebrand(q.provenance)) as Provenance) : null;
  } catch {
    provenance = null;
  }
  const printed =
    typeof provenance?.printedPage === "number" ? (provenance.printedPage as number) : null;
  return {
    correctAnswer: displayAnswer(q),
    explanation: q.explanation,
    hint: q.hint,
    skill: q.skill,
    source: q.source,
    sourcePage: q.source_page,
    printedPage: printed,
    provenance,
  };
}

/** Records one answer. Idempotent per clientEventId, so an offline answer sent twice is stored and rewarded once. */
export async function recordAttempt(
  DB: D1Database,
  userId: string,
  input: AttemptInput,
): Promise<AttemptResult | Fail> {
  const q = await DB.prepare(
    "SELECT id, chapter_id, type, answer, options, explanation, hint, source, source_page, language, answer_kind, misconceptions, provenance, skill, unit FROM questions WHERE id = ? AND status = 'published'",
  )
    .bind(input.questionId)
    .first<QuestionRow>();
  if (!q) return { ok: false, code: "not_found" };
  const total0 = await totalXp(DB, userId);

  if (input.clientEventId) {
    const prior = await DB.prepare(
      "SELECT correct, misconception FROM attempts WHERE user_id = ? AND client_event_id = ? AND question_id = ?",
    )
      .bind(userId, input.clientEventId, q.id)
      .first<{ correct: number; misconception: string | null }>();
    if (prior) {
      const lv = levelInfo(total0).level;
      return {
        ok: true,
        duplicate: true,
        correct: !!prior.correct,
        misconception: prior.misconception,
        ...feedback(q),
        nextReviewDays: 0,
        xp: { gained: 0, kind: null, total: total0, levelBefore: lv, levelAfter: lv },
        newAchievements: [],
      };
    }
  }
  if (input.sessionId) {
    const s = await DB.prepare(
      "SELECT question_ids, status FROM learning_sessions WHERE id = ? AND user_id = ?",
    )
      .bind(input.sessionId, userId)
      .first<{ question_ids: string; status: string }>();
    if (!s) return { ok: false, code: "not_found" };
    if (!(JSON.parse(s.question_ids) as string[]).includes(q.id))
      return { ok: false, code: "not_in_session" };
  }
  const response = input.response.trim();
  if (!response) return { ok: false, code: "empty_answer" };
  const g = grade(q, response);
  // An answer the checker cannot read is sent back for clarification instead of being marked wrong.
  if (!g.readable)
    return {
      ok: false,
      code:
        q.type === "numeric" || q.answer_kind === "ratio" || q.answer_kind === "list"
          ? "unreadable_number"
          : "unreadable",
    };

  const [hist, rs] = await Promise.all([
    DB.prepare(
      "SELECT COALESCE(SUM(correct), 0) AS ok, COUNT(*) - COALESCE(SUM(correct), 0) AS wrong FROM attempts WHERE user_id = ? AND question_id = ?",
    )
      .bind(userId, q.id)
      .first<{ ok: number; wrong: number }>(),
    DB.prepare("SELECT box, due_at FROM review_state WHERE user_id = ? AND question_id = ?")
      .bind(userId, q.id)
      .first<{ box: number; due_at: string }>(),
  ]);
  const ts = nowIso();
  const wasDue = !!rs && rs.due_at <= ts;
  const mode = wasDue ? "review" : input.mode;
  try {
    await DB.prepare(
      "INSERT INTO attempts (user_id, question_id, chapter_id, correct, response, confidence, mode, created_at, client_event_id, session_id, misconception) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        userId,
        q.id,
        q.chapter_id,
        g.correct ? 1 : 0,
        response.slice(0, 500),
        input.confidence,
        mode,
        ts,
        input.clientEventId,
        input.sessionId,
        g.misconception,
      )
      .run();
  } catch {
    // Unique client event id raced with another delivery of the same answer: treat as the duplicate it is.
    const lv = levelInfo(total0).level;
    return {
      ok: true,
      duplicate: true,
      correct: g.correct,
      misconception: g.misconception,
      ...feedback(q),
      nextReviewDays: 0,
      xp: { gained: 0, kind: null, total: total0, levelBefore: lv, levelAfter: lv },
      newAchievements: [],
    };
  }
  const nr = nextReview(rs?.box ?? null, g.correct, new Date());
  await DB.prepare(
    `INSERT INTO review_state (user_id, question_id, box, due_at, last_at, last_correct, lapses) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, question_id) DO UPDATE SET box = excluded.box, due_at = excluded.due_at, last_at = excluded.last_at, last_correct = excluded.last_correct, lapses = review_state.lapses + ?`,
  )
    .bind(
      userId,
      q.id,
      nr.box,
      nr.dueAt,
      ts,
      g.correct ? 1 : 0,
      g.correct ? 0 : 1,
      g.correct ? 0 : 1,
    )
    .run();

  const reward = answerReward({
    correct: g.correct,
    questionId: q.id,
    priorCorrect: hist?.ok ?? 0,
    priorWrong: hist?.wrong ?? 0,
    wasDue,
    day: localDay(),
  });
  const gained = reward ? await awardXp(DB, userId, reward.kind, reward.ref, input.sessionId) : 0;
  const total = total0 + gained;
  const newAchievements = await grantAchievements(DB, userId);
  return {
    ok: true,
    duplicate: false,
    correct: g.correct,
    misconception: g.misconception,
    ...feedback(q),
    nextReviewDays: BOX_DAYS[nr.box - 1],
    xp: {
      gained,
      kind: gained ? reward!.kind : null,
      total,
      levelBefore: levelInfo(total0).level,
      levelAfter: levelInfo(total).level,
    },
    newAchievements,
  };
}

export async function audit(
  DB: D1Database,
  actorId: string | null,
  action: string,
  target: string | null,
  detail: Record<string, unknown> | null,
): Promise<void> {
  await DB.prepare(
    "INSERT INTO audit_log (actor_id, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(actorId, action, target, detail ? JSON.stringify(detail).slice(0, 4000) : null, nowIso())
    .run();
}
