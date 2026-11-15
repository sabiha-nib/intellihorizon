// IntelliHorizon learning rules. Pure functions shared by the server (which is the only place rewards are decided)
// and the client (which only displays what the server recorded). Every number here is derived from stored events.
import type { L } from "../../content/types";

/* ─────────── Answer checking: exact fractions, mixed numbers, Bangla digits, ratios and lists ─────────── */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function asciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export type Rational = { n: bigint; d: bigint };
const babs = (x: bigint) => (x < 0n ? -x : x);
function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
export function rat(n: bigint, d: bigint = 1n): Rational {
  if (d === 0n) throw new Error("zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = bgcd(n, d);
  return { n: n / g, d: d / g };
}
const eqRat = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;

/** Parses "3", "-2", "9.6", "48/5", "9 3/5", "৯ ৩/৫" exactly. Returns null for anything else. */
export function parseRational(raw: string): { value: Rational; decimals: number } | null {
  const s = asciiDigits(raw.normalize("NFKC"))
    .replace(/[,\u00a0]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[।.]$/, (m) => (m === "।" ? "" : m));
  let m = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(s);
  if (m) {
    const whole = BigInt(m[2]),
      n = BigInt(m[3]),
      d = BigInt(m[4]);
    if (d === 0n) return null;
    const v = rat(whole * d + n, d);
    return { value: m[1] ? rat(-v.n, v.d) : v, decimals: 0 };
  }
  m = /^(-?\d+)\/(\d+)$/.exec(s.replace(/ /g, ""));
  if (m) {
    const d = BigInt(m[2]);
    return d === 0n ? null : { value: rat(BigInt(m[1]), d), decimals: 0 };
  }
  m = /^(-?)(\d*)\.?(\d*)$/.exec(s.replace(/ /g, ""));
  if (m && (m[2] || m[3])) {
    const frac = m[3] ?? "";
    const v = rat(BigInt((m[2] || "0") + frac), 10n ** BigInt(frac.length));
    return { value: m[1] ? rat(-v.n, v.d) : v, decimals: frac.length };
  }
  return null;
}

function numbersEqual(got: { value: Rational; decimals: number }, want: Rational): boolean {
  if (eqRat(got.value, want)) return true;
  // A rounded decimal is accepted for a non-terminating answer (e.g. 4.44 for 40/9), to within 0.006.
  if (want.d === 1n || got.decimals < 2) return false;
  const diff = Number(got.value.n * want.d - want.n * got.value.d) / Number(got.value.d * want.d);
  return Math.abs(diff) <= 0.006;
}

/** "3 : 6 : 10", "৩:৬:১০", "3 ∶ 6 ∶ 10" → [3, 6, 10] as rationals. */
export function parseRatio(raw: string): Rational[] | null {
  const parts = asciiDigits(raw.normalize("NFKC"))
    .replace(/[∶：]/g, ":")
    .split(":")
    .map((p) => p.trim());
  if (parts.length < 2 || parts.some((p) => !p)) return null;
  const vals = parts.map((p) => parseRational(p)?.value ?? null);
  return vals.some((v) => v === null || v.n === 0n) ? null : (vals as Rational[]);
}
/** Two ratios are the same when every term is the same multiple (2:3 = 4:6). Order matters. */
export function sameRatio(a: Rational[], b: Rational[]): boolean {
  if (a.length !== b.length) return false;
  const k = rat(a[0].n * b[0].d, a[0].d * b[0].n);
  return a.every((x, i) => eqRat(rat(x.n * b[i].d, x.d * b[i].n), k));
}

export function normalizeText(s: string): string {
  return asciiDigits(s.normalize("NFC").toLowerCase())
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type AnswerKind = "choice" | "number" | "ratio" | "list" | "text";
export type Gradable = {
  type: "mcq" | "numeric" | "short";
  answer_kind: string | null;
  answer: string;
  misconceptions?: string | null;
};
export type Graded = { correct: boolean; readable: boolean; misconception: string | null };

export function kindOf(q: Pick<Gradable, "type" | "answer_kind">): AnswerKind {
  if (
    q.answer_kind === "choice" ||
    q.answer_kind === "number" ||
    q.answer_kind === "ratio" ||
    q.answer_kind === "list" ||
    q.answer_kind === "text"
  )
    return q.answer_kind;
  return q.type === "mcq" ? "choice" : q.type === "numeric" ? "number" : "text";
}

/** Grades a response. "readable: false" means the answer could not be understood, so it is not marked wrong. */
export function grade(q: Gradable, response: string): Graded {
  const r = response.trim();
  const kind = kindOf(q);
  if (kind === "choice") {
    let tag: string | null = null;
    try {
      tag = q.misconceptions
        ? ((JSON.parse(q.misconceptions) as Record<string, string>)[r] ?? null)
        : null;
    } catch {
      tag = null;
    }
    return {
      correct: r === q.answer,
      readable: r.length > 0,
      misconception: r === q.answer ? null : tag,
    };
  }
  if (kind === "number") {
    const want = parseRational(q.answer);
    const got = parseRational(r.replace(/[^\d০-৯./\-\s]+$/u, "").trim());
    if (!want || !got) return { correct: false, readable: !!got, misconception: null };
    return { correct: numbersEqual(got, want.value), readable: true, misconception: null };
  }
  if (kind === "ratio") {
    const want = parseRatio(q.answer);
    const got = parseRatio(r);
    if (!want || !got) return { correct: false, readable: !!got, misconception: null };
    return { correct: sameRatio(got, want), readable: true, misconception: null };
  }
  if (kind === "list") {
    const want = q.answer.split(",").map((x) => parseRational(x));
    const got = asciiDigits(r)
      .split(/[,،;]|\s+and\s+|\s+ও\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => parseRational(x.replace(/[^\d./\-\s]+/g, "").trim()));
    if (got.some((g) => !g) || !got.length)
      return { correct: false, readable: false, misconception: null };
    const ok =
      got.length === want.length && want.every((w, i) => !!w && numbersEqual(got[i]!, w.value));
    return { correct: ok, readable: true, misconception: null };
  }
  let accepted: string[] = [];
  try {
    accepted = JSON.parse(q.answer) as string[];
  } catch {
    accepted = [q.answer];
  }
  const n = normalizeText(r);
  return {
    correct: n.length > 0 && accepted.some((a) => normalizeText(a) === n),
    readable: n.length > 0,
    misconception: null,
  };
}

/** The model answer as a student would write it. */
export function displayAnswer(q: {
  answer: string;
  options: string | null;
  answer_kind: string | null;
  type: string;
  language: string;
}): string {
  const bn = q.language === "bn";
  const digits = (s: string) => (bn ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s);
  const kind = kindOf(q as Gradable);
  if (kind === "choice" && q.options) {
    try {
      return (
        (JSON.parse(q.options) as { id: string; text: string }[]).find((o) => o.id === q.answer)
          ?.text ?? q.answer
      );
    } catch {
      return q.answer;
    }
  }
  if (kind === "ratio") return digits(q.answer.split(":").join(" : "));
  if (kind === "list") return digits(q.answer.split(",").join(", "));
  if (kind === "number") {
    const v = parseRational(q.answer)?.value;
    if (v && v.d !== 1n) {
      const whole = v.n / v.d,
        rem = v.n % v.d;
      return digits(whole ? `${whole} ${babs(rem)}/${v.d}` : `${v.n}/${v.d}`);
    }
    return digits(q.answer);
  }
  try {
    return (JSON.parse(q.answer) as string[])[0];
  } catch {
    return q.answer;
  }
}

/* ─────────── XP: a fixed, published table. Each reward is tied to one stored event and can be earned once. ─────────── */

export const XP = {
  first_correct: 10, // first time a question is answered correctly
  improved: 15, // answered correctly after getting it wrong before
  revision: 6, // correct on a scheduled review that was due (once per question per day)
  session_complete: 20, // finished a Learning Session with at least 3 answers
  explain: 5, // explained a chapter in your own words, covering at least two key ideas (once per chapter per day)
  chapter_opened: 2, // opened a chapter for the first time
} as const;
export type XpKind = keyof typeof XP;

export const XP_RULES: { kind: XpKind; label: L }[] = [
  {
    kind: "first_correct",
    label: { en: "A question right for the first time", bn: "প্রথমবার কোনো প্রশ্ন সঠিক" },
  },
  {
    kind: "improved",
    label: { en: "Right after getting it wrong before", bn: "আগে ভুল, এবার সঠিক" },
  },
  {
    kind: "revision",
    label: { en: "A due revision answered correctly", bn: "সময়মতো পুনরালোচনায় সঠিক" },
  },
  {
    kind: "session_complete",
    label: {
      en: "A Learning Session finished (3+ answers)",
      bn: "একটি লার্নিং সেশন শেষ (৩+ উত্তর)",
    },
  },
  {
    kind: "explain",
    label: {
      en: "A chapter explained in your own words",
      bn: "নিজের ভাষায় একটি অধ্যায় ব্যাখ্যা",
    },
  },
  { kind: "chapter_opened", label: { en: "A new chapter opened", bn: "নতুন অধ্যায় খোলা" } },
];

/** Decides which answer reward (if any) applies. History is this student's earlier attempts on the same question. */
export function answerReward(input: {
  correct: boolean;
  questionId: string;
  priorCorrect: number;
  priorWrong: number;
  wasDue: boolean;
  day: string;
}): { kind: XpKind; ref: string } | null {
  if (!input.correct) return null;
  if (input.priorCorrect === 0 && input.priorWrong > 0)
    return { kind: "improved", ref: input.questionId };
  if (input.priorCorrect === 0) return { kind: "first_correct", ref: input.questionId };
  if (input.wasDue) return { kind: "revision", ref: `${input.questionId}:${input.day}` };
  return null;
}

/* ─────────── Levels ─────────── */

export const LEVELS: { at: number; name: L }[] = [
  { at: 0, name: { en: "Explorer", bn: "অভিযাত্রী" } },
  { at: 60, name: { en: "Discoverer", bn: "আবিষ্কারক" } },
  { at: 160, name: { en: "Thinker", bn: "চিন্তক" } },
  { at: 320, name: { en: "Scholar", bn: "বিদ্যার্থী" } },
  { at: 560, name: { en: "Innovator", bn: "উদ্ভাবক" } },
  { at: 900, name: { en: "Mastermind", bn: "মহাজ্ঞানী" } },
];
export function levelInfo(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].at) i++;
  const next = LEVELS[i + 1] ?? null;
  const span = next ? next.at - LEVELS[i].at : 1;
  return {
    level: i + 1,
    name: LEVELS[i].name,
    xp,
    floor: LEVELS[i].at,
    next: next?.at ?? null,
    toNext: next ? next.at - xp : 0,
    progress: next ? (xp - LEVELS[i].at) / span : 1,
  };
}

