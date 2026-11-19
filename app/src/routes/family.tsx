import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { call } from "../components/auth/messages";
import { card } from "../components/app/kit";
import { ErrorLine, StudioPage, btn, input } from "../components/app/studio-kit";
import { viewShare } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";
import { STATE } from "./topics.index";
import type { TopicState } from "../lib/learning/quiz";

export const Route = createFileRoute("/family")({
  head: () => ({ meta: [{ title: "Progress summary | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: Family,
});

const BAND: Record<string, [string, string]> = { no_evidence: ["Not enough evidence yet", "এখনো যথেষ্ট প্রমাণ নেই"], early: ["Early", "শুরুর দিকে"], building: ["Building", "গড়ে উঠছে"], strong: ["Strong on all four factors", "চারটি কারণেই শক্ত"] };

function Family() {
  const { tx, t } = useLearner();
  const [code, setCode] = useState(""); const [err, setErr] = useState<string | null>(null);
  const [d, setD] = useState<Extract<Awaited<ReturnType<typeof viewShare>>, { ok: true }> | null>(null);
  return (
    <StudioPage needsAccount={false} next="/family" title={tx("Progress summary", "অগ্রগতির সারাংশ")} subtitle={tx("For a parent or teacher with a code from the student.", "শিক্ষার্থীর দেওয়া কোড আছে এমন অভিভাবক বা শিক্ষকের জন্য।")}>
      <form className={`${card} flex flex-wrap gap-2 p-5`} onSubmit={async (e) => { e.preventDefault(); setErr(null); const r = await call(viewShare({ data: { code } })); if (r.ok) setD(r); else { setD(null); setErr(r.code); } }}>
        <input className={`${input} flex-1 font-mono uppercase`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" aria-label={tx("Access code", "প্রবেশ কোড")} autoComplete="off" />
        <button className={btn} type="submit">{tx("View", "দেখো")}</button>
        <div className="w-full"><ErrorLine code={err} /></div>
      </form>
      {d && <section className="space-y-4" data-testid="family-summary">
        <p className="text-sm text-ink-mid">{tx(`Access for a ${d.role}, valid until ${new Date(d.expiresAt).toLocaleDateString()}. This shows practice evidence only; it can't show how a student feels or everything they know.`, `${d.role === "parent" ? "অভিভাবকের" : "শিক্ষকের"} জন্য, ${new Date(d.expiresAt).toLocaleDateString()} পর্যন্ত। এখানে শুধু অনুশীলনের প্রমাণ; শিক্ষার্থী কী অনুভব করে বা সব কী জানে তা দেখায় না।`)}</p>
        <p className="font-semibold">{tx(`${d.totalAttempts} answers recorded in total.`, `মোট ${d.totalAttempts}টি উত্তর।`)}</p>
        <div className={`${card} p-5`}><h2 className="font-display text-lg font-bold">{tx("Topics", "টপিক")}</h2>
          <ul className="mt-2 space-y-1">{d.topics.map((x) => <li key={x.title} lang="bn">{x.title} · <span className="font-semibold">{t(STATE[x.state as TopicState].label)}</span> <span className="text-sm text-ink-mid">({tx(`${x.distinctCorrect}/${x.distinctQuestions} questions right at least once`, `${x.distinctQuestions}টির মধ্যে ${x.distinctCorrect}টি অন্তত একবার ঠিক`)})</span></li>)}</ul></div>
        <div className={`${card} p-5`}><h2 className="font-display text-lg font-bold">{tx("Chapters with practice", "অনুশীলন আছে এমন অধ্যায়")}</h2>
          <ul className="mt-2 space-y-1">{d.chapters.map((c) => <li key={c.title} lang="bn">{c.title} · {tx(`${c.distinct}/${c.published} questions tried`, `${c.published}টির মধ্যে ${c.distinct}টি চেষ্টা`)} · {tx(BAND[c.readiness][0], BAND[c.readiness][1])}</li>)}</ul></div>
      </section>}
    </StudioPage>
  );
}
