import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { BookStatus, EmptyState, PageHeader, card } from "../components/app/kit";
import { PaperPage } from "../components/edu/ui";
import { getCatalog } from "../lib/api/learning.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/learn/")({
  head: () => ({ meta: [{ title: "Learn | IntelliHorizon" }] }),
  component: Learn,
});

type Cat = Extract<Awaited<ReturnType<typeof getCatalog>>, { ok: true }>;

function Learn() {
  const { tx, t, account, prefs } = useLearner();
  const [medium, setMedium] = useState<"bangla" | "english">(account ? (account.curriculum === "nctb-english" ? "english" : "bangla") : prefs.medium ?? "bangla");
  const [data, setData] = useState<Cat | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setData(null);
    setErr(false);
    void call(getCatalog({ data: { grade: 7, medium } })).then((r) => (r.ok ? setData(r as Cat) : setErr(true)));
  }, [medium]);

  const ready = data?.books.filter((b) => b.status === "indexed").length ?? 0;
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-5xl space-y-7 px-4 pt-6 md:px-6">
        <PageHeader title={tx("Class 7 · your eight subjects", "৭ম শ্রেণি · তোমার আটটি বিষয়")} subtitle={tx("NCTB textbooks for the 2026 academic year, organised by subject. Bangla 1st Paper has two books: Soptoborna and Anandapath.", "২০২৬ শিক্ষাবর্ষের এনসিটিবি পাঠ্যবই, বিষয় অনুযায়ী সাজানো। বাংলা প্রথম পত্রে দুটি বই: সপ্তবর্ণা ও আনন্দপাঠ।")} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink-mid">{tx("Version (which official books)", "ভার্সন (কোন সরকারি বই)")}</legend>
            <div role="radiogroup" className="flex gap-1 rounded-[14px] bg-sheet p-1 shadow-[0_1px_2px_rgba(52,36,140,0.12)]">
              {(["bangla", "english"] as const).map((x) => (
                <button key={x} type="button" role="radio" aria-checked={medium === x} onClick={() => setMedium(x)} className={`h-10 rounded-[10px] px-4 text-[15px] font-semibold ${medium === x ? "bg-brand text-sheet" : "text-ink-mid hover:text-ink"}`}>
                  {x === "bangla" ? tx("Bangla medium", "বাংলা মাধ্যম") : tx("English version", "ইংলিশ ভার্সন")}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="max-w-[46ch] text-sm text-ink-mid">{tx("The version is about the books. The language of buttons is set at the top of the page, and the tutor's explanation language is in your account.", "ভার্সন মানে কোন বই। বোতামের ভাষা পাতার ওপরে বদলানো যায়, আর টিউটরের ব্যাখ্যার ভাষা অ্যাকাউন্টে।")}</p>
        </div>
        {data && data.profileGrade !== null && data.profileGrade !== 7 && (
          <p className="rounded-[14px] bg-sheet p-4 text-ink-mid">{tx(`Your profile says Class ${data.profileGrade}. IntelliHorizon supports Class 7 only for now, so these are the Class 7 books.`, `তোমার প্রোফাইলে ${data.profileGrade} শ্রেণি দেওয়া আছে। ইন্টেলিহরাইজন আপাতত শুধু ৭ম শ্রেণি সমর্থন করে, তাই এগুলো ৭ম শ্রেণির বই।`)}</p>
        )}
        {err && <EmptyState title={tx("Couldn't load the subjects", "বিষয়গুলো লোড হয়নি")} body={tx("Check your connection and try again.", "সংযোগ দেখে আবার চেষ্টা করো।")} />}
        {!err && data === null && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />)}</div>}
        {data && (
          <>
            <p className="text-sm text-ink-mid" aria-live="polite">
              {data.offering?.status === "books_not_supplied"
                ? t(data.offering.note)
                : tx(`${data.books.length} textbooks registered for 8 subjects · ${ready} ready for the tutor.`, `৮টি বিষয়ে ${data.books.length}টি পাঠ্যবই নিবন্ধিত · ${ready}টি টিউটরের জন্য প্রস্তুত।`)}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.subjects.map((s) => (
                <li key={s.id} className={`${card} flex flex-col p-5`}>
                  <Link to="/subjects/$subjectId" params={{ subjectId: s.id }} search={{ medium }} className="group">
                    <span aria-hidden="true" className="block h-1.5 w-10 rounded-full" style={{ background: s.hue }} />
                    <span className="font-display mt-3 block text-lg font-bold leading-snug group-hover:underline">{t(s.label)}</span>
                    <span className="block text-sm text-ink-mid">{t({ en: s.label.bn, bn: s.label.en })}</span>
                  </Link>
                  <ul className="mt-3 space-y-2">
                    {s.books.length === 0 && <li className="text-sm text-ink-mid">{tx("English-version book not added yet.", "ইংলিশ ভার্সনের বই এখনো যোগ হয়নি।")}</li>}
                    {s.books.map((b) => (
                      <li key={b.id}>
                        <Link to="/books/$bookId" params={{ bookId: b.id }} className="flex flex-col gap-1 rounded-[12px] bg-paper/70 p-2.5 hover:bg-paper">
                          <span className="font-semibold" lang={b.language}>{b.title}</span>
                          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-mid"><BookStatus status={b.status} />{b.chapters > 0 && <span>{tx(`${b.chapters} chapters`, `${b.chapters}টি অধ্যায়`)}</span>}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {s.books.length === 0 && medium === "english" && (
                    <button type="button" onClick={() => setMedium("bangla")} className="mt-auto pt-3 text-left text-sm font-semibold underline decoration-dashed underline-offset-4">{tx("See the Bangla-medium book", "বাংলা মাধ্যমের বই দেখো")}</button>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-low">{tx("Books are the owner-supplied NCTB PDFs. A book becomes searchable by the tutor only after its text is imported and an admin approves it. Excerpts are short and cited; NCTB permission is pending.", "বইগুলো মালিকের দেওয়া এনসিটিবি পিডিএফ। লেখা আমদানি ও অ্যাডমিনের অনুমোদনের পরেই টিউটর বইয়ে খুঁজতে পারে। উদ্ধৃতি সংক্ষিপ্ত ও উৎসসহ; এনসিটিবির অনুমতি প্রক্রিয়াধীন।")}</p>
          </>
        )}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-night-0 p-6 text-cloth shadow-[0_18px_40px_-28px_rgba(52,36,140,0.55)]">
          <div>
            <h2 className="font-display text-xl font-bold">{tx("Interactive lessons", "ইন্টারঅ্যাকটিভ পাঠ")}</h2>
            <p className="mt-1 max-w-[52ch] text-cloth-mid">{tx("Three hands-on lessons written by IntelliHorizon: falling objects, comparing fractions and where a tree's mass comes from.", "ইন্টেলিহরাইজনের লেখা তিনটি হাতে-কলমে পাঠ: পড়ন্ত বস্তু, ভগ্নাংশ তুলনা আর গাছের ভর কোথা থেকে আসে।")}</p>
          </div>
          <Link to="/sky" className="inline-flex h-11 items-center rounded-[14px] bg-thread px-5 font-bold text-night-0">{tx("Open the sky", "আকাশ খোলো")}</Link>
        </section>
      </main>
    </PaperPage>
  );
}
