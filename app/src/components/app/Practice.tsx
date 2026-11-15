import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type { L } from "../../content/types";
import { getPracticeSet, submitAnswer, type PracticeQuestion } from "../../lib/api/learning.functions";
import { useLearner } from "../../lib/store";
import { call, msg } from "../auth/messages";
import { ConfidenceDial } from "../edu/ui";
import { EmptyState, SignInPrompt, card } from "./kit";

type Result = { correct: boolean; correctAnswer: string; explanation: string | null; source: string; sourcePage: number | null; nextReviewDays: number };

function why(code: string): L {
  if (code === "new") return { en: "New to you", bn: "তোমার জন্য নতুন" };
  if (code === "retry") return { en: "You missed this last time, so let's try it once more", bn: "গতবার এটি ভুল হয়েছিল, চলো আরেকবার চেষ্টা করি" };
  if (code === "again") return { en: "Answered before. One more round keeps it fresh", bn: "আগে উত্তর দিয়েছ। আরেকবার করলে মনে থাকবে" };
  if (code === "review_wrong") return { en: "Due for review: it wasn't right last time", bn: "পুনরালোচনার সময়: গতবার সঠিক হয়নি" };
  if (code.startsWith("review_correct")) return { en: "Due for review: checking it's still there", bn: "পুনরালোচনার সময়: এখনো মনে আছে কিনা দেখা" };
  return { en: "", bn: "" };
}

