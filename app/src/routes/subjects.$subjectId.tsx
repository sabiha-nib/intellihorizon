import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { BookStatus, EmptyState, card } from "../components/app/kit";
import { PaperPage } from "../components/edu/ui";
import { getSubject } from "../lib/api/learning.functions";
import { BOOKS, isSubjectId, subjectById } from "../lib/curriculum/registry";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/subjects/$subjectId")({
  validateSearch: (s: Record<string, unknown>): { medium?: "bangla" | "english" } => ({ medium: s.medium === "english" ? "english" : s.medium === "bangla" ? "bangla" : undefined }),
  head: ({ params }) => ({ meta: [{ title: `${subjectById(params.subjectId)?.label.en ?? "Subject"} | IntelliHorizon` }] }),
  component: SubjectPage,
});

type Data = Extract<Awaited<ReturnType<typeof getSubject>>, { ok: true }>;

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const { medium } = Route.useSearch();
  const { t, tx, account } = useLearner();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!isSubjectId(subjectId)) return;
    setData(null);
    void call(getSubject({ data: { subjectId, medium: medium ?? null } })).then((r) => (r.ok ? setData(r as Data) : setErr(true)));
  }, [subjectId, medium]);

  if (!isSubjectId(subjectId)) {
    return (
      <PaperPage>
        <main className="mx-auto max-w-3xl px-4 pt-6">
          <EmptyState title={tx("Not one of the eight subjects", "আটটি বিষয়ের একটি নয়")} body={tx("IntelliHorizon covers eight Class 7 subjects. This link doesn't match any of them.", "ইন্টেলিহরাইজন ৭ম শ্রেণির আটটি বিষয় কভার করে। এই লিংক তাদের কোনোটির সাথে মেলে না।")} action={<Link to="/learn" className="font-semibold underline decoration-dashed underline-offset-4">{tx("See the eight subjects", "আটটি বিষয় দেখো")}</Link>} />
        </main>
      </PaperPage>
    );
  }
  const s = subjectById(subjectId)!;
  const pct = (c: number, a: number) => (a ? Math.round((c / a) * 100) : 0);
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-6 md:px-6">
        <Link to="/learn" className="text-sm text-ink-mid hover:text-ink">{tx("All eight subjects", "আটটি বিষয়")}</Link>
        <header>
          <span aria-hidden="true" className="block h-1.5 w-14 rounded-full" style={{ background: s.hue }} />
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight md:text-4xl">{t(s.label)}</h1>
          <p className="mt-1 text-ink-mid">{t({ en: s.label.bn, bn: s.label.en })} · {tx("Class 7", "৭ম শ্রেণি")} · {data ? (data.medium === "bangla" ? tx("Bangla medium", "বাংলা মাধ্যম") : tx("English version", "ইংলিশ ভার্সন")) : ""}</p>
          {s.id === "bangla-1st" && <p className="mt-3 max-w-[64ch] rounded-[14px] bg-sheet p-3 text-sm leading-relaxed text-ink-mid">{tx("One subject, two books: Soptoborna (prose and poems) and Anandapath (stories and a short play for quick reading). The tutor searches both unless you pick one, and every excerpt says which book it came from.", "একটি বিষয়, দুটি বই: সপ্তবর্ণা (গদ্য ও কবিতা) আর আনন্দপাঠ (দ্রুতপঠনের গল্প ও নাটিকা)। একটি না বাছলে টিউটর দুটোতেই খোঁজে, আর প্রতিটি উদ্ধৃতিতে লেখা থাকে কোন বই থেকে।")}</p>}
        </header>
        <nav aria-label={tx("Quick actions", "দ্রুত কাজ")} className="flex flex-wrap gap-2">
          <Link to="/tutor" search={{ subject: s.id }} className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold text-sheet">{tx(`Ask about ${s.short.en}`, `${s.short.bn} নিয়ে প্রশ্ন করো`)}</Link>
          <Link to="/search" search={{ subject: s.id }} className="inline-flex h-10 items-center rounded-full border border-ink-low/35 bg-sheet px-4 text-sm font-semibold hover:border-ink">{tx("Search this subject", "এই বিষয়ে খোঁজো")}</Link>
          {account && <Link to="/saved" className="inline-flex h-10 items-center rounded-full border border-ink-low/35 bg-sheet px-4 text-sm font-semibold hover:border-ink">{tx("Saved notes", "সংরক্ষিত নোট")}{data?.mine ? ` (${data.mine.saved})` : ""}</Link>}
          {data?.mine && data.mine.due > 0 && <Link to="/practice/review" className="inline-flex h-10 items-center rounded-full border border-ink-low/35 bg-sheet px-4 text-sm font-semibold hover:border-ink">{tx(`Review due (${data.mine.due})`, `পুনরালোচনা বাকি (${data.mine.due})`)}</Link>}
        </nav>
        {err && <EmptyState title={tx("Couldn't load this subject", "বিষয়টি লোড হয়নি")} body={tx("Check your connection and try again.", "সংযোগ দেখে আবার চেষ্টা করো।")} />}
        {!data && !err && <div className={`${card} h-64 animate-pulse motion-reduce:animate-none`} />}
        {data?.mine && (
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [tx("Practice answers", "অনুশীলনের উত্তর"), String(data.mine.attempts)],
              [tx("Right", "সঠিক"), data.mine.attempts ? `${data.mine.correct} (${pct(data.mine.correct, data.mine.attempts)}%)` : "0"],
              [tx("Tutor conversations", "টিউটরের সাথে কথোপকথন"), String(data.mine.threads)],
              [tx("Chapters opened", "খোলা অধ্যায়"), `${data.mine.opened.length} / ${data.chapters.length}`],
            ].map(([k, v]) => (
              <div key={k} className={`${card} p-4`}><dt className="text-sm text-ink-mid">{k}</dt><dd className="font-display mt-1 text-xl font-bold tabular-nums">{v}</dd></div>
            ))}
          </dl>
        )}
        {data && data.books.length === 0 && (
          <EmptyState title={tx("No book for this version yet", "এই ভার্সনের বই এখনো নেই")} body={data.offering ? t(data.offering.note) : tx("This class isn't offered yet.", "এই শ্রেণি এখনো নেই।")} action={<Link to="/subjects/$subjectId" params={{ subjectId: s.id }} search={{ medium: "bangla" }} className="font-semibold underline decoration-dashed underline-offset-4">{tx("See the Bangla-medium book", "বাংলা মাধ্যমের বই দেখো")}</Link>} />
        )}
        {data?.books.map((b) => {
          const reg = BOOKS.find((x) => x.id === b.id);
          const chs = data.chapters.filter((c) => c.textbook_id === b.id);
          return (
            <section key={b.id} className={`${card} p-5 md:p-6`} aria-labelledby={`b-${b.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={`b-${b.id}`} className="font-display text-2xl font-bold" lang={b.language}>{b.title}</h2>
                  <p className="mt-1 text-sm text-ink-mid">{reg ? `${reg.titleLatin} · ` : ""}{b.language === "bn" ? tx("printed in Bangla", "বাংলায় ছাপা") : tx("printed in English", "ইংরেজিতে ছাপা")}{b.edition ? ` · ${b.edition}` : ""}{b.page_count ? ` · ${tx(`${b.page_count} PDF pages`, `${b.page_count} পিডিএফ পৃষ্ঠা`)}` : ""}</p>
                </div>
                <div className="flex items-center gap-2"><BookStatus status={b.status} /><Link to="/books/$bookId" params={{ bookId: b.id }} className="text-sm font-semibold underline decoration-dashed underline-offset-4">{tx("Book page", "বইয়ের পাতা")}</Link></div>
              </div>
              <ol className="mt-4 grid gap-2 md:grid-cols-2">
                {chs.map((c) => {
                  const st = data.mine?.stats[c.id];
                  const opened = data.mine?.opened.includes(c.id);
                  const printed = reg && c.start_page !== null && c.end_page !== null ? `${c.start_page - reg.pageOffset}–${c.end_page - reg.pageOffset}` : null;
                  return (
                    <li key={c.id}>
                      <Link to="/chapters/$chapterId" params={{ chapterId: c.id }} className="flex items-start gap-3 rounded-[14px] border border-ink-low/15 p-3 hover:border-ink">
                        <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-paper px-1.5 text-xs font-bold tabular-nums">{c.position}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold leading-snug" lang={b.language}>{c.label ? `${c.label}: ` : ""}{c.title}</span>
                          <span className="block text-xs text-ink-mid">
                            {printed && tx(`pages ${printed}`, `পৃষ্ঠা ${printed}`)}
                            {opened && <> · {tx("opened", "খোলা হয়েছে")}</>}
                            {st && <> · {tx(`${st.correct}/${st.attempts} right`, `${st.attempts}টির ${st.correct}টি সঠিক`)}</>}
                            {c.questions > 0 && <> · {tx(`${c.questions} questions`, `${c.questions}টি প্রশ্ন`)}</>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </main>
    </PaperPage>
  );
}