/* ─────────── Learning days and a gentle streak ─────────── */

const dayMs = 86400000;
const toDay = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/**
 * Learning days in a row, ending today (or yesterday, so a day isn't lost before you've studied).
 * One missed day is forgiven in every 7 learning days. A missed day never removes XP, levels or progress.
 */
export function streakInfo(
  days: string[],
  today: string,
): { current: number; restUsed: boolean; activeToday: boolean; best: number } {
  const set = new Set(days);
  const activeToday = set.has(today);
  let cursor = toDay(today) - (activeToday ? 0 : dayMs);
  let current = 0,
    credit = 1,
    since = 0,
    restUsed = false;
  for (;;) {
    if (set.has(iso(cursor))) {
      current++;
      since++;
      if (since >= 7) credit = 1;
      cursor -= dayMs;
      continue;
    }
    if (credit > 0 && set.has(iso(cursor - dayMs))) {
      credit = 0;
      since = 0;
      restUsed = true;
      cursor -= dayMs;
      continue;
    }
    break;
  }
  if (current === 0) restUsed = false;
  let best = 0,
    run = 0,
    prev: number | null = null;
  credit = 1;
  since = 0;
  for (const d of [...set].sort()) {
    const t = toDay(d);
    const gap = prev === null ? 0 : Math.round((t - prev) / dayMs);
    if (prev === null || gap > 2 || (gap === 2 && credit === 0)) {
      run = 1;
      credit = 1;
      since = 1;
    } else {
      if (gap === 2) {
        credit = 0;
        since = 0;
      }
      run++;
      since++;
      if (since >= 7) credit = 1;
    }
    best = Math.max(best, run);
    prev = t;
  }
  return { current, restUsed, activeToday, best: Math.max(best, current) };
}