export function PracticeSession({ chapterId, review }: { chapterId: string | null; review: boolean }) {
  const { tx, t, account } = useLearner();
  const [qs, setQs] = useState<PracticeQuestion[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [resp, setResp] = useState("");
  const [conf, setConf] = useState<1 | 2 | 3 | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, done: 0 });

  useEffect(() => {
    if (!account) return;
    void call(getPracticeSet({ data: { chapterId, review } })).then((r) => (r.ok ? setQs(r.questions) : setLoadErr(r.code)));
  }, [account, chapterId, review]);

  if (!account) return <SignInPrompt next={review ? "/practice/review" : `/practice/${chapterId}`} why={{ en: "Practice is saved to your account so revision can be scheduled for you.", bn: "অনুশীলন অ্যাকাউন্টে সংরক্ষিত হয়, যাতে তোমার পুনরালোচনার সময় ঠিক করা যায়।" }} />;
  if (loadErr) return <EmptyState title={tx("Couldn't load questions", "প্রশ্ন লোড হয়নি")} body={t(msg(loadErr)!)} />;
  if (!qs) return <div className={`${card} h-64 animate-pulse motion-reduce:animate-none`} />;
  if (!qs.length) return <EmptyState title={review ? tx("Nothing due for review", "পুনরালোচনার কিছু নেই") : tx("No questions here yet", "এখনো কোনো প্রশ্ন নেই")} body={review ? tx("Questions you've practised come back here when they're due. Come back later.", "অনুশীলন করা প্রশ্ন সময় হলে এখানে ফিরে আসে। পরে এসো।") : tx("Practice questions for this chapter haven't been added yet.", "এই অধ্যায়ের প্রশ্ন এখনো যোগ হয়নি।")} action={<Link to="/practice" className="font-semibold underline decoration-dashed underline-offset-4">{tx("Back to practice", "অনুশীলনে ফিরে যাও")}</Link>} />;

  if (i >= qs.length) {
    return (
      <div className={`${card} edu-rise space-y-4 p-6`}>
        <h2 className="font-display text-2xl font-bold">{tx(`${score.right} of ${score.done} right`, `${score.done}টির মধ্যে ${score.right}টি সঠিক`)}</h2>
        <p className="text-ink-mid">{tx("Every question you answered is now scheduled for review: sooner if it was wrong, later if it was right.", "উত্তর দেওয়া প্রতিটি প্রশ্নের পুনরালোচনার সময় ঠিক হয়েছে: ভুল হলে শিগগির, সঠিক হলে পরে।")}</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/practice" className="inline-flex h-11 items-center rounded-[14px] bg-brand px-5 font-semibold text-sheet">{tx("Back to practice", "অনুশীলনে ফিরে যাও")}</Link>
          <Link to="/insights" className="inline-flex h-11 items-center rounded-[14px] border border-ink-low/35 px-5 font-semibold">{tx("See my progress", "আমার অগ্রগতি দেখো")}</Link>
        </div>
      </div>
    );
  }

  const q = qs[i];
  const submit = async () => {
    if (!resp.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const r = await call(submitAnswer({ data: { questionId: q.id, response: resp, confidence: conf, mode: review ? "review" : "practice" } }));
    setBusy(false);
    if (!r.ok) return setErr(r.code);
    setRes(r);
    setScore((s) => ({ right: s.right + (r.correct ? 1 : 0), done: s.done + 1 }));
  };
  const next = () => { setI(i + 1); setResp(""); setConf(null); setRes(null); };
  const input = "h-12 w-full rounded-[14px] border border-ink-low/35 bg-sheet px-4 text-[16px] outline-none focus:border-ink";
  return (
    <article className={`${card} space-y-5 p-5 md:p-7`} lang={q.language}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-mid">
        <span>{tx(`Question ${i + 1} of ${qs.length}`, `প্রশ্ন ${i + 1} / ${qs.length}`)}</span>
        <span className="rounded-full border border-dashed border-ink-low/40 px-2.5 py-0.5 text-xs font-semibold">
          {q.source === "textbook_exercise" ? tx(`Textbook exercise${q.sourcePage ? `, PDF page ${q.sourcePage}` : ""}`, `পাঠ্যবইয়ের অনুশীলনী${q.sourcePage ? `, পিডিএফ পৃষ্ঠা ${q.sourcePage}` : ""}`) : tx("IntelliHorizon practice question", "ইন্টেলিহরাইজনের অনুশীলনী প্রশ্ন")}
        </span>
      </div>
      {t(why(q.why)) && <p className="text-sm text-ink-mid">{t(why(q.why))}</p>}
      <h2 className="font-display whitespace-pre-wrap text-xl font-bold leading-snug md:text-2xl">{q.prompt}</h2>
      {q.type === "mcq" && q.options ? (
        <div role="radiogroup" className="grid gap-2.5">
          {q.options.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={resp === o.id} disabled={!!res} onClick={() => setResp(o.id)} className={`rounded-[14px] border px-4 py-3 text-left text-[16px] font-medium ${res ? (o.text === res.correctAnswer ? "border-right bg-right/10" : resp === o.id ? "border-again bg-again/10" : "border-ink-low/25 opacity-70") : resp === o.id ? "border-brand bg-brand text-sheet" : "border-ink-low/35 hover:border-ink"}`}>
              {o.text}
            </button>
          ))}
        </div>
      ) : (
        <label className="block text-sm font-semibold text-ink-mid">
          {q.type === "numeric" ? tx("Your answer (a number or fraction)", "তোমার উত্তর (সংখ্যা বা ভগ্নাংশ)") : tx("Your answer", "তোমার উত্তর")}
          <input className={`${input} mt-2`} inputMode={q.type === "numeric" ? "decimal" : "text"} value={resp} disabled={!!res} maxLength={300} onChange={(e) => setResp(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
        </label>
      )}
      {!res ? (
        <>
          <ConfidenceDial value={conf} onChange={setConf} />
          {err && <p className="text-sm font-medium text-again" role="alert">{t(msg(err) ?? msg("unknown")!)}</p>}
          <button type="button" onClick={() => void submit()} disabled={!resp.trim() || busy} className="h-12 rounded-[14px] bg-brand px-6 font-semibold text-sheet disabled:opacity-50">{busy ? tx("Checking…", "দেখছি…") : tx("Check my answer", "উত্তর যাচাই করো")}</button>
        </>
      ) : (
        <div className="edu-rise space-y-3" aria-live="polite">
          <p className={`text-lg font-semibold ${res.correct ? "text-right" : "text-again"}`}>{res.correct ? tx("That's right.", "সঠিক।") : tx("Not this time.", "এবার হয়নি।")}</p>
          {!res.correct && <p>{tx("The answer is: ", "উত্তর হলো: ")}<span className="font-semibold">{res.correctAnswer}</span></p>}
          {res.explanation && <p className="whitespace-pre-wrap leading-relaxed text-ink">{res.explanation}</p>}
          {q.type === "short" && <p className="text-xs text-ink-low">{tx("Short answers are checked against accepted answers, ignoring capitals and punctuation.", "ছোট উত্তর বড়-ছোট হাতের অক্ষর ও যতিচিহ্ন বাদ দিয়ে গ্রহণযোগ্য উত্তরের সাথে মেলানো হয়।")}</p>}
          <p className="text-sm text-ink-mid">{tx(`You'll see this again in ${res.nextReviewDays} day${res.nextReviewDays === 1 ? "" : "s"}.`, `${res.nextReviewDays} দিন পরে এটি আবার দেখবে।`)}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={next} className="h-12 rounded-[14px] bg-brand px-6 font-semibold text-sheet">{i < qs.length - 1 ? tx("Next question", "পরের প্রশ্ন") : tx("Finish", "শেষ করো")}</button>
            {!res.correct && <Link to="/tutor" search={{ chapter: q.chapterId }} className="inline-flex h-12 items-center rounded-[14px] border border-ink-low/35 px-5 font-semibold">{tx("Ask the tutor about this", "এ নিয়ে টিউটরকে প্রশ্ন করো")}</Link>}
          </div>
        </div>
      )}
    </article>
  );
}
