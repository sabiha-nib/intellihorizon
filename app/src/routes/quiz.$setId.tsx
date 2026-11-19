import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { call, msg } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import { Badge, Button, Loading, Panel, SectionTitle } from "../components/universe/ui";
import type { L } from "../content/types";
import { answerQuiz, getQuiz, startQuiz, submitQuiz } from "../lib/api/quiz.functions";
import { requireAccount } from "../lib/guard";
import { CORRECTIONS, MISCONCEPTIONS, SKILLS } from "../lib/learning/lessons";
import type { QuizAnalysis } from "../lib/learning/quiz";
import { useLearner } from "../lib/store";
import { MODE_INFO } from "./quiz.index";

export const Route = createFileRoute("/quiz/$setId")({
  beforeLoad: ({ params }) => requireAccount(`/quiz/${params.setId}`),
  head: () => ({ meta: [{ title: "Practice set | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: QuizPlayer,
});

type Data = Extract<Awaited<ReturnType<typeof getQuiz>>, { ok: true }>;
type Q = Data["questions"][number];
type Result = QuizAnalysis & { seconds: number; xp: number; mode: string };

const ORIGIN: Record<string, L> = {
  textbook_exercise: { en: "Textbook exercise", bn: "পাঠ্যবইয়ের অনুশীলনী" },
  intellihorizon_reviewed: { en: "IntelliHorizon question, reviewed before publishing (not an NCTB question)", bn: "ইন্টেলিহরাইজনের প্রশ্ন, প্রকাশের আগে পর্যালোচিত (এনসিটিবির প্রশ্ন নয়)" },
  ai_generated: { en: "AI-generated practice (not an official question)", bn: "এআই-তৈরি অনুশীলন (আনুষ্ঠানিক প্রশ্ন নয়)" },
};
const DIFF: Record<number, L> = { 1: { en: "Foundation", bn: "ভিত্তি" }, 2: { en: "Developing", bn: "উন্নয়নশীল" }, 3: { en: "Applied", bn: "প্রয়োগ" } };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function QuizPlayer() {
  const { setId } = Route.useParams();
  const { tx, t, lang } = useLearner();
  const nav = useNavigate();
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const r = await call(getQuiz({ data: { id: setId } }));
    if (!r.ok) return setErr(r.code);
    setD(r as Data);
    setLeft((r as Data).set.secondsLeft);
    if ((r as Data).result) setResult((r as Data).result as Result);
  }, [setId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (left === null || d?.set.status !== "active") return;
    const id = setInterval(() => setLeft((x) => (x === null ? x : Math.max(0, x - 1))), 1000);
    return () => clearInterval(id);
  }, [left === null, d?.set.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const q: Q | undefined = d?.questions[i];
  const patch = (qid: string, p: Partial<Q>) => setD((x) => (x ? { ...x, questions: x.questions.map((y) => (y.id === qid ? { ...y, ...p } : y)) } : x));
  const save = async (qq: Q, response: string | null, flagged: boolean, check: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setErr(null);
    patch(qq.id, { response, flagged });
    const r = await call(answerQuiz({ data: { id: setId, questionId: qq.id, response, flagged, check } }));
    inFlight.current = false; setBusy(false);
    if (!r.ok) return setErr(r.code);
    if (r.result) patch(qq.id, { result: { ...r.result, correctAnswer: r.result.correctAnswer, explanation: r.result.explanation } as Q["result"] });
  };
  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    const r = await call(submitQuiz({ data: { id: setId } }));
    inFlight.current = false; setBusy(false); setConfirm(false);
    if (!r.ok) return setErr(r.code);
    setResult(r.result as Result);
    await load();
    window.scrollTo({ top: 0 });
  };
  const immediate = d?.set.feedback === "immediate";
  const active = d?.set.status === "active";

  // Keyboard: A–D or 1–4 picks an option, Enter checks (immediate) or moves on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q || !active || confirm || (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      const opts = q.options ?? [];
      const k = e.key.toLowerCase();
      const idx = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : "1234".indexOf(k);
      if (idx >= 0 && opts[idx] && !q.result) { e.preventDefault(); void save(q, opts[idx].id, q.flagged, false); }
      if (k === "enter" && d) { e.preventDefault(); if (immediate && q.response && !q.result) void save(q, q.response, q.flagged, true); else if (i < d.questions.length - 1) setI(i + 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (err === "not_found") return <Frame><p className="text-ink-mid">{tx("This practice set doesn't exist or belongs to another account.", "এই অনুশীলন সেটটি নেই, অথবা অন্য অ্যাকাউন্টের।")}</p></Frame>;
  if (!d) return <Frame><Loading label={tx("Loading", "লোড হচ্ছে")} /></Frame>;
  const answered = d.questions.filter((x) => x.response).length;
  const flagged = d.questions.filter((x) => x.flagged).length;

  if (result && !active) return <Results d={d} r={result} N={N} onRetry={async (mode, skill) => {
    const r = await call(startQuiz({ data: { mode, chapterId: null, topicId: null, count: 5 } }));
    if (r.ok) void nav({ to: "/quiz/$setId", params: { setId: r.id } }); else setErr(r.code);
    void skill;
  }} err={err} />;
  if (!q) return null;
  const timeUp = left !== null && left <= 0;

  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-ink-mid">{t(MODE_INFO[d.set.mode].title)} · {immediate ? tx("feedback after each answer", "প্রতিটি উত্তরের পর ফিডব্যাক") : tx("answers checked when you submit", "জমা দিলে উত্তর মেলানো")}</p>
            <p className="font-display text-[22px] font-bold">{tx(`Question ${i + 1} of ${d.questions.length}`, `প্রশ্ন ${N(i + 1)} / ${N(d.questions.length)}`)}</p>
          </div>
          {left !== null && <Badge tone={left < 60 ? "again" : "neutral"} icon="history"><span role="timer" aria-live="off">{timeUp ? tx("Time's up: submit to see results", "সময় শেষ: ফল দেখতে জমা দাও") : `${tx("Time left", "বাকি সময়")} ${mmss(left)}`}</span></Badge>}
        </div>
        <nav aria-label={tx("Questions in this set", "এই সেটের প্রশ্ন")} className="flex flex-wrap gap-1.5">
          {d.questions.map((x, k) => (
            <button key={x.id} type="button" onClick={() => setI(k)} aria-current={k === i ? "step" : undefined}
              aria-label={`${k + 1}${x.response ? tx(", answered", ", উত্তর দেওয়া") : tx(", not answered", ", উত্তর নেই")}${x.flagged ? tx(", marked for review", ", পর্যালোচনার জন্য চিহ্নিত") : ""}`}
              className={`relative h-9 min-w-9 rounded-full border-2 px-2 text-[14px] font-semibold ${k === i ? "border-brand bg-brand text-white" : x.result ? (x.result.correct ? "border-mint bg-mint-soft" : "border-again bg-again-soft") : x.response ? "border-brand bg-brand-soft" : "border-line bg-sheet"}`}>
              {N(k + 1)}{x.flagged && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-fill" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <article className="rounded-[24px] border border-line bg-sheet p-5 md:p-7" aria-labelledby="qtext">
          <p className="text-[13px] text-ink-low">{t(ORIGIN[q.origin])}{q.exercise ? ` · ${q.exercise}` : ""}{q.printedPage ? tx(`, page ${q.printedPage}`, `, পৃষ্ঠা ${N(q.printedPage)}`) : ""}{q.skill && SKILLS[q.skill] ? ` · ${t(SKILLS[q.skill])}` : ""}{q.difficulty && DIFF[q.difficulty] ? ` · ${t(DIFF[q.difficulty])}` : ""}</p>
          <h2 id="qtext" className="mt-3 whitespace-pre-line text-[19px] font-semibold leading-relaxed" lang={q.language}>{q.prompt}</h2>
          {q.type === "mcq" && q.options ? (
            <div role="radiogroup" aria-labelledby="qtext" className="mt-5 grid gap-2.5" lang={q.language}>
              {q.options.map((o, k) => {
                const chosen = q.response === o.id;
                const right = q.result && q.result.correctAnswer === o.text;
                const wrong = q.result && chosen && !q.result.correct;
                return (
                  <button key={o.id} type="button" role="radio" aria-checked={chosen} disabled={!active || !!q.result || busy || timeUp} onClick={() => void save(q, o.id, q.flagged, false)}
                    className={`flex min-h-[54px] items-center gap-3 rounded-[14px] border-2 px-4 py-3 text-left text-[17px] font-medium ${right ? "border-mint bg-mint-soft" : wrong ? "border-again bg-again-soft" : chosen ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong"}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[14px] font-bold ${chosen ? "border-brand bg-brand text-white" : "border-line-strong text-ink-mid"}`}>{o.id}</span>
                    <span>{o.text}</span>
                    <span className="sr-only">{tx(`(key ${k + 1})`, `(কী ${k + 1})`)}</span>
                    {right && <Icon name="check" className="ml-auto text-mint" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="mt-5 block text-[15px] font-semibold">{tx("Your answer", "তোমার উত্তর")}
              <div className="mt-2 flex items-center gap-2">
                <input key={q.id} defaultValue={q.response ?? ""} disabled={!active || !!q.result || timeUp} maxLength={200} lang={q.language} inputMode={q.type === "numeric" ? "decimal" : "text"} autoComplete="off"
                  onBlur={(e) => { if ((e.target.value.trim() || null) !== q.response) void save(q, e.target.value.trim() || null, q.flagged, false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) void save(q, v, q.flagged, immediate); } }}
                  className="h-14 min-w-0 flex-1 rounded-[14px] border-2 border-line bg-sheet px-4 text-[20px] outline-none focus:border-brand" />
                {q.unit && <span className="text-[16px] font-semibold text-ink-mid" lang={q.language}>{q.unit}</span>}
              </div>
              <span className="mt-1 block text-[13px] font-normal text-ink-low">{q.type === "numeric" ? tx("A number. Fractions like 3/4 are fine.", "একটি সংখ্যা। ৩/৪-এর মতো ভগ্নাংশ চলবে।") : tx("A short answer.", "ছোট উত্তর।")}</span>
            </label>
          )}
          {q.result && (
            <div className={`mt-5 rounded-[16px] p-4 ${q.result.correct ? "bg-mint-soft" : "bg-again-soft"}`} role="status">
              <p className="font-semibold">{q.result.correct ? tx("That's right.", "ঠিক হয়েছে।") : tx(`Not yet. The answer is ${q.result.correctAnswer}.`, `হয়নি। উত্তর ${q.result.correctAnswer}।`)}</p>
              {q.result.misconception && MISCONCEPTIONS[q.result.misconception] && <p className="mt-1 text-[15px]">{tx("This wrong answer often comes from: ", "এই ভুল সাধারণত হয়: ")}{t(MISCONCEPTIONS[q.result.misconception])}</p>}
              {q.result.explanation && <p className="mt-2 text-[15px] leading-relaxed" lang={q.language}>{q.result.explanation}</p>}
            </div>
          )}
          {err && <p role="alert" className="mt-3 text-again">{err === "time_up" ? tx("Time is up. Submit to see your results.", "সময় শেষ। ফল দেখতে জমা দাও।") : t(msg(err) ?? msg("unknown")!)}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {immediate && active && !q.result && <Button onClick={() => q.response && void save(q, q.response, q.flagged, true)} disabled={!q.response || busy}>{tx("Check my answer", "উত্তর মেলাও")}</Button>}
            {active && <Button variant="secondary" size="sm" icon="saved" onClick={() => void save(q, q.response, !q.flagged, false)} disabled={busy}>{q.flagged ? tx("Unmark review", "চিহ্ন সরাও") : tx("Mark for review", "পর্যালোচনার জন্য চিহ্নিত করো")}</Button>}
          </div>
        </article>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" size="sm" icon="back" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>{tx("Previous", "আগের")}</Button>
          <div className="flex gap-2">
            {i < d.questions.length - 1 && <Button variant="secondary" size="sm" onClick={() => setI(i + 1)}>{q.response ? tx("Next", "পরের") : tx("Skip", "বাদ দাও")}</Button>}
            {active && <Button size="sm" onClick={() => setConfirm(true)}>{tx("Finish and submit", "শেষ করে জমা দাও")}</Button>}
          </div>
        </div>
        {confirm && (
          <div role="dialog" aria-modal="false" aria-labelledby="confirm-h"><Panel tone="lift" className="space-y-3 p-5">
            <h2 id="confirm-h" className="font-display text-[20px] font-bold">{tx("Submit this set?", "সেটটি জমা দেবে?")}</h2>
            <p className="text-[15px] text-ink-mid">{tx(`${answered} of ${d.questions.length} answered${d.questions.length - answered ? `; ${d.questions.length - answered} will count as skipped` : ""}${flagged ? `; ${flagged} marked for review` : ""}. You can't change answers after submitting.`, `${N(d.questions.length)}টির মধ্যে ${N(answered)}টির উত্তর দেওয়া${d.questions.length - answered ? `; ${N(d.questions.length - answered)}টি বাদ হিসেবে গণ্য` : ""}${flagged ? `; ${N(flagged)}টি পর্যালোচনার জন্য চিহ্নিত` : ""}। জমার পর উত্তর বদলানো যাবে না।`)}</p>
            <div className="flex gap-2">
              <Button onClick={() => void submit()} disabled={busy}>{busy ? tx("Submitting…", "জমা হচ্ছে…") : tx("Submit", "জমা দাও")}</Button>
              <Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>{tx("Keep going", "চালিয়ে যাও")}</Button>
            </div>
          </Panel></div>
        )}
      </div>
    </Frame>
  );
}

function Results({ d, r, N, onRetry, err }: { d: Data; r: Result; N: (n: number) => string; onRetry: (mode: "mistakes" | "weakness" | "exam" | "quick", skill: string | null) => void; err: string | null }) {
  const { tx, t } = useLearner();
  const byId = new Map(d.questions.map((q) => [q.id, q]));
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const NEXT: Record<QuizAnalysis["next"]["why"], L> = {
    repeated_mistake: { en: "The same kind of mistake showed up more than once. Replay your mistakes with the fix in mind.", bn: "একই ধরনের ভুল একাধিকবার হয়েছে। সমাধান মাথায় রেখে ভুলগুলো আবার করো।" },
    weakest_skill: { en: `Your lowest result was in ${r.next.skill && SKILLS[r.next.skill] ? t(SKILLS[r.next.skill]) : "one skill"}. Practise your weak spots next.`, bn: `সবচেয়ে কম ফল ${r.next.skill && SKILLS[r.next.skill] ? t(SKILLS[r.next.skill]) : "একটি দক্ষতায়"}। এরপর দুর্বল জায়গা অনুশীলন করো।` },
    some_wrong: { en: "A few answers were wrong. Replay them while they're fresh.", bn: "কয়েকটি উত্তর ভুল। মনে থাকতে থাকতে আবার করো।" },
    skipped: { en: "You skipped some questions. Try a fresh set.", bn: "কিছু প্রশ্ন বাদ দিয়েছ। নতুন একটি সেট চেষ্টা করো।" },
    all_right: { en: "Everything you answered was right. Try exam simulation for a timed challenge.", bn: "যা উত্তর দিয়েছ সব ঠিক। সময় বাঁধা চ্যালেঞ্জের জন্য পরীক্ষার অনুশীলন করো।" },
  };
  const nextMode = r.next.kind === "mistakes" ? "mistakes" : r.next.kind === "topic" ? "weakness" : r.next.kind === "challenge" ? "exam" : "quick";
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-[14px] font-semibold text-ink-mid">{t(MODE_INFO[d.set.mode].title)} · {tx("results", "ফলাফল")}</p>
          <h1 className="font-display text-[30px] font-bold">{tx(`${r.correct} right of ${r.attempted} answered`, `${N(r.attempted)}টির মধ্যে ${N(r.correct)}টি ঠিক`)}</h1>
          <p className="mt-1 text-[15px] text-ink-mid">{tx(`${r.total} questions · ${r.incorrect} wrong · ${r.skipped} skipped · accuracy ${r.accuracy === null ? "–" : `${pct(r.correct, r.attempted)}% of answered`} · ${Math.round(r.seconds / 60)} min from start to submit${r.xp ? ` · +${r.xp} XP` : ""}`, `${N(r.total)}টি প্রশ্ন · ${N(r.incorrect)}টি ভুল · ${N(r.skipped)}টি বাদ · নির্ভুলতা ${r.accuracy === null ? "–" : `উত্তর দেওয়াগুলোর ${N(pct(r.correct, r.attempted))}%`} · শুরু থেকে জমা ${N(Math.round(r.seconds / 60))} মিনিট${r.xp ? ` · +${N(r.xp)} XP` : ""}`)}</p>
          <p className="mt-1 text-[13px] text-ink-low">{tx("A practice result, not a grade or a prediction of your exam.", "এটি অনুশীলনের ফল, নম্বর বা পরীক্ষার পূর্বাভাস নয়।")}</p>
        </header>
        <Panel tone="lilac" className="space-y-3 p-5">
          <p className="font-semibold">{tx("Recommended next", "এরপর যা করবে")}</p>
          <p className="text-[15px]">{t(NEXT[r.next.why])}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onRetry(nextMode, r.next.skill)}>{t(MODE_INFO[nextMode].title)}</Button>
            <Link to="/revision" className="inline-flex h-10 items-center rounded-[14px] px-4 text-[15px] font-semibold text-brand-deep hover:bg-brand-soft">{tx("Open revision", "পুনরালোচনা খোলো")}</Link>
            <Link to="/quiz" className="inline-flex h-10 items-center rounded-[14px] px-4 text-[15px] font-semibold text-brand-deep hover:bg-brand-soft">{tx("All practice modes", "সব অনুশীলন")}</Link>
          </div>
          {err && <p role="alert" className="text-again">{t(msg(err) ?? msg("unknown")!)}</p>}
        </Panel>
        <section aria-labelledby="by-h" className="grid gap-4 sm:grid-cols-2">
          <h2 id="by-h" className="sr-only">{tx("Breakdown", "বিশ্লেষণ")}</h2>
          <Panel className="p-5">
            <p className="font-semibold">{tx("By topic", "টপিক অনুযায়ী")}</p>
            <ul className="mt-2 space-y-1.5 text-[15px]">{r.bySkill.map((s) => <li key={s.skill ?? "none"} className="flex justify-between gap-2"><span>{s.skill && SKILLS[s.skill] ? t(SKILLS[s.skill]) : tx("Other", "অন্যান্য")}</span><span className="tnum text-ink-mid">{N(s.correct)}/{N(s.attempted)}{s.total > s.attempted ? tx(` (${s.total - s.attempted} skipped)`, ` (${N(s.total - s.attempted)}টি বাদ)`) : ""}</span></li>)}</ul>
          </Panel>
          <Panel className="p-5">
            <p className="font-semibold">{tx("By difficulty", "কাঠিন্য অনুযায়ী")}</p>
            <ul className="mt-2 space-y-1.5 text-[15px]">{r.byDifficulty.map((s) => <li key={String(s.difficulty)} className="flex justify-between gap-2"><span>{s.difficulty && DIFF[s.difficulty] ? t(DIFF[s.difficulty]) : tx("Unrated", "অনির্ধারিত")}</span><span className="tnum text-ink-mid">{N(s.correct)}/{N(s.attempted)}</span></li>)}</ul>
          </Panel>
        </section>
        {r.misconceptions.length > 0 && (
          <Panel className="space-y-2 p-5">
            <p className="font-semibold">{tx("Mistake types in this set", "এই সেটে ভুলের ধরন")}</p>
            {r.misconceptions.map((m) => (
              <div key={m.id} className="text-[15px]">
                <p><span className="font-semibold">{MISCONCEPTIONS[m.id] ? t(MISCONCEPTIONS[m.id]) : m.id}</span> · {m.repeated ? tx(`on ${m.questions} questions here, a possible pattern`, `এখানে ${N(m.questions)}টি প্রশ্নে, সম্ভাব্য একটি ধরন`) : tx("once here; one mistake isn't a pattern", "এখানে একবার; একটি ভুল কোনো ধরন নয়")}</p>
                {CORRECTIONS[m.id] && <p className="text-ink-mid">{tx("Suggested fix: ", "যেভাবে ঠিক করবে: ")}{t(CORRECTIONS[m.id])}</p>}
              </div>
            ))}
            <Link to="/mistakes" className="text-[15px] font-semibold text-brand-deep hover:underline">{tx("See your Misconception Radar", "ভুল ধারণার রাডার দেখো")}</Link>
          </Panel>
        )}
        <section aria-labelledby="rev-h" className="space-y-3">
          <SectionTitle id="rev-h" title={tx("Questions to revisit", "আবার দেখার প্রশ্ন")} />
          {r.revisit.length === 0 ? <p className="text-ink-mid">{tx("None: every question was answered correctly and none were marked.", "নেই: সব প্রশ্ন ঠিক, কোনোটি চিহ্নিত নয়।")}</p> : (
            <ul className="space-y-3">
              {r.revisit.map((qid) => {
                const q = byId.get(qid);
                if (!q) return null;
                return (
                  <li key={qid}>
                    <Panel className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {q.result ? <Badge tone={q.result.correct ? "mint" : "again"}>{q.result.correct ? tx("Right", "ঠিক") : tx("Wrong", "ভুল")}</Badge> : <Badge tone="neutral">{tx("Skipped", "বাদ")}</Badge>}
                        {q.flagged && <Badge tone="amber">{tx("Marked for review", "চিহ্নিত")}</Badge>}
                      </div>
                      <p className="mt-2 text-[16px]" lang={q.language}>{q.prompt}</p>
                      {q.result && <p className="mt-1 text-[15px]">{tx("Answer: ", "উত্তর: ")}<span className="font-semibold">{q.result.correctAnswer}</span></p>}
                      {q.result?.explanation && <p className="mt-1 text-[15px] text-ink-mid" lang={q.language}>{q.result.explanation}</p>}
                      {!q.result && <p className="mt-1 text-[14px] text-ink-low">{tx("Skipped questions aren't marked, so the answer isn't shown here; they'll come back in practice.", "বাদ দেওয়া প্রশ্ন মেলানো হয় না, তাই উত্তর দেখানো হয়নি; অনুশীলনে আবার আসবে।")}</p>}
                      <p className="mt-1 text-[13px] text-ink-low">{t(ORIGIN[q.origin])}{q.printedPage ? tx(`, page ${q.printedPage}`, `, পৃষ্ঠা ${N(q.printedPage)}`) : ""}</p>
                    </Panel>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Frame>
  );
}
