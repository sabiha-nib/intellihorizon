// Phase 5 unit tests: provider adapters (wire formats), IntelliCore routing and cross-checking, curriculum scope.
// Thresholds were fixed before running: every test must pass (no tolerance).
import { describe, expect, test } from "bun:test";

import { arithmeticErrors, assurance, classifyTask, coordinate, parseVerdicts, route, routingPolicy } from "../src/lib/ai/crosscheck";
import type { AiBlock } from "../src/lib/ai/grounding";
import { allowance } from "../src/lib/ai/orchestrator.server";
import { callProvider, configuredProviders, estimateCost, providerStatus, type ProviderConfig } from "../src/lib/ai/providers";
import { availabilityOf, buildMatrix, SCOPE_GRADES } from "../src/lib/curriculum/scope";

const ENV = {
  ANTHROPIC_API_KEY: "sk-ant-secret", ANTHROPIC_MODEL: "claude-sonnet-5-5",
  GEMINI_API_KEY: "gem-secret", GEMINI_MODEL: "gemini-3.8-flash",
  OPENAI_API_KEY: "sk-openai-secret", OPENAI_MODEL: "gpt-6.2-sol",
};
type Req = { url: string; init: RequestInit };
function fakeFetch(responses: (Response | Error)[], log: Req[] = []): typeof fetch {
  let i = 0;
  return (async (url: string, init: RequestInit) => {
    log.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r instanceof Error) throw r;
    return r.clone();
  }) as unknown as typeof fetch;
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const cfg = (id: "anthropic" | "gemini" | "openai") => configuredProviders(ENV).find((c) => c.id === id)!;

describe("provider configuration", () => {
  test("reads all three providers from their own secrets", () => {
    const set = configuredProviders(ENV);
    expect(set.map((c) => c.id)).toEqual(["anthropic", "gemini", "openai"]);
    expect(set.every((c) => c.source === "native")).toBe(true);
  });
  test("a provider without its key or model is not configured", () => {
    expect(configuredProviders({ ANTHROPIC_API_KEY: "x" }).length).toBe(0);
    expect(configuredProviders({ GEMINI_MODEL: "gemini-3.8-flash" }).length).toBe(0);
    expect(configuredProviders({}).length).toBe(0);
  });
  test("a non-https base URL is refused (loopback http allowed for tests)", () => {
    expect(configuredProviders({ ...ENV, OPENAI_BASE_URL: "http://evil.example.com" }).some((c) => c.id === "openai")).toBe(false);
    expect(configuredProviders({ ...ENV, OPENAI_BASE_URL: "http://127.0.0.1:8791/openai" }).find((c) => c.id === "openai")!.baseUrl).toBe("http://127.0.0.1:8791/openai");
  });
  test("legacy AI_* secrets still work as one provider", () => {
    const set = configuredProviders({ AI_PROVIDER: "openai", AI_API_KEY: "k", AI_MODEL: "m" });
    expect(set.length).toBe(1);
    expect(set[0].source).toBe("legacy");
  });
  test("status never contains a key", () => {
    const s = JSON.stringify(providerStatus(ENV));
    for (const k of ["sk-ant-secret", "gem-secret", "sk-openai-secret"]) expect(s.includes(k)).toBe(false);
  });
  test("cost estimate from list prices", () => {
    expect(estimateCost(cfg("anthropic"), { input: 1_000_000, output: 100_000 })).toBeCloseTo(3, 6);
    expect(estimateCost({ ...cfg("openai"), price: null } as ProviderConfig, { input: 10, output: 10 })).toBeNull();
  });
});