/* ─────────── Mastery: what the record shows for one chapter ─────────── */

export type MasteryStatus = "none" | "practising" | "developing" | "demonstrated";
export type AttemptLite = {
  question_id: string;
  correct: number;
  created_at: string;
  mode?: string | null;
};

/**
 * none: no answers. practising: some answers. developing: 3+ different questions and 60%+ of the last 10 right.
 * demonstrated: 5+ different questions right, at least one due review right, and 70%+ of the last 10 right.
 * This describes evidence in IntelliHorizon only; it is not a grade or an exam result.
 */
export function masteryStatus(attempts: AttemptLite[]): {
  status: MasteryStatus;
  distinct: number;
  distinctCorrect: number;
  recentRate: number;
  reviewCorrect: number;
} {
  if (!attempts.length)
    return { status: "none", distinct: 0, distinctCorrect: 0, recentRate: 0, reviewCorrect: 0 };
  const sorted = [...attempts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const distinct = new Set(sorted.map((a) => a.question_id)).size;
  const distinctCorrect = new Set(sorted.filter((a) => a.correct).map((a) => a.question_id)).size;
  const recent = sorted.slice(-10);
  const recentRate = recent.filter((a) => a.correct).length / recent.length;
  const reviewCorrect = sorted.filter((a) => a.mode === "review" && a.correct).length;
  let status: MasteryStatus = "practising";
  if (distinct >= 3 && recentRate >= 0.6) status = "developing";
  if (distinctCorrect >= 5 && reviewCorrect >= 1 && recentRate >= 0.7) status = "demonstrated";
  return { status, distinct, distinctCorrect, recentRate, reviewCorrect };
}

/* ─────────── Mistake radar ─────────── */

export type RadarAttempt = AttemptLite & { misconception?: string | null; skill?: string | null };
/** Confirmed: wrong twice or more and still not right since. Pattern: the same misconception on 2+ questions. Weak skill: 3+ answers under 60%. Fixed: wrong before, right on the latest try. */
export function radar(attempts: RadarAttempt[]) {
  const byQ = new Map<string, RadarAttempt[]>();
  for (const a of [...attempts].sort((x, y) => x.created_at.localeCompare(y.created_at)))
    byQ.set(a.question_id, [...(byQ.get(a.question_id) ?? []), a]);
  const confirmed: string[] = [],
    fixed: string[] = [];
  for (const [qid, list] of byQ) {
    const wrong = list.filter((a) => !a.correct).length;
    const last = list[list.length - 1];
    if (wrong >= 2 && !last.correct) confirmed.push(qid);
    if (wrong >= 1 && last.correct) fixed.push(qid);
  }
  const tagQs = new Map<string, Set<string>>();
  for (const a of attempts)
    if (!a.correct && a.misconception)
      tagQs.set(a.misconception, (tagQs.get(a.misconception) ?? new Set()).add(a.question_id));
  const patterns = [...tagQs]
    .filter(([, qs]) => qs.size >= 2)
    .map(([tag, qs]) => ({ tag, questions: [...qs] }));
  const bySkill = new Map<string, { n: number; ok: number }>();
  for (const a of attempts)
    if (a.skill) {
      const s = bySkill.get(a.skill) ?? { n: 0, ok: 0 };
      s.n++;
      s.ok += a.correct ? 1 : 0;
      bySkill.set(a.skill, s);
    }
  const weakSkills = [...bySkill]
    .filter(([, s]) => s.n >= 3 && s.ok / s.n < 0.6)
    .map(([skill, s]) => ({ skill, attempts: s.n, correct: s.ok }));
  return { confirmed, patterns, weakSkills, fixed };
}

/* ─────────── Explain It Back: which key ideas an explanation covers ─────────── */

export type KeyIdea = { id: string; label: L; words: string[] };
/** An idea counts as mentioned when its own words appear. Two or more ideas and at least 12 words are needed to count as an explanation. */
export function explainCoverage(text: string, ideas: KeyIdea[]) {
  const t = text.normalize("NFC").toLowerCase();
  const words = t.split(/\s+/).filter(Boolean).length;
  const covered = ideas
    .filter((i) => i.words.some((w) => t.includes(w.toLowerCase())))
    .map((i) => i.id);
  return {
    covered,
    missing: ideas.filter((i) => !covered.includes(i.id)).map((i) => i.id),
    words,
    counts: covered.length >= Math.min(2, ideas.length) && words >= 12,
  };
}

/* ─────────── Achievements: each one is a specific behaviour, read from stored records ─────────── */

export type Stats = {
  chaptersOpened: number;
  subjectsOpened: number;
  correctQuestions: number;
  attempts: number;
  improved: number;
  reviewsCorrect: number;
  sessionsCompleted: number;
  explanations: number;
  learningDays: number;
  bestStreak: number;
  demonstratedChapters: number;
};
export type Achievement = {
  id: string;
  category: "discovery" | "consistency" | "practice" | "improvement" | "understanding" | "revision";
  title: L;
  how: L;
  target: number;
  value: (s: Stats) => number;
};
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-steps",
    category: "discovery",
    title: { en: "First Discovery", bn: "প্রথম আবিষ্কার" },
    how: { en: "Open your first chapter", bn: "প্রথম অধ্যায় খোলো" },
    target: 1,
    value: (s) => s.chaptersOpened,
  },
  {
    id: "wide-explorer",
    category: "discovery",
    title: { en: "Curious Mind", bn: "কৌতূহলী মন" },
    how: { en: "Open chapters in 4 different subjects", bn: "৪টি ভিন্ন বিষয়ের অধ্যায় খোলো" },
    target: 4,
    value: (s) => s.subjectsOpened,
  },
  {
    id: "three-days",
    category: "consistency",
    title: { en: "Three good days", bn: "তিনটি ভালো দিন" },
    how: { en: "Learn on 3 different days", bn: "৩টি ভিন্ন দিনে শেখো" },
    target: 3,
    value: (s) => s.learningDays,
  },
  {
    id: "steady-week",
    category: "consistency",
    title: { en: "Consistency Builder", bn: "ধারাবাহিকতার কারিগর" },
    how: {
      en: "Reach a 7-day streak (one rest day allowed)",
      bn: "৭ দিনের ধারা (একদিন বিশ্রাম চলবে)",
    },
    target: 7,
    value: (s) => s.bestStreak,
  },
  {
    id: "ten-right",
    category: "practice",
    title: { en: "Ten right", bn: "দশে দশ" },
    how: { en: "Get 10 different questions right", bn: "১০টি ভিন্ন প্রশ্ন সঠিক করো" },
    target: 10,
    value: (s) => s.correctQuestions,
  },
  {
    id: "session-finisher",
    category: "practice",
    title: { en: "Session finisher", bn: "সেশন সমাপ্তকারী" },
    how: { en: "Finish 3 Learning Sessions", bn: "৩টি লার্নিং সেশন শেষ করো" },
    target: 3,
    value: (s) => s.sessionsCompleted,
  },
  {
    id: "comeback",
    category: "improvement",
    title: { en: "Deep Thinker", bn: "গভীর চিন্তক" },
    how: {
      en: "Get 3 questions right that you missed before",
      bn: "আগে ভুল হওয়া ৩টি প্রশ্ন সঠিক করো",
    },
    target: 3,
    value: (s) => s.improved,
  },
  {
    id: "in-my-words",
    category: "understanding",
    title: { en: "Independent Explainer", bn: "স্বাধীন ব্যাখ্যাকারী" },
    how: {
      en: "Explain 2 chapters in your own words",
      bn: "নিজের ভাষায় ২টি অধ্যায় ব্যাখ্যা করো",
    },
    target: 2,
    value: (s) => s.explanations,
  },
  {
    id: "demonstrated",
    category: "understanding",
    title: { en: "Concept Conqueror", bn: "ধারণা জয়ী" },
    how: {
      en: "Reach 'demonstrated' in one chapter",
      bn: "একটি অধ্যায়ে 'প্রমাণিত' পর্যায়ে পৌঁছাও",
    },
    target: 1,
    value: (s) => s.demonstratedChapters,
  },
  {
    id: "still-there",
    category: "revision",
    title: { en: "Revision Champion", bn: "পুনরালোচনার চ্যাম্পিয়ন" },
    how: { en: "Answer 5 due reviews correctly", bn: "সময়মতো ৫টি পুনরালোচনা সঠিক করো" },
    target: 5,
    value: (s) => s.reviewsCorrect,
  },
];
export const ACHIEVEMENT_CATEGORY: Record<Achievement["category"], L> = {
  discovery: { en: "Discovery", bn: "আবিষ্কার" },
  consistency: { en: "Consistency", bn: "ধারাবাহিকতা" },
  practice: { en: "Practice", bn: "অনুশীলন" },
  improvement: { en: "Improvement", bn: "উন্নতি" },
  understanding: { en: "Understanding", bn: "বোঝাপড়া" },
  revision: { en: "Revision", bn: "পুনরালোচনা" },
};

