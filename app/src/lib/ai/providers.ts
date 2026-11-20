// Three independent provider adapters (Anthropic Claude, Google Gemini, OpenAI) behind one call shape.
// Server-only: configuration comes from website secrets passed in by server code; this module holds no secrets and
// never logs request bodies or keys. Every adapter returns the same normalised result, so the orchestrator can route,
// verify and fall back without knowing vendor formats.
//
// Request formats follow each vendor's current documentation (checked 20 Nov 2026):
//   Anthropic  POST {base}/v1/messages  x-api-key + anthropic-version: 2023-06-01; system, messages, max_tokens,
//              optional output_config.effort. Current models reject sampling overrides, so none are sent.
//   Gemini     POST {base}/v1beta/models/{model}:generateContent  x-goog-api-key; systemInstruction, contents[].parts,
//              generationConfig.maxOutputTokens / responseMimeType. Gemini 3.6+ ignores temperature, so none is sent.
//   OpenAI     POST {base}/v1/responses  Bearer; instructions, input (input_text / input_image), max_output_tokens,
//              text.format {type: "json_object"}, optional reasoning.effort, store: false.
//   Groq       POST https://api.groq.com/openai/v1/chat/completions  Bearer; OpenAI-compatible Chat Completions.
//   OpenRouter POST https://openrouter.ai/api/v1/chat/completions    Bearer; OpenAI-compatible Chat Completions.
//              (Both also cover a local Ollama server for testing: GROQ_BASE_URL=http://localhost:11434/v1.)
//
// Free tiers (checked 20 Nov 2026; vendors change these without notice, and none is guaranteed):
//   Gemini via Google AI Studio: free key, no card, Flash-class models only, daily request caps shown at
//     aistudio.google.com/rate-limit. Outside the EU/UK/EEA, free-tier prompts may be used to improve Google products.
//   Groq free plan: no card; e.g. openai/gpt-oss-120b 30 req/min, 1,000 req/day, 8K tokens/min (console.groq.com/settings/limits).
//   OpenRouter ":free" models: no card; 20 req/min and 50 req/day per account (1,000/day only after buying credits).
//   Hugging Face removed free Inference Providers credits on 15 Oct 2026, so it is not offered here.

export type ProviderId = "anthropic" | "gemini" | "openai" | "groq" | "openrouter";
export const PROVIDER_IDS: ProviderId[] = ["anthropic", "gemini", "openai", "groq", "openrouter"];
export const PROVIDER_LABEL: Record<ProviderId, string> = { anthropic: "Anthropic Claude", gemini: "Google Gemini", openai: "OpenAI", groq: "Groq", openrouter: "OpenRouter" };
/** Providers that speak OpenAI-compatible Chat Completions at {base}/chat/completions. */
const CHAT_COMPAT: ProviderId[] = ["groq", "openrouter"];
/** What the admin page shows about each provider's free access. Informational; the live limits are on the vendor's page. */
export const FREE_TIER: Record<ProviderId, { free: boolean; note: string; signup: string; limitsUrl: string; defaultDailyCap: number | null }> = {
  gemini: { free: true, note: "Free key from Google AI Studio, no card. Flash-class models; per-model daily caps.", signup: "https://aistudio.google.com/apikey", limitsUrl: "https://aistudio.google.com/rate-limit", defaultDailyCap: 200 },
  groq: { free: true, note: "Free plan, no card. openai/gpt-oss-120b: 30 req/min, 1,000 req/day, 8K tokens/min.", signup: "https://console.groq.com/keys", limitsUrl: "https://console.groq.com/settings/limits", defaultDailyCap: 800 },
  openrouter: { free: true, note: "Models ending in :free, no card. 20 req/min, 50 req/day per account.", signup: "https://openrouter.ai/settings/keys", limitsUrl: "https://openrouter.ai/docs/api-reference/limits", defaultDailyCap: 45 },
  anthropic: { free: false, note: "Paid API (prepaid credits).", signup: "https://platform.claude.com", limitsUrl: "https://platform.claude.com", defaultDailyCap: null },
  openai: { free: false, note: "Paid API (prepaid credits).", signup: "https://platform.openai.com", limitsUrl: "https://platform.openai.com", defaultDailyCap: null },
};

export type ProviderConfig = {
  id: ProviderId;
  /** "legacy" = configured through the older AI_* secrets (OpenAI-compatible Chat Completions or Anthropic). */
  source: "native" | "legacy";
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxTokens: number;
  effort: string | null;
  vision: boolean;
  /** USD per million tokens, for cost estimates only. */
  price: { input: number; output: number } | null;
  legacyChat?: boolean;
  /** Calls per UTC day this deployment will make to the provider (keeps free-tier use under the vendor's cap). null = no cap. */
  dailyCap: number | null;
};

