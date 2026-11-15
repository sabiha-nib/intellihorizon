// Unit tests for the learning rules: grading, XP decisions, levels, streaks, mastery, radar, missions and session picking.
import { describe, expect, test } from "bun:test";

import {
  ACHIEVEMENTS,
  answerReward,
  displayAnswer,
  explainCoverage,
  grade,
  levelInfo,
  masteryStatus,
  missionsFor,
  parseRational,
  patternConfidence,
  practiceLevel,
  pickSessionQuestions,
  radar,
  streakInfo,
} from "../src/lib/learning/rules";

const num = (answer: string) => ({ type: "numeric" as const, answer_kind: "number", answer });
describe("grading", () => {
  test("exact fractions, mixed numbers and Bangla digits", () => {
    expect(grade(num("48/5"), "48/5").correct).toBe(true);
    expect(grade(num("48/5"), "9 3/5").correct).toBe(true);
    expect(grade(num("48/5"), "৯ ৩/৫").correct).toBe(true);
    expect(grade(num("48/5"), "9.6").correct).toBe(true);
    expect(grade(num("48/5"), "9.5").correct).toBe(false);
    expect(grade(num("3"), "৩").correct).toBe(true);
    expect(grade(num("3"), "3 দিন").correct).toBe(true);
  });
  test("rounded decimals only for non-terminating answers", () => {
    expect(grade(num("40/9"), "4.44").correct).toBe(true);
    expect(grade(num("40/9"), "4.4").correct).toBe(false);
    expect(grade(num("6"), "6.001").correct).toBe(false);
  });
  test("unreadable answers are not marked as readable", () => {
    expect(grade(num("3"), "three").readable).toBe(false);
    expect(parseRational("1/0")).toBeNull();
  });
  test("ratios compare by proportion and keep order", () => {
    const q = { type: "short" as const, answer_kind: "ratio", answer: "3:6:10" };
    expect(grade(q, "৩ : ৬ : ১০").correct).toBe(true);
    expect(grade(q, "6:12:20").correct).toBe(true);
    expect(grade(q, "10:6:3").correct).toBe(false);
    expect(grade(q, "3:6").correct).toBe(false);
  });
  test("lists", () => {
    const q = { type: "short" as const, answer_kind: "list", answer: "30,60,100" };
    expect(grade(q, "৩০, ৬০, ১০০").correct).toBe(true);
    expect(grade(q, "30 গ্রাম, 60 গ্রাম, 100 গ্রাম").correct).toBe(true);
    expect(grade(q, "60, 30, 100").correct).toBe(false);
  });
  test("multiple choice reports the misconception of the chosen option", () => {
    const q = {
      type: "mcq" as const,
      answer_kind: "choice",
      answer: "ক",
      misconceptions: JSON.stringify({ ঘ: "squared-not-rooted" }),
    };
    expect(grade(q, "ঘ")).toEqual({
      correct: false,
      readable: true,
      misconception: "squared-not-rooted",
    });
    expect(grade(q, "ক").misconception).toBeNull();
  });
  test("short text ignores case and punctuation", () => {
    const q = { type: "short" as const, answer_kind: "text", answer: JSON.stringify(["রহমত"]) };
    expect(grade(q, " রহমত। ").correct).toBe(true);
    expect(grade(q, "মিনি").correct).toBe(false);
  });
  test("display answers", () => {
    expect(
      displayAnswer({
        answer: "48/5",
        options: null,
        answer_kind: "number",
        type: "numeric",
        language: "bn",
      }),
    ).toBe("৯ ৩/৫");
    expect(
      displayAnswer({
        answer: "3:6:10",
        options: null,
        answer_kind: "ratio",
        type: "short",
        language: "bn",
      }),
    ).toBe("৩ : ৬ : ১০");
  });
});

describe("xp", () => {
  const base = { questionId: "q1", day: "2026-10-26", wasDue: false };
  test("first correct, improved and revision are separate, one-time rewards", () => {
    expect(answerReward({ ...base, correct: true, priorCorrect: 0, priorWrong: 0 })).toEqual({
      kind: "first_correct",
      ref: "q1",
    });
    expect(answerReward({ ...base, correct: true, priorCorrect: 0, priorWrong: 2 })).toEqual({
      kind: "improved",
      ref: "q1",
    });
    expect(
      answerReward({ ...base, correct: true, priorCorrect: 1, priorWrong: 0, wasDue: true }),
    ).toEqual({ kind: "revision", ref: "q1:2026-10-26" });
    expect(answerReward({ ...base, correct: true, priorCorrect: 1, priorWrong: 0 })).toBeNull();
    expect(answerReward({ ...base, correct: false, priorCorrect: 0, priorWrong: 0 })).toBeNull();
  });
  test("levels", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(59).level).toBe(1);
    expect(levelInfo(60).level).toBe(2);
    expect(levelInfo(100).toNext).toBe(60);
    expect(levelInfo(5000).next).toBeNull();
    expect(levelInfo(5000).level).toBe(6);
  });
  test("adaptive practice level follows recent accuracy", () => {
    const a = (n: number, ok: number) => Array.from({ length: n }, (_, i) => ({ correct: i < ok ? 1 : 0 }));
    expect(practiceLevel(a(2, 2)).level).toBe("foundation");
    expect(practiceLevel(a(5, 2)).level).toBe("foundation");
    expect(practiceLevel(a(5, 3)).level).toBe("developing");
    expect(practiceLevel(a(5, 4)).level).toBe("applied");
    expect(practiceLevel(a(8, 8)).level).toBe("challenging");
    expect(patternConfidence(2)).toBe("possible");
    expect(patternConfidence(3)).toBe("likely");
  });
  test("a higher target prefers harder new questions", () => {
    const pool = [
      { id: "easy", difficulty: 1 },
      { id: "hard", difficulty: 3 },
      { id: "mid", difficulty: 2 },
    ];
    expect(pickSessionQuestions(pool, new Map(), 1, 3)).toEqual(["hard"]);
    expect(pickSessionQuestions(pool, new Map(), 1, 1)).toEqual(["easy"]);
  });

});

