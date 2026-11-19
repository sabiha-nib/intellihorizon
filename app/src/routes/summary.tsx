import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { MathText } from "../components/app/MathText";
import { EmptyState, card } from "../components/app/kit";
import { Loading, StudioPage, input } from "../components/app/studio-kit";
import { chapterSummary, summaryChapters } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "IntelliSummary | IntelliHorizon" }] }),
  component: Summary,
});

type S = { chapter: { title: string; book_title: string; language: string }; passages: number; lines: { text: string; page: number; printedPage: number | null; kind: string }[]; formulas: { id: string; name: string; expression: string }[] };

function Summary() {
  const { tx } = useLearner();
  const [chapters, setChapters] = useState<{ id: string; title: string; book_title: string; n: number }[] | null>(null);
  const [ch, setCh] = useState("");
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { void call(summaryChapters()).then((r) => setChapters(r.ok ? r.chapters : [])); }, []);
  useEffect(() => { if (ch) { setS(null); void call(chapterSummary({ data: { chapterId: ch } })).then((r) => r.ok && setS(r)); } }, [ch]);
  return (
    <StudioPage needsAccount={false} next="/summary" title={tx("IntelliSummary", "ইন্টেলিসারাংশ")} subtitle={tx("A short summary made only from sentences in the book's checked text: its definitions first, then the opening line of each passage. Nothing is reworded.", "শুধু বইয়ের যাচাই করা লেখার বাক্য দিয়ে ছোট সারাংশ: আগে সংজ্ঞা, তারপর প্রতিটি অংশের প্রথম বাক্য। কিছু নতুন করে লেখা হয়নি।")}
      note={tx("A summary only covers the pages that have been checked so far, so it can be incomplete. Read the chapter in your book too.", "এ পর্যন্ত যাচাই করা পৃষ্ঠাগুলো থেকেই সারাংশ, তাই অসম্পূর্ণ হতে পারে। বইয়ে অধ্যায়টিও পড়ো।")}>
      {chapters === null ? <Loading /> : chapters.length === 0 ? <EmptyState title={tx("No chapter has checked text yet", "এখনো কোনো অধ্যায়ে যাচাই করা লেখা নেই")} body={tx("Summaries appear once textbook pages are checked.", "পাঠ্যবইয়ের পৃষ্ঠা যাচাই হলে সারাংশ আসবে।")} /> : (
        <select className={input} value={ch} onChange={(e) => setCh(e.target.value)} aria-label={tx("Chapter", "অধ্যায়")}>
          <option value="">{tx("Choose a chapter", "অধ্যায় বাছো")}</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.book_title} · {c.title} ({tx(`${c.n} checked passages`, `${c.n}টি যাচাই করা অংশ`)})</option>)}
        </select>
      )}
      {ch && (s === null ? <Loading /> : (
        <section className={`${card} space-y-3 p-5`} data-testid="summary">
          <h2 className="font-display text-xl font-bold" lang="bn">{s.chapter.title}</h2>
          <ol className="space-y-2">{s.lines.map((l, i) => (
            <li key={i} className="leading-[1.75]"><span lang={s.chapter.language}>{l.text}</span> <span className="whitespace-nowrap text-xs text-ink-low">({l.printedPage ? tx(`printed page ${l.printedPage}`, `ছাপা পৃষ্ঠা ${l.printedPage}`) : tx(`PDF page ${l.page}`, `PDF পৃষ্ঠা ${l.page}`)}{l.kind === "definition" ? tx(", definition", ", সংজ্ঞা") : ""})</span></li>
          ))}</ol>
          {s.formulas.length > 0 && <div><h3 className="font-semibold">{tx("Checked formulas in this chapter", "এই অধ্যায়ের যাচাই করা সূত্র")}</h3><ul>{s.formulas.map((f) => <li key={f.id} lang="bn">{f.name}: <MathText text={f.expression} /></li>)}</ul></div>}
          <p className="text-xs text-ink-low">{tx(`Built from ${s.passages} checked passages.`, `${s.passages}টি যাচাই করা অংশ থেকে তৈরি।`)}</p>
        </section>
      ))}
    </StudioPage>
  );
}
