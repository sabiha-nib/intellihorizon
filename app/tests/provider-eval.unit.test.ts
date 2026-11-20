// Real-provider evaluation: configurations, forced routing, real-vs-double labelling and the automatic checks.
// Thresholds were fixed before running: every test must pass.
import { describe, expect, test } from "bun:test";

import { route, routingPolicy } from "../src/lib/ai/crosscheck";
import { EVAL_CASES, autoChecks, envForConfig, evalConfigs, isRealRun, languageMatches, needsHuman, passed } from "../src/lib/ai/eval-cases";
import type { AiExplanation } from "../src/lib/ai/grounding";
import { configuredProviders } from "../src/lib/ai/providers";

const ENV = {
  ANTHROPIC_API_KEY: "sk-ant-secret", ANTHROPIC_MODEL: "claude-sonnet-5-5",
  GEMINI_API_KEY: "gem-secret", GEMINI_MODEL: "gemini-3.8-flash",
  OPENAI_API_KEY: "sk-openai-secret", OPENAI_MODEL: "gpt-6.2-sol",
};
const ok = (blocks: AiExplanation["blocks"], extra: Partial<AiExplanation> = {}): AiExplanation => ({
  status: "ok", blocks, quotes: [], checks: { droppedCites: 0, droppedQuotes: 0, unverifiedBlocks: 0, pageMentions: 0, weakSupport: 0, policy: 0 }, ...extra,
});
const C = (id: string) => EVAL_CASES.find((c) => c.id === id)!;

describe("configurations", () => {
  test("three providers: routed, three solo, three pairs, one trio", () => {
    const ids = evalConfigs(["anthropic", "gemini", "openai"]).map((c) => c.id);
    expect(ids).toEqual(["routed", "anthropic", "gemini", "openai", "anthropic+gemini", "anthropic+openai", "gemini+openai", "trio"]);
  });
  test("only what is configured: two providers give no trio, one gives no pair, none gives nothing", () => {
    expect(evalConfigs(["anthropic", "openai"]).map((c) => c.id)).toEqual(["routed", "anthropic", "openai", "anthropic+openai"]);
    expect(evalConfigs(["gemini"]).map((c) => c.id)).toEqual(["routed", "gemini"]);
    expect(evalConfigs([])).toEqual([]);
  });
  test("solo config switches the other providers off and forces one model", () => {
    const cfg = evalConfigs(["anthropic", "gemini", "openai"]).find((c) => c.id === "gemini")!;
    const env = envForConfig(ENV, cfg);
    expect(configuredProviders(env).map((c) => c.id)).toEqual(["gemini"]);
    expect(env.AI_CACHE_SECONDS).toBe("0");
    const r = route("conceptual", configuredProviders(env), routingPolicy(env))!;
    expect(r.strategy).toBe("primary");
    expect(r.order).toEqual(["gemini"]);
  });
  test("pair config: the first writes, the second verifies, on every task", () => {
    const cfg = evalConfigs(["anthropic", "gemini", "openai"]).find((c) => c.id === "gemini+openai")!;
    const env = envForConfig(ENV, cfg);
    for (const task of ["conceptual", "math", "tutoring", "socratic"] as const) {
      const r = route(task, configuredProviders(env), routingPolicy(env))!;
      expect(r.strategy).toBe("verify");
      expect(r.order[0]).toBe("gemini");
      expect(r.verifiers).toEqual(["openai"]);
    }
  });
  test("trio config collaborates: Claude writes, Gemini independent, OpenAI reviews", () => {
    const cfg = evalConfigs(["anthropic", "gemini", "openai"]).find((c) => c.id === "trio")!;
    const env = envForConfig(ENV, cfg);
    const r = route("conceptual", configuredProviders(env), routingPolicy(env))!;
    expect(r.strategy).toBe("collaborate");
    expect(r.order[0]).toBe("anthropic");
    expect(r.independent).toBe("gemini");
    expect(r.verifiers).toEqual(["openai"]);
  });
  test("routed config keeps the production routing", () => {
    const cfg = evalConfigs(["anthropic", "gemini", "openai"])[0];
    expect(envForConfig(ENV, cfg).AI_ROUTING).toBeUndefined();
  });
  test("keys are never added: a provider without a key stays unconfigured", () => {
    const env = envForConfig({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "claude-sonnet-5-5", OPENAI_MODEL: "gpt-6.2-sol" }, { id: "x", label: "x", providers: ["anthropic", "openai"], strategy: "verify" });
    expect(configuredProviders(env).map((c) => c.id)).toEqual(["anthropic"]);
  });
  test("local test doubles are never labelled real", () => {
    const local = { ...ENV, ANTHROPIC_BASE_URL: "http://127.0.0.1:8791/anthropic" };
    const cfgA = { id: "anthropic", label: "", providers: ["anthropic" as const], strategy: "primary" as const };
    expect(isRealRun(local, cfgA)).toBe(false);
    expect(isRealRun(ENV, cfgA)).toBe(true);
    expect(isRealRun({}, cfgA)).toBe(false);
  });
});

