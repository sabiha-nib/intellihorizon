// Pure rules behind MemoryCards, IntelliSummary, ExamArena readiness, the improvement view and QuestionGen
// validation. No database or network here, so every rule is unit-tested.

export type Grade = "again" | "hard" | "good" | "easy";
export const GRADES: Grade[] = ["again", "hard", "good", "easy"];
export type CardSched = { ease: number; interval_days: number; reps: number; lapses: number };

/** SM-2 style spacing. "Again" resets the interval and counts a lapse; ease never drops below 1.3. */
export function schedule(c: CardSched, g: Grade, now = new Date()): CardSched & { due_at: string } {
  let { ease, interval_days: iv, reps, lapses } = c;
  if (g === "again") { lapses += 1; reps = 0; iv = 0; ease = Math.max(1.3, ease - 0.2); }
  else {
    reps += 1;
    if (g === "hard") { iv = reps === 1 ? 1 : Math.max(1, iv * 1.2); ease = Math.max(1.3, ease - 0.15); }
    else if (g === "good") iv = reps === 1 ? 1 : reps === 2 ? 3 : iv * ease;
    else { iv = reps === 1 ? 3 : Math.max(4, iv * ease * 1.3); ease += 0.15; }
  }
  const ms = g === "again" ? 10 * 60_000 : Math.round(iv * 86_400_000);
  return { ease: Math.round(ease * 100) / 100, interval_days: Math.round(iv * 100) / 100, reps, lapses, due_at: new Date(now.getTime() + ms).toISOString() };
}

/** Splits text into sentences at Bangla dari (।), ?, ! and full stops followed by a space. */
export function sentences(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[।?!])\s*|(?<=\.)\s+/).map((s) => s.trim()).filter((s) => s.length >= 12);
}

/**
 * Definition sentences, taken verbatim from the text: Bangla "… কে … বলে।" and English "… is called …" / "… is defined as …".
 * Returns the term the sentence defines, so a card can ask "X কাকে বলে?". Nothing is paraphrased.
 */
export function extractDefinitions(text: string): { term: string; sentence: string; lang: "bn" | "en" }[] {
  const out: { term: string; sentence: string; lang: "bn" | "en" }[] = [];
  for (const s of sentences(text)) {
    const bn = s.match(/(?:কে|কেই)\s+((?:[ঀ-৿]+\s?){1,3})\s*বলে\s*।?$/);
    if (bn) { out.push({ term: bn[1].trim(), sentence: s, lang: "bn" }); continue; }
    const en = s.match(/\b(?:is|are)\s+(?:called|known as|defined as)\s+(?:an?\s+|the\s+)?([A-Za-z][A-Za-z -]{1,40}?)[.,]?$/);
    if (en) out.push({ term: en[1].trim(), sentence: s, lang: "en" });
  }
  const seen = new Set<string>();
  return out.filter((d) => (seen.has(d.term) ? false : (seen.add(d.term), true)));
}

export function cardFront(term: string, lang: "bn" | "en"): string {
  return lang === "bn" ? `${term} কাকে বলে?` : `What is meant by "${term}"?`;
}

/**
 * Extractive summary: definition sentences first, then each passage's opening sentence, in page order, capped.
 * Every line keeps its page so the summary is checkable against the book.
 */
export function extractiveSummary(passages: { id: number; page: number; text: string }[], max = 8) {
  const lines: { text: string; page: number; passageId: number; kind: "definition" | "opening" }[] = [];
  const used = new Set<string>();
  const sorted = [...passages].sort((a, b) => a.page - b.page || a.id - b.id);
  for (const p of sorted) for (const d of extractDefinitions(p.text)) if (!used.has(d.sentence)) { used.add(d.sentence); lines.push({ text: d.sentence, page: p.page, passageId: p.id, kind: "definition" }); }
  for (const p of sorted) {
    const first = sentences(p.text)[0];
    if (first && !used.has(first)) { used.add(first); lines.push({ text: first, page: p.page, passageId: p.id, kind: "opening" }); }
  }
  return lines.slice(0, max).sort((a, b) => a.page - b.page);
}

export type ReadinessInput = { published: number; distinctAnswered: number; recentCorrect: number; recentTotal: number; due: number; daysSinceLast: number | null };
export type Readiness = { band: "no_evidence" | "early" | "building" | "strong"; factors: { key: string; value: string; ok: boolean }[] };