describe("streak", () => {
  test("counts back from today or yesterday", () => {
    expect(streakInfo(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-26").current).toBe(3);
    expect(streakInfo(["2026-10-24", "2026-10-25"], "2026-10-26")).toMatchObject({
      current: 2,
      activeToday: false,
    });
  });
  test("forgives one rest day", () => {
    expect(
      streakInfo(["2026-10-22", "2026-10-23", "2026-10-25", "2026-10-26"], "2026-10-26"),
    ).toMatchObject({ current: 4, restUsed: true });
    expect(streakInfo(["2026-10-20", "2026-10-22", "2026-10-24"], "2026-10-24").current).toBe(2);
  });
  test("resets after a longer break, and best is kept", () => {
    const s = streakInfo(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-26"], "2026-10-26");
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
    expect(streakInfo([], "2026-10-26").current).toBe(0);
  });
});

describe("evidence", () => {
  const a = (q: string, c: number, d: string, mode = "practice") => ({
    question_id: q,
    correct: c,
    created_at: d,
    mode,
  });
  test("mastery needs varied questions, recent accuracy and a due review", () => {
    expect(masteryStatus([]).status).toBe("none");
    expect(masteryStatus([a("1", 1, "1")]).status).toBe("practising");
    expect(
      masteryStatus([a("1", 1, "1"), a("2", 1, "2"), a("3", 0, "3"), a("4", 1, "4")]).status,
    ).toBe("developing");
    const five = ["1", "2", "3", "4", "5"].map((q, i) => a(q, 1, String(i)));
    expect(masteryStatus(five).status).toBe("developing");
    expect(masteryStatus([...five, a("1", 1, "9", "review")]).status).toBe("demonstrated");
  });
  test("radar separates confirmed mistakes, patterns, weak skills and fixed ones", () => {
    const r = radar([
      { ...a("q1", 0, "1"), misconception: "reversed-order", skill: "ratio" },
      { ...a("q1", 0, "2"), misconception: "reversed-order", skill: "ratio" },
      { ...a("q2", 0, "3"), misconception: "reversed-order", skill: "ratio" },
      { ...a("q2", 1, "4"), skill: "ratio" },
    ]);
    expect(r.confirmed).toEqual(["q1"]);
    expect(r.fixed).toEqual(["q2"]);
    expect(r.patterns).toEqual([{ tag: "reversed-order", questions: ["q1", "q2"] }]);
    expect(r.weakSkills).toEqual([{ skill: "ratio", attempts: 4, correct: 1 }]);
  });
  test("explain-it-back needs two ideas and enough words; one keyword is not enough", () => {
    const ideas = [
      { id: "a", label: { en: "", bn: "" }, words: ["equal"] },
      { id: "b", label: { en: "", bn: "" }, words: ["multiply"] },
    ];
    expect(explainCoverage("equal", ideas).counts).toBe(false);
    expect(
      explainCoverage(
        "You multiply both ratios so that the middle terms become equal and then you join them",
        ideas,
      ).counts,
    ).toBe(true);
  });
  test("missions reflect today's activity", () => {
    const m = missionsFor(
      {
        answered: 5,
        correct: 3,
        newChapters: 0,
        reviewsDone: 0,
        reviewsDue: 0,
        explained: 0,
        sessions: 1,
      },
      5,
    );
    expect(m.find((x) => x.id === "answer")?.done).toBe(true);
    expect(m.find((x) => x.id === "new")?.done).toBe(false);
  });
  test("session picks due, then missed, then new", () => {
    const h = new Map([
      ["due", { wrong: 0, correct: 1, due: true }],
      ["missed", { wrong: 1, correct: 0, due: false }],
      ["done", { wrong: 0, correct: 1, due: false }],
    ]);
    expect(
      pickSessionQuestions(
        [
          { id: "done", difficulty: 1 },
          { id: "new", difficulty: 1 },
          { id: "missed", difficulty: 1 },
          { id: "due", difficulty: 1 },
        ],
        h,
        3,
      ),
    ).toEqual(["due", "missed", "new"]);
  });
  test("achievements have unique ids", () => {
    expect(new Set(ACHIEVEMENTS.map((x) => x.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
