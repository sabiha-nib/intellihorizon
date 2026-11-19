import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call, msg } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { bnDigits } from "../components/universe/learning";
import { Badge, Button, Loading, Panel } from "../components/universe/ui";
import { startQuiz } from "../lib/api/quiz.functions";
import { getTopic } from "../lib/api/topics.functions";
import { requireAccount } from "../lib/guard";
import { MISCONCEPTIONS } from "../lib/learning/lessons";
import { useLearner } from "../lib/store";
import { STATE } from "./topics.index";

export const Route = createFileRoute("/topics/$topicId")({
  beforeLoad: ({ params }) => requireAccount(`/topics/${params.topicId}`),
  head: () => ({ meta: [{ title: "Topic | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: TopicPage,
});

type Data = Extract<Awaited<ReturnType<typeof getTopic>>, { ok: true }>;

function TopicPage() {
  const { topicId } = Route.useParams();
  const { tx, t, lang } = useLearner();
  const nav = useNavigate();
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void call(getTopic({ data: { id: topicId } })).then((r) => (r.ok ? setD(r as Data) : setErr(r.code))); }, [topicId]);
  if (err) return <Frame><p className="text-ink-mid">{err === "not_found" ? tx("This topic isn't available.", "এই টপিকটি নেই।") : t(msg(err) ?? msg("unknown")!)}</p></Frame>;
  if (!d) return <Frame><Loading label={tx("Loading", "লোড হচ্ছে")} /></Frame>;
  const tp = d.topic;
  const c = tp.coverage;
  const practise = async () => {
    const r = await call(startQuiz({ data: { mode: "topic", chapterId: null, topicId, count: 10 } }));
    if (r.ok) void nav({ to: "/quiz/$setId", params: { setId: r.id } }); else setErr(r.code);
  };
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <Link to="/topics" className="text-[14px] text-ink-mid hover:text-ink">{tx("All topics", "সব টপিক")}</Link>
          <h1 className="mt-1 font-display text-[32px] font-bold" lang="bn">{tp.title}</h1>
          <p className="text-[15px] text-ink-mid">{tp.titleEn ? `${tp.titleEn} · ` : ""}{tx(`Chapter ${tp.chapterPosition}: `, `অধ্যায় ${N(tp.chapterPosition)}: `)}<span lang="bn">{tp.chapterTitle}</span> · <span lang="bn">{tp.bookTitle}</span></p>
          <p className="mt-1 text-[13px] text-ink-low">{tx(`Where this topic comes from: ${tp.provenance}. ${tp.reviewStatus === "teacher_reviewed" ? "Reviewed by a teacher." : "Checked against the book; not yet reviewed by a teacher."}`, `টপিকের উৎস: ${tp.provenance}। ${tp.reviewStatus === "teacher_reviewed" ? "শিক্ষক পর্যালোচনা করেছেন।" : "বইয়ের সঙ্গে মেলানো; এখনো শিক্ষক পর্যালোচনা করেননি।"}`)}</p>
        </header>
        <Panel className="p-5">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={STATE[tp.state].tone}>{t(STATE[tp.state].label)}</Badge><span className="text-[14px] text-ink-mid">{t(STATE[tp.state].means)}</span></div>
          <dl className="mt-3 grid gap-2 text-[15px] sm:grid-cols-2">
            <div><dt className="text-ink-mid">{tx("1. Checked material", "১. যাচাই করা উপাদান")}</dt><dd>{c.material ? tx("Available below", "নিচে আছে") : tx("Not yet", "এখনো নেই")}</dd></div>
            <div><dt className="text-ink-mid">{tx("2. Learning", "২. শেখা")}</dt><dd>{c.opened ? tx("You've opened this chapter", "এই অধ্যায় খুলেছ") : tx("Not opened yet", "এখনো খোলোনি")}</dd></div>
            <div><dt className="text-ink-mid">{tx("3. Assessment", "৩. মূল্যায়ন")}</dt><dd>{tx(`${c.answered} answers on ${c.distinctQuestions} of ${c.questions} questions`, `${N(c.questions)}টি প্রশ্নের ${N(c.distinctQuestions)}টিতে ${N(c.answered)}টি উত্তর`)}</dd></div>
            <div><dt className="text-ink-mid">{tx("4. Evidence", "৪. প্রমাণ")}</dt><dd>{c.recentRate === null ? tx("No answers yet", "এখনো উত্তর নেই") : tx(`${c.distinctCorrect} different questions right; ${Math.round(c.recentRate * 100)}% of your last 10 answers`, `${N(c.distinctCorrect)}টি ভিন্ন প্রশ্ন ঠিক; শেষ ১০টির ${N(Math.round(c.recentRate * 100))}%`)}</dd></div>
            <div><dt className="text-ink-mid">{tx("5. Revision", "৫. পুনরালোচনা")}</dt><dd>{c.due ? tx(`${c.due} due now`, `${N(c.due)}টি এখন বাকি`) : tx("Nothing due", "কিছু বাকি নেই")}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {c.questions > 0 && <Button size="sm" onClick={() => void practise()}>{tx(`Practise this topic (${c.questions})`, `এই টপিক অনুশীলন (${N(c.questions)})`)}</Button>}
            {c.due > 0 && <Link to="/revision" className="inline-flex h-10 items-center rounded-[14px] px-4 text-[15px] font-semibold text-brand-deep hover:bg-brand-soft">{tx("Revise now", "এখন পুনরালোচনা")}</Link>}
            <Link to="/tutor" search={{ chapter: tp.chapterId }} className="inline-flex h-10 items-center rounded-[14px] px-4 text-[15px] font-semibold text-brand-deep hover:bg-brand-soft">{tx("Ask the tutor about it", "টিউটরকে জিজ্ঞেস করো")}</Link>
            <Link to="/chapters/$chapterId" params={{ chapterId: tp.chapterId }} className="inline-flex h-10 items-center rounded-[14px] px-4 text-[15px] font-semibold text-brand-deep hover:bg-brand-soft">{tx("Open the chapter", "অধ্যায় খোলো")}</Link>
          </div>
        </Panel>
        {d.passage && (
          <Panel className="space-y-2 p-5">
            <p className="font-semibold">{tx("From your textbook", "তোমার পাঠ্যবই থেকে")}</p>
            <blockquote lang={d.passage.language} className="border-l-[3px] border-thread pl-3.5 text-[16px] leading-[1.75]">{d.passage.text}</blockquote>
            <p className="text-[13px] text-ink-low">{d.passage.book} · {d.passage.printedPage ? tx(`printed page ${d.passage.printedPage}`, `ছাপা পৃষ্ঠা ${N(d.passage.printedPage)}`) : tx(`PDF page ${d.passage.pdfPage}`, `পিডিএফ পৃষ্ঠা ${N(d.passage.pdfPage)}`)} · {d.passage.reviewStatus === "teacher_reviewed" ? tx("checked and reviewed by a teacher", "যাচাই ও শিক্ষক-পর্যালোচিত") : tx("checked against the page, not yet reviewed by a teacher", "পৃষ্ঠার সঙ্গে যাচাই, এখনো শিক্ষক পর্যালোচনা করেননি")} · {d.passage.license === "permitted" ? tx("used with NCTB permission", "এনসিটিবির অনুমতিতে") : tx("NCTB permission pending", "এনসিটিবির অনুমতি প্রক্রিয়াধীন")}</p>
          </Panel>
        )}
        {d.objectives.length > 0 && (
          <Panel className="p-5">
            <p className="font-semibold">{tx("This chapter's learning outcomes, as printed", "এই অধ্যায়ের ছাপা শিখনফল")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]" lang="bn">{d.objectives.map((o, k) => <li key={k}>{o.text}</li>)}</ul>
            <p className="mt-2 text-[13px] text-ink-low">{tx("Outcomes are listed for the chapter; the book doesn't assign them to individual topics.", "শিখনফল অধ্যায়ের জন্য দেওয়া; বই এগুলো আলাদা টপিকে ভাগ করেনি।")}</p>
          </Panel>
        )}
        <Panel className="p-5">
          <p className="font-semibold">{tx("Your history on this topic", "এই টপিকে তোমার ইতিহাস")}</p>
          {d.history.length === 0 ? <p className="mt-1 text-[15px] text-ink-mid">{tx("No answers yet.", "এখনো উত্তর নেই।")}</p> : (
            <ul className="mt-2 space-y-1 text-[15px]">{d.history.map((h, k) => <li key={k}>{h.created_at.slice(0, 10)} · {h.correct ? tx("right", "ঠিক") : tx("wrong", "ভুল")}{h.mode === "review" ? tx(" (revision)", " (পুনরালোচনা)") : ""}{h.misconception && MISCONCEPTIONS[h.misconception] ? ` · ${t(MISCONCEPTIONS[h.misconception])}` : ""}</li>)}</ul>
          )}
        </Panel>
      </div>
    </Frame>
  );
}
