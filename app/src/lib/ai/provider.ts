// AI provider abstraction. Credentials and model names come from website secrets, passed in at request time by
// server code (`aiConfig(bindings())`); this module holds no secrets itself and is imported only by server modules. The tutor never calls a vendor SDK directly: it calls
// `complete()`, so the provider or model can change without touching the tutor.
//
// Secrets (Vercel project environment variables, marked Sensitive; then redeploy):
//   AI_PROVIDER   "openai" (any OpenAI-compatible Chat Completions API) or "anthropic"
//   AI_API_KEY    the provider key
//   AI_MODEL      the model id to use (required; there is no built-in default model)
//   AI_BASE_URL   optional, e.g. https://api.openai.com/v1 (default) or another compatible endpoint
//   AI_TIMEOUT_MS optional, default 20000
//   AI_DAILY_LIMIT optional, AI explanations per student per day, default 60
//   AI_VISION     optional, "on" to allow reading homework photos with the same provider (the model must accept images)

export type AiConfig = { provider: "openai" | "anthropic"; apiKey: string; model: string; baseUrl: string; timeoutMs: number; dailyLimit: number; vision: boolean };

export type AiMessage = { role: "system" | "user"; content: string; image?: { mime: string; base64: string } };

export type AiResult =
  | { ok: true; text: string; model: string; usage: { input: number | null; output: number | null }; ms: number }
  | { ok: false; code: "not_configured" | "timeout" | "rate_limited" | "provider_error" | "bad_response" | "auth_failed"; status?: number; ms: number };

type Env = Record<string, string | undefined>;