describe("provider adapters speak each vendor's format", () => {
  test("Anthropic Messages API", async () => {
    const log: Req[] = [];
    const r = await callProvider(cfg("anthropic"), { system: "SYS", user: "USER" }, { json: true }, fakeFetch([json({ model: "claude-sonnet-5-5", content: [{ type: "text", text: '{"a":1}' }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } })], log));
    expect(r.ok && r.text).toBe('{"a":1}');
    expect(r.ok && r.usage).toEqual({ input: 10, output: 5 });
    expect(log[0].url).toBe("https://api.anthropic.com/v1/messages");
    const h = log[0].init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe("sk-ant-secret");
    expect(h["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(String(log[0].init.body));
    expect(body.system).toBe("SYS");
    expect(body.messages[0]).toEqual({ role: "user", content: "USER" });
    expect("temperature" in body).toBe(false);
  });
  test("Gemini generateContent: thought parts are not part of the answer", async () => {
    const log: Req[] = [];
    const r = await callProvider(cfg("gemini"), { system: "SYS", user: "USER", image: { mime: "image/png", base64: "AAAA" } }, { json: true }, fakeFetch([json({ candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text: "ANSWER" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3, thoughtsTokenCount: 2 } })], log));
    expect(r.ok && r.text).toBe("ANSWER");
    expect(r.ok && r.usage).toEqual({ input: 7, output: 5 });
    expect(log[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect((log[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("gem-secret");
    const body = JSON.parse(String(log[0].init.body));
    expect(body.systemInstruction.parts[0].text).toBe("SYS");
    expect(body.contents[0].parts[1].inlineData).toEqual({ mimeType: "image/png", data: "AAAA" });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });
  test("OpenAI Responses API: only message output_text counts; nothing is stored", async () => {
    const log: Req[] = [];
    const r = await callProvider(cfg("openai"), { system: "SYS", user: "USER" }, { json: true }, fakeFetch([json({ status: "completed", model: "gpt-6.2-sol", output: [{ type: "reasoning", summary: [] }, { type: "message", content: [{ type: "output_text", text: "OUT" }] }], usage: { input_tokens: 4, output_tokens: 2 } })], log));
    expect(r.ok && r.text).toBe("OUT");
    expect(log[0].url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(log[0].init.body));
    expect(body.instructions).toBe("SYS");
    expect(body.store).toBe(false);
    expect(body.text.format.type).toBe("json_object");
    expect(body.input[0].content[0]).toEqual({ type: "input_text", text: "USER" });
  });
  test("429 is retried within the limit, then succeeds", async () => {
    const r = await callProvider(cfg("openai"), { system: "s", user: "u" }, {}, fakeFetch([json({}, 429), json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "OK" }] }], usage: {} })]), 1);
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
  });
  test("a bad key is not retried", async () => {
    const log: Req[] = [];
    const r = await callProvider(cfg("anthropic"), { system: "s", user: "u" }, {}, fakeFetch([json({}, 401)], log), 2);
    expect(!r.ok && r.code).toBe("auth_failed");
    expect(log.length).toBe(1);
  });
  test("timeouts and malformed bodies fail safely", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const t = await callProvider(cfg("gemini"), { system: "s", user: "u" }, {}, fakeFetch([abort]), 0);
    expect(!t.ok && t.code).toBe("timeout");
    const m = await callProvider(cfg("gemini"), { system: "s", user: "u" }, {}, fakeFetch([new Response("<html>", { status: 200 })]), 0);
    expect(!m.ok && m.code).toBe("bad_response");
    const tr = await callProvider(cfg("anthropic"), { system: "s", user: "u" }, {}, fakeFetch([json({ content: [], stop_reason: "max_tokens", usage: {} })]), 0);
    expect(!tr.ok && tr.code).toBe("truncated");
  });
});

