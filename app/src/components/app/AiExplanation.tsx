import type { L } from "../../content/types";
import type { AiBlock, AiExplanation as Ai } from "../../lib/ai/grounding";
import type { Excerpt } from "../../lib/tutor/types";
import { useLearner } from "../../lib/store";
import { MathText } from "./MathText";

/** What each part of an AI explanation rests on. Shown on every block so generated wording is never mistaken for the book. */
const BASIS: Record<AiBlock["basis"], { label: L; cls: string }> = {
  textbook: { label: { en: "From your textbook", bn: "তোমার পাঠ্যবই থেকে" }, cls: "bg-mint-soft text-mint" },
  derived: { label: { en: "Explained from your textbook", bn: "পাঠ্যবই থেকে ব্যাখ্যা" }, cls: "bg-brand-soft text-brand-deep" },
  general: { label: { en: "General explanation, not from your book", bn: "সাধারণ ব্যাখ্যা, বই থেকে নয়" }, cls: "bg-paper text-ink-mid" },
  practice: { label: { en: "Practice question written by AI", bn: "এআই-এর লেখা অনুশীলন প্রশ্ন" }, cls: "bg-amber-soft text-amber" },
  unverified: { label: { en: "Couldn't be checked against your book", bn: "বইয়ের সঙ্গে মেলানো যায়নি" }, cls: "bg-pink-soft text-pink" },
};
const ROLE: Record<AiBlock["role"], L> = {
  direct: { en: "Answer", bn: "উত্তর" },
  explanation: { en: "Explanation", bn: "ব্যাখ্যা" },
  step: { en: "Step", bn: "ধাপ" },
  example: { en: "Example", bn: "উদাহরণ" },
  connection: { en: "In your textbook", bn: "পাঠ্যবইয়ে" },
  check: { en: "Check yourself", bn: "নিজেকে যাচাই করো" },
};
const STATUS: Partial<Record<Ai["status"], L>> = {
  not_configured: { en: "AI explanations aren't switched on for IntelliHorizon yet, so you're seeing the textbook text on its own.", bn: "ইন্টেলিহরাইজনে এআই ব্যাখ্যা এখনো চালু হয়নি, তাই শুধু পাঠ্যবইয়ের লেখা দেখছ।" },
  unavailable: { en: "The AI explanation couldn't be made just now. Here is the textbook text; nothing has been made up.", bn: "এই মুহূর্তে এআই ব্যাখ্যা তৈরি করা যায়নি। এখানে পাঠ্যবইয়ের লেখা আছে; কিছু বানানো হয়নি।" },
  rejected: { en: "The AI's explanation didn't match your textbook closely enough, so I'm not showing it. Read the textbook text below.", bn: "এআই-এর ব্যাখ্যা তোমার বইয়ের সঙ্গে যথেষ্ট মেলেনি, তাই দেখাচ্ছি না। নিচের লেখাটি পড়ো।" },
  insufficient: { en: "The checked text I found doesn't explain this fully, so there's no AI explanation. Read the passage below, or ask a narrower question.", bn: "যাচাই করা যে লেখা পেয়েছি তা এটি পুরোপুরি ব্যাখ্যা করে না, তাই এআই ব্যাখ্যা নেই। নিচের অংশটি পড়ো, বা আরও নির্দিষ্ট প্রশ্ন করো।" },
  limit: { en: "You've used today's AI explanations. The textbook text still works, and more explanations are available tomorrow.", bn: "আজকের এআই ব্যাখ্যা শেষ। পাঠ্যবইয়ের লেখা দেখা যাবে, কাল আবার ব্যাখ্যা পাবে।" },
};

export function AiExplanation({ ai, excerpts }: { ai: Ai; excerpts: Excerpt[] }) {
  const { t, tx } = useLearner();
  const sourceNo = (id: number) => excerpts.findIndex((e) => e.source.passageId === id) + 1;
  if (ai.status !== "ok") {
    const msg = STATUS[ai.status];
    return msg ? <p className="rounded-[12px] bg-paper px-3 py-2 text-sm text-ink-mid" data-ai-status={ai.status}>{t(msg)}</p> : null;
  }
  return (
    <section className="space-y-3 rounded-[18px] border border-brand/25 bg-sheet p-4" aria-label={tx("AI explanation", "এআই ব্যাখ্যা")} data-ai-status="ok">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">{tx("AI explanation, built from the textbook text below", "এআই ব্যাখ্যা, নিচের পাঠ্যবইয়ের লেখা থেকে তৈরি")}</p>
      <ol className="space-y-3">
        {ai.blocks.map((b, i) => (
          <li key={i} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{t(ROLE[b.role])}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BASIS[b.basis].cls}`}>{t(BASIS[b.basis].label)}</span>
              {b.cites.filter((c) => sourceNo(c) > 0).map((c) => <span key={c} className="text-[11px] font-semibold text-ink-mid">{tx(`Source ${sourceNo(c)}`, `উৎস ${sourceNo(c)}`)}</span>)}
            </div>
            <p className="text-[15px] leading-relaxed"><MathText text={b.text} /></p>
          </li>
        ))}
      </ol>
      {ai.quotes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{tx("Exact words from your book", "তোমার বইয়ের হুবহু কথা")}</p>
          {ai.quotes.map((q, i) => {
            const e = excerpts.find((x) => x.source.passageId === q.passageId);
            return (
              <blockquote key={i} lang={e?.source.language} className="border-l-[3px] border-thread pl-3 text-[15px] leading-relaxed">
                “{q.text}”
                {e && <span className="mt-0.5 block text-xs text-ink-mid">{tx(`Source ${sourceNo(q.passageId)}: ${e.source.title}${e.source.printedPage ? `, printed page ${e.source.printedPage}` : ""}`, `উৎস ${sourceNo(q.passageId)}: ${e.source.title}${e.source.printedPage ? `, ছাপা পৃষ্ঠা ${e.source.printedPage}` : ""}`)}</span>}
              </blockquote>
            );
          })}
        </div>
      )}
      <p className="text-xs text-ink-low">{tx("Written by an AI model from the sources listed below. Labels show what comes from your book and what doesn't. Check with your teacher if something seems wrong.", "নিচের উৎসগুলো থেকে একটি এআই মডেল লিখেছে। কোনটি বই থেকে আর কোনটি নয়, লেবেলে দেখানো আছে। কিছু ভুল মনে হলে শিক্ষককে জিজ্ঞেস করো।")}</p>
    </section>
  );
}
