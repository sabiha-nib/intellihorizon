import { useEffect, useState } from "react";

import { call } from "../auth/messages";
import { aiUsage, resolveDispute } from "../../lib/api/review.functions";

type Data = Extract<Awaited<ReturnType<typeof aiUsage>>, { ok: true }>;
const usd = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`);
const ROLE_HELP = "Authored = wrote the answer (first choice or fallback). Verifications = independent reviews of another model's draft. Independent = separate answers written for comparison.";

/** IntelliCore orchestrator dashboard: provider status, usage, errors, latency, tokens, estimated cost, verification and disagreements. */
export function AiUsage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const load = () => void call(aiUsage({ data: { days } })).then((r) => (r.ok ? setD(r as Data) : setErr(r.code)));
  useEffect(load, [days]);
  if (err) return <p role="alert">Couldn't load AI usage: {err}</p>;
  if (!d) return <p>Loading…</p>;
  const row = (id: string) => d.usage.find((u) => u.provider === id) as Record<string, number | null> | undefined;
  return (
    <div className="space-y-6" data-testid="ai-usage">
      <div>
        <h2 className="font-display text-xl font-bold">IntelliCore multi-model orchestrator</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-mid">One tutor, three providers. The textbook evidence and validation rules are the final authority; models are reasoning engines, and agreement between them is never treated as proof. Keys are never shown here.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {d.providers.map((p) => (
          <div key={p.id} className="rounded-[14px] border border-line bg-sheet p-4" data-provider={p.id} data-configured={p.configured}>
            <p className="font-semibold">{p.label}</p>
            <p className={`mt-1 text-sm ${p.configured ? "text-mint" : "text-ink-mid"}`}>{p.configured ? `Configured${p.source === "legacy" ? " (legacy AI_* secrets)" : ""} · ${p.model}` : "Not configured"}</p>
            <p className="mt-1 text-xs text-ink-low">{p.configured ? `${p.vision ? "Images allowed" : "Text only"} · ${p.priced ? "cost estimated from list price" : "no price known: set *_PRICE_IN/_OUT"}` : `Set ${p.id.toUpperCase()}_API_KEY and ${p.id.toUpperCase()}_MODEL in website secrets, then redeploy.`}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label>Period <select className="ml-1 rounded-[10px] border border-line bg-sheet px-2 py-1" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[1, 7, 30, 90].map((n) => <option key={n} value={n}>last {n} day{n > 1 ? "s" : ""}</option>)}</select></label>
        <span>Spend today {usd(d.spend.today)}{d.caps.daily ? ` of ${usd(d.caps.daily)} cap` : " (no daily cap set)"} · this month {usd(d.spend.month)}{d.caps.monthly ? ` of ${usd(d.caps.monthly)} cap` : " (no monthly cap set)"}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">AI usage by provider</caption>
          <thead><tr className="border-b border-line">{["Provider", "Calls", "Authored", "Verifications", "Independent", "Fallbacks", "Error rate", "Avg latency", "Tokens in / out", "Est. cost", "Reviews with disagreement"].map((h) => <th key={h} scope="col" className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {d.providers.map((p) => {
              const u = row(p.id);
              const calls = Number(u?.calls ?? 0);
              return (
                <tr key={p.id} className="border-b border-line/60" data-usage={p.id}>
                  <th scope="row" className="px-2 py-2">{p.label}</th>
                  <td className="px-2 py-2 tnum">{calls}</td>
                  <td className="px-2 py-2 tnum">{u?.authored ?? 0}</td>
                  <td className="px-2 py-2 tnum">{u?.verifications ?? 0}</td>
                  <td className="px-2 py-2 tnum">{u?.independent ?? 0}</td>
                  <td className="px-2 py-2 tnum">{u?.fallbacks ?? 0}</td>
                  <td className="px-2 py-2 tnum">{calls ? `${Math.round((Number(u?.errors ?? 0) / calls) * 100)}%` : "n/a"}</td>
                  <td className="px-2 py-2 tnum">{u?.avg_ms ? `${(Number(u.avg_ms) / 1000).toFixed(1)} s` : "n/a"}</td>
                  <td className="px-2 py-2 tnum">{u ? `${u.input_tokens ?? 0} / ${u.output_tokens ?? 0}` : "0 / 0"}</td>
                  <td className="px-2 py-2 tnum">{usd(u?.cost_usd as number | null)}</td>
                  <td className="px-2 py-2 tnum">{u?.verifications ? `${u.disagreeing ?? 0} of ${u.verifications}` : "n/a"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-low">{ROLE_HELP} Requests by strategy: {d.strategies.length ? d.strategies.map((s) => `${s.strategy} ${s.n}`).join(" · ") : "none yet"}.</p>
      </div>
      <div>
        <h3 className="font-semibold">Withheld for human review ({d.disputes.filter((x) => x.status === "open").length} open)</h3>
        <p className="text-sm text-ink-mid">Explanations the coordinator withheld because independent checks disagreed and the textbook text couldn't settle it. The student saw only the textbook excerpts.</p>
        {d.disputes.length === 0 ? <p className="mt-2 text-sm">None.</p> : (
          <ul className="mt-2 space-y-2">
            {d.disputes.map((x) => (
              <li key={x.id} className="rounded-[12px] border border-line bg-sheet p-3 text-sm">
                <p><b>{x.task}</b> · {new Date(x.created_at).toLocaleString()} · {x.status}</p>
                <p className="mt-1" lang="bn">“{x.question}”</p>
                <ul className="mt-1 list-disc pl-5 text-ink-mid">{x.issues.map((i, k) => <li key={k}>{i}</li>)}</ul>
                {x.status === "open" && <div className="mt-2 flex gap-2">{(["resolved", "dismissed"] as const).map((st) => <button key={st} type="button" className="rounded-[10px] border border-line px-3 py-1 font-semibold" onClick={async () => { await call(resolveDispute({ data: { id: x.id, status: st } })); load(); }}>Mark {st}</button>)}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
