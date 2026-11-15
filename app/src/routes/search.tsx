import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { PageHeader, SubjectFilter, SubjectTag, card } from "../components/app/kit";
import { PaperPage } from "../components/edu/ui";
import { globalSearch } from "../lib/api/search.functions";
import { isSubjectId, type SubjectId } from "../lib/curriculum/registry";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): { q?: string; subject?: SubjectId } => ({
    q: typeof s.q === "string" ? s.q.slice(0, 100) : undefined,
    subject: isSubjectId(s.subject) ? s.subject : undefined,
  }),
  head: () => ({ meta: [{ title: "Search | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: SearchPage,
});

type Res = Extract<Awaited<ReturnType<typeof globalSearch>>, { ok: true }>;

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { tx, t, account } = useLearner();
  const [text, setText] = useState(search.q ?? "");
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const q = (search.q ?? "").trim();
  useEffect(() => {
    if (!q) { setRes(null); return; }
    setBusy(true);
    void call(globalSearch({ data: { q, subjectId: search.subject ?? null } })).then((r) => { setBusy(false); setRes(r.ok ? (r as Res) : null); });
  }, [q, search.subject]);

  const go = (next: { q?: string; subject?: SubjectId | null }) => void navigate({ to: "/search", search: { q: next.q ?? (q || undefined), subject: (next.subject === undefined ? search.subject : next.subject) ?? undefined } });
  const total = res ? res.subjects.length + res.books.length + res.chapters.length + res.passages.length + res.threads.length + res.saved.length : 0;
  const h = "font-display text-lg font-bold";
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pt-6 md:px-6">
        <PageHeader title={tx("Search", "খোঁজো")} subtitle={tx("Subjects, books and chapters for Class 7. Signed in, it also searches your textbooks' text, your tutor conversations and your saved notes. Only yours.", "৭ম শ্রেণির বিষয়, বই ও অধ্যায়। সাইন ইন থাকলে পাঠ্যবইয়ের লেখা, তোমার টিউটর কথোপকথন আর সংরক্ষিত নোটেও খোঁজে। শুধু তোমারগুলো।")} />
        <form role="search" onSubmit={(e) => { e.preventDefault(); go({ q: text.trim() || undefined }); }} className="flex gap-2">
          <label htmlFor="sq" className="sr-only">{tx("Search", "খোঁজো")}</label>
          <input id="sq" type="search" value={text} maxLength={100} onChange={(e) => setText(e.target.value)} placeholder={tx("Try: Kabuliwala, photosynthesis, সন্ধি, Unit 3", "যেমন: কাবুলিওয়ালা, সালোকসংশ্লেষণ, সন্ধি, Unit 3")} className="h-12 flex-1 rounded-[14px] border border-ink-low/30 bg-sheet px-4 text-[16px] outline-none focus:border-ink" />
          <button type="submit" className="h-12 rounded-[14px] bg-brand px-5 font-semibold text-sheet">{tx("Search", "খোঁজো")}</button>
        </form>
        <SubjectFilter value={search.subject ?? null} onChange={(v) => go({ subject: v })} />
        {busy && <p className="text-sm text-ink-mid" role="status">{tx("Searching…", "খুঁজছি…")}</p>}
        {res && !busy && total === 0 && <p className={`${card} p-5 text-ink-mid`}>{tx("Nothing matched. Try a word as it's printed in the book.", "কিছু মেলেনি। বইয়ে যেভাবে ছাপা আছে সেভাবে শব্দটি লেখো।")}</p>}
        {res && !res.signedIn && <p className="text-sm text-ink-mid">{tx("Sign in to search inside the textbooks and your own notes.", "পাঠ্যবইয়ের ভেতরে ও নিজের নোটে খুঁজতে সাইন ইন করো।")} <Link to="/signin" search={{ next: "/search" }} className="font-semibold underline decoration-dashed underline-offset-4">{tx("Sign in", "সাইন ইন")}</Link></p>}
        {res && res.subjects.length > 0 && (
          <section aria-labelledby="r-s"><h2 id="r-s" className={h}>{tx("Subjects", "বিষয়")}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">{res.subjects.map((s) => <li key={s.id}><Link to="/subjects/$subjectId" params={{ subjectId: s.id }} className="inline-flex items-center gap-2 rounded-full border border-ink-low/30 bg-sheet px-3.5 py-2 font-semibold hover:border-ink"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: s.hue }} />{t(s.label)}</Link></li>)}</ul>
          </section>
        )}
        {res && res.books.length > 0 && (
          <section aria-labelledby="r-b"><h2 id="r-b" className={h}>{tx("Books", "বই")}</h2>
            <ul className="mt-2 space-y-2">{res.books.map((b) => <li key={b.id}><Link to="/books/$bookId" params={{ bookId: b.id }} className={`${card} flex items-center justify-between gap-3 p-3.5`}><span className="font-semibold">{b.title}</span><SubjectTag id={b.subject_key} /></Link></li>)}</ul>
          </section>
        )}
        {res && res.chapters.length > 0 && (
          <section aria-labelledby="r-c"><h2 id="r-c" className={h}>{tx("Chapters", "অধ্যায়")}</h2>
            <ul className="mt-2 space-y-2">{res.chapters.map((c) => <li key={c.id}><Link to="/chapters/$chapterId" params={{ chapterId: c.id }} className={`${card} flex items-center justify-between gap-3 p-3.5`}><span className="min-w-0"><span className="block font-semibold">{c.label ? `${c.label}: ` : ""}{c.title}</span><span className="block text-xs text-ink-mid">{c.book_title}</span></span><SubjectTag id={c.subject_key} /></Link></li>)}</ul>
          </section>
        )}
        {res && res.passages.length > 0 && (
          <section aria-labelledby="r-p"><h2 id="r-p" className={h}>{tx("In your textbooks", "তোমার পাঠ্যবইয়ে")}</h2>
            <ul className="mt-2 space-y-3">{res.passages.map((p, i) => (
              <li key={i} className={`${card} p-4`}>
                <p className="leading-relaxed">{p.text}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-mid"><SubjectTag id={p.subjectKey} /><span>{p.title}{p.chapterTitle ? ` · ${p.chapterTitle}` : ""} · {p.printedPage !== null && p.printedPage > 0 ? tx(`page ${p.printedPage}`, `পৃষ্ঠা ${p.printedPage}`) : tx(`PDF page ${p.pdfPage}`, `পিডিএফ পৃষ্ঠা ${p.pdfPage}`)}{p.ocr ? tx(" · OCR text", " · ওসিআর লেখা") : ""}</span>{p.chapterId && <Link to="/chapters/$chapterId" params={{ chapterId: p.chapterId }} className="font-semibold underline decoration-dashed underline-offset-4">{tx("Open chapter", "অধ্যায় খোলো")}</Link>}</p>
              </li>
            ))}</ul>
          </section>
        )}
        {res && res.threads.length > 0 && (
          <section aria-labelledby="r-t"><h2 id="r-t" className={h}>{tx("Your tutor conversations", "তোমার টিউটর কথোপকথন")}</h2>
            <ul className="mt-2 space-y-2">{res.threads.map((th) => <li key={th.id}><Link to="/tutor/$threadId" params={{ threadId: th.id }} className={`${card} flex items-center justify-between gap-3 p-3.5`}><span className="truncate font-semibold">{th.title}</span><SubjectTag id={th.subject_key} /></Link></li>)}</ul>
          </section>
        )}
        {res && res.saved.length > 0 && (
          <section aria-labelledby="r-n"><h2 id="r-n" className={h}>{tx("Your saved notes", "তোমার সংরক্ষিত নোট")}</h2>
            <ul className="mt-2 space-y-2">{res.saved.map((n) => <li key={n.id}><Link to="/saved" className={`${card} flex items-center justify-between gap-3 p-3.5`}><span className="line-clamp-2">{n.excerpt}</span><SubjectTag id={n.subject_key} /></Link></li>)}</ul>
          </section>
        )}
        {!q && account && <p className="text-sm text-ink-mid">{tx("Tip: pick a subject first to search only inside it.", "পরামর্শ: শুধু একটি বিষয়ের ভেতরে খুঁজতে আগে বিষয়টি বাছো।")}</p>}
      </main>
    </PaperPage>
  );
}
