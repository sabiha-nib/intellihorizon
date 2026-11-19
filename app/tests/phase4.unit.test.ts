import { describe, expect, test } from "bun:test";

import { cosine, embedConfig, rrf } from "../src/lib/ai/provider";
import { rewriteToBangla, rewriteToEnglish } from "../src/lib/curriculum/glossary";
import { cardFront, extractDefinitions, extractiveSummary, improvement, readiness, schedule, sentences, validateGenerated } from "../src/lib/learning/studio";
import { detectLanguage, explanationLanguage } from "../src/lib/tutor/language";
import { checkWorking, looksLikeWorking } from "../src/lib/tutor/working";

const DEF = "দুইটি অনুপাতের প্রথমটির উত্তর রাশি ও দ্বিতীয়টির পূর্ব রাশি সমান হলে এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে। অনুপাতের রাশি দুটি একই এককে প্রকাশ করতে হয়।";

describe("language engine", () => {
  test("detects Bangla, English and code-switching", () => {
    expect(detectLanguage("ধারাবাহিক অনুপাত কী?").primary).toBe("bn");
    expect(detectLanguage("What is a continued ratio?").primary).toBe("en");
    expect(detectLanguage("continued ratio আসলে কী জিনিস, example দাও").mixed).toBe(true);
    expect(detectLanguage("ধারাবাহিক অনুপাত কী?").mixed).toBe(false);
  });
  test("explanation language: one-off beats mode beats question", () => {
    expect(explanationLanguage("ধারাবাহিক অনুপাত কী?", "auto", null)).toBe("bn");
    expect(explanationLanguage("ধারাবাহিক অনুপাত কী?", "en", null)).toBe("en");
    expect(explanationLanguage("What is a ratio?", "bn", "en")).toBe("en");
    expect(explanationLanguage("ratio আর proportion এর পার্থক্য কী", "auto", null)).toBe("mixed");
  });
});

describe("cross-language glossary", () => {
  test("rewrites English curriculum terms to Bangla, longest first", () => {
    const r = rewriteToBangla("What is a continued ratio?");
    expect(r.terms).toContain("ধারাবাহিক অনুপাত");
    expect(r.matched[0]).toBe("continued ratio");
  });
  test("no invented terms for unknown words", () => {
    expect(rewriteToBangla("Tell me about volcanoes").terms).toHaveLength(0);
  });
  test("rewrites Bangla to English", () => {
    expect(rewriteToEnglish("কোষ কী?").terms).toContain("cell");
  });
});

describe("working checker", () => {
  test("finds the first wrong step and keeps earlier steps ok", () => {
    const w = checkWorking("৭ × ৮ = ৫৬\n৫৬ + ৪ = ৬১\n৬১ - ১ = ৬০");
    expect(w.steps[0].status).toBe("ok");
    expect(w.firstWrong).toBe(1);
    expect(w.steps[1].detail?.left).toBe("60");
  });
  test("all-correct working reports no wrong step", () => {
    const w = checkWorking("3/4 + 1/4 = 1\n1 × 5 = 5");
    expect(w.firstWrong).toBeNull();
    expect(w.checked).toBe(2);
  });
  test("ratios are compared by value", () => {
    expect(checkWorking("56 : 40 : 45 = 112 : 80 : 90\n2 = 2").firstWrong).toBeNull();
  });
  test("unreadable lines are not guessed", () => {
    const w = checkWorking("x + banana = 3\n2 + 2 = 4");
    expect(w.steps[0].status).toBe("unchecked");
    expect(w.firstWrong).toBeNull();
  });
  test("detects working vs ordinary questions", () => {
    expect(looksLikeWorking("7 × 8 = 56\n56 + 4 = 60")).toBe(true);
    expect(looksLikeWorking("What is 7 × 8?")).toBe(false);
  });
});