describe("IntelliCore routing", () => {
  const all = [{ id: "anthropic" as const, vision: true }, { id: "gemini" as const, vision: true }, { id: "openai" as const, vision: true }];
  const pol = routingPolicy({});
  test("tasks are classified from the request, not the brand", () => {
    expect(classifyTask({ purpose: "explain", question: "৭ : ৫ এবং ৮ : ৯ কে ধারাবাহিক অনুপাতে প্রকাশ করো", subjectKey: "mathematics" }).task).toBe("math");
    expect(classifyTask({ purpose: "explain", question: "What is a continued ratio?", explanationLang: "en", sourceLangs: ["bn"] }).task).toBe("translation");
    expect(classifyTask({ purpose: "explain", question: "x", persona: "exam" }).task).toBe("high_impact");
    expect(classifyTask({ purpose: "explain", question: "x", evidence: "partial" }).task).toBe("high_impact");
    expect(classifyTask({ purpose: "explain", question: "ধারাবাহিক অনুপাত কাকে বলে?", explanationLang: "bn", sourceLangs: ["bn"] }).task).toBe("conceptual");
    expect(classifyTask({ purpose: "image_read" }).task).toBe("image_homework");
    expect(classifyTask({ purpose: "question_gen" }).task).toBe("mcq_generation");
  });
  test("not every message calls every model", () => {
    expect(route("tutoring", all, pol)!.strategy).toBe("primary");
    expect(route("conceptual", all, pol)!.strategy).toBe("verify");
    expect(route("high_impact", all, pol)!.strategy).toBe("collaborate");
  });
  test("collaboration uses three different providers", () => {
    const r = route("high_impact", all, pol)!;
    const ids = new Set([r.order[0], r.independent, r.verifiers[0]]);
    expect(ids.size).toBe(3);
  });
  test("with two providers collaboration becomes verification; with one, a single model", () => {
    expect(route("high_impact", all.slice(0, 2), pol)!.strategy).toBe("verify");
    expect(route("conceptual", all.slice(0, 1), pol)!.strategy).toBe("primary");
  });
  test("photos never go to a text-only model", () => {
    const r = route("image_homework", [{ id: "anthropic", vision: false }, { id: "gemini", vision: true }, { id: "openai", vision: false }], pol)!;
    expect(r.order).toEqual(["gemini"]);
    expect(route("image_homework", [{ id: "anthropic", vision: false }], pol)).toBeNull();
  });
  test("routing is configurable", () => {
    expect(route("conceptual", all, routingPolicy({ AI_VERIFY: "off" }))!.strategy).toBe("primary");
    expect(route("tutoring", all, routingPolicy({ AI_VERIFY: "always" }))!.strategy).toBe("verify");
    expect(route("conceptual", all, routingPolicy({ AI_ROUTING: JSON.stringify({ conceptual: { order: ["gemini", "openai"] } }) }))!.order[0]).toBe("gemini");
    expect(route("high_impact", all, routingPolicy({ AI_COLLABORATE: "off" }))!.strategy).toBe("verify");
    expect(routingPolicy({ AI_ROUTING: "{not json" }).overrides).toEqual({});
  });
});

describe("exact arithmetic checks", () => {
  test("catches a wrong product in Bangla digits", () => {
    expect(arithmeticErrors("৭ : ৫ = ৭ × ৮ : ৫ × ৮ = ৫৬ : ৪৫").length).toBe(1);
  });
  test("accepts the textbook's own working", () => {
    expect(arithmeticErrors("৭ : ৫ = ৭ × ৮ : ৫ × ৮ = ৫৬ : ৪০ এবং ৮ : ৯ = ৮ × ৫ : ৯ × ৫ = ৪০ : ৪৫")).toEqual([]);
  });
  test("reads LaTeX fractions and operators", () => {
    expect(arithmeticErrors("$\\frac{3}{4} \\times 8 = 6$")).toEqual([]);
    expect(arithmeticErrors("$\\frac{3}{4} \\times 8 = 7$").length).toBe(1);
  });
  test("ignores statements with nothing to compute", () => {
    expect(arithmeticErrors("x = 5, page 18")).toEqual([]);
  });
});

