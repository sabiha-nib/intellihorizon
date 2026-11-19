import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { EmptyState, card } from "../components/app/kit";
import { ErrorLine, Loading, StudioPage, btn, btnGhost, input } from "../components/app/studio-kit";
import { addSuggestedCard, createCard, deleteCard, listCards, reviewCard, suggestCards, summaryChapters } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/cards")({
  head: () => ({ meta: [{ title: "MemoryCards | IntelliHorizon" }] }),
  component: Cards,
});

type CardT = { id: string; kind: string; front: string; back: string; lang: string | null; reps: number; lapses: number; interval_days: number; due_at: string; last_grade: string | null };
const GRADE_LABEL: Record<string, [string, string]> = { again: ["Again", "আবার"], hard: ["Hard", "কঠিন"], good: ["Good", "ভালো"], easy: ["Easy", "সহজ"] };

function Cards() {
  const { tx, account } = useLearner();
  const [cards, setCards] = useState<CardT[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"review" | "make" | "all">("review");
  const load = () => void call(listCards()).then((r) => (r.ok ? setCards(r.cards) : setErr(r.code)));
  useEffect(() => { if (account) load(); }, [account]);
  const now = new Date().toISOString();
  const due = (cards ?? []).filter((c) => c.due_at <= now);
  return (
    <StudioPage title={tx("MemoryCards", "মেমরি কার্ড")} subtitle={tx("Flashcards you make or take from your book's definitions. Cards you find hard come back sooner.", "নিজে বানানো বা বইয়ের সংজ্ঞা থেকে নেওয়া ফ্ল্যাশকার্ড। কঠিন লাগা কার্ড আগে ফিরে আসে।")} next="/cards"
      note={tx("Card reviews help you remember; they are not counted as mastery evidence. Mastery comes only from answering practice questions.", "কার্ড রিভিউ মনে রাখতে সাহায্য করে; এটি দক্ষতার প্রমাণ হিসেবে গোনা হয় না। দক্ষতা আসে শুধু অনুশীলনের প্রশ্নের উত্তর থেকে।")}>
      <div role="tablist" className="flex flex-wrap gap-2">
        {(["review", "make", "all"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? btn : btnGhost}>
            {t === "review" ? tx(`Review (${due.length} due)`, `রিভিউ (${due.length}টি বাকি)`) : t === "make" ? tx("Make cards", "কার্ড বানাও") : tx(`All cards (${cards?.length ?? 0})`, `সব কার্ড (${cards?.length ?? 0})`)}
          </button>
        ))}
      </div>
      <ErrorLine code={err} />
      {cards === null ? <Loading /> : tab === "review" ? <Review due={due} onDone={load} /> : tab === "make" ? <Make onAdded={load} /> : (
        cards.length === 0 ? <EmptyState title={tx("No cards yet", "এখনো কার্ড নেই")} body={tx("Make one yourself or take definitions from a chapter.", "নিজে বানাও বা কোনো অধ্যায় থেকে সংজ্ঞা নাও।")} /> : (
          <ul className="space-y-3">{cards.map((c) => (
            <li key={c.id} className={`${card} p-4`}>
              <p className="font-semibold">{c.front}</p><p className="mt-1 text-ink-mid">{c.back}</p>
              <p className="mt-2 text-xs text-ink-low">{c.kind === "definition" ? tx("From your textbook, word for word", "পাঠ্যবই থেকে, হুবহু") : c.kind === "excerpt" ? tx("From a saved excerpt", "সংরক্ষিত অংশ থেকে") : tx("Made by you", "তোমার বানানো")} · {tx(`next ${new Date(c.due_at).toLocaleDateString()}`, `পরের বার ${new Date(c.due_at).toLocaleDateString()}`)}</p>
              <button type="button" className="mt-2 text-sm font-semibold text-ink-mid underline decoration-dashed underline-offset-4 hover:text-again" onClick={async () => { await call(deleteCard({ data: { id: c.id } })); load(); }}>{tx("Delete", "মুছো")}</button>
            </li>))}</ul>
        )
      )}
    </StudioPage>
  );
}

function Review({ due, onDone }: { due: CardT[]; onDone: () => void }) {
  const { tx } = useLearner();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const c = due[i];
  if (!c) return <EmptyState title={tx("Nothing due right now", "এখন কিছু বাকি নেই")} body={tx("Come back later, or make new cards.", "পরে এসো, বা নতুন কার্ড বানাও।")} />;
  const grade = async (g: string) => {
    setBusy(true);
    await call(reviewCard({ data: { id: c.id, grade: g, clientEventId: `card:${c.id}:${c.due_at}` } }));
    setBusy(false); setShown(false);
    if (i + 1 >= due.length) onDone(); else setI(i + 1);
  };
  return (
    <section className={`${card} space-y-4 p-6`} aria-live="polite" data-testid="card-review">
      <p className="text-xs text-ink-low">{tx(`Card ${i + 1} of ${due.length}`, `কার্ড ${i + 1} / ${due.length}`)}</p>
      <p lang={c.lang ?? undefined} className="text-xl font-semibold">{c.front}</p>
      {shown ? (
        <>
          <p lang={c.lang ?? undefined} className="border-l-[3px] border-thread pl-3.5 leading-[1.75]">{c.back}</p>
          <div className="flex flex-wrap gap-2">{Object.entries(GRADE_LABEL).map(([g, l]) => <button key={g} disabled={busy} onClick={() => void grade(g)} className={btnGhost}>{tx(l[0], l[1])}</button>)}</div>
        </>
      ) : <button className={btn} onClick={() => setShown(true)}>{tx("Show answer", "উত্তর দেখাও")}</button>}
    </section>
  );
}

