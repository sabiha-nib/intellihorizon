// IntelliCore Multi-Model Orchestrator. One tutor, three providers, one evidence authority.
//
// Student input -> curriculum context -> evidence retrieval (done by the caller) -> task classification -> provider
// selection -> model execution (with fallback) -> cross-model verification when the task calls for it -> evidence
// validation (grounding.ts, always) -> coordinator (crosscheck.ts) -> final response -> learning profile update (caller).
//
// Cost and abuse controls live here: per-student and judge-demo daily limits, optional daily/monthly spending caps,
// a short-lived cache of validated answers, retries within limits, and per-call metadata logging (never the prompt,
// the answer text or a key).
import type { D1Database } from "@cloudflare/workers-types";

import { type Route, type Task, classifyTask, route as pickRoute, routingPolicy } from "./crosscheck";
import { type CallMessage, type CallOptions, type CallResult, type ProviderConfig, type ProviderId, callProvider, configuredProviders, estimateCost } from "./providers";

type Env = Record<string, string | undefined>;

export type OrchestratorCtx = { DB: D1Database; env: Env; userId: string; purpose: string; fetcher?: typeof fetch };
export type CallRole = "primary" | "fallback" | "verifier" | "independent";
export type Failure = { provider: ProviderId; code: string };

export type GenerateOk = { ok: true; text: string; provider: ProviderId; model: string; group: string; route: Route; failures: Failure[]; fellBack: boolean };
export type GenerateFail = { ok: false; code: "not_configured" | "no_vision" | "limit" | "budget" | "unavailable"; group: string | null; route: Route | null; failures: Failure[] };

// "0" is a real setting (e.g. AI_CACHE_SECONDS=0 turns the cache off), so only a missing or non-numeric value falls back.
const num = (v: string | undefined, def: number, lo: number, hi: number) => { const n = v === undefined || v.trim() === "" ? NaN : Number(v); return Math.min(Math.max(Number.isFinite(n) ? n : def, lo), hi); };
const dayStart = () => `${new Date().toISOString().slice(0, 10)}T00:00:00`;
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01T00:00:00`;

export function aiAvailable(env: Env, opts: { vision?: boolean } = {}): boolean {
  return configuredProviders(env).some((c) => !opts.vision || c.vision);
}

/** True if this account is an isolated judge-demo account. */
async function isDemo(DB: D1Database, userId: string): Promise<boolean> {
  try {
    const r = await DB.prepare("SELECT is_demo FROM users WHERE id = ?").bind(userId).first<{ is_demo: number | null }>();
    return !!r?.is_demo;
  } catch {
    return false;
  }
}

/** Student requests today (one per tutoring request, however many models it used). */
async function requestsToday(DB: D1Database, userId: string): Promise<number> {
  const r = await DB.prepare("SELECT COUNT(DISTINCT COALESCE(request_group, CAST(id AS TEXT))) AS n FROM ai_requests WHERE user_id = ? AND created_at >= ? AND COALESCE(role, 'primary') IN ('primary', 'fallback')").bind(userId, dayStart()).first<{ n: number }>();
  return r?.n ?? 0;
}

async function demoRequestsToday(DB: D1Database): Promise<number> {
  const r = await DB.prepare("SELECT COUNT(DISTINCT COALESCE(a.request_group, CAST(a.id AS TEXT))) AS n FROM ai_requests a JOIN users u ON u.id = a.user_id WHERE u.is_demo = 1 AND a.created_at >= ?").bind(dayStart()).first<{ n: number }>();
  return r?.n ?? 0;
}

export async function spend(DB: D1Database): Promise<{ today: number; month: number }> {
  const r = await DB.prepare("SELECT COALESCE(SUM(CASE WHEN created_at >= ? THEN cost_usd END), 0) AS today, COALESCE(SUM(cost_usd), 0) AS month FROM ai_requests WHERE created_at >= ?").bind(dayStart(), monthStart()).first<{ today: number; month: number }>();
  return { today: r?.today ?? 0, month: r?.month ?? 0 };
}

export type Allowance = { state: "ok" | "limit" | "budget"; economy: boolean };

/** Limits checked before any provider call. "economy" = near the daily budget, so skip optional second opinions. */
export async function allowance(ctx: OrchestratorCtx): Promise<Allowance> {
  const { DB, env, userId } = ctx;
  const demo = await isDemo(DB, userId);
  const perStudent = demo ? num(env.JUDGE_AI_DAILY_LIMIT, 25, 1, 500) : num(env.AI_DAILY_LIMIT, 60, 1, 1000);
  if ((await requestsToday(DB, userId)) >= perStudent) return { state: "limit", economy: false };
  if (demo && (await demoRequestsToday(DB)) >= num(env.JUDGE_AI_TOTAL_DAILY, 300, 1, 10000)) return { state: "limit", economy: false };
  const dailyCap = Number(env.AI_DAILY_BUDGET_USD), monthCap = Number(env.AI_MONTHLY_BUDGET_USD);
  if ((Number.isFinite(dailyCap) && dailyCap > 0) || (Number.isFinite(monthCap) && monthCap > 0)) {
    const s = await spend(DB);
    if (dailyCap > 0 && s.today >= dailyCap) return { state: "budget", economy: false };
    if (monthCap > 0 && s.month >= monthCap) return { state: "budget", economy: false };
    return { state: "ok", economy: dailyCap > 0 && s.today >= dailyCap * 0.8 };
  }
  return { state: "ok", economy: false };
}

export async function logCall(ctx: OrchestratorCtx, row: { group: string; task: Task; strategy: string; role: CallRole; cfg: ProviderConfig | null; res: CallResult | null; status: string; sources?: number; checks?: unknown }) {
  const ok = row.res && row.res.ok ? row.res : null;
  const cost = ok && row.cfg ? estimateCost(row.cfg, ok.usage) : null;
  try {
    await ctx.DB.prepare(
      `INSERT INTO ai_requests (user_id, purpose, provider, model, status, latency_ms, input_tokens, output_tokens, sources, checks, created_at, request_group, task, strategy, role, cost_usd, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      ctx.userId, ctx.purpose, row.cfg?.id ?? null, ok?.model ?? row.cfg?.model ?? null, row.status, row.res?.ms ?? null, ok?.usage.input ?? null, ok?.usage.output ?? null,
      row.sources ?? 0, row.checks ? JSON.stringify(row.checks) : null, new Date().toISOString(), row.group, row.task, row.strategy, row.role, cost, row.res?.attempts ?? null,
    ).run();
  } catch {
    // Logging never breaks an answer.
  }
}

