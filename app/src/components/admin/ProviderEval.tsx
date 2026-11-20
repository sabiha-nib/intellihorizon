import { useEffect, useRef, useState } from "react";

import { call } from "../auth/messages";
import { providerEvalPlan, providerEvalResults, rateProviderEvalResult, runProviderEvalJob, startProviderEval } from "../../lib/api/provider-eval.functions";

type Plan = Extract<Awaited<ReturnType<typeof providerEvalPlan>>, { ok: true }>;
type Results = Extract<Awaited<ReturnType<typeof providerEvalResults>>, { ok: true }>;
type Row = Results["results"][number];
const usd = (n: number | null) => (n === null ? "n/a" : `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(3)}`);
const score = (n: number | null) => (n === null ? "–" : n.toFixed(1));

/**
 * Real-provider evaluation: every configured provider alone, each pair (one writes, one verifies), all three together,
 * and the production routing, over fixed cases. Automatic checks are mechanical; a person scores meaning, fluency and
 * teaching below each answer. A run against local test doubles is labelled as such and is never a real-model result.
 */
export function ProviderEval() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [res, setRes] = useState<Results | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const stop = useRef(false);
  const loadPlan = () => void call(providerEvalPlan()).then((r) => { if (r.ok) { setPlan(r as Plan); setChosen((c) => c ?? (r as Plan).configs.map((x) => x.id)); } });
  const open = (runId: string) => void call(providerEvalResults({ data: { runId } })).then((r) => r.ok && setRes(r as Results));
  useEffect(loadPlan, []);
  if (!plan) return <p>Loading evaluation…</p>;
  const caseLabel = (id: string) => plan.cases.find((c) => c.id === id)?.label ?? id;
  const cfgLabel = (id: string) => plan.configs.find((c) => c.id === id)?.label ?? id;

  async function run() {
    setMsg(null);
    stop.current = false;
    const s = await call(startProviderEval({ data: { label: null, configs: chosen } }));
    if (!s.ok) { setMsg(s.code === "not_configured" ? "No provider is configured, so there is nothing to evaluate." : `Couldn't start: ${s.code}`); return; }
    setProgress({ done: 0, total: s.jobs.length });
    for (let i = 0; i < s.jobs.length; i++) {
      if (stop.current) { setMsg("Stopped. Results so far are saved."); break; }
      await call(runProviderEvalJob({ data: { runId: s.runId, ...s.jobs[i] } }));
      setProgress({ done: i + 1, total: s.jobs.length });
    }
    setProgress(null);
    open(s.runId);
    loadPlan();
  }

  const none = !plan.configs.length;
  return (
    <div className="space-y-5" data-testid="provider-eval">
      <div>
        <h2 className="font-display text-xl font-bold">Provider evaluation</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-mid">
          Runs {plan.cases.length} fixed cases through the same pipeline students use, under each provider alone, each pair (one writes, one verifies), all three together and the production routing. Every provider gets the same checked passages. Automatic checks cover grounding, citations, invented pages, arithmetic, language and injection; meaning, fluency and teaching quality need your scores below. Pass marks were fixed before any run: every automatic check, and a human average of at least {plan.thresholds.humanMinimum} of 5.
        </p>
      </div>
      {none ? (
        <p className="rounded-[14px] border border-line bg-sheet p-4 text-sm" data-testid="eval-blocked">Blocked: no AI provider is configured. Add ANTHROPIC_API_KEY + ANTHROPIC_MODEL, GEMINI_API_KEY + GEMINI_MODEL and OPENAI_API_KEY + OPENAI_MODEL in website secrets, redeploy, then run this.</p>
      ) : (
        <>
          <fieldset className="space-y-1 text-sm">
            <legend className="font-semibold">Configurations</legend>
            {plan.configs.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input type="checkbox" checked={!!chosen?.includes(c.id)} onChange={(e) => setChosen((x) => (e.target.checked ? [...(x ?? []), c.id] : (x ?? []).filter((y) => y !== c.id)))} />
                <span>{c.label}</span>
                {!c.real && <span className="rounded-full bg-amber-soft px-2 text-xs font-semibold">local test double, not a real model</span>}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="rounded-[12px] bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={!!progress || !chosen?.length} onClick={() => void run()}>Run evaluation ({(chosen?.length ?? 0) * plan.cases.length} answers)</button>
            {progress && <><span role="status" className="text-sm tnum">{progress.done} of {progress.total} done</span><button type="button" className="rounded-[12px] border border-line px-3 py-2 text-sm font-semibold" onClick={() => { stop.current = true; }}>Stop</button></>}
            <span className="text-xs text-ink-low">Each answer is a real, billed request (two or three for verified and collaborative configurations).</span>
          </div>
        </>
      )}
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {plan.runs.length > 0 && (
        <div>
          <h3 className="font-semibold">Earlier runs</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {plan.runs.map((r) => (
              <li key={r.id}><button type="button" className="underline" onClick={() => open(r.id)}>{new Date(r.created_at).toLocaleString()}</button> · {r.real ? "real providers" : "local test doubles"} · {r.done} answers, {r.passed ?? 0} passed automatic checks, {r.reviewed ?? 0} scored by a person</li>
            ))}
          </ul>
        </div>
      )}
      {res && <RunReport res={res} cfgLabel={cfgLabel} caseLabel={caseLabel} onRated={() => open(res.run.id)} />}
    </div>
  );
}