export type CallMessage = { system: string; user: string; image?: { mime: string; base64: string } | null };
export type CallOptions = { maxTokens?: number; json?: boolean };
export type CallResult =
  | { ok: true; provider: ProviderId; text: string; model: string; usage: { input: number | null; output: number | null }; ms: number; attempts: number }
  | { ok: false; provider: ProviderId; code: "timeout" | "rate_limited" | "provider_error" | "bad_response" | "auth_failed" | "truncated"; status?: number; ms: number; attempts: number };

type Env = Record<string, string | undefined>;

/**
 * Published list prices (USD per million tokens, standard tier, short context), checked 20 Nov 2026 on
 * platform.claude.com/docs (models overview), aistudio.google.com/docs/pricing and developers.openai.com/api/docs/pricing.
 * Used only to estimate cost; override per provider with *_PRICE_IN / *_PRICE_OUT. Unknown models get no estimate.
 */
export const KNOWN_PRICES: Record<string, { input: number; output: number }> = {
  "claude-fable-5-2": { input: 8, output: 40 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "gemini-4-argon": { input: 2, output: 10 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gpt-6.2-astra": { input: 8, output: 40 },
  "gpt-6.2-sol": { input: 2, output: 10 },
  "gpt-6.1-terra": { input: 1, output: 5 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
};

const DEFAULT_BASE: Record<ProviderId, string> = {
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
  openai: "https://api.openai.com",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const PREFIX: Record<ProviderId, string> = { anthropic: "ANTHROPIC", gemini: "GEMINI", openai: "OPENAI", groq: "GROQ", openrouter: "OPENROUTER" };

/** https only, except loopback http for local tests. */
function safeBase(raw: string | undefined, fallback: string): string | null {
  const b = (raw ?? "").trim().replace(/\/+$/, "") || fallback;
  if (/^https:\/\//.test(b)) return b;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/.*)?$/.test(b)) return b;
  return null;
}
const num = (v: string | undefined, def: number, lo: number, hi: number) => Math.min(Math.max(Number(v) || def, lo), hi);

function priceFor(env: Env, id: ProviderId, model: string) {
  const p = PREFIX[id];
  const i = Number(env[`${p}_PRICE_IN`]), o = Number(env[`${p}_PRICE_OUT`]);
  if (Number.isFinite(i) && i > 0 && Number.isFinite(o) && o > 0) return { input: i, output: o };
  // Free-tier access costs nothing (the owner can set *_PRICE_IN/OUT if they ever move to a paid plan).
  if (id === "groq" || id === "openrouter" || (id === "gemini" && (env.GEMINI_TIER ?? "free").trim().toLowerCase() === "free")) return { input: 0, output: 0 };
  return KNOWN_PRICES[model] ?? null;
}

function capFor(env: Env, id: ProviderId): number | null {
  const raw = (env[`${PREFIX[id]}_DAILY_LIMIT`] ?? "").trim();
  if (raw === "0" || raw.toLowerCase() === "none") return null;
  const n = Number(raw);
  if (raw && Number.isFinite(n) && n > 0) return Math.floor(n);
  if (id === "gemini" && (env.GEMINI_TIER ?? "free").trim().toLowerCase() !== "free") return null;
  return FREE_TIER[id].defaultDailyCap;
}

/** Providers configured through ANTHROPIC_* / GEMINI_* / OPENAI_* secrets, plus the legacy AI_* pair if set. */
export function configuredProviders(env: Env): ProviderConfig[] {
  const out: ProviderConfig[] = [];
  for (const id of PROVIDER_IDS) {
    const p = PREFIX[id];
    const apiKey = (env[`${p}_API_KEY`] ?? "").trim();
    const model = (env[`${p}_MODEL`] ?? "").trim();
    if (!apiKey || !model) continue;
    const baseUrl = safeBase(env[`${p}_BASE_URL`], DEFAULT_BASE[id]);
    if (!baseUrl) continue;
    out.push({
      id, source: "native", apiKey, model, baseUrl,
      timeoutMs: num(env[`${p}_TIMEOUT_MS`] ?? env.AI_TIMEOUT_MS, 30000, 2000, 90000),
      // Free-tier token-per-minute limits are small (Groq: 8K including the reply), so the compatible providers default lower.
      maxTokens: num(env[`${p}_MAX_TOKENS`], CHAT_COMPAT.includes(id) ? 1500 : 4096, 256, 16000),
      effort: (env[`${p}_EFFORT`] ?? "").trim().toLowerCase() || null,
      // All current Claude, Gemini and OpenAI flagship models accept images (per each vendor's model pages); the owner can
      // switch it off for a model that doesn't.
      // Groq/OpenRouter free text models don't take images unless the owner says the chosen model does.
      vision: (env[`${p}_VISION`] ?? (CHAT_COMPAT.includes(id) ? "off" : "on")).trim().toLowerCase() !== "off",
      price: priceFor(env, id, model),
      dailyCap: capFor(env, id),
    });
  }
  // Legacy single-provider secrets (AI_PROVIDER/AI_API_KEY/AI_MODEL) still work, as one more provider, unless the same
  // vendor is already configured natively.
  const lp = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  const lk = (env.AI_API_KEY ?? "").trim();
  const lm = (env.AI_MODEL ?? "").trim();
  if ((lp === "openai" || lp === "anthropic") && lk && lm && !out.some((c) => c.id === lp)) {
    const fallback = lp === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com/v1";
    const baseUrl = safeBase(env.AI_BASE_URL, fallback);
    if (baseUrl) out.push({
      id: lp, source: "legacy", apiKey: lk, model: lm, baseUrl,
      timeoutMs: num(env.AI_TIMEOUT_MS, 20000, 2000, 60000), maxTokens: 1500, effort: null,
      vision: (env.AI_VISION ?? "").trim().toLowerCase() === "on", price: priceFor(env, lp, lm), legacyChat: true, dailyCap: null,
    });
  }
  return out;
}

/** Non-secret description for the admin page. Never includes a key. */
export function providerStatus(env: Env) {
  const set = configuredProviders(env);
  return PROVIDER_IDS.map((id) => {
    const c = set.find((x) => x.id === id);
    const keySet = !!(env[`${PREFIX[id]}_API_KEY`] ?? "").trim();
    const f = FREE_TIER[id];
    return {
      id, label: PROVIDER_LABEL[id], configured: !!c, source: c?.source ?? null, model: c?.model ?? null, vision: c?.vision ?? false, priced: !!c?.price,
      free: f.free, freeNote: f.note, signup: f.signup, limitsUrl: f.limitsUrl, dailyCap: c?.dailyCap ?? null,
      // Says what is missing without revealing anything about the key itself.
      missing: c ? null : !keySet ? `${PREFIX[id]}_API_KEY` : `${PREFIX[id]}_MODEL`,
    };
  });
}

export function estimateCost(c: ProviderConfig, usage: { input: number | null; output: number | null }): number | null {
  if (!c.price || usage.input === null || usage.output === null) return null;
  return (usage.input * c.price.input + usage.output * c.price.output) / 1_000_000;
}

function request(c: ProviderConfig, m: CallMessage, o: CallOptions): { url: string; headers: Record<string, string>; body: unknown } {
  // Native models think before answering and thinking counts toward the limit, so they get the configured ceiling.
  const max = c.legacyChat ? (o.maxTokens ?? 900) : Math.max(c.maxTokens, o.maxTokens ?? 0);
  if ((c.legacyChat && c.id === "openai") || CHAT_COMPAT.includes(c.id)) {
    const extra: Record<string, string> = c.id === "openrouter" ? { "x-title": "IntelliHorizon" } : {};
    return {
      url: `${c.baseUrl}/chat/completions`,
      headers: { "content-type": "application/json", authorization: `Bearer ${c.apiKey}`, ...extra },
      body: {
        model: c.model, max_tokens: c.legacyChat ? (o.maxTokens ?? 900) : max, temperature: 0.2,
        ...(o.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: m.system },
          m.image ? { role: "user", content: [{ type: "text", text: m.user }, { type: "image_url", image_url: { url: `data:${m.image.mime};base64,${m.image.base64}` } }] } : { role: "user", content: m.user },
        ],
      },
    };
  }
  if (c.id === "anthropic") {
    const base = c.legacyChat ? c.baseUrl : `${c.baseUrl}/v1`;
    return {
      url: `${base}/messages`,
      headers: { "content-type": "application/json", "x-api-key": c.apiKey, "anthropic-version": "2023-06-01" },
      body: {
        model: c.model, max_tokens: max, system: m.system,
        ...(c.effort ? { output_config: { effort: c.effort } } : {}),
        messages: [{ role: "user", content: m.image ? [{ type: "image", source: { type: "base64", media_type: m.image.mime, data: m.image.base64 } }, { type: "text", text: m.user }] : m.user }],
      },
    };
  }
  if (c.id === "gemini") {
    return {
      url: `${c.baseUrl}/v1beta/models/${encodeURIComponent(c.model)}:generateContent`,
      headers: { "content-type": "application/json", "x-goog-api-key": c.apiKey },
      body: {
        systemInstruction: { parts: [{ text: m.system }] },
        contents: [{ role: "user", parts: [{ text: m.user }, ...(m.image ? [{ inlineData: { mimeType: m.image.mime, data: m.image.base64 } }] : [])] }],
        generationConfig: { maxOutputTokens: max, ...(o.json ? { responseMimeType: "application/json" } : {}) },
      },
    };
  }
  return {
    url: `${c.baseUrl}/v1/responses`,
    headers: { "content-type": "application/json", authorization: `Bearer ${c.apiKey}` },
    body: {
      model: c.model, instructions: m.system, max_output_tokens: max, store: false,
      ...(c.effort ? { reasoning: { effort: c.effort } } : {}),
      ...(o.json ? { text: { format: { type: "json_object" } } } : {}),
      input: [{ role: "user", content: [{ type: "input_text", text: m.user }, ...(m.image ? [{ type: "input_image", image_url: `data:${m.image.mime};base64,${m.image.base64}` }] : [])] }],
    },
  };
}

type Parsed = { text: string; model: string | null; input: number | null; output: number | null; truncated: boolean };

function parse(c: ProviderConfig, j: Record<string, unknown>): Parsed | null {
  if ((c.legacyChat && c.id === "openai") || CHAT_COMPAT.includes(c.id)) {
    const choice = (j.choices as { message?: { content?: unknown }; finish_reason?: string }[] | undefined)?.[0];
    const u = j.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
    return { text, model: typeof j.model === "string" ? j.model : null, input: u?.prompt_tokens ?? null, output: u?.completion_tokens ?? null, truncated: choice?.finish_reason === "length" };
  }
  if (c.id === "anthropic") {
    const parts = (j.content as { type: string; text?: string }[] | undefined) ?? [];
    const u = j.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return { text: parts.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text).join(""), model: typeof j.model === "string" ? j.model : null, input: u?.input_tokens ?? null, output: u?.output_tokens ?? null, truncated: j.stop_reason === "max_tokens" };
  }
  if (c.id === "gemini") {
    const cand = (j.candidates as { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] | undefined)?.[0];
    const u = j.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined;
    const text = (cand?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
    const out = u?.candidatesTokenCount === undefined ? null : (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
    return { text, model: typeof j.modelVersion === "string" ? j.modelVersion : null, input: u?.promptTokenCount ?? null, output: out, truncated: cand?.finishReason === "MAX_TOKENS" };
  }
  const items = (j.output as { type?: string; content?: { type?: string; text?: string }[] }[] | undefined) ?? [];
  const text = items.filter((i) => i.type === "message").flatMap((i) => i.content ?? []).filter((p) => p.type === "output_text" && typeof p.text === "string").map((p) => p.text).join("");
  const u = j.usage as { input_tokens?: number; output_tokens?: number } | undefined;
  const inc = j.incomplete_details as { reason?: string } | null | undefined;
  return { text, model: typeof j.model === "string" ? j.model : null, input: u?.input_tokens ?? null, output: u?.output_tokens ?? null, truncated: j.status === "incomplete" && inc?.reason === "max_output_tokens" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One provider call with a timeout and at most `retries` retries on 429/5xx/timeout (short backoff).
 * Never throws; never includes the key or the prompt in what it returns.
 */
export async function callProvider(c: ProviderConfig, m: CallMessage, o: CallOptions = {}, fetcher: typeof fetch = fetch, retries = 1): Promise<CallResult> {
  const t0 = Date.now();
  let attempts = 0;
  let last: CallResult | null = null;
  while (attempts <= retries) {
    attempts++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), c.timeoutMs);
    try {
      const r = request(c, m, o);
      const res = await fetcher(r.url, { method: "POST", signal: ctrl.signal, headers: r.headers, body: JSON.stringify(r.body) });
      if (res.status === 401 || res.status === 403) return { ok: false, provider: c.id, code: "auth_failed", status: res.status, ms: Date.now() - t0, attempts };
      if (res.status === 429 || res.status >= 500) {
        last = { ok: false, provider: c.id, code: res.status === 429 ? "rate_limited" : "provider_error", status: res.status, ms: Date.now() - t0, attempts };
      } else if (!res.ok) {
        return { ok: false, provider: c.id, code: "provider_error", status: res.status, ms: Date.now() - t0, attempts };
      } else {
        let j: Record<string, unknown>;
        try { j = (await res.json()) as Record<string, unknown>; } catch { return { ok: false, provider: c.id, code: "bad_response", ms: Date.now() - t0, attempts }; }
        const p = parse(c, j);
        if (!p || !p.text.trim()) return { ok: false, provider: c.id, code: p?.truncated ? "truncated" : "bad_response", ms: Date.now() - t0, attempts };
        return { ok: true, provider: c.id, text: p.text, model: p.model ?? c.model, usage: { input: p.input, output: p.output }, ms: Date.now() - t0, attempts };
      }
    } catch (e) {
      last = { ok: false, provider: c.id, code: (e as Error)?.name === "AbortError" ? "timeout" : "provider_error", ms: Date.now() - t0, attempts };
    } finally {
      clearTimeout(timer);
    }
    if (attempts <= retries) await sleep(250 * attempts);
  }
  return last ?? { ok: false, provider: c.id, code: "provider_error", ms: Date.now() - t0, attempts };
}