/** Exam readiness for one chapter, from four visible factors. Never a percentage; "strong" needs every factor. */
export function readiness(r: ReadinessInput): Readiness {
  const coverage = r.published ? r.distinctAnswered / r.published : 0;
  const acc = r.recentTotal ? r.recentCorrect / r.recentTotal : null;
  const factors = [
    { key: "coverage", value: `${r.distinctAnswered}/${r.published}`, ok: coverage >= 0.7 },
    { key: "recent_accuracy", value: acc === null ? "—" : `${r.recentCorrect}/${r.recentTotal}`, ok: acc !== null && r.recentTotal >= 5 && acc >= 0.8 },
    { key: "due_reviews", value: String(r.due), ok: r.due === 0 },
    { key: "recency", value: r.daysSinceLast === null ? "—" : String(r.daysSinceLast), ok: r.daysSinceLast !== null && r.daysSinceLast <= 7 },
  ];
  if (!r.published || r.recentTotal === 0) return { band: "no_evidence", factors };
  const okN = factors.filter((f) => f.ok).length;
  return { band: okN === 4 ? "strong" : okN >= 2 && coverage >= 0.4 ? "building" : "early", factors };
}

/**
 * Improvement on the same questions' difficulty level: the first N attempts against the latest N, per difficulty.
 * Reported only when both windows have at least N attempts and they don't overlap, so a change is never invented.
 */
export function improvement(attempts: { correct: number; created_at: string; difficulty: number | null }[], n = 5) {
  const byD = new Map<number, typeof attempts>();
  for (const a of attempts) { const d = a.difficulty ?? 0; byD.set(d, [...(byD.get(d) ?? []), a]); }
  const out: { difficulty: number; first: number; recent: number; n: number }[] = [];
  for (const [d, list] of byD) {
    const s = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (s.length < 2 * n) continue;
    const sum = (xs: typeof s) => xs.reduce((k, x) => k + (x.correct ? 1 : 0), 0);
    out.push({ difficulty: d, first: sum(s.slice(0, n)), recent: sum(s.slice(-n)), n });
  }
  return out.sort((a, b) => a.difficulty - b.difficulty);
}

export type GenQuestion = { type: "mcq" | "numeric" | "short"; prompt: string; options?: string[]; answer: string; explanation?: string; bloom?: string; difficulty?: number };
const BLOOM = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

/** Structural checks on a generated question. Content truth is a reviewer's job; this only rejects malformed output. */
export function validateGenerated(q: unknown): { ok: true; q: GenQuestion } | { ok: false; reason: string } {
  if (!q || typeof q !== "object") return { ok: false, reason: "not_object" };
  const x = q as Record<string, unknown>;
  if (x.type !== "mcq" && x.type !== "numeric" && x.type !== "short") return { ok: false, reason: "bad_type" };
  if (typeof x.prompt !== "string" || x.prompt.trim().length < 8 || x.prompt.length > 600) return { ok: false, reason: "bad_prompt" };
  if (typeof x.answer !== "string" || !x.answer.trim() || x.answer.length > 200) return { ok: false, reason: "bad_answer" };
  let options: string[] | undefined;
  if (x.type === "mcq") {
    if (!Array.isArray(x.options) || x.options.length < 3 || x.options.length > 5 || x.options.some((o) => typeof o !== "string" || !o.trim())) return { ok: false, reason: "bad_options" };
    options = (x.options as string[]).map((o) => o.trim());
    if (new Set(options).size !== options.length) return { ok: false, reason: "duplicate_options" };
    if (!options.includes(x.answer.trim())) return { ok: false, reason: "answer_not_in_options" };
  }
  if (x.type === "numeric" && !/^-?[\d০-৯]+([.,][\d০-৯]+)?$/.test(x.answer.trim())) return { ok: false, reason: "numeric_answer_not_number" };
  const bloom = typeof x.bloom === "string" && BLOOM.includes(x.bloom) ? x.bloom : undefined;
  const difficulty = typeof x.difficulty === "number" && [1, 2, 3].includes(x.difficulty) ? x.difficulty : undefined;
  return { ok: true, q: { type: x.type, prompt: x.prompt.trim(), options, answer: x.answer.trim(), explanation: typeof x.explanation === "string" ? x.explanation.slice(0, 800) : undefined, bloom, difficulty } };
}