function RunReport({ res, cfgLabel, caseLabel, onRated }: { res: Results; cfgLabel: (id: string) => string; caseLabel: (id: string) => string; onRated: () => void }) {
  return (
    <div className="space-y-4" data-testid="eval-report" data-real={res.run.real ? "true" : "false"}>
      <p className={`rounded-[12px] p-3 text-sm font-semibold ${res.run.real ? "bg-mint-soft" : "bg-amber-soft"}`}>
        {res.run.real ? "Run against the real provider APIs." : "Run against local test doubles. These numbers measure the pipeline only and are not real-model results."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Evaluation summary by configuration</caption>
          <thead><tr className="border-b border-line">{["Configuration", "Cases passed", "Checks passed", "Needs a person", "Withheld", "Unavailable", "Avg latency", "Calls", "Est. cost", "Scored", "Correct", "Fluency", "Teaching"].map((h) => <th key={h} scope="col" className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {res.summary.map((s) => (
              <tr key={s.config} className="border-b border-line/60" data-summary={s.config}>
                <th scope="row" className="px-2 py-2">{cfgLabel(s.config)}</th>
                <td className="px-2 py-2 tnum">{s.passedCases} / {s.cases}</td>
                <td className="px-2 py-2 tnum">{s.checksPassed} / {s.checksDecided}</td>
                <td className="px-2 py-2 tnum">{s.needsHuman}</td>
                <td className="px-2 py-2 tnum">{s.withheld}</td>
                <td className="px-2 py-2 tnum">{s.unavailable}</td>
                <td className="px-2 py-2 tnum">{s.avgMs === null ? "n/a" : `${(s.avgMs / 1000).toFixed(1)} s`}</td>
                <td className="px-2 py-2 tnum">{s.calls}</td>
                <td className="px-2 py-2 tnum">{usd(s.cost)}</td>
                <td className="px-2 py-2 tnum">{s.reviewed} / {s.cases}</td>
                <td className="px-2 py-2 tnum">{score(s.human.correct)}</td>
                <td className="px-2 py-2 tnum">{score(s.human.fluency)}</td>
                <td className="px-2 py-2 tnum">{score(s.human.pedagogy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-low">No configuration is called better than another until people have scored its answers; automatic checks alone don't show language quality.</p>
      </div>
      <ul className="space-y-3">
        {res.results.map((r) => <ResultCard key={r.id} r={r} title={`${cfgLabel(r.config)} · ${caseLabel(r.case_id)}`} onRated={onRated} />)}
      </ul>
    </div>
  );
}

function ResultCard({ r, title, onRated }: { r: Row; title: string; onRated: () => void }) {
  const [v, setV] = useState({ correct: r.human_correct ?? 0, fluency: r.human_fluency ?? 0, pedagogy: r.human_pedagogy ?? 0, note: r.human_note ?? "" });
  const [saved, setSaved] = useState(false);
  const blocks = (r.answer?.blocks ?? []) as { role: string; text: string; basis: string }[];
  const ready = v.correct > 0 && v.fluency > 0 && v.pedagogy > 0;
  return (
    <li className="rounded-[14px] border border-line bg-sheet p-4 text-sm" data-result={`${r.config}:${r.case_id}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-ink-mid">Status {r.status}{r.provider ? ` · written by ${r.provider} (${r.model})` : ""} · {(r.latency_ms / 1000).toFixed(1)} s · {r.calls} call{r.calls === 1 ? "" : "s"} · {usd(r.cost_usd)}{r.orchestration ? ` · ${r.orchestration.strategy}, assurance ${r.orchestration.assurance?.level}` : ""}</p>
      <ul className="mt-2 flex flex-wrap gap-1">
        {r.checks.map((c, i) => <li key={i} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.ok === true ? "bg-mint-soft" : c.ok === false ? "bg-again-soft" : "bg-amber-soft"}`} title={c.detail}>{c.ok === true ? "✓" : c.ok === false ? "✗" : "?"} {c.name}</li>)}
      </ul>
      {blocks.length ? (
        <div className="mt-2 space-y-1 rounded-[10px] border border-line/60 p-3">
          {blocks.map((b, i) => <p key={i}><span className="text-xs font-semibold text-ink-low">{b.role} · {b.basis}</span><br /><span>{b.text}</span></p>)}
        </div>
      ) : <p className="mt-2 text-ink-mid">No explanation shown (status {r.status}).</p>}
      <fieldset className="mt-3 flex flex-wrap items-end gap-3">
        <legend className="sr-only">Score this answer</legend>
        {(["correct", "fluency", "pedagogy"] as const).map((k) => (
          <label key={k} className="text-xs font-semibold">{k === "correct" ? "Correct meaning" : k === "fluency" ? "Language fluency" : "Teaching quality"}
            <select className="ml-1 rounded-[8px] border border-line bg-sheet px-1 py-1" value={v[k]} onChange={(e) => { setV({ ...v, [k]: Number(e.target.value) }); setSaved(false); }}>
              <option value={0}>–</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
        <label className="grow text-xs font-semibold">Note <input className="ml-1 w-full max-w-sm rounded-[8px] border border-line bg-sheet px-2 py-1" value={v.note} maxLength={1000} onChange={(e) => { setV({ ...v, note: e.target.value }); setSaved(false); }} /></label>
        <button type="button" disabled={!ready} className="rounded-[10px] border border-line px-3 py-1 font-semibold disabled:opacity-50" onClick={async () => { const x = await call(rateProviderEvalResult({ data: { resultId: r.id, correct: v.correct, fluency: v.fluency, pedagogy: v.pedagogy, note: v.note || null } })); if (x.ok) { setSaved(true); onRated(); } }}>Save score</button>
        {saved && <span role="status" className="text-xs">Saved</span>}
      </fieldset>
    </li>
  );
}
