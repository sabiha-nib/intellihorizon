import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { ReadinessFactors } from "../components/app/Readiness";
import { EmptyState, card } from "../components/app/kit";
import { ErrorLine, Loading, StudioPage, btnGhost } from "../components/app/studio-kit";
import { startQuiz } from "../lib/api/quiz.functions";
import { twinData, twinFeedback } from "../lib/api/studio.functions";
import type { TopicState } from "../lib/learning/quiz";
import { useLearner } from "../lib/store";
import { STATE } from "./topics.index";

export const Route = createFileRoute("/twin")({
  head: () => ({ meta: [{ title: "Learning Twin | IntelliHorizon" }] }),
  component: Twin,
});

type D = Extract<Awaited<ReturnType<typeof twinData>>, { ok: true }>;
const DIFF: Record<number, [string, string]> = { 0: ["unrated", "মাত্রাহীন"], 1: ["Foundation", "ভিত্তি"], 2: ["Standard", "সাধারণ"], 3: ["Challenge", "চ্যালেঞ্জ"] };

function Twin() {
  const { tx, t, account } = useLearner();
  const nav = useNavigate();
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => void call(twinData()).then((r) => (r.ok ? setD(r) : setErr(r.code)));
  useEffect(() => { if (account) load(); }, [account]);
  const claim = async (topicId: string, c: "know_it" | "dont_know_it") => {
    setErr(null);
    const r = await call(twinFeedback({ data: { target: topicId, claim: c, note: null } }));
    if (!r.ok) return setErr(r.code);
    load();
    if (r.next.kind === "check") {
      const q = await call(startQuiz({ data: { mode: "topic", chapterId: null, topicId, count: 5 } }));
      if (q.ok) return void nav({ to: "/quiz/$setId", params: { setId: q.id } });
      setMsg(tx("Noted. There aren't enough questions on this topic for a check yet, so your evidence stays as it is.", "লিখে রাখা হলো। এই টপিকে যাচাইয়ের মতো যথেষ্ট প্রশ্ন এখনো নেই, তাই প্রমাণ যেমন ছিল তেমনই থাকল।"));
    } else setMsg(tx("Noted. This topic is now suggested for revision; your evidence isn't changed.", "লিখে রাখা হলো। টপিকটি পুনরালোচনার জন্য প্রস্তাব করা হলো; প্রমাণ বদলায়নি।"));
  };
  const improved = d?.chapters.flatMap((c) => c.improvement.map((i) => ({ ...i, chapter: c.title }))) ?? [];
  return (
    <StudioPage next="/twin" title={tx("Learning Twin", "লার্নিং টুইন")} subtitle={tx("A model of your learning built only from what you've done here: answers, reviews and chapters opened. Each claim shows its evidence.", "শুধু এখানে তোমার কাজ থেকে বানানো শেখার মডেল: উত্তর, রিভিউ আর খোলা অধ্যায়। প্রতিটি দাবির সঙ্গে প্রমাণ দেখানো আছে।")}
      note={tx("If something here is wrong about you, say so. IntelliHorizon won't just change the record: it offers a short check, and the result becomes new evidence.", "এখানে তোমার সম্পর্কে কিছু ভুল থাকলে জানাও। ইন্টেলিহরাইজন রেকর্ড সরাসরি বদলায় না: ছোট একটি যাচাই দেয়, আর তার ফলাফল নতুন প্রমাণ হয়।")}>
      <ErrorLine code={err} />{msg && <p role="status" className="rounded-[12px] bg-mint-soft/60 px-3 py-2 text-sm">{msg}</p>}
      {d === null ? <Loading /> : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className={`${card} p-4`}><p className="text-2xl font-bold">{d.totalAttempts}</p><p className="text-sm text-ink-mid">{tx("answers recorded", "উত্তর রেকর্ড")}</p></div>
            <div className={`${card} p-4`}><p className="text-2xl font-bold">{d.cards.n}</p><p className="text-sm text-ink-mid">{tx(`memory cards (${d.cards.due} due)`, `মেমরি কার্ড (${d.cards.due}টি বাকি)`)}</p></div>
            <div className={`${card} p-4`}><p className="text-2xl font-bold">{d.reflections}</p><p className="text-sm text-ink-mid">{tx("reflections (not counted as evidence)", "প্রতিফলন (প্রমাণ হিসেবে গোনা নয়)")}</p></div>
          </section>
          <section className="space-y-3"><h2 className="font-display text-xl font-bold">{tx("Topics", "টপিক")}</h2>
            {d.topics.length === 0 ? <EmptyState title={tx("No reviewed topics yet", "এখনো পর্যালোচিত টপিক নেই")} body={tx("Topics appear once they've been checked.", "যাচাই হলে টপিক আসবে।")} /> : d.topics.map((tp) => (
              <article key={tp.id} className={`${card} space-y-2 p-5`} data-testid="twin-topic">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><Link to="/topics/$topicId" params={{ topicId: tp.id }} className="font-display text-lg font-bold underline-offset-4 hover:underline" lang="bn">{tp.title}</Link><span className="rounded-full bg-lilac px-2.5 py-0.5 text-sm font-semibold">{t(STATE[tp.state as TopicState].label)}</span></div>
                <p className="text-sm text-ink-mid">{t(STATE[tp.state as TopicState].means)}</p>
                <p className="text-sm">{tx(`Evidence: ${tp.coverage.answered} answers; ${tp.coverage.distinctCorrect} of ${tp.coverage.distinctQuestions} different questions right at least once; ${tp.coverage.due} due for review.`, `প্রমাণ: ${tp.coverage.answered}টি উত্তর; ${tp.coverage.distinctQuestions}টি ভিন্ন প্রশ্নের ${tp.coverage.distinctCorrect}টি অন্তত একবার ঠিক; ${tp.coverage.due}টি রিভিউ বাকি।`)}</p>
                <div className="flex flex-wrap gap-2">
                  <button className={btnGhost} onClick={() => void claim(tp.id, "know_it")}>{tx("I know this better than this says", "আমি এর চেয়ে ভালো জানি")}</button>
                  <button className={btnGhost} onClick={() => void claim(tp.id, "dont_know_it")}>{tx("I don't really know this yet", "আমি এটা এখনো ঠিক জানি না")}</button>
                </div>
              </article>
            ))}
          </section>
          <section className="space-y-3"><h2 className="font-display text-xl font-bold">{tx("Improvement", "উন্নতি")}</h2>
            {improved.length === 0 ? <p className="text-[15px] text-ink-mid">{tx("Not enough answers yet to compare. Improvement is shown only when you have at least 10 answers at the same difficulty in a chapter, so your first 5 and latest 5 don't overlap.", "তুলনার মতো যথেষ্ট উত্তর এখনো নেই। কোনো অধ্যায়ে একই কাঠিন্যে অন্তত ১০টি উত্তর হলে তবেই উন্নতি দেখানো হয়, যাতে প্রথম ৫টি আর শেষ ৫টি আলাদা থাকে।")}</p> : (
              <ul className="space-y-2">{improved.map((i, k) => <li key={k} className={`${card} p-4 text-[15px]`} lang="bn">{i.chapter} · {tx(DIFF[i.difficulty][0], DIFF[i.difficulty][1])}: {tx(`first ${i.n}: ${i.first} right → latest ${i.n}: ${i.recent} right`, `প্রথম ${i.n}টিতে ${i.first}টি ঠিক → শেষ ${i.n}টিতে ${i.recent}টি ঠিক`)}</li>)}</ul>
            )}
          </section>
          <section className="space-y-3"><h2 className="font-display text-xl font-bold">{tx("Chapter readiness", "অধ্যায়ের প্রস্তুতি")}</h2>
            {d.chapters.filter((c) => c.attempts > 0).length === 0 ? <p className="text-[15px] text-ink-mid">{tx("Answer some practice questions to see readiness.", "প্রস্তুতি দেখতে কিছু অনুশীলনের প্রশ্নের উত্তর দাও।")}</p> : d.chapters.filter((c) => c.attempts > 0).map((c) => <div key={c.id} className={`${card} space-y-2 p-4`}><p className="font-semibold" lang="bn">{c.title}</p><ReadinessFactors r={c.readiness} /></div>)}
          </section>
          {d.feedback.length > 0 && <section><h2 className="font-display text-xl font-bold">{tx("Your corrections", "তোমার সংশোধন")}</h2><ul className="mt-2 text-sm text-ink-mid">{d.feedback.map((f, i) => <li key={i}>{new Date(f.created_at).toLocaleDateString()} · {d.topics.find((x) => x.id === f.target)?.title ?? f.target} · {f.claim === "know_it" ? tx("you said you know it", "তুমি বলেছ জানো") : tx("you said you don't know it yet", "তুমি বলেছ এখনো জানো না")}</li>)}</ul></section>}
          <p className="text-sm"><Link to="/mirror" className="font-semibold underline underline-offset-4">{tx("See and correct everything IntelliHorizon believes about how you learn", "তুমি কীভাবে শেখো সে সম্পর্কে ইন্টেলিহরাইজন যা ভাবে, দেখো ও সংশোধন করো")}</Link></p>
        </>
      )}
    </StudioPage>
  );
}
