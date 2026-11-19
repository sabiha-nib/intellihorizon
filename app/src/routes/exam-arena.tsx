import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { ReadinessFactors } from "../components/app/Readiness";
import { EmptyState, card } from "../components/app/kit";
import { ErrorLine, Loading, StudioPage, btn } from "../components/app/studio-kit";
import { startQuiz } from "../lib/api/quiz.functions";
import { examArena } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/exam-arena")({
  head: () => ({ meta: [{ title: "ExamArena | IntelliHorizon" }] }),
  component: Arena,
});

type Ch = { id: string; title: string; book_title: string; published: number; attempts: number; distinct: number; readiness: { band: string; factors: { key: string; value: string; ok: boolean }[] } };

function Arena() {
  const { tx, account } = useLearner();
  const nav = useNavigate();
  const [list, setList] = useState<Ch[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(10);
  useEffect(() => { if (account) void call(examArena()).then((r) => (r.ok ? setList(r.chapters) : setErr(r.code))); }, [account]);
  return (
    <StudioPage next="/exam-arena" title={tx("ExamArena", "পরীক্ষা অঙ্গন")} subtitle={tx("See how ready each chapter looks from your own evidence, then sit a timed exam with answers shown at the end.", "নিজের প্রমাণে প্রতিটি অধ্যায়ের প্রস্তুতি দেখো, তারপর সময় বাঁধা পরীক্ষা দাও; উত্তর শেষে দেখাবে।")}
      note={tx("Readiness is shown as four separate factors, not a score or a prediction of your exam mark.", "প্রস্তুতি দেখানো হয় চারটি আলাদা কারণে, কোনো স্কোর বা পরীক্ষার নম্বরের ভবিষ্যদ্বাণী হিসেবে নয়।")}>
      <ErrorLine code={err} />
      {list === null ? <Loading /> : list.length === 0 ? <EmptyState title={tx("No chapter has published questions yet", "এখনো কোনো অধ্যায়ে প্রকাশিত প্রশ্ন নেই")} body={tx("Exams appear once questions are published.", "প্রশ্ন প্রকাশিত হলে পরীক্ষা আসবে।")} /> : (
        <>
          <label className="flex items-center gap-2 text-sm font-semibold">{tx("Questions per exam", "পরীক্ষায় প্রশ্ন")}
            <select className="rounded-[10px] border border-ink-low/30 bg-sheet px-2 py-1" value={n} onChange={(e) => setN(Number(e.target.value))}>{[5, 10, 15, 20].map((x) => <option key={x}>{x}</option>)}</select>
            <span className="font-normal text-ink-mid">{tx(`${Math.round((n * 90) / 60)} minutes`, `${Math.round((n * 90) / 60)} মিনিট`)}</span>
          </label>
          <ul className="space-y-3">{list.map((c) => (
            <li key={c.id} className={`${card} space-y-3 p-5`} data-testid="arena-chapter">
              <div><h2 className="font-display text-lg font-bold" lang="bn">{c.title}</h2><p className="text-xs text-ink-low">{c.book_title} · {tx(`${c.published} published questions`, `${c.published}টি প্রকাশিত প্রশ্ন`)}</p></div>
              <ReadinessFactors r={c.readiness} />
              <button className={btn} onClick={async () => { setErr(null); const r = await call(startQuiz({ data: { mode: "exam", chapterId: c.id, topicId: null, count: Math.min(n, Math.max(3, c.published)) } })); if (r.ok) void nav({ to: "/quiz/$setId", params: { setId: r.id } }); else setErr(r.code); }}>{tx("Start timed exam", "সময় বাঁধা পরীক্ষা শুরু")}</button>
            </li>))}</ul>
        </>
      )}
    </StudioPage>
  );
}
