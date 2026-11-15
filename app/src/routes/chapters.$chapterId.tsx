import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { BookStatus, EmptyState, bookLabel, card, todayLocal } from "../components/app/kit";
import { PaperPage } from "../components/edu/ui";
import type { L } from "../content/types";
import { addChapterToPlan, getChapter, markChapterOpened } from "../lib/api/learning.functions";
import { useLearner } from "../lib/store";
import { LESSONS } from "../lib/learning/lessons";

export const Route = createFileRoute("/chapters/$chapterId")({
  loader: ({ params }) => getChapter({ data: { id: params.chapterId } }),
  head: () => ({ meta: [{ title: "Chapter | IntelliHorizon" }] }),
  component: Chapter,
});

const BLOOM: Record<string, L> = {
  remember: { en: "Remember", bn: "মনে রাখা" }, understand: { en: "Understand", bn: "বোঝা" }, apply: { en: "Apply", bn: "প্রয়োগ" },
  analyze: { en: "Analyse", bn: "বিশ্লেষণ" }, evaluate: { en: "Evaluate", bn: "মূল্যায়ন" }, create: { en: "Create", bn: "সৃষ্টি" },
};

function Chapter() {
  const data = Route.useLoaderData();
  const { chapterId } = Route.useParams();
  const { tx, t, lang, account } = useLearner();
  const [planned, setPlanned] = useState<"idle" | "busy" | "done" | "error">("idle");
  useEffect(() => { if (account) void call(markChapterOpened({ data: { chapterId } })); }, [account, chapterId]);
  if (!data.ok) return <PaperPage><main className="mx-auto max-w-3xl px-4 pt-6"><EmptyState title={tx("Chapter not found", "অধ্যায় পাওয়া যায়নি")} body={tx("It may have been removed.", "হয়তো সরিয়ে ফেলা হয়েছে।")} /></main></PaperPage>;
  const c = data.chapter as Record<string, string | number | null>;
  const s = (k: string) => (c[k] === null ? "" : String(c[k]));
  const n = (k: string) => Number(c[k] ?? 0);
  const ready = n("searchable") > 0; // whole book approved, or passages here checked against the page
  const hasLesson = !!LESSONS[chapterId];
  const idx = data.siblings.findIndex((x) => x.id === chapterId);
  const prev = idx > 0 ? data.siblings[idx - 1] : null;
  const next = idx >= 0 && idx < data.siblings.length - 1 ? data.siblings[idx + 1] : null;
  const offset = c.page_offset === null ? null : n("page_offset");
  const pages = c.start_page && c.end_page ? (offset !== null ? tx(`pages ${n("start_page") - offset} to ${n("end_page") - offset}`, `পৃষ্ঠা ${n("start_page") - offset} থেকে ${n("end_page") - offset}`) : tx(`PDF pages ${s("start_page")} to ${s("end_page")}`, `পিডিএফ পৃষ্ঠা ${s("start_page")} থেকে ${s("end_page")}`)) : "";
  const btn = "inline-flex h-12 items-center justify-center rounded-[14px] px-5 font-semibold transition-transform active:scale-[0.98]";
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-6 md:px-6">
        <Link to="/books/$bookId" params={{ bookId: s("textbook_id") }} className="text-sm text-ink-mid hover:text-ink" lang={s("language")}>{s("book_title")}</Link>
        <header className={`${card} space-y-3 p-6`}>
          <p className="text-sm font-semibold text-ink-mid">{bookLabel({ subject_key: s("subject_key"), subject_name: s("subject_name"), paper: s("paper") }, t, lang)} · {s("label") || tx(`Chapter ${s("position")}`, `অধ্যায় ${s("position")}`)}</p>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight" lang={s("language")}>{s("title")}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-mid">
            <BookStatus status={s("book_status") === "indexed" && ready ? "indexed" : ready ? "partial" : s("book_status") === "indexed" ? "discovered" : s("book_status")} />
            {pages && <span>{pages}</span>}
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            {ready ? (
              <Link to="/tutor" search={{ book: s("textbook_id"), chapter: chapterId }} className={`${btn} bg-brand text-sheet`}>{tx("Ask the tutor about this chapter", "এই অধ্যায় নিয়ে প্রশ্ন করো")}</Link>
            ) : (
              <p className="text-sm text-ink-mid sm:col-span-2">{tx("This chapter's text isn't searchable yet, so the tutor can't answer from it.", "এই অধ্যায়ের লেখা এখনো খোঁজা যায় না, তাই টিউটর এখান থেকে উত্তর দিতে পারবে না।")}</p>
            )}
            {(n("questions") > 0 || hasLesson) && <Link to="/practice/$chapterId" params={{ chapterId }} className={`${btn} order-first bg-brand text-white sm:col-span-2`}>{n("questions") > 0 ? tx(`Start a Learning Session (${n("questions")} checked questions)`, `লার্নিং সেশন শুরু করো (${n("questions")}টি যাচাই করা প্রশ্ন)`) : tx("Start a short lesson and explain it back", "ছোট পাঠ শুরু করো ও নিজের ভাষায় বলো")}</Link>}
            {account && (
              <button type="button" disabled={planned === "busy" || planned === "done"} onClick={async () => { setPlanned("busy"); const r = await call(addChapterToPlan({ data: { chapterId, date: todayLocal() } })); setPlanned(r.ok ? "done" : "error"); }} className={`${btn} border border-ink-low/35 bg-sheet disabled:opacity-70`}>
                {planned === "done" ? tx("Added to today's plan", "আজকের পরিকল্পনায় যোগ হয়েছে") : planned === "error" ? tx("Couldn't add. Try again", "যোগ হয়নি। আবার চেষ্টা করো") : tx("Add to today's plan", "আজকের পরিকল্পনায় যোগ করো")}
              </button>
            )}
            {c.official_url && <a href={s("official_url")} target="_blank" rel="noopener noreferrer" className={`${btn} border border-ink-low/35 bg-sheet`}>{tx("Read it in the official book", "মূল বইয়ে পড়ো")}</a>}
          </div>
        </header>
        <section className={`${card} p-6`} aria-labelledby="obj-h">
          <h2 id="obj-h" className="font-display text-xl font-bold">{tx("Learning outcomes", "শিখনফল")}</h2>
          {data.objectives.length === 0 ? (
            <p className="mt-2 text-ink-mid">{tx("The learning outcomes for this chapter haven't been entered yet.", "এই অধ্যায়ের শিখনফল এখনো যোগ হয়নি।")}</p>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {data.objectives.map((o) => (
                <li key={o.id} className="flex gap-3">
                  <span className="font-semibold tabular-nums text-ink-low">{o.position}.</span>
                  <span className="flex-1" lang={s("language")}>{o.text}{o.bloom && <span className="ml-2 rounded-full border border-ink-low/30 px-2 py-0.5 text-xs text-ink-mid">{t(BLOOM[o.bloom])}</span>}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        {data.mine && (
          <section className={`${card} p-6`}>
            <h2 className="font-display text-xl font-bold">{tx("Your practice here", "এখানে তোমার অনুশীলন")}</h2>
            <p className="mt-2 text-ink-mid">{tx(`${data.mine.correct} of ${data.mine.attempts} answers right so far.`, `এ পর্যন্ত ${data.mine.attempts}টি উত্তরের ${data.mine.correct}টি সঠিক।`)}</p>
          </section>
        )}
        <nav className="flex justify-between gap-3 text-sm font-semibold" aria-label={tx("Chapters", "অধ্যায়")}>
          {prev ? <Link to="/chapters/$chapterId" params={{ chapterId: prev.id }} className="text-ink-mid hover:text-ink">← {prev.position}. {prev.title}</Link> : <span />}
          {next ? <Link to="/chapters/$chapterId" params={{ chapterId: next.id }} className="text-right text-ink-mid hover:text-ink">{next.position}. {next.title} →</Link> : <span />}
        </nav>
      </main>
    </PaperPage>
  );
}