describe("coordinator: evidence decides, never a vote", () => {
  const src = [{ id: 1, text: "এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে। প্রথম অনুপাতের উত্তর রাশি ও দ্বিতীয় অনুপাতের পূর্ব রাশি সমান।", printedPage: 18 }];
  const supported: AiBlock = { role: "direct", text: "এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে।", basis: "textbook", cites: [1] };
  const weak: AiBlock = { role: "direct", text: "ধারাবাহিক অনুপাত সবসময় দশের গুণিতক।", basis: "derived", cites: [1] };
  test("a reviewer's contradiction does not remove text the source itself supports", () => {
    const r = coordinate([supported], src, [{ block: 0, verdict: "contradicted", note: "", by: "openai" }], []);
    expect(r.withheld).toBe(false);
    expect(r.disagreements).toBe(1);
  });
  test("an unsupported answer under dispute is withheld for human review", () => {
    const r = coordinate([weak], src, [{ block: 0, verdict: "contradicted", note: "", by: "openai" }], []);
    expect(r.withheld).toBe(true);
  });
  test("an unresolved conflict with an independent answer removes the claim", () => {
    const r = coordinate([supported, { ...weak, role: "explanation" }], src, [], [{ block: 1, description: "", evidence: "unclear", by: "gemini" }]);
    expect(r.blocks.length).toBe(1);
    expect(r.removed[0].reason).toBe("conflict");
  });
  test("agreement does not promote an unverified block", () => {
    const unv: AiBlock = { ...weak, role: "explanation", basis: "unverified", cites: [] };
    const r = coordinate([supported, unv], src, [{ block: 1, verdict: "supported", note: "", by: "gemini" }, { block: 1, verdict: "supported", note: "", by: "openai" }], []);
    expect(r.blocks[1].basis).toBe("unverified");
  });
  test("an exact recalculation overrules every model", () => {
    const step: AiBlock = { role: "step", text: "৭ × ৮ : ৫ × ৮ = ৫৬ : ৪৫", basis: "derived", cites: [1] };
    const r = coordinate([supported, step], src, [{ block: 1, verdict: "supported", note: "", by: "gemini" }], []);
    expect(r.removed).toEqual([{ block: 1, reason: "arithmetic" }]);
  });
  test("a translation whose meaning changed is withheld", () => {
    expect(coordinate([supported], src, [], [], false).withheld).toBe(true);
  });
  test("unsupported verdicts strip the textbook label", () => {
    const r = coordinate([supported, { ...weak, role: "explanation" }], src, [{ block: 1, verdict: "unsupported", note: "", by: "openai" }], []);
    expect(r.blocks[1].basis).toBe("unverified");
    expect(r.downgraded).toEqual([1]);
  });
  test("verdict parsing ignores invented blocks and labels", () => {
    const p = parseVerdicts({ verdicts: [{ block: 0, verdict: "supported" }, { block: 9, verdict: "contradicted" }, { block: 0, verdict: "great" }], conflicts: [{ block: 5, evidence: "unclear" }] }, 2, "openai")!;
    expect(p.verdicts.length).toBe(1);
    expect(p.conflicts.length).toBe(0);
    expect(parseVerdicts(null, 2, "openai")).toBeNull();
  });
});

describe("assurance is calibrated from checks, not model confidence", () => {
  test("levels", () => {
    expect(assurance({ evidence: "sufficient", corrections: 0, strategy: "verify", verified: true, verifyFailed: false, downgraded: 0, removed: 0, arithmeticChecked: false }).level).toBe("checked_twice");
    expect(assurance({ evidence: "sufficient", corrections: 0, strategy: "primary", verified: false, verifyFailed: false, downgraded: 0, removed: 0, arithmeticChecked: false }).level).toBe("checked");
    expect(assurance({ evidence: "partial", corrections: 0, strategy: "verify", verified: true, verifyFailed: false, downgraded: 0, removed: 0, arithmeticChecked: false }).level).toBe("limited");
    expect(assurance({ evidence: "sufficient", corrections: 0, strategy: "verify", verified: false, verifyFailed: true, downgraded: 0, removed: 0, arithmeticChecked: false }).level).toBe("limited");
  });
});

