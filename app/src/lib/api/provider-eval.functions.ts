// Real-provider evaluation, run by the admin from Admin -> AI providers. Each job is one case under one provider
// configuration, through the same explain() pipeline students get (retrieval, orchestrator, validation, coordinator).
// The browser drives the jobs one at a time so no single request runs long. Results keep the shown answer so a person can
// score meaning, fluency and teaching; automatic checks never stand in for that. Admin only, checked on every call.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { requireAdmin } from "../curriculum/admin.server";
import { retrieve } from "../curriculum/retrieval.server";
import { explain } from "../ai/explain.server";
import { EVAL_CASES, THRESHOLDS, autoChecks, envForConfig, evalConfigs, isRealRun, needsHuman, passed } from "../ai/eval-cases";
import { PROVIDER_IDS, callProvider, configuredProviders, providerStatus } from "../ai/providers";
import { learnerContext } from "../learning/context.server";

type Env = Record<string, string | undefined>;
const fail = (code: string) => ({ ok: false as const, code });
const now = () => new Date().toISOString();

async function guard() {
  const { DB } = bindings();
  if (!DB) return { error: fail("unavailable_now") } as const;
  if (!sameOrigin()) return { error: fail("bad_origin") } as const;
  const admin = await requireAdmin();
  if (!admin) return { error: fail("not_admin") } as const;
  return { DB, admin, env: bindings() as unknown as Env, error: null } as const;
}

const configured = (env: Env) => [...new Set(configuredProviders(env).map((c) => c.id))];

export const providerEvalPlan = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard();
  if (g.error) return g.error;
  const configs = evalConfigs(configured(g.env));
  const runs = await g.DB.prepare(
    `SELECT r.id, r.label, r.real, r.created_at, COUNT(x.id) AS done,
            SUM(CASE WHEN x.passed = 1 THEN 1 ELSE 0 END) AS passed, SUM(CASE WHEN x.reviewed_at IS NOT NULL THEN 1 ELSE 0 END) AS reviewed
       FROM ai_eval_runs r LEFT JOIN ai_eval_results x ON x.run_id = r.id GROUP BY r.id ORDER BY r.created_at DESC LIMIT 10`,
  ).all<{ id: string; label: string | null; real: number; created_at: string; done: number; passed: number | null; reviewed: number | null }>();
  return {
    ok: true as const,
    providers: providerStatus(g.env),
    configs: configs.map((c) => ({ ...c, real: isRealRun(g.env, c) })),
    cases: EVAL_CASES.map((c) => ({ id: c.id, label: c.label, measures: c.measures, question: c.question, lang: c.lang, expect: c.expect })),
    thresholds: THRESHOLDS,
    runs: runs.results ?? [],
  };
});