function Make({ onAdded }: { onAdded: () => void }) {
  const { tx } = useLearner();
  const [front, setFront] = useState(""); const [back, setBack] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [chapters, setChapters] = useState<{ id: string; title: string; book_title: string }[]>([]);
  const [ch, setCh] = useState("");
  const [sug, setSug] = useState<{ passageId: number; page: number; front: string; back: string; lang: string; exists: boolean }[] | null>(null);
  useEffect(() => { void call(summaryChapters()).then((r) => r.ok && setChapters(r.chapters)); }, []);
  useEffect(() => { if (ch) { setSug(null); void call(suggestCards({ data: { chapterId: ch } })).then((r) => setSug(r.ok ? r.suggestions : [])); } }, [ch]);
  return (
    <div className="space-y-6">
      <form className={`${card} space-y-3 p-5`} onSubmit={async (e) => { e.preventDefault(); setErr(null); const r = await call(createCard({ data: { front, back } })); if (r.ok) { setFront(""); setBack(""); setMsg(tx("Card added.", "কার্ড যোগ হয়েছে।")); onAdded(); } else setErr(r.code); }}>
        <h2 className="font-display text-lg font-bold">{tx("Write your own", "নিজে লেখো")}</h2>
        <label className="block text-sm font-semibold">{tx("Front (question)", "সামনে (প্রশ্ন)")}<input className={input} value={front} onChange={(e) => setFront(e.target.value)} maxLength={400} required /></label>
        <label className="block text-sm font-semibold">{tx("Back (answer)", "পেছনে (উত্তর)")}<textarea className={input} value={back} onChange={(e) => setBack(e.target.value)} maxLength={1200} rows={3} required /></label>
        <button className={btn} type="submit">{tx("Add card", "কার্ড যোগ করো")}</button>
        {msg && <p role="status" className="text-sm">{msg}</p>}<ErrorLine code={err} />
      </form>
      <section className={`${card} space-y-3 p-5`}>
        <h2 className="font-display text-lg font-bold">{tx("Definitions from a chapter", "অধ্যায় থেকে সংজ্ঞা")}</h2>
        <p className="text-sm text-ink-mid">{tx("These are sentences in checked textbook text that define a term (\"… কে … বলে\"). The answer side is the book's sentence, unchanged.", "যাচাই করা পাঠ্যবইয়ের যে বাক্যে কোনো শব্দের সংজ্ঞা আছে (\"… কে … বলে\")। উত্তরের দিকে বইয়ের বাক্যটাই, অপরিবর্তিত।")}</p>
        <select className={input} value={ch} onChange={(e) => setCh(e.target.value)} aria-label={tx("Chapter", "অধ্যায়")}>
          <option value="">{tx("Choose a chapter with checked text", "যাচাই করা লেখা আছে এমন অধ্যায় বাছো")}</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.book_title} · {c.title}</option>)}
        </select>
        {ch && (sug === null ? <Loading /> : sug.length === 0 ? <p className="text-sm text-ink-mid">{tx("No definition sentences were found in this chapter's checked text.", "এই অধ্যায়ের যাচাই করা লেখায় কোনো সংজ্ঞা-বাক্য পাওয়া যায়নি।")}</p> : (
          <ul className="space-y-2">{sug.map((s) => (
            <li key={s.front + s.passageId} className="rounded-[12px] border border-ink-low/15 p-3">
              <p lang={s.lang} className="font-semibold">{s.front}</p><p lang={s.lang} className="text-ink-mid">{s.back}</p>
              {s.exists ? <p className="mt-1 text-xs text-ink-low">{tx("Already in your cards", "ইতিমধ্যে তোমার কার্ডে আছে")}</p> : <button className={`${btnGhost} mt-2`} onClick={async () => { const r = await call(addSuggestedCard({ data: { chapterId: ch, passageId: s.passageId, front: s.front } })); if (r.ok) { setSug((x) => x?.map((y) => (y === s ? { ...y, exists: true } : y)) ?? null); onAdded(); } }}>{tx("Add this card", "এই কার্ড যোগ করো")}</button>}
            </li>))}</ul>
        ))}
      </section>
    </div>
  );
}
