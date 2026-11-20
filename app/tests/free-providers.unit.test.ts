import { describe, expect, test } from "bun:test";

import { callProvider, configuredProviders, estimateCost, providerStatus } from "../src/lib/ai/providers";

const env = { GROQ_API_KEY: "test-groq-key", GROQ_MODEL: "openai/gpt-oss-120b", OPENROUTER_API_KEY: "test-or-key", OPENROUTER_MODEL: "meta-llama/llama-3.3-70b-instruct:free" };

describe("free-tier providers", () => {
  test("Groq and OpenRouter are configured from their own variables, priced at zero, capped per day", () => {
    const set = configuredProviders(env);
    const groq = set.find((c) => c.id === "groq")!, or = set.find((c) => c.id === "openrouter")!;
    expect(groq.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(or.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(groq.dailyCap).toBe(800);
    expect(or.dailyCap).toBe(45);
    expect(groq.vision).toBe(false);
    expect(estimateCost(groq, { input: 1000, output: 1000 })).toBe(0);
    expect(configuredProviders({ ...env, GROQ_DAILY_LIMIT: "10" }).find((c) => c.id === "groq")!.dailyCap).toBe(10);
  });

  test("a Groq call is an OpenAI-compatible Chat Completions request with a Bearer key, and its reply is parsed", async () => {
    const groq = configuredProviders(env).find((c) => c.id === "groq")!;
    let seen: { url: string; auth: string; body: Record<string, unknown> } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, auth: (init.headers as Record<string, string>).authorization, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ model: "openai/gpt-oss-120b", choices: [{ message: { content: "উত্তর" }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 3 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await callProvider(groq, { system: "s", user: "u" }, { json: true }, fake, 0);
    expect(seen!.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(seen!.auth).toBe("Bearer test-groq-key");
    expect(seen!.body.model).toBe("openai/gpt-oss-120b");
    expect(seen!.body.response_format).toEqual({ type: "json_object" });
    expect(r.ok && r.text).toBe("উত্তর");
    expect(r.ok && r.usage).toEqual({ input: 12, output: 3 });
  });

  test("a free-tier 429 is reported as rate_limited, never as an answer", async () => {
    const or = configuredProviders(env).find((c) => c.id === "openrouter")!;
    const fake = (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch;
    const r = await callProvider(or, { system: "s", user: "u" }, {}, fake, 0);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe("rate_limited");
  });

  test("status names the missing variable and marks free tiers, without revealing keys", () => {
    const st = providerStatus({ GEMINI_MODEL: "gemini-3.8-flash", GROQ_API_KEY: "k", GROQ_MODEL: "m" });
    const g = st.find((p) => p.id === "gemini")!;
    expect(g.configured).toBe(false);
    expect(g.missing).toBe("GEMINI_API_KEY");
    expect(g.free).toBe(true);
    expect(st.find((p) => p.id === "anthropic")!.free).toBe(false);
    expect(JSON.stringify(st)).not.toContain('"k"');
  });
});
