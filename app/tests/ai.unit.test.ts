import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { parseJsonObject, validateExplanation } from "../src/lib/ai/grounding";
import { aiConfig, aiStatus, complete } from "../src/lib/ai/provider";
import { checkPassage, hasMath, mathMarkupValid } from "../src/lib/curriculum/quality";
import { planBook, planToSql, validatePackBook } from "../src/lib/curriculum/pipeline";
import { bookById } from "../src/lib/curriculum/registry";

const SRC = [
  { id: 11, text: "দুইটি অনুপাতের প্রথমটির উত্তর রাশি ও দ্বিতীয়টির পূর্ব রাশি সমান হলে এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে।", printedPage: 18 },
  { id: 12, text: "অনুপাতের রাশি দুটি একই এককে প্রকাশ করতে হয়।", printedPage: 19 },
];

describe("grounding validation", () => {
  test("accepts a grounded answer with an exact quotation", () => {
    const r = validateExplanation({ blocks: [{ role: "direct", text: "It is a continued ratio.", basis: "textbook", cites: [11] }, { role: "check", text: "What must be equal?", basis: "textbook", cites: [11] }], quotes: [{ source: 11, text: "এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে" }] }, SRC);
    expect(r.status).toBe("ok");
    expect(r.quotes).toHaveLength(1);
    expect(r.blocks[1].basis).toBe("practice");
    expect(r.blocks[1].cites).toEqual([]);
  });
  test("drops a fabricated quotation and a citation to a record that was not retrieved", () => {
    const r = validateExplanation({ blocks: [{ role: "direct", text: "Answer.", basis: "textbook", cites: [11, 999] }], quotes: [{ source: 11, text: "words that are not in the book at all" }, { source: 999, text: "অনুপাত" }] }, SRC);
    expect(r.status).toBe("ok");
    expect(r.blocks[0].cites).toEqual([11]);
    expect(r.quotes).toHaveLength(0);
    expect(r.checks?.droppedQuotes).toBe(2);
    expect(r.checks?.droppedCites).toBe(1);
  });
  test("a textbook claim without a valid citation becomes unverified", () => {
    const r = validateExplanation({ blocks: [{ role: "direct", text: "Ratio.", basis: "textbook", cites: [11] }, { role: "explanation", text: "The book says so.", basis: "textbook", cites: [42] }] }, SRC);
    expect(r.blocks[1].basis).toBe("unverified");
  });
  test("a page number that is not the cited source's printed page makes the block unverified", () => {
    const r = validateExplanation({ blocks: [{ role: "direct", text: "See page 35 of the book.", basis: "textbook", cites: [11] }, { role: "connection", text: "পৃষ্ঠা ১৮ তে আছে।", basis: "textbook", cites: [11] }] }, SRC);
    expect(r.blocks[0].basis).toBe("unverified");
    expect(r.blocks[1].basis).toBe("textbook");
  });
  test("quoted words inside a block that are not in a source lose their quotation marks", () => {
    const r = validateExplanation({ blocks: [{ role: "direct", text: 'The book says "ratios are always fractions of apples".', basis: "derived", cites: [11] }] }, SRC);
    expect(r.blocks[0].text).not.toContain('"');
  });
  test("insufficient, ungrounded, unparseable and heavily corrected replies are not shown", () => {
    expect(validateExplanation({ insufficient: true }, SRC).status).toBe("insufficient");
    expect(validateExplanation({ blocks: [{ role: "direct", text: "General idea.", basis: "general", cites: [] }] }, SRC).status).toBe("insufficient");
    expect(validateExplanation(parseJsonObject("not json"), SRC).status).toBe("rejected");
    expect(validateExplanation({ blocks: [{ role: "direct", text: "x p. 90 y", basis: "textbook", cites: [1, 2, 3, 11] }] }, SRC).status).toBe("rejected");
  });
  test("parses JSON wrapped in a code fence", () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});

describe("provider configuration", () => {
  test("not configured without provider, key and model; never a default model", () => {
    expect(aiConfig({})).toBeNull();
    expect(aiConfig({ AI_PROVIDER: "openai", AI_API_KEY: "k" })).toBeNull();
    expect(aiConfig({ AI_PROVIDER: "other", AI_API_KEY: "k", AI_MODEL: "m" })).toBeNull();
    expect(aiConfig({ AI_PROVIDER: "openai", AI_API_KEY: "k", AI_MODEL: "m", AI_BASE_URL: "http://evil.example/v1" })).toBeNull();
    expect(aiStatus({ AI_PROVIDER: "anthropic", AI_API_KEY: "secret", AI_MODEL: "m" })).toEqual({ configured: true, provider: "anthropic", model: "m", vision: false });
    expect(JSON.stringify(aiStatus({ AI_PROVIDER: "anthropic", AI_API_KEY: "secret", AI_MODEL: "m" }))).not.toContain("secret");
  });
  test("maps provider failures to honest codes", async () => {
    const cfg = aiConfig({ AI_PROVIDER: "openai", AI_API_KEY: "k", AI_MODEL: "m", AI_TIMEOUT_MS: "2000" })!;
    const resp = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    expect((await complete(cfg, [{ role: "user", content: "x" }], { maxTokens: 10 }, resp(429, {}))).ok).toBe(false);
    expect(await complete(cfg, [{ role: "user", content: "x" }], { maxTokens: 10 }, resp(500, {}))).toMatchObject({ ok: false, code: "provider_error" });
    expect(await complete(cfg, [{ role: "user", content: "x" }], { maxTokens: 10 }, resp(401, {}))).toMatchObject({ ok: false, code: "auth_failed" });
    expect(await complete(cfg, [{ role: "user", content: "x" }], { maxTokens: 10 }, resp(200, { choices: [] }))).toMatchObject({ ok: false, code: "bad_response" });
    expect(await complete(cfg, [{ role: "user", content: "x" }], { maxTokens: 10 }, resp(200, { model: "m", choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }))).toMatchObject({ ok: true, text: "{}" });
    const slow = ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as unknown as typeof fetch;
    expect(await complete(cfg, [{ role: "user", content: "x" }], { maxTokens: 10 }, slow)).toMatchObject({ ok: false, code: "timeout" });
  });
  test("anthropic adapter sends the key in a header and reads text blocks", async () => {
    const cfg = aiConfig({ AI_PROVIDER: "anthropic", AI_API_KEY: "k", AI_MODEL: "m" })!;
    let seen: Headers | null = null;
    const f = (async (_u: string, init: RequestInit) => { seen = new Headers(init.headers); return new Response(JSON.stringify({ model: "m", content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } })); }) as unknown as typeof fetch;
    expect(await complete(cfg, [{ role: "system", content: "s" }, { role: "user", content: "u" }], { maxTokens: 10 }, f)).toMatchObject({ ok: true, text: "ok" });
    expect(seen!.get("x-api-key")).toBe("k");
  });
});

