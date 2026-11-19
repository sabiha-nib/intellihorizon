import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { card } from "../components/app/kit";
import { ErrorLine, StudioPage, btn, input } from "../components/app/studio-kit";
import { listReflections, saveReflection } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/reflect")({
  head: () => ({ meta: [{ title: "Reflection | IntelliHorizon" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ context: typeof s.context === "string" ? s.context.slice(0, 120) : undefined }),
  component: Reflect,
});

const QS = [["learned", "What did I learn?", "আমি কী শিখলাম?"], ["difficult", "What was difficult?", "কী কঠিন লাগল?"], ["canExplain", "What can I now explain?", "এখন কী ব্যাখ্যা করতে পারি?"], ["revisit", "What should I revisit?", "কী আবার দেখা উচিত?"], ["nextGoal", "My next goal", "আমার পরের লক্ষ্য"]] as const;
type Key = (typeof QS)[number][0];
type R = { id: string; learned: string; difficult: string; can_explain: string; revisit: string; next_goal: string; context: string | null; created_at: string };

function Reflect() {
  const { tx, account } = useLearner();
  const { context } = Route.useSearch();
  const [v, setV] = useState<Record<Key, string>>({ learned: "", difficult: "", canExplain: "", revisit: "", nextGoal: "" });
  const [list, setList] = useState<R[]>([]);
  const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState(false);
  const load = () => void call(listReflections()).then((r) => r.ok && setList(r.reflections));
  useEffect(() => { if (account) load(); }, [account]);
  return (
    <StudioPage next="/reflect" title={tx("Reflection", "প্রতিফলন")} subtitle={tx("A few minutes of looking back. Private to you.", "কয়েক মিনিট পেছন ফিরে দেখা। শুধু তোমার।")}
      note={tx("Reflections are your own words. They are never counted as mastery and never shown to teachers or parents.", "প্রতিফলন তোমার নিজের কথা। এগুলো কখনো দক্ষতা হিসেবে গোনা হয় না এবং শিক্ষক বা অভিভাবককে দেখানো হয় না।")}>
      <form className={`${card} space-y-3 p-5`} onSubmit={async (e) => { e.preventDefault(); setErr(null); setOk(false); const r = await call(saveReflection({ data: { ...v, context: context ?? null } })); if (r.ok) { setOk(true); setV({ learned: "", difficult: "", canExplain: "", revisit: "", nextGoal: "" }); load(); } else setErr(r.code); }}>
        {context && <p className="text-xs text-ink-low">{tx(`After: ${context}`, `এর পরে: ${context}`)}</p>}
        {QS.map(([k, en, bn]) => <label key={k} className="block text-sm font-semibold">{tx(en, bn)}<textarea className={input} rows={2} maxLength={1000} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>)}
        <button className={btn} type="submit">{tx("Save reflection", "প্রতিফলন রাখো")}</button>
        {ok && <p role="status" className="text-sm">{tx("Saved.", "রাখা হয়েছে।")}</p>}<ErrorLine code={err} />
      </form>
      {list.length > 0 && <section className="space-y-3"><h2 className="font-display text-xl font-bold">{tx("Earlier reflections", "আগের প্রতিফলন")}</h2>
        {list.map((r) => <article key={r.id} className={`${card} space-y-1 p-4 text-[15px]`}><p className="text-xs text-ink-low">{new Date(r.created_at).toLocaleString()}{r.context ? ` · ${r.context}` : ""}</p>
          {([["learned", r.learned], ["difficult", r.difficult], ["canExplain", r.can_explain], ["revisit", r.revisit], ["nextGoal", r.next_goal]] as const).filter(([, x]) => x).map(([k, x]) => { const q = QS.find((y) => y[0] === k)!; return <p key={k}><span className="font-semibold">{tx(q[1], q[2])}</span> {x}</p>; })}
        </article>)}
      </section>}
    </StudioPage>
  );
}