describe("hybrid retrieval maths", () => {
  test("cosine", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
  test("reciprocal rank fusion rewards agreement", () => {
    expect(rrf([[1, 2, 3], [2, 4]])[0]).toBe(2);
  });
  test("embedding config needs all secrets and a safe base URL", () => {
    expect(embedConfig({})).toBeNull();
    expect(embedConfig({ EMBED_API_KEY: "k", EMBED_MODEL: "m", EMBED_BASE_URL: "http://evil.example/v1" })).toBeNull();
    expect(embedConfig({ EMBED_API_KEY: "k", EMBED_MODEL: "m", EMBED_BASE_URL: "https://api.example.com/v1" })?.minSim).toBe(0.35);
  });
});

describe("MemoryCards scheduling", () => {
  const fresh = { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };
  const t0 = new Date("2026-11-19T00:00:00Z");
  test("good grows the interval, again resets and counts a lapse", () => {
    const a = schedule(fresh, "good", t0);
    expect(a.interval_days).toBe(1);
    const b = schedule(a, "good", t0);
    expect(b.interval_days).toBe(3);
    const c = schedule(b, "good", t0);
    expect(c.interval_days).toBeCloseTo(7.5);
    const d = schedule(c, "again", t0);
    expect(d.interval_days).toBe(0);
    expect(d.lapses).toBe(1);
    expect(d.ease).toBeCloseTo(2.3);
    expect(Date.parse(d.due_at) - t0.getTime()).toBe(10 * 60_000);
  });
  test("ease never falls below 1.3", () => {
    let s = { ...fresh, ease: 1.35 };
    for (let i = 0; i < 5; i++) s = schedule(s, "again", t0);
    expect(s.ease).toBe(1.3);
  });
});

describe("definitions and extractive summary (verbatim only)", () => {
  test("extracts the defined term and the exact sentence", () => {
    const d = extractDefinitions(DEF);
    expect(d).toHaveLength(1);
    expect(d[0].term).toBe("ধারাবাহিক অনুপাত");
    expect(DEF.includes(d[0].sentence)).toBe(true);
    expect(cardFront(d[0].term, "bn")).toBe("ধারাবাহিক অনুপাত কাকে বলে?");
  });
  test("English definitions", () => {
    const d = extractDefinitions("The smallest unit of life is called the cell. Plants make food.");
    expect(d[0].term).toBe("cell");
  });
  test("summary lines are sentences of the source, definitions first, with pages", () => {
    const lines = extractiveSummary([{ id: 1, page: 23, text: DEF }, { id: 2, page: 24, text: "চারটি রাশির প্রথম দুইটির অনুপাত ও শেষ দুইটির অনুপাত সমান হলে সমানুপাত হয়। আরও কিছু কথা এখানে লেখা আছে।" }]);
    for (const l of lines) expect([DEF, "চারটি রাশির প্রথম দুইটির অনুপাত ও শেষ দুইটির অনুপাত সমান হলে সমানুপাত হয়। আরও কিছু কথা এখানে লেখা আছে।"].some((t) => t.includes(l.text))).toBe(true);
    expect(lines.some((l) => l.kind === "definition")).toBe(true);
    expect(sentences(DEF)).toHaveLength(2);
  });
});

describe("readiness and improvement never invent evidence", () => {
  test("no answers means no evidence, not a low score", () => {
    expect(readiness({ published: 10, distinctAnswered: 0, recentCorrect: 0, recentTotal: 0, due: 0, daysSinceLast: null }).band).toBe("no_evidence");
  });
  test("strong needs all four factors", () => {
    expect(readiness({ published: 10, distinctAnswered: 8, recentCorrect: 9, recentTotal: 10, due: 0, daysSinceLast: 1 }).band).toBe("strong");
    expect(readiness({ published: 10, distinctAnswered: 8, recentCorrect: 9, recentTotal: 10, due: 2, daysSinceLast: 1 }).band).toBe("building");
  });
  test("improvement needs two non-overlapping windows at the same difficulty", () => {
    const mk = (n: number, correct: (i: number) => number, d = 1) => Array.from({ length: n }, (_, i) => ({ correct: correct(i), created_at: `2026-11-${String(10 + i).padStart(2, "0")}`, difficulty: d }));
    expect(improvement(mk(9, () => 1))).toHaveLength(0);
    const r = improvement(mk(10, (i) => (i < 5 ? 0 : 1)));
    expect(r[0]).toEqual({ difficulty: 1, first: 0, recent: 5, n: 5 });
    expect(improvement([...mk(5, () => 0, 1), ...mk(5, () => 1, 2)])).toHaveLength(0);
  });
});

describe("QuestionGen structural validation", () => {
  const ok = { type: "mcq", prompt: "৭ : ৫ ও ৮ : ৯ থেকে ধারাবাহিক অনুপাত কোনটি?", options: ["৫৬ : ৪০ : ৪৫", "৭ : ৮ : ৯", "৫ : ৮ : ৯", "৭ : ৫ : ৯"], answer: "৫৬ : ৪০ : ৪৫", bloom: "apply", difficulty: 2 };
  test("accepts a well-formed MCQ", () => expect(validateGenerated(ok).ok).toBe(true));
  test("rejects malformed output", () => {
    expect(validateGenerated(null)).toEqual({ ok: false, reason: "not_object" });
    expect(validateGenerated({ ...ok, answer: "১ : ২" })).toEqual({ ok: false, reason: "answer_not_in_options" });
    expect(validateGenerated({ ...ok, options: ["a", "a", "b"] })).toEqual({ ok: false, reason: "duplicate_options" });
    expect(validateGenerated({ ...ok, type: "essay" })).toEqual({ ok: false, reason: "bad_type" });
    expect(validateGenerated({ type: "numeric", prompt: "৭ × ৮ কত হবে বলো?", answer: "fifty-six" })).toEqual({ ok: false, reason: "numeric_answer_not_number" });
  });
  test("drops unknown bloom and difficulty instead of trusting them", () => {
    const v = validateGenerated({ ...ok, bloom: "memorise", difficulty: 9 });
    expect(v.ok && v.q.bloom).toBeUndefined();
    expect(v.ok && v.q.difficulty).toBeUndefined();
  });
});

describe("working checker: the textbook's own worked example", () => {
  test("arithmetic inside ratio terms is evaluated exactly (Example 1, printed page 19)", async () => {
    const { checkWorking } = await import("../src/lib/tutor/working");
    const ok = checkWorking("৭ : ৫ = ৭ × ৮ : ৫ × ৮ = ৫৬ : ৪০\n৮ : ৯ = ৮ × ৫ : ৯ × ৫ = ৪০ : ৪৫");
    expect(ok.steps.map((s) => s.status)).toEqual(["ok", "ok"]);
    const bad = checkWorking("৭ : ৫ = ৭ × ৮ : ৫ × ৮ = ৫৬ : ৪৫\n৮ : ৯ = ৪০ : ৪৫");
    expect(bad.firstWrong).toBe(0);
  });
  test("glossary doesn't map 'compound ratio' (a different idea) to the multiple-ratio term", async () => {
    const { rewriteToBangla } = await import("../src/lib/curriculum/glossary");
    expect(rewriteToBangla("what is a compound ratio of three").terms).not.toContain("বহুরাশিক অনুপাত");
  });
});
