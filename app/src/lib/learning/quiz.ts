// IntelliQuiz rules (pure, shared, unit-tested). Question choice, result analysis and topic states are all derived
// from the student's own records; nothing here is a grade or a prediction of an exam result.
import { masteryStatus, pickSessionQuestions } from "./rules";

export const QUIZ_MODES = ["quick", "chapter", "topic", "mistakes", "weakness", "daily", "exam"] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];

/** Deferred feedback only in exam simulation; every other mode explains each answer straight away. */
export const feedbackFor = (m: QuizMode): "immediate" | "deferred" => (m === "exam" ? "deferred" : "immediate");
/** Exam simulation gives 90 seconds per question. */
export const EXAM_SECONDS_PER_QUESTION = 90;

export type PoolQ = { id: string; difficulty: number | null; skill: string | null; chapter_id: string };
export type History = Map<string, { wrong: number; correct: number; due: boolean; lastCorrect: boolean }>;

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Chooses questions for a mode. Returns [] when the mode has nothing to offer (for example no past mistakes),
 * so the caller can say so instead of filling the set with unrelated questions.
 */
export function pickQuiz(mode: QuizMode, pool: PoolQ[], history: History, count: number, rand: () => number = Math.random, opts: { skill?: string | null } = {}): string[] {
  const h = (id: string) => history.get(id);
  switch (mode) {
    case "daily":
    case "quick":
      return pickSessionQuestions(pool, history, count, 1);
    case "chapter":
      return shuffle(pool, rand).slice(0, count).map((q) => q.id);
    case "topic":
      return shuffle(pool.filter((q) => opts.skill && q.skill === opts.skill), rand).slice(0, count).map((q) => q.id);
    case "mistakes":
      return shuffle(pool.filter((q) => h(q.id) && !h(q.id)!.lastCorrect), rand).slice(0, count).map((q) => q.id);
    case "weakness": {
      // A skill is weak with 2+ answers and under 60% right; prefer the questions in it not yet answered correctly.
      const bySkill = new Map<string, { n: number; ok: number }>();
      for (const q of pool) {
        const x = h(q.id);
        if (!x || !q.skill) continue;
        const s = bySkill.get(q.skill) ?? { n: 0, ok: 0 };
        s.n += x.wrong + x.correct;
        s.ok += x.correct;
        bySkill.set(q.skill, s);
      }
      const weak = new Set([...bySkill].filter(([, s]) => s.n >= 2 && s.ok / s.n < 0.6).map(([k]) => k));
      const inWeak = pool.filter((q) => q.skill && weak.has(q.skill));
      return [...shuffle(inWeak.filter((q) => !h(q.id)?.lastCorrect), rand), ...shuffle(inWeak.filter((q) => h(q.id)?.lastCorrect), rand)].slice(0, count).map((q) => q.id);
    }
    case "exam":
      return shuffle(pool, rand).slice(0, count).map((q) => q.id);
  }
}

export type QuizRow = { questionId: string; skill: string | null; difficulty: number | null; correct: boolean | null; misconception: string | null; flagged: boolean };
export type QuizAnalysis = {
  total: number; attempted: number; correct: number; incorrect: number; skipped: number;
  /** Right answers out of attempted questions (skipped ones are reported separately). */
  accuracy: number | null;
  bySkill: { skill: string | null; correct: number; attempted: number; total: number }[];
  byDifficulty: { difficulty: number | null; correct: number; attempted: number; total: number }[];
  /** Mistake types seen in this set. "repeated" = the same type on 2+ questions here; otherwise a single observation. */
  misconceptions: { id: string; questions: number; repeated: boolean }[];
  revisit: string[];
  next: { kind: "mistakes" | "topic" | "revision" | "challenge" | "chapter"; skill: string | null; why: string };
};

export function analyseQuiz(rows: QuizRow[]): QuizAnalysis {
  const attempted = rows.filter((r) => r.correct !== null);
  const correct = attempted.filter((r) => r.correct).length;
  const group = <K,>(key: (r: QuizRow) => K) => {
    const m = new Map<K, { correct: number; attempted: number; total: number }>();
    for (const r of rows) {
      const g = m.get(key(r)) ?? { correct: 0, attempted: 0, total: 0 };
      g.total++;
      if (r.correct !== null) g.attempted++;
      if (r.correct) g.correct++;
      m.set(key(r), g);
    }
    return [...m];
  };
  const mis = new Map<string, Set<string>>();
  for (const r of rows) if (r.correct === false && r.misconception) mis.set(r.misconception, (mis.get(r.misconception) ?? new Set()).add(r.questionId));
  const misconceptions = [...mis].map(([id, qs]) => ({ id, questions: qs.size, repeated: qs.size >= 2 })).sort((a, b) => b.questions - a.questions);
  const revisit = rows.filter((r) => r.correct !== true || r.flagged).map((r) => r.questionId);
  const bySkill = group((r) => r.skill).map(([skill, g]) => ({ skill, ...g }));
  const weakest = bySkill.filter((s) => s.attempted > 0 && s.correct / s.attempted < 0.6).sort((a, b) => a.correct / a.attempted - b.correct / b.attempted)[0];
  const incorrect = attempted.length - correct;
  const next: QuizAnalysis["next"] =
    incorrect > 0 && misconceptions.some((m) => m.repeated)
      ? { kind: "mistakes", skill: null, why: "repeated_mistake" }
      : weakest
        ? { kind: "topic", skill: weakest.skill, why: "weakest_skill" }
        : incorrect > 0
          ? { kind: "mistakes", skill: null, why: "some_wrong" }
          : rows.length - attempted.length > 0
            ? { kind: "chapter", skill: null, why: "skipped" }
            : { kind: "challenge", skill: null, why: "all_right" };
  return {
    total: rows.length, attempted: attempted.length, correct, incorrect, skipped: rows.length - attempted.length,
    accuracy: attempted.length ? correct / attempted.length : null,
    bySkill, byDifficulty: group((r) => r.difficulty).map(([difficulty, g]) => ({ difficulty, ...g })).sort((a, b) => (a.difficulty ?? 0) - (b.difficulty ?? 0)),
    misconceptions, revisit, next,
  };
}

/* ─────────── Topic states ─────────── */

export type TopicState = "not_explored" | "available" | "learning" | "practicing" | "developing" | "demonstrated" | "needs_revision";

/**
 * not_explored: nothing to learn here yet (no checked text or questions) and no activity.
 * available: checked material or questions exist; not started.
 * learning: the chapter was opened or the tutor asked about it, but no answers yet.
 * practicing / developing / demonstrated: the mastery rule on this topic's answers (see rules.masteryStatus).
 * needs_revision: answers exist and at least one of this topic's questions is due for revision.
 * Opening a topic or answering one easy question never reaches "demonstrated".
 */
export function topicState(input: { hasMaterial: boolean; hasQuestions: boolean; opened: boolean; attempts: { question_id: string; correct: number; created_at: string; mode?: string | null }[]; due: number }): TopicState {
  if (!input.attempts.length) {
    if (input.opened) return "learning";
    return input.hasMaterial || input.hasQuestions ? "available" : "not_explored";
  }
  if (input.due > 0) return "needs_revision";
  const m = masteryStatus(input.attempts).status;
  return m === "demonstrated" ? "demonstrated" : m === "developing" ? "developing" : "practicing";
}