export function planRoute(env: Env, task: Task, reason = ""): Route | null {
  const set = configuredProviders(env);
  return pickRoute(task, set.map((c) => ({ id: c.id, vision: c.vision })), routingPolicy(env), reason);
}

export const providerFor = (env: Env, id: ProviderId) => configuredProviders(env).find((c) => c.id === id) ?? null;

/**
 * Runs the providers in route order until one answers. A failure is retried within the provider's limit, then the
 * next configured provider is tried. Vision routes only ever contain vision-capable providers, so a photo is never
 * silently handed to a text-only model.
 */
export async function generate(ctx: OrchestratorCtx, task: Task, msg: CallMessage, opts: CallOptions & { reason?: string; group?: string; status?: (text: string) => string; checks?: (text: string) => unknown; accept?: (text: string) => boolean; sources?: number } = {}): Promise<GenerateOk | GenerateFail> {
  const r = planRoute(ctx.env, task, opts.reason);
  if (!r) return { ok: false, code: aiAvailable(ctx.env) ? "no_vision" : "not_configured", group: null, route: null, failures: [] };
  const group = opts.group ?? crypto.randomUUID();
  const failures: Failure[] = [];
  const retries = num(ctx.env.AI_RETRIES, 1, 0, 3);
  let unusable: { text: string; provider: ProviderId; model: string; i: number } | null = null;
  for (let i = 0; i < r.order.length; i++) {
    const cfg = providerFor(ctx.env, r.order[i])!;
    if (await overDailyCap(ctx.DB, cfg)) { failures.push({ provider: cfg.id, code: "daily_cap" }); continue; }
    const res = await callProvider(cfg, msg, opts, ctx.fetcher, retries);
    const role: CallRole = i === 0 ? "primary" : "fallback";
    if (res.ok && (!opts.accept || opts.accept(res.text))) {
      await logCall(ctx, { group, task, strategy: r.strategy, role, cfg, res, status: opts.status ? opts.status(res.text) : "ok", checks: opts.checks?.(res.text), sources: opts.sources });
      return { ok: true, text: res.text, provider: cfg.id, model: res.model, group, route: r, failures, fellBack: i > 0 };
    }
    if (res.ok) {
      // Answered, but not in a usable shape (e.g. broken JSON): try the next provider, keep this reply as a last resort
      // so validation can reject it visibly.
      unusable = { text: res.text, provider: cfg.id, model: res.model, i };
      failures.push({ provider: cfg.id, code: "bad_response" });
      await logCall(ctx, { group, task, strategy: r.strategy, role, cfg, res, status: "bad_response", sources: opts.sources });
      continue;
    }
    failures.push({ provider: cfg.id, code: res.code });
    await logCall(ctx, { group, task, strategy: r.strategy, role, cfg, res, status: res.code, sources: opts.sources });
    // A bad key or a malformed reply from one vendor shouldn't stop the others.
  }
  if (unusable) return { ok: true, text: unusable.text, provider: unusable.provider, model: unusable.model, group, route: r, failures, fellBack: unusable.i > 0 };
  return { ok: false, code: "unavailable", group, route: r, failures };
}