describe("content quality", () => {
  test("mathematics with expressions is held for checking; prose is not", () => {
    expect(hasMath("৫ : ৩ এবং ২ : ৫")).toBe(true);
    expect(hasMath("x² + 2x = 0")).toBe(true);
    const math = checkPassage({ text: "৫ : ৩ এবং ২ : ৫ এর ধারাবাহিক অনুপাত নির্ণয় করো। এখানে প্রথম অনুপাতের উত্তর রাশি ৩।", confidence: 90, subjectKey: "mathematics", printedPage: 35, inChapter: true, duplicate: false });
    expect(math.flags).toContain("math_unverified");
    expect(math.blocked).toBe(true);
    const ok = checkPassage({ text: "বাংলাদেশের প্রকৃতি ও পরিবেশ নিয়ে এই অধ্যায়ে আমরা অনেক কিছু জানব এবং আমাদের চারপাশ পর্যবেক্ষণ করব।", confidence: 90, subjectKey: "science", printedPage: 3, inChapter: true, duplicate: false });
    expect(ok).toEqual({ flags: [], blocked: false });
  });
  test("low confidence, missing page and missing chapter are flagged", () => {
    const r = checkPassage({ text: "a".repeat(100), confidence: 50, subjectKey: "science", printedPage: null, inChapter: false, duplicate: true });
    expect(r.flags).toEqual(["low_confidence", "duplicate", "no_printed_page", "no_chapter"]);
    expect(r.blocked).toBe(true);
    // Missing metadata alone is a warning for reviewers, not a reason to hide approved text.
    expect(checkPassage({ text: "b".repeat(100), confidence: 90, subjectKey: "science", printedPage: null, inChapter: false, duplicate: false })).toEqual({ flags: ["no_printed_page", "no_chapter"], blocked: false });
  });
  test("maths markup must balance", () => {
    expect(mathMarkupValid("$\\frac{3}{5}$ and $x^{2}$")).toBe(true);
    expect(mathMarkupValid("$\\frac{3}{5$")).toBe(false);
    expect(mathMarkupValid("cost $5")).toBe(false);
  });
});

describe("import pipeline", () => {
  const reg = bookById("95402820-a31b-54ab-83e6-55a0dabe844b")!;
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const prose = "দুইটি অনুপাতের প্রথমটির উত্তর রাশি ও দ্বিতীয়টির পূর্ব রাশি সমান হলে এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে। ".repeat(3);
  const book = { bookId: reg.id, key: reg.key, sourceFile: "x.pdf", sourceSha256: "a".repeat(64), pdfPages: reg.pdfPages, pages: [
    { page: 23, text: prose, confidence: 88 }, { page: 24, text: prose, confidence: 88 }, { page: 25, text: "৩ : ৫ = ৬ : ১০ " + prose, confidence: 60 }, { page: 2, text: "", confidence: null },
  ] };
  test("validates against the registry", () => {
    expect(validatePackBook(book, reg)).toEqual([]);
    expect(validatePackBook({ ...book, pdfPages: 3 }, reg)[0]).toContain("pages");
    expect(validatePackBook({ ...book, pages: [...book.pages, book.pages[0]] }, reg)).toContain("a page appears more than once");
    expect(validatePackBook(book, null)[0]).toContain("Unknown book");
  });
  test("plans drafts, skips repeated text, flags low-confidence maths and is deterministic", () => {
    const a = planBook(book, reg, sha);
    const b = planBook(book, reg, sha);
    expect(planToSql(a, { jobId: "j", engine: "e", createdAt: "t" })).toBe(planToSql(b, { jobId: "j", engine: "e", createdAt: "t" }));
    expect(a.report.skippedDuplicates).toBeGreaterThan(0);
    expect(a.report.emptyPages).toBe(1);
    const p25 = a.passages.filter((p) => p.page === 25);
    expect(p25.every((p) => p.blocked)).toBe(true);
    expect(p25[0].flags).toContain("low_confidence");
    const sql = planToSql(a, { jobId: "j", engine: "e", createdAt: "t" });
    expect(sql).toContain("'draft'");
    expect(sql).not.toContain("'published'");
    expect(sql).toContain("WHERE NOT EXISTS");
  });
});