/* ─────────── Daily missions: today's real activity against small, fixed goals ─────────── */

export type Today = {
  answered: number;
  correct: number;
  newChapters: number;
  reviewsDone: number;
  reviewsDue: number;
  explained: number;
  sessions: number;
};
export type Mission = {
  id: string;
  title: L;
  target: number;
  value: number;
  done: boolean;
  to: string;
};
export function missionsFor(t: Today, dailyGoal: number): Mission[] {
  const goal = Math.max(3, Math.min(20, dailyGoal || 5));
  const m: Omit<Mission, "done">[] = [
    {
      id: "answer",
      title: {
        en: `Answer ${goal} checked questions`,
        bn: `${goal}টি যাচাই করা প্রশ্নের উত্তর দাও`,
      },
      target: goal,
      value: t.answered,
      to: "/practice",
    },
    {
      id: "session",
      title: { en: "Finish one Learning Session", bn: "একটি লার্নিং সেশন শেষ করো" },
      target: 1,
      value: t.sessions,
      to: "/practice",
    },
    t.reviewsDue + t.reviewsDone > 0
      ? {
          id: "review",
          title: { en: "Clear today's revision", bn: "আজকের পুনরালোচনা শেষ করো" },
          target: t.reviewsDue + t.reviewsDone,
          value: t.reviewsDone,
          to: "/revision",
        }
      : {
          id: "new",
          title: { en: "Open a chapter you haven't seen", bn: "নতুন একটি অধ্যায় খোলো" },
          target: 1,
          value: t.newChapters,
          to: "/learn",
        },
    {
      id: "explain",
      title: {
        en: "Explain a chapter in your own words",
        bn: "নিজের ভাষায় একটি অধ্যায় ব্যাখ্যা করো",
      },
      target: 1,
      value: t.explained,
      to: "/practice",
    },
  ];
  return m.map((x) => ({ ...x, value: Math.min(x.value, x.target), done: x.value >= x.target }));
}

