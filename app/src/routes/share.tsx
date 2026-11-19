import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { card } from "../components/app/kit";
import { ErrorLine, StudioPage, btn, btnGhost, input } from "../components/app/studio-kit";
import { createShare, listShares, revokeShare } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/share")({
  head: () => ({ meta: [{ title: "Teacher and parent access | IntelliHorizon" }] }),
  component: Share,
});

type G = { id: string; role: string; label: string | null; created_at: string; expires_at: string; revoked_at: string | null; last_viewed_at: string | null; views: number };

function Share() {
  const { tx, account } = useLearner();
  const [role, setRole] = useState<"teacher" | "parent">("parent");
  const [label, setLabel] = useState(""); const [days, setDays] = useState(14);
  const [code, setCode] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [list, setList] = useState<G[]>([]);
  const load = () => void call(listShares()).then((r) => r.ok && setList(r.shares));
  useEffect(() => { if (account) load(); }, [account]);
  const nowIso = new Date().toISOString();
  return (
    <StudioPage next="/share" title={tx("Teacher and parent access", "শিক্ষক ও অভিভাবকের প্রবেশ")} subtitle={tx("Make a code that lets one person see a summary of your progress. You can withdraw it at any time.", "একটি কোড বানাও, যা দিয়ে একজন তোমার অগ্রগতির সারাংশ দেখতে পারবে। যেকোনো সময় বাতিল করতে পারো।")}
      note={tx("They will see topic and chapter progress only: never your name or email, tutor conversations, notes, reflections or uploads.", "তারা শুধু টপিক ও অধ্যায়ের অগ্রগতি দেখবে: কখনো তোমার নাম বা ইমেইল, টিউটরের কথোপকথন, নোট, প্রতিফলন বা আপলোড নয়।")}>
      <form className={`${card} space-y-3 p-5`} onSubmit={async (e) => { e.preventDefault(); setErr(null); const r = await call(createShare({ data: { role, label: label || null, days } })); if (r.ok) { setCode(r.code); load(); } else setErr(r.code); }}>
        <fieldset className="flex gap-2"><legend className="mb-1 text-sm font-semibold">{tx("Who is it for?", "কার জন্য?")}</legend>
          {(["parent", "teacher"] as const).map((x) => <button key={x} type="button" aria-pressed={role === x} onClick={() => setRole(x)} className={role === x ? btn : btnGhost}>{x === "parent" ? tx("Parent", "অভিভাবক") : tx("Teacher", "শিক্ষক")}</button>)}
        </fieldset>
        <label className="block text-sm font-semibold">{tx("Label (only you see this)", "লেবেল (শুধু তুমি দেখবে)")}<input className={input} maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="block text-sm font-semibold">{tx("Expires after (days)", "মেয়াদ (দিন)")}<input className={input} type="number" min={1} max={90} value={days} onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))} /></label>
        <button className={btn} type="submit">{tx("Make a code", "কোড বানাও")}</button><ErrorLine code={err} />
      </form>
      {code && <div className={`${card} space-y-2 border-brand p-5`} role="status" data-testid="share-code">
        <p className="font-semibold">{tx("Give this code to them. It is shown only once.", "কোডটি তাদের দাও। এটি শুধু একবার দেখানো হয়।")}</p>
        <p className="font-mono text-2xl tracking-wider">{code}</p>
        <p className="text-sm text-ink-mid">{tx("They open ", "তারা খুলবে ")}<Link to="/family" className="underline">/family</Link>{tx(" and enter it.", " এবং কোডটি লিখবে।")}</p>
      </div>}
      {list.length > 0 && <ul className="space-y-2">{list.map((g) => {
        const active = !g.revoked_at && g.expires_at > nowIso;
        return <li key={g.id} className={`${card} flex flex-wrap items-center justify-between gap-2 p-4 text-[15px]`}>
          <span>{g.role === "parent" ? tx("Parent", "অভিভাবক") : tx("Teacher", "শিক্ষক")}{g.label ? ` · ${g.label}` : ""} · {active ? tx(`active until ${new Date(g.expires_at).toLocaleDateString()}`, `${new Date(g.expires_at).toLocaleDateString()} পর্যন্ত চালু`) : g.revoked_at ? tx("withdrawn", "বাতিল") : tx("expired", "মেয়াদ শেষ")} · {tx(`viewed ${g.views} times`, `${g.views} বার দেখা হয়েছে`)}</span>
          {active && <button className={btnGhost} onClick={async () => { await call(revokeShare({ data: { id: g.id } })); load(); }}>{tx("Withdraw", "বাতিল করো")}</button>}
        </li>;
      })}</ul>}
    </StudioPage>
  );
}