export const startProviderEval = createServerFn({ method: "POST" })
  .inputValidator(z.object({ label: z.string().max(80).nullable().default(null), configs: z.array(z.string().max(40)).max(10).nullable().default(null) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const all = evalConfigs(configured(g.env));
    const chosen = data.configs ? all.filter((c) => data.configs!.includes(c.id)) : all;
    if (!chosen.length) return fail("not_configured");
    const real = chosen.every((c) => isRealRun(g.env, c));
    const id = crypto.randomUUID();
    await g.DB.prepare("INSERT INTO ai_eval_runs (id, label, real, configs, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, data.label, real ? 1 : 0, JSON.stringify(chosen.map((c) => c.id)), g.admin.id, now()).run();
    return { ok: true as const, runId: id, real, jobs: chosen.flatMap((c) => EVAL_CASES.map((k) => ({ configId: c.id, caseId: k.id }))) };
  });

export const runProviderEvalJob = createServerFn({ method: "POST" })
  .inputValidator(z.object({ runId: z.string().uuid(), configId: z.string().max(40), caseId: z.string().max(40) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const run = await g.DB.prepare("SELECT configs FROM ai_eval_runs WHERE id = ?").bind(data.runId).first<{ configs: string }>();
    if (!run || !(JSON.parse(run.configs) as string[]).includes(data.configId)) return fail("not_found");
    const cfg = evalConfigs(configured(g.env)).find((c) => c.id === data.configId);
    const c = EVAL_CASES.find((x) => x.id === data.caseId);
    if (!cfg || !c) return fail("not_found");
    const dup = await g.DB.prepare("SELECT id FROM ai_eval_results WHERE run_id = ? AND config = ? AND case_id = ?").bind(data.runId, cfg.id, c.id).first();
    if (dup) return fail("already_run");

    // Same evidence for every provider: the checked Class 7 Bangla Version Mathematics passages for the case's terms.
    const r = await retrieve(g.DB, { grade: 7, medium: "bangla", subjectKey: "mathematics", textbookId: null, chapterId: null }, c.search);
    const t0 = now();
    const started = Date.now();
    let ai: Awaited<ReturnType<typeof explain>>;
    if (!r.excerpts.length) ai = { status: "insufficient", blocks: [], quotes: [] };
    else {
      const learner = await learnerContext(g.DB, g.admin.id, { chapterId: r.excerpts[0].source.chapter?.id ?? null, grade: 7, medium: "bangla", lang: c.lang === "en" ? "en" : "bn" });
      ai = await explain(g.DB, envForConfig(g.env, cfg), {
        userId: g.admin.id, question: c.question, persona: c.persona, lang: c.lang, excerpts: r.excerpts, learner, evidence: "sufficient",
        style: null, socratic: c.persona === "socratic", subjectKey: "mathematics",
      });
    }
    const ms = Date.now() - started;
    const usage = await g.DB.prepare("SELECT COUNT(*) AS calls, SUM(cost_usd) AS cost, SUM(input_tokens) AS tin, SUM(output_tokens) AS tout FROM ai_requests WHERE user_id = ? AND created_at >= ? AND purpose = 'explain'")
      .bind(g.admin.id, t0).first<{ calls: number; cost: number | null; tin: number | null; tout: number | null }>();
    const checks = r.excerpts.length ? autoChecks(c, ai) : [{ name: "evidence found for the case", ok: false, detail: "no checked passage matched; import or publish the Class 7 Mathematics passages" }];
    const id = crypto.randomUUID();
    await g.DB.prepare(
      `INSERT INTO ai_eval_results (id, run_id, config, case_id, status, provider, model, latency_ms, calls, cost_usd, input_tokens, output_tokens, checks, passed, needs_human, answer, orchestration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, data.runId, cfg.id, c.id, ai.status, ai.provider ?? null, ai.model ?? null, ms, usage?.calls ?? 0, usage?.cost ?? null, usage?.tin ?? null, usage?.tout ?? null,
      JSON.stringify(checks), passed(checks) ? 1 : 0, needsHuman(checks) ? 1 : 0, JSON.stringify({ blocks: ai.blocks, quotes: ai.quotes, corrections: ai.checks ?? null }),
      ai.orchestration ? JSON.stringify(ai.orchestration) : null, now(),
    ).run();
    return { ok: true as const, id, status: ai.status, passed: passed(checks), ms };
  });

type ResultRow = {
  id: string; config: string; case_id: string; status: string; provider: string | null; model: string | null; latency_ms: number; calls: number; cost_usd: number | null;
  input_tokens: number | null; output_tokens: number | null; checks: string; passed: number; needs_human: number; answer: string; orchestration: string | null;
  human_correct: number | null; human_fluency: number | null; human_pedagogy: number | null; human_note: string | null; reviewed_at: string | null;
};

export const providerEvalResults = createServerFn({ method: "POST" })
  .inputValidator(z.object({ runId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const run = await g.DB.prepare("SELECT id, label, real, configs, created_at FROM ai_eval_runs WHERE id = ?").bind(data.runId).first<{ id: string; label: string | null; real: number; configs: string; created_at: string }>();
    if (!run) return fail("not_found");
    const rows = (await g.DB.prepare("SELECT * FROM ai_eval_results WHERE run_id = ? ORDER BY created_at").bind(data.runId).all<ResultRow>()).results ?? [];
    const results = rows.map((x) => ({ ...x, checks: JSON.parse(x.checks) as { name: string; ok: boolean | null; detail?: string }[], answer: JSON.parse(x.answer), orchestration: x.orchestration ? JSON.parse(x.orchestration) : null }));
    const avg = (xs: (number | null)[]) => { const v = xs.filter((n): n is number => typeof n === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const summary = (JSON.parse(run.configs) as string[]).map((cid) => {
      const rs = results.filter((x) => x.config === cid);
      const allChecks = rs.flatMap((x) => x.checks);
      const decided = allChecks.filter((x) => x.ok !== null);
      return {
        config: cid, cases: rs.length, passedCases: rs.filter((x) => x.passed).length,
        checksPassed: decided.filter((x) => x.ok).length, checksDecided: decided.length, needsHuman: rs.filter((x) => x.needs_human).length,
        withheld: rs.filter((x) => x.status === "disputed").length, unavailable: rs.filter((x) => x.status === "unavailable").length,
        avgMs: avg(rs.map((x) => x.latency_ms)), cost: rs.some((x) => x.cost_usd !== null) ? rs.reduce((a, x) => a + (x.cost_usd ?? 0), 0) : null, calls: rs.reduce((a, x) => a + x.calls, 0),
        reviewed: rs.filter((x) => x.reviewed_at).length,
        human: { correct: avg(rs.map((x) => x.human_correct)), fluency: avg(rs.map((x) => x.human_fluency)), pedagogy: avg(rs.map((x) => x.human_pedagogy)) },
      };
    });
    return { ok: true as const, run: { ...run, configs: JSON.parse(run.configs) as string[] }, results, summary, thresholds: THRESHOLDS };
  });

export const rateProviderEvalResult = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    resultId: z.string().uuid(),
    correct: z.number().int().min(1).max(5), fluency: z.number().int().min(1).max(5), pedagogy: z.number().int().min(1).max(5),
    note: z.string().max(1000).nullable().default(null),
  }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const r = await g.DB.prepare("UPDATE ai_eval_results SET human_correct = ?, human_fluency = ?, human_pedagogy = ?, human_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?")
      .bind(data.correct, data.fluency, data.pedagogy, data.note, g.admin.id, now(), data.resultId).run();
    return r.meta?.changes ? { ok: true as const } : fail("not_found");
  });

/* ─────────── Connection test: integrated -> configured -> tested OK / unavailable ─────────── */

type ProviderTest = { ok: boolean; code: string | null; model: string | null; ms: number; at: string };

/** Last connection test per provider (admin only). Never includes a key or any reply text. */
export const providerTests = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard();
  if (g.error) return g.error;
  const rows = (await g.DB.prepare("SELECT key, value FROM app_settings WHERE key LIKE 'provider_test:%'").all<{ key: string; value: string }>()).results ?? [];
  const tests = Object.fromEntries(rows.map((r) => [r.key.slice("provider_test:".length), JSON.parse(r.value) as ProviderTest]));
  return { ok: true as const, providers: providerStatus(g.env), tests };
});

/**
 * Sends one tiny real request to each configured provider ("reply with {\"ok\": true}") and records the outcome.
 * A provider counts as working only after this succeeds against its real API.
 */
export const testProviderConnections = createServerFn({ method: "POST" }).handler(async () => {
  const g = await guard();
  if (g.error) return g.error;
  const set = configuredProviders(g.env);
  const out: Record<string, ProviderTest> = {};
  for (const id of PROVIDER_IDS) {
    const cfg = set.find((c) => c.id === id);
    if (!cfg) continue;
    const r = await callProvider(cfg, { system: "You are a connectivity check. Reply with JSON only.", user: 'Reply with exactly {"ok": true}' }, { json: true, maxTokens: 300 }, fetch, 1);
    const ok = r.ok && /"ok"\s*:\s*true/.test(r.text);
    out[id] = { ok, code: r.ok ? (ok ? null : "unexpected_reply") : r.code, model: r.ok ? r.model : cfg.model, ms: r.ms, at: now() };
    await g.DB.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").bind(`provider_test:${id}`, JSON.stringify(out[id])).run();
    await g.DB.prepare("INSERT INTO ai_requests (user_id, purpose, provider, model, status, latency_ms, input_tokens, output_tokens, sources, created_at, role, task, strategy) VALUES (?, 'connection_test', ?, ?, ?, ?, ?, ?, 0, ?, 'primary', 'connection_test', 'primary')")
      .bind(g.admin.id, id, out[id].model, r.ok ? (ok ? "ok" : "bad_response") : r.code, r.ms, r.ok ? r.usage.input : null, r.ok ? r.usage.output : null, now()).run();
  }
  return { ok: true as const, tests: out };
});