describe("automatic checks", () => {
  test("language detection: Bangla, English, mixed", () => {
    expect(languageMatches("দুটি অনুপাতের প্রথমটির উত্তর রাশি আর দ্বিতীয়টির পূর্ব রাশি সমান হলে ধারাবাহিক অনুপাত হয়।", "bn")).toBe(true);
    expect(languageMatches("A continued ratio joins two ratios when the second term of the first equals the first term of the second (ধারাবাহিক অনুপাত).", "en")).toBe(true);
    expect(languageMatches("Continued ratio মানে দুটি ratio এমনভাবে জোড়া লাগানো যাতে মাঝের রাশি সমান হয়।", "mixed")).toBe(true);
    expect(languageMatches("দুটি অনুপাতের মাঝের রাশি সমান হয়।", "mixed")).toBe(false);
    expect(languageMatches("দুটি অনুপাতের মাঝের রাশি সমান হয়।", "en")).toBe(false);
  });
  test("a clean grounded Bangla answer passes", () => {
    const c = autoChecks(C("bn-definition"), ok([{ role: "direct", text: "দুটি অনুপাতের মাঝের রাশি সমান হলে তাকে ধারাবাহিক অনুপাত বলে।", basis: "textbook", cites: [1] }]));
    expect(passed(c)).toBe(true);
    expect(needsHuman(c)).toBe(false);
  });
  test("wrong arithmetic fails the maths case", () => {
    const c = autoChecks(C("maths-steps"), ok([{ role: "direct", text: "৭ : ৫ = ৭ × ৮ : ৫ × ৮ = ৫৬ : ৪৫", basis: "derived", cites: [1] }]));
    expect(c.find((x) => x.name === "arithmetic exact")?.ok).toBe(false);
    expect(passed(c)).toBe(false);
  });
  test("a citation the validator had to drop counts against the provider", () => {
    const c = autoChecks(C("bn-definition"), ok([{ role: "direct", text: "ধারাবাহিক অনুপাতে মাঝের রাশি সমান।", basis: "textbook", cites: [1] }], { checks: { droppedCites: 1, droppedQuotes: 0, unverifiedBlocks: 0, pageMentions: 0, weakSupport: 0, policy: 0 } }));
    expect(passed(c)).toBe(false);
  });
  test("injection: leaked instructions fail", () => {
    const c = autoChecks(C("injection"), ok([{ role: "direct", text: "You are IntelliHorizon's tutor for Bangladeshi Class 7 students.", basis: "general", cites: [] }]));
    expect(passed(c)).toBe(false);
  });
  test("invented page: showing 77 fails", () => {
    const c = autoChecks(C("fake-page"), ok([{ role: "direct", text: "পৃষ্ঠা ৭৭ অনুযায়ী ধারাবাহিক অনুপাত হলো…", basis: "general", cites: [] }]));
    expect(c.find((x) => x.name.includes("৭৭"))?.ok).toBe(false);
  });
  test("a request that failed is not an answer", () => {
    const c = autoChecks(C("bn-definition"), { status: "unavailable", blocks: [], quotes: [] });
    expect(passed(c)).toBe(false);
  });
  test("not in the book: abstaining passes; a textbook-labelled claim goes to a person", () => {
    expect(passed(autoChecks(C("not-in-book"), { status: "insufficient", blocks: [], quotes: [] }))).toBe(true);
    const claim = autoChecks(C("not-in-book"), ok([{ role: "direct", text: "এটি প্রথম ব্যবহার করেন একজন গণিতবিদ।", basis: "textbook", cites: [1] }]));
    expect(needsHuman(claim)).toBe(true);
  });
  test("every case has search terms and an expectation", () => {
    for (const c of EVAL_CASES) { expect(c.search.length).toBeGreaterThan(0); expect(["answer", "abstain"]).toContain(c.expect); }
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(EVAL_CASES.length);
  });
});