describe("spending and judge limits", () => {
  // Minimal D1 stand-in: answers the three queries allowance() makes.
  const fakeDB = (o: { demo: boolean; mine: number; demoAll: number; today: number; month: number }) => ({
    prepare: (sql: string) => ({
      bind: () => ({
        first: async () => sql.includes("is_demo FROM users") ? { is_demo: o.demo ? 1 : 0 } : sql.includes("u.is_demo = 1") ? { n: o.demoAll } : sql.includes("SUM(") ? { today: o.today, month: o.month } : { n: o.mine },
      }),
    }),
  }) as never;
  const ctx = (db: never, env: Record<string, string>) => ({ DB: db, env, userId: "u", purpose: "explain" });
  test("per-student daily limit", async () => {
    expect((await allowance(ctx(fakeDB({ demo: false, mine: 60, demoAll: 0, today: 0, month: 0 }), {}))).state).toBe("limit");
    expect((await allowance(ctx(fakeDB({ demo: false, mine: 59, demoAll: 0, today: 0, month: 0 }), {}))).state).toBe("ok");
  });
  test("judge workspaces have their own, lower limits", async () => {
    expect((await allowance(ctx(fakeDB({ demo: true, mine: 25, demoAll: 0, today: 0, month: 0 }), {}))).state).toBe("limit");
    expect((await allowance(ctx(fakeDB({ demo: true, mine: 1, demoAll: 300, today: 0, month: 0 }), {}))).state).toBe("limit");
  });
  test("daily and monthly spending caps; economy near the cap", async () => {
    expect((await allowance(ctx(fakeDB({ demo: false, mine: 0, demoAll: 0, today: 5, month: 5 }), { AI_DAILY_BUDGET_USD: "5" }))).state).toBe("budget");
    expect((await allowance(ctx(fakeDB({ demo: false, mine: 0, demoAll: 0, today: 1, month: 100 }), { AI_MONTHLY_BUDGET_USD: "100" }))).state).toBe("budget");
    const near = await allowance(ctx(fakeDB({ demo: false, mine: 0, demoAll: 0, today: 4.2, month: 4.2 }), { AI_DAILY_BUDGET_USD: "5" }));
    expect(near).toEqual({ state: "ok", economy: true });
  });
});

describe("curriculum scope", () => {
  test("ten cells: Classes 6–10 × two versions", () => {
    const m = buildMatrix([]);
    expect(m.length).toBe(10);
    expect(new Set(m.map((c) => c.grade))).toEqual(new Set(SCOPE_GRADES));
    expect(m.every((c) => c.availability === "coming_soon")).toBe(true);
  });
  test("availability comes only from real counts", () => {
    expect(availabilityOf({ books: 0, chapters: 0, booksWithText: 0, publishedPassages: 0, publishedQuestions: 0, topics: 0 })).toBe("coming_soon");
    expect(availabilityOf({ books: 9, chapters: 110, booksWithText: 0, publishedPassages: 0, publishedQuestions: 0, topics: 0 })).toBe("under_review");
    expect(availabilityOf({ books: 9, chapters: 110, booksWithText: 1, publishedPassages: 16, publishedQuestions: 22, topics: 4 })).toBe("partial");
    expect(availabilityOf({ books: 2, chapters: 4, booksWithText: 2, publishedPassages: 9, publishedQuestions: 0, topics: 0 })).toBe("available");
  });
  test("Bangla and English Version are separate cells", () => {
    const m = buildMatrix([{ grade: 7, medium: "bangla", books: 9, booksWithText: 1, publishedPassages: 16 }]);
    expect(m.find((c) => c.grade === 7 && c.medium === "bangla")!.availability).toBe("partial");
    expect(m.find((c) => c.grade === 7 && c.medium === "english")!.availability).toBe("coming_soon");
  });
});

describe("settings parsing", () => {
  test("AI_CACHE_SECONDS=0 really turns the cache off", async () => {
    const { cacheGet } = await import("../src/lib/ai/orchestrator.server");
    let queried = false;
    const db = { prepare: () => { queried = true; return { bind: () => ({ first: async () => ({ payload: "{}", created_at: new Date().toISOString() }) }) }; } } as never;
    expect(await cacheGet(db, "k", { AI_CACHE_SECONDS: "0" })).toBeNull();
    expect(queried).toBe(false);
    expect(await cacheGet(db, "k", {})).toEqual({});
  });
});