/* ─────────── Adaptive practice: a transparent rule, not a model ─────────── */

export type PracticeLevel = "foundation" | "developing" | "applied" | "challenging";
export const PRACTICE_LEVEL: Record<PracticeLevel, { label: L; difficulty: number }> = {
  foundation: { label: { en: "Foundation", bn: "ভিত্তি" }, difficulty: 1 },
  developing: { label: { en: "Developing", bn: "বিকাশমান" }, difficulty: 2 },
  applied: { label: { en: "Applied", bn: "প্রয়োগ" }, difficulty: 2 },
  challenging: { label: { en: "Challenging", bn: "চ্যালেঞ্জিং" }, difficulty: 3 },
};
/**
 * Level from the student's last answers in this chapter (up to 8):
 * fewer than 3 answers → foundation; under 50% right → foundation; 50–69% → developing; 70–84% → applied; 85%+ → challenging.
 */
export function practiceLevel(recent: { correct: number }[]): { level: PracticeLevel; right: number; of: number } {
  const last = recent.slice(-8);
  const right = last.filter((a) => a.correct).length;
  const of = last.length;
  if (of < 3) return { level: "foundation", right, of };
  const rate = right / of;
  return { level: rate < 0.5 ? "foundation" : rate < 0.7 ? "developing" : rate < 0.85 ? "applied" : "challenging", right, of };
}

/** How sure the radar is that a wrong-answer pattern is real: 2 questions is "possible", 3 or more is "likely". Never "certain". */
export function patternConfidence(questions: number): "possible" | "likely" {
  return questions >= 3 ? "likely" : "possible";
}

/**
 * Picks the questions for a Learning Session: due reviews first, then questions missed before, then new ones nearest
 * the target difficulty, then the rest. Questions already answered correctly come last, so they are not repeated while others remain.
 */
export function pickSessionQuestions(pool: { id: string; difficulty: number | null }[], history: Map<string, { wrong: number; correct: number; due: boolean }>, size = 5, target = 1): string[] {
  const score = (id: string, diff: number) => {
    const h = history.get(id);
    if (h?.due) return 0;
    if (h && h.wrong > 0 && h.correct === 0) return 1;
    if (!h) return 2 + Math.abs(diff - target) / 4 + diff / 100;
    return 4 + diff / 10;
  };
  return [...pool].sort((a, b) => score(a.id, a.difficulty ?? 2) - score(b.id, b.difficulty ?? 2) || a.id.localeCompare(b.id)).slice(0, size).map((q) => q.id);
}
