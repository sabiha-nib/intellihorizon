import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call, msg } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon, type IconName } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import { Badge, Button, Loading, PageTitle, Panel, SectionTitle } from "../components/universe/ui";
import type { L } from "../content/types";
import { quizHome, startQuiz } from "../lib/api/quiz.functions";
import { requireAccount } from "../lib/guard";
import type { QuizMode } from "../lib/learning/quiz";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/quiz/")({
  beforeLoad: () => requireAccount("/quiz"),
  head: () => ({ meta: [{ title: "IntelliQuiz | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: QuizHome,
});

type Data = Extract<Awaited<ReturnType<typeof quizHome>>, { ok: true }>;

export const MODE_INFO: Record<QuizMode, { icon: IconName; title: L; body: L }> = {
  daily: { icon: "sun", title: { en: "Daily Five", bn: "দৈনিক পাঁচ" }, body: { en: "Five questions a day: due revision first, then past mistakes, then new ones.", bn: "দিনে পাঁচটি প্রশ্ন: আগে পুনরালোচনা, তারপর পুরোনো ভুল, তারপর নতুন।" } },
  quick: { icon: "play", title: { en: "Quick practice", bn: "দ্রুত অনুশীলন" }, body: { en: "A short mixed set with feedback after each answer.", bn: "প্রতিটি উত্তরের পর ফিডব্যাকসহ ছোট মিশ্র সেট।" } },
  chapter: { icon: "book", title: { en: "Chapter practice", bn: "অধ্যায় অনুশীলন" }, body: { en: "Questions from across one chapter.", bn: "একটি অধ্যায়ের সব জায়গা থেকে প্রশ্ন।" } },
  topic: { icon: "layers", title: { en: "Topic practice", bn: "টপিক অনুশীলন" }, body: { en: "Questions on one reviewed topic.", bn: "একটি পর্যালোচিত টপিকের প্রশ্ন।" } },
  mistakes: { icon: "revision", title: { en: "Mistake replay", bn: "ভুল আবার করো" }, body: { en: "Questions whose last answer was wrong.", bn: "যেসব প্রশ্নের শেষ উত্তর ভুল ছিল।" } },
  weakness: { icon: "radar", title: { en: "Weak spots", bn: "দুর্বল জায়গা" }, body: { en: "Skills with two or more answers and under 60% right.", bn: "যে দক্ষতায় দুই বা বেশি উত্তরের ৬০%-এর কম ঠিক।" } },
  exam: { icon: "shield", title: { en: "Exam simulation", bn: "পরীক্ষার অনুশীলন" }, body: { en: "Timed (90 seconds a question), answers checked only when you submit. Practice, not a prediction of your exam.", bn: "সময় বাঁধা (প্রতি প্রশ্নে ৯০ সেকেন্ড), জমা দিলে তবেই উত্তর মেলানো। এটি অনুশীলন, পরীক্ষার ফলের পূর্বাভাস নয়।" } },
};

function QuizHome() {
  const { tx, t, lang } = useLearner();
  const nav = useNavigate();
  const [d, setD] = useState<Data | null>(null);
  const [mode, setMode] = useState<QuizMode>("quick");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  useEffect(() => { void call(quizHome()).then((r) => { if (r.ok) { setD(r as Data); setChapterId((r as Data).chapters[0]?.id ?? ""); setTopicId((r as Data).topics[0]?.id ?? ""); } }); }, []);
  const start = async () => {
    setBusy(true); setErr(null);
    const r = await call(startQuiz({ data: { mode, chapterId: mode === "chapter" || mode === "exam" ? chapterId || null : null, topicId: mode === "topic" ? topicId || null : null, count } }));
    setBusy(false);
    if (!r.ok) return setErr(r.code);
    void nav({ to: "/quiz/$setId", params: { setId: r.id } });
  };
  const ERR: Record<string, L> = {
    no_mistakes: { en: "No past mistakes to replay. Every question you've answered is right on its latest try.", bn: "আবার করার মতো পুরোনো ভুল নেই। যত প্রশ্নের উত্তর দিয়েছ, শেষবার সব ঠিক।" },
    no_weakness: { en: "No weak spot yet: a skill needs two or more answers with under 60% right before it shows up here.", bn: "এখনো দুর্বল জায়গা নেই: কোনো দক্ষতায় দুই বা বেশি উত্তরের ৬০%-এর কম ঠিক হলে এখানে আসবে।" },
    no_questions: { en: "There are no checked questions for this choice yet.", bn: "এই বাছাইয়ের জন্য এখনো যাচাই করা প্রশ্ন নেই।" },
  };
  return (
    <Frame>
      <div className="space-y-8">
        <PageTitle icon="practice" title={tx("IntelliQuiz", "ইন্টেলিকুইজ")} sub={tx("Practice with checked questions, see why each answer is right, and get a breakdown by topic and difficulty. Questions are textbook exercises unless labelled otherwise.", "যাচাই করা প্রশ্নে অনুশীলন করো, প্রতিটি উত্তর কেন ঠিক দেখো, আর টপিক ও কাঠিন্য অনুযায়ী বিশ্লেষণ পাও। আলাদা লেবেল না থাকলে প্রশ্নগুলো পাঠ্যবইয়ের অনুশীলনী।")} />
        {!d ? <Loading label={tx("Loading", "লোড হচ্ছে")} /> : (
          <>
            {d.total === 0 && <p className="text-ink-mid">{tx("No checked questions have been published yet.", "এখনো কোনো যাচাই করা প্রশ্ন প্রকাশিত হয়নি।")}</p>}
            <p className="text-[15px] text-ink-mid">{tx(`${d.total} checked questions are available, all from ${d.chapters.length === 1 ? "one chapter" : `${d.chapters.length} chapters`}: ${d.chapters.map((c) => c.title).join(", ")}. More arrive as questions are reviewed.`, `${N(d.total)}টি যাচাই করা প্রশ্ন আছে, ${N(d.chapters.length)}টি অধ্যায় থেকে: ${d.chapters.map((c) => c.title).join(", ")}। প্রশ্ন পর্যালোচিত হলে আরও আসবে।`)}</p>
            <section aria-labelledby="modes-h" className="space-y-3">
              <SectionTitle id="modes-h" title={tx("Choose a mode", "একটি ধরন বাছো")} />
              <div role="radiogroup" aria-labelledby="modes-h" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(MODE_INFO) as QuizMode[]).map((m) => {
                  const off = (m === "topic" && !d.topics.length) || (m === "mistakes" && d.mistakes === 0);
                  return (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={off} onClick={() => setMode(m)}
                      className={`flex items-start gap-3 rounded-[18px] border-2 p-4 text-left transition-colors disabled:opacity-50 ${mode === m ? "border-brand bg-brand-soft" : "border-line bg-sheet hover:border-line-strong"}`}>
                      <Icon name={MODE_INFO[m].icon} className="mt-0.5 shrink-0 text-brand" />
                      <span>
                        <span className="block font-semibold">{t(MODE_INFO[m].title)}{m === "daily" && d.daily ? (d.daily.status === "submitted" ? tx(" · done today", " · আজ শেষ") : tx(" · in progress", " · চলছে")) : ""}{m === "mistakes" ? ` · ${N(d.mistakes)}` : ""}</span>
                        <span className="mt-0.5 block text-[14px] text-ink-mid">{t(MODE_INFO[m].body)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <Panel className="space-y-4 p-5">
              {(mode === "chapter" || mode === "exam") && (
                <label className="block text-[15px] font-semibold">{tx("Chapter", "অধ্যায়")}
                  <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} className="mt-1 h-12 w-full rounded-[12px] border-2 border-line bg-sheet px-3 text-[16px]">
                    {d.chapters.map((c) => <option key={c.id} value={c.id}>{c.book}: {c.position}. {c.title} ({N(c.n)})</option>)}
                  </select>
                </label>
              )}
              {mode === "topic" && (
                <label className="block text-[15px] font-semibold">{tx("Topic", "টপিক")}
                  <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="mt-1 h-12 w-full rounded-[12px] border-2 border-line bg-sheet px-3 text-[16px]">
                    {d.topics.map((tp) => <option key={tp.id} value={tp.id}>{tp.title}{tp.title_en ? ` (${tp.title_en})` : ""} · {N(tp.n)}</option>)}
                  </select>
                </label>
              )}
              {mode !== "daily" && (
                <label className="block text-[15px] font-semibold">{tx("Number of questions", "প্রশ্নের সংখ্যা")}
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 h-12 w-full max-w-[12rem] rounded-[12px] border-2 border-line bg-sheet px-3 text-[16px]">
                    {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{N(n)}</option>)}
                  </select>
                  <span className="mt-1 block text-[13px] font-normal text-ink-low">{tx("If fewer checked questions fit your choice, you get all of them.", "তোমার বাছাইয়ে এর চেয়ে কম যাচাই করা প্রশ্ন থাকলে সবগুলো পাবে।")}</span>
                </label>
              )}
              {err && <p role="alert" className="text-again">{ERR[err] ? t(ERR[err]) : t(msg(err) ?? msg("unknown")!)}</p>}
              <Button onClick={() => void start()} disabled={busy || d.total === 0}>{busy ? tx("Preparing…", "তৈরি হচ্ছে…") : mode === "daily" && d.daily ? tx("Open today's Daily Five", "আজকের দৈনিক পাঁচ খোলো") : tx("Start", "শুরু করো")}</Button>
            </Panel>
            {d.recent.length > 0 && (
              <section aria-labelledby="recent-h" className="space-y-3">
                <SectionTitle id="recent-h" title={tx("Recent practice", "সাম্প্রতিক অনুশীলন")} />
                <ul className="space-y-2">
                  {d.recent.map((r) => (
                    <li key={r.id}>
                      <a href={`/quiz/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-line bg-sheet px-4 py-3 hover:border-line-strong">
                        <span className="font-semibold">{t(MODE_INFO[r.mode as QuizMode]?.title ?? { en: r.mode, bn: r.mode })} <span className="font-normal text-ink-mid">· {r.startedAt.slice(0, 10)}</span></span>
                        {r.status === "submitted" ? <Badge tone="brand">{tx(`${r.correct} right of ${r.attempted} answered (${r.total} questions)`, `${N(r.total ?? 0)}টির মধ্যে ${N(r.attempted ?? 0)}টির উত্তর, ${N(r.correct ?? 0)}টি ঠিক`)}</Badge> : <Badge tone="amber">{tx("Not submitted", "জমা হয়নি")}</Badge>}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Frame>
  );
}
