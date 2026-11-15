import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { QuestionCard, type Answer } from "../components/edu/QuestionCard";
import { IgniteButton, PaperPage } from "../components/edu/ui";
import { conceptById, PLAYABLE_IDS } from "../content/concepts";
import { findMisconception, PACKS } from "../content/packs";
import { subjectById } from "../content/subjects";
import type { Question } from "../content/types";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/tomorrow")({
  head: () => ({ meta: [{ title: "Exam tomorrow | IntelliHorizon" }] }),
  component: Tomorrow,
});

type Plan = { qs: Question[]; targeted: number; retry: number };

function Tomorrow() {
  const { t, tx, concept, rows } = useLearner();
  const [pick, setPick] = useState<string | null>(null);
  const [size, setSize] = useState<5 | 8>(5);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const plan = useMemo<Plan | null>(() => {
    if (!pick) return null;
    const pack = PACKS[pick];
    const m = concept(pick);
    const pool = [...pack.exam, ...pack.trials, ...pack.probe];
    const wrongBefore = new Set(rows.filter((r) => r.concept === pick && !r.correct && r.kind !== "challenge").map((r) => r.item));
    const seen = new Set(rows.filter((r) => r.concept === pick).map((r) => r.item));
    const score = (q: Question) => {
      let s = 0;
      if (q.options.some((o) => o.misconception && m.activeMisconceptions.includes(o.misconception))) s += 10;
      if (wrongBefore.has(q.id)) s += 6;
      if (!seen.has(q.id)) s += 3;
      if (q.kind === "exam") s += 2;
      return s;
    };
    const qs = [...pool].sort((a, b) => score(b) - score(a)).slice(0, size);
    return {
      qs,
      targeted: qs.filter((q) => q.options.some((o) => o.misconception && m.activeMisconceptions.includes(o.misconception))).length,
      retry: qs.filter((q) => wrongBefore.has(q.id)).length,
    };
  }, [pick, size, concept, rows]);

  if (!started || !plan) {
    return (
      <PaperPage>
        <main className="mx-auto w-full max-w-3xl px-4 pt-4 md:px-6">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tighter md:text-5xl">{tx("Exam tomorrow? Let's focus.", "কাল পরীক্ষা? চলো মন দিই।")}</h1>
          <p className="mt-3 max-w-[56ch] text-ink-mid">{tx("Exam-style questions chosen from what your answers show, with an explanation every time you miss.", "তোমার উত্তর দেখে বাছাই করা পরীক্ষা-ধাঁচের প্রশ্ন, প্রতিটি ভুলের সাথে ব্যাখ্যা।")}</p>
          <h2 className="mt-8 text-sm font-semibold text-ink-mid">{tx("Which chapter?", "কোন অধ্যায়?")}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {PLAYABLE_IDS.map((id) => {
              const c = conceptById(id)!;
              const s = subjectById(c.subject)!;
              return (
                <li key={id}>
                  <button type="button" aria-pressed={pick === id} onClick={() => setPick(id)} className={`h-full w-full rounded-[14px] border p-4 text-left transition-colors ${pick === id ? "border-brand bg-brand text-sheet" : "border-ink-low/40 bg-sheet hover:border-ink"}`}>
                    <span className="block h-1 w-8 rounded-full" style={{ background: s.thread }} />
                    <span className="mt-2 block text-sm opacity-80">{t(s.name)}</span>
                    <span className="block font-semibold leading-snug">{t(c.title)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <h2 className="mt-6 text-sm font-semibold text-ink-mid">{tx("How much time do you have?", "কত সময় আছে?")}</h2>
          <div className="mt-3 flex gap-2">
            {([5, 8] as const).map((n) => (
              <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${size === n ? "border-brand bg-brand text-sheet" : "border-ink-low/40 hover:border-ink"}`}>
                {n === 5 ? tx("About 10 minutes", "প্রায় ১০ মিনিট") : tx("About 20 minutes", "প্রায় ২০ মিনিট")}
              </button>
            ))}
          </div>
          {plan && (
            <div className="edu-rise mt-6 rounded-[14px] border border-dashed border-ink-low/60 p-4 text-sm text-ink-mid">
              <p className="font-semibold text-ink">{tx("Why these questions", "কেন এই প্রশ্নগুলো")}</p>
              <p className="mt-1">
                {plan.targeted > 0
                  ? tx(`${plan.targeted} target an idea that showed up in your earlier answers. `, `${plan.targeted}টি প্রশ্ন তোমার আগের উত্তরে দেখা যাওয়া একটি ধারণা নিয়ে। `)
                  : tx("No misconceptions recorded yet, so this is a balanced mix. ", "এখনো কোনো ভুল ধারণা ধরা পড়েনি, তাই প্রশ্নগুলো মিশ্র। ")}
                {plan.retry > 0 ? tx(`${plan.retry} are questions you missed before. `, `${plan.retry}টি আগে ভুল হওয়া প্রশ্ন। `) : ""}
                {tx("The rest are exam-style questions you have not seen.", "বাকিগুলো পরীক্ষা-ধাঁচের নতুন প্রশ্ন।")}
              </p>
            </div>
          )}
          <div className="mt-6">
            <IgniteButton disabled={!pick} onClick={() => setStarted(true)}>{tx("Start focused practice", "মনোযোগী অনুশীলন শুরু")}</IgniteButton>
          </div>
        </main>
      </PaperPage>
    );
  }

  if (i < plan.qs.length) {
    return (
      <PaperPage>
        <main className="mx-auto w-full max-w-3xl px-4 pt-4 md:px-6">
          <div className="mb-4 flex items-center justify-between text-sm text-ink-mid">
            <span>{tx(`Question ${i + 1} of ${plan.qs.length}`, `প্রশ্ন ${i + 1} / ${plan.qs.length}`)}</span>
            <button type="button" onClick={() => setI(plan.qs.length)} className="underline decoration-dashed underline-offset-4 hover:text-ink">{tx("Stop and see summary", "থামো, সারাংশ দেখো")}</button>
          </div>
          <div className="mb-5 h-1.5 rounded-full bg-ink-low/20">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(i / plan.qs.length) * 100}%` }} />
          </div>
          <QuestionCard key={plan.qs[i].id + i} q={{ ...plan.qs[i], kind: "exam", disguise: plan.qs[i].disguise === "language" ? "language" : undefined }} onDone={(a) => { setAnswers((x) => [...x, a]); setI(i + 1); }} />
        </main>
      </PaperPage>
    );
  }

  const n = answers.length;
  const right = answers.filter((a) => a.correct).length;
  const certain = answers.filter((a) => a.confidence === 3);
  const certainRight = certain.filter((a) => a.correct).length;
  const guessRight = answers.filter((a) => a.confidence === 1 && a.correct).length;
  const misses = [...new Set(answers.filter((a) => !a.correct && a.misconception).map((a) => a.misconception!))];
  const ratio = n ? right / n : 0;
  const band = n < 3 ? tx("Too few answers to say", "বলার মতো যথেষ্ট উত্তর নেই") : ratio >= 0.8 ? tx("Steady", "দৃঢ়") : ratio >= 0.5 ? tx("Getting there", "এগোচ্ছে") : tx("Still building", "এখনো গড়ছে");
  const c = conceptById(pick!)!;
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-3xl px-4 pt-4 md:px-6">
        <h1 className="font-display text-4xl font-bold tracking-tighter">{tx("Your readiness snapshot", "তোমার প্রস্তুতির ঝলক")}</h1>
        <p className="mt-2 text-ink-mid">{t(c.title)}</p>
        <section className="mt-6 rounded-[14px] bg-night-0 p-6 text-cloth">
          <p className="text-sm text-cloth-mid">{tx("Today's signal", "আজকের সংকেত")}</p>
          <p className="font-display mt-1 text-3xl font-bold text-thread">{band}</p>
          <p className="mt-2 text-cloth-mid">{tx(`${right} of ${n} correct.`, `${n}টির মধ্যে ${right}টি সঠিক।`)}</p>
          <p className="mt-3 text-sm text-cloth-low">{tx(`Based on only ${n} answers today, so this is a rough signal, not a prediction of your exam mark.`, `আজ মাত্র ${n}টি উত্তরের ভিত্তিতে, তাই এটি একটি মোটা দাগের সংকেত, পরীক্ষার নম্বরের পূর্বাভাস নয়।`)}</p>
        </section>
        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[14px] border border-dashed border-ink-low/60 p-4">
            <p className="font-semibold">{tx("How well your confidence matched", "আত্মবিশ্বাস কতটা মিলল")}</p>
            <p className="mt-1 text-ink-mid">
              {certain.length > 0 ? tx(`You were certain ${certain.length} times and right ${certainRight} of those.`, `তুমি ${certain.length} বার নিশ্চিত ছিলে, তার মধ্যে ${certainRight} বার সঠিক।`) : tx("You were never fully certain today.", "আজ কখনো পুরো নিশ্চিত ছিলে না।")}{" "}
              {guessRight > 0 ? tx(`${guessRight} right answers were guesses: revise those too.`, `${guessRight}টি সঠিক উত্তর আন্দাজে: ওগুলোও ঝালিয়ে নাও।`) : ""}
            </p>
          </div>
          <div className="rounded-[14px] border border-dashed border-ink-low/60 p-4">
            <p className="font-semibold">{tx("Revise in the next 10 minutes", "পরের ১০ মিনিটে ঝালাও")}</p>
            {misses.length ? (
              <ul className="mt-1 space-y-1 text-ink-mid">
                {misses.map((id) => (
                  <li key={id}>"{t(findMisconception(pick!, id)?.name ?? { en: id, bn: id })}"</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-ink-mid">{tx("No pattern of mistakes today. Try one disguise to check it holds.", "আজ ভুলের কোনো ধরন নেই। একটি ছদ্মবেশে যাচাই করে নাও।")}</p>
            )}
          </div>
        </section>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link to={c.route!} search={{ phase: misses.length ? "sense" : "trials" }} className="rounded-[14px] bg-thread px-6 py-3 font-bold text-night-0 active:scale-[0.98]">
            {misses.length ? tx("Fix these ideas", "এই ধারণাগুলো ঠিক করো") : tx("Try the disguises", "ছদ্মবেশ চেষ্টা করো")}
          </Link>
          <button type="button" onClick={() => { setStarted(false); setI(0); setAnswers([]); }} className="font-semibold underline decoration-dashed underline-offset-4">
            {tx("Another round", "আরেক দফা")}
          </button>
        </div>
      </main>
    </PaperPage>
  );
}