export function aiConfig(env: Env): AiConfig | null {
  const provider = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (env.AI_API_KEY ?? "").trim();
  const model = (env.AI_MODEL ?? "").trim();
  if ((provider !== "openai" && provider !== "anthropic") || !apiKey || !model) return null;
  const base = (env.AI_BASE_URL ?? "").trim().replace(/\/+$/, "") || (provider === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com/v1");
  if (!/^https:\/\//.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(base + "/")) return null;
  const timeoutMs = Math.min(Math.max(Number(env.AI_TIMEOUT_MS) || 20000, 2000), 60000);
  const dailyLimit = Math.min(Math.max(Number(env.AI_DAILY_LIMIT) || 60, 1), 1000);
  return { provider, apiKey, model, baseUrl: base, timeoutMs, dailyLimit, vision: (env.AI_VISION ?? "").trim().toLowerCase() === "on" };
}

/** Public, non-secret description of the configuration (for admin status). Never includes the key. */
export function aiStatus(env: Env) {
  const c = aiConfig(env);
  return c ? { configured: true as const, provider: c.provider, model: c.model, vision: c.vision } : { configured: false as const, provider: null, model: null, vision: false };
}

export async function complete(cfg: AiConfig, messages: AiMessage[], opts: { maxTokens: number; json?: boolean }, fetcher: typeof fetch = fetch): Promise<AiResult> {
  const t0 = Date.now();
  const ms = () => Date.now() - t0;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    let res: Response;
    if (cfg.provider === "openai") {
      const body = {
        model: cfg.model,
        max_tokens: opts.maxTokens,
        temperature: 0.2,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages: messages.map((m) =>
          m.image
            ? { role: m.role, content: [{ type: "text", text: m.content }, { type: "image_url", image_url: { url: `data:${m.image.mime};base64,${m.image.base64}` } }] }
            : { role: m.role, content: m.content },
        ),
      };
      res = await fetcher(`${cfg.baseUrl}/chat/completions`, { method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` }, body: JSON.stringify(body) });
    } else {
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const body = {
        model: cfg.model,
        max_tokens: opts.maxTokens,
        temperature: 0.2,
        system,
        messages: messages.filter((m) => m.role !== "system").map((m) => ({
          role: "user",
          content: m.image ? [{ type: "image", source: { type: "base64", media_type: m.image.mime, data: m.image.base64 } }, { type: "text", text: m.content }] : m.content,
        })),
      };
      res = await fetcher(`${cfg.baseUrl}/messages`, { method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
    }
    if (res.status === 429) return { ok: false, code: "rate_limited", status: 429, ms: ms() };
    if (res.status === 401 || res.status === 403) return { ok: false, code: "auth_failed", status: res.status, ms: ms() };
    if (!res.ok) return { ok: false, code: "provider_error", status: res.status, ms: ms() };
    const j = (await res.json()) as Record<string, unknown>;
    if (cfg.provider === "openai") {
      const choice = (j.choices as { message?: { content?: unknown } }[] | undefined)?.[0];
      const text = typeof choice?.message?.content === "string" ? choice.message.content : null;
      const u = j.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
      if (!text) return { ok: false, code: "bad_response", ms: ms() };
      return { ok: true, text, model: typeof j.model === "string" ? j.model : cfg.model, usage: { input: u?.prompt_tokens ?? null, output: u?.completion_tokens ?? null }, ms: ms() };
    }
    const parts = (j.content as { type: string; text?: string }[] | undefined) ?? [];
    const text = parts.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text).join("");
    const u = j.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    if (!text) return { ok: false, code: "bad_response", ms: ms() };
    return { ok: true, text, model: typeof j.model === "string" ? j.model : cfg.model, usage: { input: u?.input_tokens ?? null, output: u?.output_tokens ?? null }, ms: ms() };
  } catch (e) {
    return { ok: false, code: (e as Error)?.name === "AbortError" ? "timeout" : "provider_error", ms: ms() };
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────── Embeddings (semantic retrieval) ─────────── */
// Secrets: EMBED_API_KEY and EMBED_MODEL (required), EMBED_BASE_URL (OpenAI-compatible /embeddings endpoint, https;
// default https://api.openai.com/v1), EMBED_MIN_SIM (default 0.35). Without them retrieval is keyword-only, and the
// admin Coverage tab and every tutor answer say so.
export type EmbedConfig = { apiKey: string; model: string; baseUrl: string; minSim: number; timeoutMs: number };

export function embedConfig(env: Env): EmbedConfig | null {
  const apiKey = (env.EMBED_API_KEY ?? "").trim();
  const model = (env.EMBED_MODEL ?? "").trim();
  if (!apiKey || !model) return null;
  const baseUrl = (env.EMBED_BASE_URL ?? "").trim().replace(/\/+$/, "") || "https://api.openai.com/v1";
  if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseUrl.replace(/\/v1$/, ""))) return null;
  const minSim = Math.min(Math.max(Number(env.EMBED_MIN_SIM) || 0.35, 0.05), 0.95);
  return { apiKey, model, baseUrl, minSim, timeoutMs: Math.min(Math.max(Number(env.AI_TIMEOUT_MS) || 15000, 2000), 60000) };
}

export async function embed(cfg: EmbedConfig, texts: string[], fetcher: typeof fetch = fetch): Promise<{ ok: true; vectors: number[][] } | { ok: false; code: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetcher(`${cfg.baseUrl}/embeddings`, { method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` }, body: JSON.stringify({ model: cfg.model, input: texts }) });
    if (res.status === 429) return { ok: false, code: "rate_limited" };
    if (!res.ok) return { ok: false, code: res.status === 401 || res.status === 403 ? "auth_failed" : "provider_error" };
    const j = (await res.json()) as { data?: { embedding?: number[]; index?: number }[] };
    const rows = (j.data ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (rows.length !== texts.length || rows.some((r) => !Array.isArray(r.embedding) || !r.embedding.length)) return { ok: false, code: "bad_response" };
    return { ok: true, vectors: rows.map((r) => r.embedding!) };
  } catch (e) {
    return { ok: false, code: (e as Error)?.name === "AbortError" ? "timeout" : "provider_error" };
  } finally {
    clearTimeout(timer);
  }
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Reciprocal-rank fusion of ranked id lists (k = 60, the usual constant). */
export function rrf(lists: number[][], k = 60): number[] {
  const score = new Map<number, number>();
  for (const l of lists) l.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)));
  return [...score].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
