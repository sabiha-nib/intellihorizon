import { useEffect, useState } from "react";

import { call } from "../auth/messages";
import { providerTests, testProviderConnections } from "../../lib/api/provider-eval.functions";

type Data = Extract<Awaited<ReturnType<typeof providerTests>>, { ok: true }>;

const REASON: Record<string, string> = {
  auth_failed: "the key was refused (check it was copied whole, and that the account is active)",
  rate_limited: "the provider's free-tier rate limit was hit; try again in a minute",
  timeout: "no reply in time",
  provider_error: "the provider returned an error (often an unknown model name)",
  bad_response: "the reply wasn't usable",
  unexpected_reply: "a reply came back, but not the expected test answer",
  truncated: "the reply was cut off",
};

/**
 * Honest state per provider: integrated (code present, no key), configured (key and model set), tested OK (a real
 * request just succeeded) or unavailable (the last real request failed, with the reason). Shows which providers are
 * free, the free-tier note, this deployment's daily cap and today's calls. Keys are never shown.
 */
export function ProviderConnections() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => void call(providerTests()).then((r) => r.ok && setD(r as Data));
  useEffect(load, []);
  if (!d) return <p>Loading provider status…</p>;
  const anyConfigured = d.providers.some((p) => p.configured);
  const ordered = [...d.providers].sort((a, b) => Number(b.free) - Number(a.free));
  return (
    <div className="space-y-3" data-testid="provider-connections">
      <h2 className="font-display text-xl font-bold">AI providers</h2>
      <p className="text-sm text-ink-mid">
        IntelliTutor works with any one of these. Free-tier providers come first; paid ones are optional and stay off unless you add their key.
        Textbook retrieval, source checks and arithmetic checks run on this server whichever provider answers.
      </p>
      {!anyConfigured && (
        <p className="rounded-[12px] bg-amber-soft p-3 text-sm text-amber" data-testid="no-provider">
          No AI provider is configured, so the tutor shows textbook passages without an AI explanation. Quickest free setup: create a free Gemini key at
          aistudio.google.com/apikey (Google account, no card), add it in Vercel as GEMINI_API_KEY (Sensitive, Production), then redeploy.
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((p) => {
          const t = d.tests[p.id];
          const state = !p.configured ? "integrated" : !t ? "configured" : t.ok ? "tested" : "unavailable";
          const label = { integrated: "Not configured", configured: "Configured · not tested yet", tested: "Tested OK", unavailable: "Unavailable" }[state];
          const tone = { integrated: "bg-lilac text-ink-mid", configured: "bg-amber-soft text-amber", tested: "bg-mint-soft text-mint", unavailable: "bg-again-soft text-again" }[state];
          const used = d.today[p.id] ?? 0;
          return (
            <li key={p.id} className="rounded-[14px] border border-line bg-sheet p-4" data-provider-state={`${p.id}:${state}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{p.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.free ? "bg-mint-soft text-mint" : "bg-lilac text-ink-mid"}`}>{p.free ? "Free tier" : "Paid"}</span>
              </div>
              <p className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</p>
              <dl className="mt-2 space-y-1 text-sm text-ink-mid">
                {p.model && <div><dt className="inline font-medium text-ink">Model: </dt><dd className="inline">{p.model}</dd></div>}
                <div><dt className="inline font-medium text-ink">Free access: </dt><dd className="inline">{p.freeNote}</dd></div>
                {p.configured && <div><dt className="inline font-medium text-ink">Calls today: </dt><dd className="inline">{used}{p.dailyCap !== null ? ` of ${p.dailyCap} (this site's daily cap, kept under the free limit)` : ""}</dd></div>}
                {state === "integrated" && p.missing && <div><dt className="inline font-medium text-ink">Missing: </dt><dd className="inline">{p.missing} (Vercel → Settings → Environment Variables, Sensitive), then redeploy. {p.free ? `Get a free key at ${p.signup}.` : ""}</dd></div>}
                {t && state !== "integrated" && (
                  <div><dt className="inline font-medium text-ink">Last test: </dt><dd className="inline">{t.ok ? "real request succeeded" : `failed: ${REASON[t.code ?? ""] ?? t.code}${t.status ? ` (HTTP ${t.status})` : ""}`} · {(t.ms / 1000).toFixed(1)} s · {new Date(t.at).toLocaleString()}</dd></div>
                )}
                <div><a className="underline" href={p.limitsUrl} target="_blank" rel="noreferrer">Current limits on the provider's site</a></div>
              </dl>
            </li>
          );
        })}
      </ul>
      <button type="button" disabled={!anyConfigured || busy} className="rounded-[12px] bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={async () => { setBusy(true); await call(testProviderConnections()); setBusy(false); load(); }}>
        {busy ? "Testing…" : "Test connections (one tiny real request each)"}
      </button>
    </div>
  );
}
