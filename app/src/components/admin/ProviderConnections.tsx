import { useEffect, useState } from "react";

import { call } from "../auth/messages";
import { providerTests, testProviderConnections } from "../../lib/api/provider-eval.functions";

type Data = Extract<Awaited<ReturnType<typeof providerTests>>, { ok: true }>;

/**
 * Four honest states per provider: integrated (the code is there), configured (key and model set), tested OK (a real
 * request just succeeded) or unavailable (the last real request failed, with the reason). Keys are never shown.
 */
export function ProviderConnections() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => void call(providerTests()).then((r) => r.ok && setD(r as Data));
  useEffect(load, []);
  if (!d) return <p>Loading provider status…</p>;
  const anyConfigured = d.providers.some((p) => p.configured);
  return (
    <div className="space-y-3" data-testid="provider-connections">
      <h2 className="font-display text-xl font-bold">Provider status</h2>
      <ul className="grid gap-3 md:grid-cols-3">
        {d.providers.map((p) => {
          const t = d.tests[p.id];
          const state = !p.configured ? "integrated" : !t ? "configured" : t.ok ? "tested" : "unavailable";
          const label = { integrated: "Integrated · not configured", configured: "Configured · not tested yet", tested: "Tested OK", unavailable: "Unavailable" }[state];
          const tone = { integrated: "bg-lilac text-ink-mid", configured: "bg-amber-soft text-amber", tested: "bg-mint-soft text-mint", unavailable: "bg-again-soft text-again" }[state];
          return (
            <li key={p.id} className="rounded-[14px] border border-line bg-sheet p-4" data-provider-state={`${p.id}:${state}`}>
              <p className="font-semibold">{p.label}</p>
              <p className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</p>
              <p className="mt-2 text-sm text-ink-mid">
                {state === "integrated" && `Add ${p.id.toUpperCase()}_API_KEY and ${p.id.toUpperCase()}_MODEL as secrets on the host, then redeploy.`}
                {state === "configured" && `Model ${p.model}. Run the connection test to confirm a real request works.`}
                {t && state !== "integrated" && `${t.ok ? "Real request succeeded" : `Last real request failed: ${t.code}`} · ${t.model ?? p.model} · ${(t.ms / 1000).toFixed(1)} s · ${new Date(t.at).toLocaleString()}`}
              </p>
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
