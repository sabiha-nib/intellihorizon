import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call, msg } from "../components/auth/messages";
import { Composer, ContextPicker, PersonaPicker, usePersona, type TutorContext, useTutorLang, LangPicker } from "../components/app/Tutor";
import { SUBJECTS, isSubjectId, subjectById, type SubjectId } from "../lib/curriculum/registry";
import { PageHeader, SignInPrompt, card } from "../components/app/kit";
import { PaperPage } from "../components/edu/ui";
import { ask, deleteThread, listThreads } from "../lib/api/tutor.functions";
import type { ThreadSummary } from "../lib/tutor/types";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/tutor/")({
  validateSearch: (s: Record<string, unknown>): { subject?: SubjectId; book?: string; chapter?: string } => ({
    subject: isSubjectId(s.subject) ? s.subject : undefined,
    book: typeof s.book === "string" ? s.book : undefined,
    chapter: typeof s.chapter === "string" ? s.chapter : undefined,
  }),
  head: () => ({ meta: [{ title: "Tutor | IntelliHorizon" }] }),
  component: TutorHome,
});

function TutorHome() {
  const { account, tx, t, lang } = useLearner();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<TutorContext>({ subject: search.subject ?? null, book: search.book ?? null, chapter: search.chapter ?? null });
  const [filter, setFilter] = useState<SubjectId | null>(null);
  useEffect(() => { setCtx({ subject: search.subject ?? null, book: search.book ?? null, chapter: search.chapter ?? null }); }, [search.subject, search.book, search.chapter]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [persona, setPersona] = usePersona();
  const [tutorLang, setTutorLang] = useTutorLang();

  useEffect(() => {
    if (!account) return;
    const timer = setTimeout(async () => {
      const r = await call(listThreads({ data: { search: q, subjectId: filter } }));
      setThreads(r.ok ? r.threads : []);
    }, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [account, q, filter]);

  if (!account) {
    return (
      <PaperPage>
        <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-6 md:px-6">
          <PageHeader title={tx("Tutor", "টিউটর")} subtitle={tx("Ask about your NCTB textbook and get answers quoted from the book itself, with the page they come from.", "তোমার এনসিটিবি পাঠ্যবই নিয়ে প্রশ্ন করো, উত্তর পাবে বই থেকেই, পৃষ্ঠা নম্বরসহ।")} />
          <SignInPrompt next="/tutor" why={{ en: "Your questions are private and saved to your account, so the tutor needs you to sign in.", bn: "তোমার প্রশ্ন গোপন থাকে এবং অ্যাকাউন্টে সংরক্ষিত হয়, তাই টিউটর ব্যবহারে সাইন ইন লাগবে।" }} />
        </main>
      </PaperPage>
    );
  }

  const send = async (text: string) => {
    setBusy(true);
    setErr(null);
    const r = await call(ask({ data: { threadId: null, question: text, subjectId: ctx.subject, textbookId: ctx.book, chapterId: ctx.chapter, scopeExplicit: true, persona, style: null, langMode: tutorLang } }), 25000);
    setBusy(false);
    if (!r.ok) { setErr(r.code); return false; }
    void navigate({ to: "/tutor/$threadId", params: { threadId: r.threadId } });
    return true;
  };

  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-6">
        <PageHeader title={tx("AI Tutor", "এআই টিউটর")} subtitle={tx("Every answer quotes your own textbook and shows exactly where it comes from. If it isn't in your book, I'll tell you instead of guessing.", "প্রতিটি উত্তর তোমার নিজের পাঠ্যবই থেকে নেওয়া, কোথা থেকে তাও দেখানো হয়। বইয়ে না থাকলে অনুমান না করে সরাসরি জানাব।")} />
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className={`${card} space-y-4 p-5 md:p-6`} aria-labelledby="ask-h">
            <h2 id="ask-h" className="font-display text-xl font-bold">{tx("Ask a new question", "নতুন প্রশ্ন করো")}</h2>
            <ContextPicker value={ctx} onChange={setCtx} />
            <PersonaPicker value={persona} onChange={setPersona} /><LangPicker value={tutorLang} onChange={setTutorLang} />
            <Composer onSend={send} busy={busy} autoFocus />
            {err && <p className="text-sm font-medium text-again" role="alert">{err === "rate_limited" ? tx("You've asked a lot in a short time. Take a short break and try again.", "অল্প সময়ে অনেক প্রশ্ন হয়েছে। একটু বিরতি নিয়ে আবার চেষ্টা করো।") : t(msg(err) ?? msg("unknown")!)}</p>}
            <details className="rounded-[14px] bg-paper/70 p-4 text-sm leading-relaxed text-ink-mid">
              <summary className="cursor-pointer font-semibold text-ink">{tx("How the tutor works", "টিউটর কীভাবে কাজ করে")}</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{tx("It searches only the eight Class 7 subjects, and only inside the subject or book you choose. Name a book (like Anandapath) and it searches that book.", "শুধু ৭ম শ্রেণির আটটি বিষয়ে খোঁজে, আর তুমি যে বিষয় বা বই বাছবে শুধু তার ভেতরে। বইয়ের নাম লিখলে (যেমন আনন্দপাঠ) সেই বইয়েই খোঁজে।")}</li>
                <li>{tx("It shows short passages from your book, each with its chapter and page. When an AI model is switched on, it explains only from those passages, and every part is labelled: from your textbook, worked out from it, general knowledge, or couldn't be checked.", "তোমার বই থেকে ছোট অংশ দেখায়, প্রতিটির অধ্যায় ও পৃষ্ঠাসহ। এআই মডেল চালু থাকলে শুধু ওই অংশ থেকেই ব্যাখ্যা করে, আর প্রতিটি অংশে লেবেল থাকে: পাঠ্যবই থেকে, তা থেকে বের করা, সাধারণ জ্ঞান, বা যাচাই করা যায়নি।")}</li>
                <li>{tx("It searches words, not meaning, so using your textbook's own words works best.", "এটি অর্থ নয়, শব্দ খোঁজে, তাই বইয়ের শব্দ ব্যবহার করলে ভালো কাজ করে।")}</li>
                <li>{tx("Sums typed like 3/4 + 1/6 are worked out exactly by a calculator.", "৩/৪ + ১/৬ এর মতো হিসাব ক্যালকুলেটরে নির্ভুলভাবে করা হয়।")}</li>
              </ul>
            </details>
          </section>
          <aside aria-labelledby="hist-h">
            <h2 id="hist-h" className="font-display text-lg font-bold">{tx("Your conversations", "তোমার কথোপকথন")}</h2>
            <div className="mt-3 flex flex-wrap gap-1" role="radiogroup" aria-label={tx("Filter by subject", "বিষয় দিয়ে ছাঁকো")}>
              <button type="button" role="radio" aria-checked={filter === null} onClick={() => setFilter(null)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filter === null ? "bg-brand text-sheet" : "bg-sheet text-ink-mid"}`}>{tx("All", "সব")}</button>
              {SUBJECTS.map((s) => <button key={s.id} type="button" role="radio" aria-checked={filter === s.id} onClick={() => setFilter(s.id)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filter === s.id ? "bg-brand text-sheet" : "bg-sheet text-ink-mid"}`}>{t(s.short)}</button>)}
            </div>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search your questions", "তোমার প্রশ্ন খোঁজো")} aria-label={tx("Search your questions", "তোমার প্রশ্ন খোঁজো")} className="mt-3 h-11 w-full rounded-[12px] border border-ink-low/30 bg-sheet px-3 text-[15px] outline-none focus:border-ink" />
            <ul className="mt-3 divide-y divide-ink-low/15">
              {threads === null && <li className="py-3"><div className="h-4 w-2/3 animate-pulse rounded bg-ink-low/20 motion-reduce:animate-none" /></li>}
              {threads?.length === 0 && <li className="py-3 text-sm text-ink-mid">{q ? tx("Nothing matches that.", "এমন কিছু নেই।") : tx("Your questions will appear here.", "তোমার প্রশ্নগুলো এখানে দেখা যাবে।")}</li>}
              {threads?.map((th) => (
                <li key={th.id} className="group flex items-start gap-2 py-2.5">
                  <Link to="/tutor/$threadId" params={{ threadId: th.id }} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold group-hover:underline">{th.title}</span>
                    <span className="block truncate text-xs text-ink-low">{th.contextLabel ?? (th.subjectKey && subjectById(th.subjectKey) ? t(subjectById(th.subjectKey)!.label) : tx("All subjects", "সব বিষয়"))} · {new Date(th.updatedAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short" })}</span>
                  </Link>
                  <button type="button" aria-label={tx(`Delete "${th.title}"`, `"${th.title}" মুছে ফেলো`)} onClick={async () => { if (!confirm(tx("Delete this conversation?", "এই কথোপকথন মুছে ফেলবে?"))) return; const r = await call(deleteThread({ data: { id: th.id } })); if (r.ok) setThreads((x) => x?.filter((y) => y.id !== th.id) ?? null); }} className="rounded-full px-2 text-sm text-ink-low hover:text-again">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>
    </PaperPage>
  );
}