/** One call to a named provider in a given role (verifier / independent). No fallback: a second opinion is optional. */
export async function consult(ctx: OrchestratorCtx, group: string, r: Route, id: ProviderId, role: CallRole, msg: CallMessage, opts: CallOptions = {}): Promise<CallResult | null> {
  const cfg = providerFor(ctx.env, id);
  if (!cfg) return null;
  // A second opinion is optional, so a provider at its free-tier cap is simply not consulted.
  if (await overDailyCap(ctx.DB, cfg)) return null;
  const res = await callProvider(cfg, msg, opts, ctx.fetcher, num(ctx.env.AI_RETRIES, 1, 0, 3));
  await logCall(ctx, { group, task: r.task, strategy: r.strategy, role, cfg, res, status: res.ok ? "ok" : res.code });
  return res;
}

/**
 * Free tiers cap requests per day per account. This deployment stops calling a provider a little before its cap (the
 * configured *_DAILY_LIMIT, default per FREE_TIER) so students get the next provider or the textbook-only answer
 * instead of a run of 429s. Counts every call this app made to that provider today (UTC), all users together.
 */
export async function overDailyCap(DB: D1Database, cfg: ProviderConfig): Promise<boolean> {
  if (cfg.dailyCap === null) return false;
  try {
    const r = await DB.prepare("SELECT COUNT(*) AS n FROM ai_requests WHERE provider = ? AND created_at >= ?").bind(cfg.id, dayStart()).first<{ n: number }>();
    return (r?.n ?? 0) >= cfg.dailyCap;
  } catch {
    return false;
  }
}

/** Calls made to each provider today (UTC), for the admin page. */
export async function callsToday(DB: D1Database): Promise<Record<string, number>> {
  const r = await DB.prepare("SELECT provider, COUNT(*) AS n FROM ai_requests WHERE created_at >= ? AND provider IS NOT NULL GROUP BY provider").bind(dayStart()).all<{ provider: string; n: number }>();
  return Object.fromEntries((r.results ?? []).map((x) => [x.provider, x.n]));
}

/* ─────────── Cache of validated answers (same student, same evidence, same request) ─────────── */

export async function cacheGet<T>(DB: D1Database, key: string, env: Env): Promise<T | null> {
  const ttl = num(env.AI_CACHE_SECONDS, 21600, 0, 7 * 86400);
  if (!ttl) return null;
  try {
    const r = await DB.prepare("SELECT payload, created_at FROM ai_cache WHERE key = ?").bind(key).first<{ payload: string; created_at: string }>();
    if (!r || Date.now() - Date.parse(r.created_at) > ttl * 1000) return null;
    return JSON.parse(r.payload) as T;
  } catch {
    return null;
  }
}

export async function cachePut(DB: D1Database, key: string, userId: string, payload: unknown, env: Env) {
  // AI_CACHE_SECONDS=0 means no cache at all: nothing is read and nothing is written.
  if (!num(env.AI_CACHE_SECONDS, 21600, 0, 7 * 86400)) return;
  try {
    await DB.prepare("INSERT OR REPLACE INTO ai_cache (key, user_id, payload, created_at) VALUES (?, ?, ?, ?)").bind(key, userId, JSON.stringify(payload), new Date().toISOString()).run();
  } catch {
    // Cache is an optimisation only.
  }
}

export { classifyTask };
