import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Frame } from "../components/universe/Shell";
import { SubjectDot } from "../components/universe/icons";
import { Button } from "../components/universe/ui";
import { curriculumMatrix, setCurriculum } from "../lib/api/learning.functions";
import { SUBJECTS } from "../lib/curriculum/registry";
import { AVAILABILITY, type Availability, MEDIA, type Medium, SCOPE_GRADES, SCOPE_LINE, type ScopeCell, gradeLabel } from "../lib/curriculum/scope";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/start")({
  loader: () => curriculumMatrix(),
  head: () => ({ meta: [{ title: "Choose your class and version | IntelliHorizon" }, { name: "description", content: "Pick your class (6–10) and your NCTB textbook version (Bangla Version or English Version). IntelliHorizon shows honestly what each one has today." }] }),
  component: Start,
});

const TONE: Record<Availability, string> = {
  available: "bg-mint-soft text-mint",
  partial: "bg-brand-soft text-brand-deep",
  under_review: "bg-amber-soft text-amber",
  coming_soon: "bg-paper text-ink-mid",
};
const RANK: Availability[] = ["available", "partial", "under_review", "coming_soon"];
const best = (cells: ScopeCell[]) => cells.map((c) => c.availability).sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0] ?? "coming_soon";

export function AvailabilityChip({ a, className = "" }: { a: Availability; className?: string }) {
  const { t } = useLearner();
  return <span data-availability={a} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[a]} ${className}`}>{t(AVAILABILITY[a].label)}</span>;
}

function Start() {
  const { t, tx, lang, account, prefs, updatePrefs, refresh } = useLearner();
  const { cells } = Route.useLoaderData();
  const navigate = useNavigate();
  const initialGrade = account?.grade ?? prefs.grade ?? null;
  const [grade, setGrade] = useState<number | null>(initialGrade && initialGrade >= 6 && initialGrade <= 10 ? initialGrade : null);
  const [medium, setMedium] = useState<Medium | null>(account ? (account.curriculum === "nctb-english" ? "english" : account.curriculum === "nctb-bangla" ? "bangla" : null) : (prefs.medium ?? null));
  const [subject, setSubject] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const step = grade === null ? 1 : medium === null ? 2 : 3;
  const cell = grade !== null && medium !== null ? cells.find((c) => c.grade === grade && c.medium === medium) ?? null : null;
  const hasBooks = !!cell && cell.books > 0;
  const N = (n: number) => (lang === "bn" ? String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : String(n));

  const enter = async () => {
    if (grade === null || medium === null) return;
    setBusy(true);
    setErr(null);
    if (account) {
      const r = await setCurriculum({ data: { grade, medium } });
      if (!r.ok) { setBusy(false); setErr(r.code); return; }
      await refresh();
    } else {
      updatePrefs({ grade, medium });
    }
    setBusy(false);
    if (subject && hasBooks) void navigate({ to: "/subjects/$subjectId", params: { subjectId: subject } });
    else void navigate({ to: account ? "/dashboard" : "/learn" });
  };

  return (
    <Frame>
      <div className="mx-auto max-w-3xl pb-10">
        <p className="text-sm font-semibold text-brand-deep">{t(SCOPE_LINE)}</p>
        <h1 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold leading-tight tracking-tight">{tx("Set up your learning", "তোমার শেখা সাজিয়ে নাও")}</h1>
        <p className="mt-2 max-w-prose text-ink-mid">{tx("Your class and your textbook version decide which books the tutor reads from. Your interface language is separate: you can study the English Version with Bangla menus, or the other way round.", "তোমার শ্রেণি আর পাঠ্যবইয়ের ভার্সন ঠিক করে টিউটর কোন বই থেকে পড়বে। ইন্টারফেসের ভাষা আলাদা: বাংলা মেনু দিয়ে ইংলিশ ভার্সন পড়া যায়, উল্টোটাও।")}</p>

        <ol className="mt-6 flex flex-wrap gap-2 text-sm" aria-label={tx("Steps", "ধাপ")}>
          {[tx("Class", "শ্রেণি"), tx("Version", "ভার্সন"), tx("Subject", "বিষয়")].map((s, i) => (
            <li key={i} aria-current={step === i + 1 ? "step" : undefined} className={`rounded-full px-3 py-1 font-semibold ${step === i + 1 ? "bg-brand text-white" : step > i + 1 ? "bg-mint-soft text-mint" : "bg-lilac text-ink-mid"}`}>{N(i + 1)}. {s}</li>
          ))}
        </ol>

        <section className="mt-6" aria-labelledby="pick-class">
          <h2 id="pick-class" className="font-display text-xl font-bold">{tx("1. Your class", "১. তোমার শ্রেণি")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5" role="radiogroup" aria-label={tx("Class", "শ্রেণি")}>
            {SCOPE_GRADES.map((g) => {
              const a = best(cells.filter((c) => c.grade === g));
              const on = grade === g;
              return (
                <button key={g} type="button" role="radio" aria-checked={on} data-grade={g} onClick={() => { setGrade(g); setSubject(null); }}
                  className={`flex min-h-[96px] flex-col items-start justify-between rounded-[18px] border p-3 text-left transition-colors ${on ? "border-brand bg-brand-soft" : "border-line bg-sheet hover:border-line-strong"}`}>
                  <span className="font-display text-lg font-bold">{t(gradeLabel(g))}</span>
                  <AvailabilityChip a={a} />
                </button>
              );
            })}
          </div>
        </section>

        {grade !== null && (
          <section className="mt-8" aria-labelledby="pick-medium">
            <h2 id="pick-medium" className="font-display text-xl font-bold">{tx("2. Your textbook version", "২. তোমার পাঠ্যবইয়ের ভার্সন")}</h2>
            <p className="mt-1 text-sm text-ink-mid">{tx("Bangla Version and English Version are separate NCTB editions. Their wording, examples and page numbers can differ, so the tutor never mixes them.", "বাংলা ভার্সন আর ইংলিশ ভার্সন এনসিটিবির আলাদা সংস্করণ। এদের লেখা, উদাহরণ ও পৃষ্ঠা নম্বর আলাদা হতে পারে, তাই টিউটর কখনো দুটি মেশায় না।")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={tx("Textbook version", "পাঠ্যবইয়ের ভার্সন")}>
              {MEDIA.map((m) => {
                const c = cells.find((x) => x.grade === grade && x.medium === m.id)!;
                const on = medium === m.id;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on} data-medium={m.id} onClick={() => { setMedium(m.id); setSubject(null); }}
                    className={`rounded-[18px] border p-4 text-left transition-colors ${on ? "border-brand bg-brand-soft" : "border-line bg-sheet hover:border-line-strong"}`}>
                    <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-display text-lg font-bold">{t(m.label)}</span><AvailabilityChip a={c.availability} /></span>
                    <span className="mt-1 block text-sm text-ink-mid">{t(m.edition)}</span>
                    <span className="mt-2 block text-sm text-ink-mid" data-testid="cell-counts">
                      {c.books > 0
                        ? tx(`${c.books} books registered · ${c.publishedPassages} checked passages published · ${c.publishedQuestions} published questions`, `${N(c.books)}টি বই নিবন্ধিত · ${N(c.publishedPassages)}টি যাচাই করা অংশ প্রকাশিত · ${N(c.publishedQuestions)}টি প্রকাশিত প্রশ্ন`)
                        : t(AVAILABILITY.coming_soon.detail)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {cell && (
          <section className="mt-8" aria-labelledby="pick-subject">
            <h2 id="pick-subject" className="font-display text-xl font-bold">{tx("3. Start with a subject", "৩. একটি বিষয় দিয়ে শুরু করো")}</h2>
            {hasBooks ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tx("Subject", "বিষয়")}>
                {SUBJECTS.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={subject === s.id} onClick={() => setSubject(s.id)}
                    className={`flex items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left ${subject === s.id ? "border-brand bg-brand-soft" : "border-line bg-sheet hover:border-line-strong"}`}>
                    <SubjectDot hue={s.hue} />
                    <span className="font-semibold">{t(s.label)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-[14px] bg-lilac p-4 text-ink-mid" data-testid="no-books">
                {tx(`IntelliHorizon is built for ${t(gradeLabel(grade!))}, ${t(MEDIA.find((m) => m.id === medium)!.label)}, but its textbooks haven't been imported yet. You can still set it as your class: the tutor will tell you plainly that it has no textbook to quote instead of guessing, and the subjects will appear here as soon as the books are added.`,
                  `ইন্টেলিহরাইজন ${t(gradeLabel(grade!))}, ${t(MEDIA.find((m) => m.id === medium)!.label)}-এর জন্য তৈরি, তবে এর পাঠ্যবই এখনো আমদানি হয়নি। তবু এটিকে তোমার শ্রেণি হিসেবে রাখতে পারো: অনুমান না করে টিউটর সরাসরি জানাবে যে উদ্ধৃত করার মতো বই নেই, আর বই যোগ হলেই বিষয়গুলো এখানে আসবে।`)}
              </p>
            )}
            {err && <p className="mt-3 text-sm text-again" role="alert">{tx("That didn't save. Please try again.", "সংরক্ষণ হয়নি। আবার চেষ্টা করো।")}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={enter} disabled={busy} icon="arrow">{account ? tx("Save and enter", "সংরক্ষণ করে প্রবেশ করো") : tx("Enter IntelliHorizon", "ইন্টেলিহরাইজনে প্রবেশ করো")}</Button>
              {!account && <Link to="/signup" className="font-semibold text-ink underline decoration-dashed underline-offset-4">{tx("Create an account to save progress", "অগ্রগতি রাখতে অ্যাকাউন্ট খোলো")}</Link>}
            </div>
          </section>
        )}
      </div>
    </Frame>
  );
}
