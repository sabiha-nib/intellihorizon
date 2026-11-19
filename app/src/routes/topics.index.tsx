import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { bnDigits } from "../components/universe/learning";
import { Badge, Loading, PageTitle, Panel } from "../components/universe/ui";
import type { L } from "../content/types";
import { listTopics } from "../lib/api/topics.functions";
import { subjectById } from "../lib/curriculum/registry";
import { requireAccount } from "../lib/guard";
import type { TopicState } from "../lib/learning/quiz";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/topics/")({
  beforeLoad: () => requireAccount("/topics"),
  head: () => ({ meta: [{ title: "Topics | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: Topics,
});

type Data = Extract<Awaited<ReturnType<typeof listTopics>>, { ok: true }>;
export const STATE: Record<TopicState, { label: L; tone: "neutral" | "brand" | "amber" | "mint" | "pink"; means: L }> = {
  not_explored: { label: { en: "Not explored", bn: "অন্বেষণ হয়নি" }, tone: "neutral", means: { en: "No checked material or questions here yet.", bn: "এখানে এখনো যাচাই করা উপাদান বা প্রশ্ন নেই।" } },
  available: { label: { en: "Available to learn", bn: "শেখার জন্য প্রস্তুত" }, tone: "neutral", means: { en: "Checked material or questions are ready; you haven't started.", bn: "যাচাই করা উপাদান বা প্রশ্ন প্রস্তুত; তুমি শুরু করোনি।" } },
  learning: { label: { en: "Learning", bn: "শিখছ" }, tone: "brand", means: { en: "You've opened the chapter but haven't answered its questions yet.", bn: "অধ্যায় খুলেছ, কিন্তু প্রশ্নের উত্তর দাওনি।" } },
  practicing: { label: { en: "Practising", bn: "অনুশীলন চলছে" }, tone: "brand", means: { en: "Some answers so far; not enough for a pattern.", bn: "কিছু উত্তর আছে; ধরন বোঝার মতো যথেষ্ট নয়।" } },
  developing: { label: { en: "Developing", bn: "উন্নতি হচ্ছে" }, tone: "amber", means: { en: "3+ different questions and 60%+ of your last 10 answers right.", bn: "৩+ ভিন্ন প্রশ্ন আর শেষ ১০টির ৬০%+ ঠিক।" } },
  demonstrated: { label: { en: "Demonstrated", bn: "প্রমাণিত" }, tone: "mint", means: { en: "5+ different questions right, a revision answered right, and 70%+ of your last 10 right.", bn: "৫+ ভিন্ন প্রশ্ন ঠিক, একটি পুনরালোচনা ঠিক, আর শেষ ১০টির ৭০%+ ঠিক।" } },
  needs_revision: { label: { en: "Needs revision", bn: "পুনরালোচনা দরকার" }, tone: "pink", means: { en: "At least one of its questions is due for revision.", bn: "অন্তত একটি প্রশ্ন পুনরালোচনার সময় হয়েছে।" } },
};

function Topics() {
  const { tx, t, lang } = useLearner();
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  const [d, setD] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [state, setState] = useState<TopicState | "">("");
  const [material, setMaterial] = useState<"" | "yes" | "no">("");
  useEffect(() => { void call(listTopics()).then((r) => r.ok && setD(r as Data)); }, []);
  const shown = useMemo(() => (d?.topics ?? []).filter((x) =>
    (!q || `${x.title} ${x.titleEn ?? ""} ${x.chapterTitle}`.toLowerCase().includes(q.toLowerCase())) && (!state || x.state === state) && (!material || (material === "yes") === x.coverage.material)), [d, q, state, material]);
  return (
    <Frame>
      <div className="space-y-6">
        <PageTitle icon="layers" title={tx("Topics", "টপিক")} sub={tx("Topics inside your chapters, each with five separate signals: is there checked material, have you opened it, have you answered its questions, what your answers show, and is anything due. They're never blended into one percentage.", "অধ্যায়ের ভেতরের টপিক, প্রতিটির পাঁচটি আলাদা সংকেত: যাচাই করা উপাদান আছে কি না, খুলেছ কি না, প্রশ্নের উত্তর দিয়েছ কি না, উত্তর কী দেখায়, আর কিছু পুনরালোচনার সময় হয়েছে কি না। এগুলো কখনো একটি শতাংশে মেশানো হয় না।")} />
        {!d ? <Loading label={tx("Loading", "লোড হচ্ছে")} /> : (
          <>
            <p className="text-[15px] text-ink-mid">{tx(`${d.topics.length} reviewed topics so far, in ${d.chaptersWithTopics} of ${d.chapters} chapters. Topics are added only when they can be traced to the book; the rest of the curriculum is listed by chapter under Learn.`, `এ পর্যন্ত ${N(d.topics.length)}টি পর্যালোচিত টপিক, ${N(d.chapters)}টি অধ্যায়ের ${N(d.chaptersWithTopics)}টিতে। বইয়ের সঙ্গে মেলানো গেলে তবেই টপিক যোগ হয়; বাকি পাঠ্যক্রম "শেখো" অংশে অধ্যায় ধরে আছে।`)}</p>
            <div className="flex flex-wrap gap-3">
              <label className="text-[15px] font-semibold">{tx("Search", "খোঁজো")}<input value={q} onChange={(e) => setQ(e.target.value)} className="ml-2 h-11 rounded-[12px] border-2 border-line bg-sheet px-3 font-normal" /></label>
              <label className="text-[15px] font-semibold">{tx("Status", "অবস্থা")}<select value={state} onChange={(e) => setState(e.target.value as TopicState | "")} className="ml-2 h-11 rounded-[12px] border-2 border-line bg-sheet px-2 font-normal"><option value="">{tx("Any", "যেকোনো")}</option>{(Object.keys(STATE) as TopicState[]).map((s) => <option key={s} value={s}>{t(STATE[s].label)}</option>)}</select></label>
              <label className="text-[15px] font-semibold">{tx("Checked material", "যাচাই করা উপাদান")}<select value={material} onChange={(e) => setMaterial(e.target.value as "")} className="ml-2 h-11 rounded-[12px] border-2 border-line bg-sheet px-2 font-normal"><option value="">{tx("Any", "যেকোনো")}</option><option value="yes">{tx("Available", "আছে")}</option><option value="no">{tx("Not yet", "এখনো নেই")}</option></select></label>
            </div>
            {shown.length === 0 && <p className="text-ink-mid">{tx("No topics match these filters.", "এই ফিল্টারে কোনো টপিক নেই।")}</p>}
            <ul className="grid gap-3 md:grid-cols-2">
              {shown.map((x) => (
                <li key={x.id}>
                  <Link to="/topics/$topicId" params={{ topicId: x.id }} className="block h-full rounded-[20px] border border-line bg-sheet p-4 hover:border-line-strong">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-[19px] font-bold" lang="bn">{x.title}</span>
                      <Badge tone={STATE[x.state].tone}>{t(STATE[x.state].label)}</Badge>
                    </div>
                    <p className="text-[14px] text-ink-mid">{x.titleEn ? `${x.titleEn} · ` : ""}{t(subjectById(x.subjectKey)?.label ?? { en: x.subjectKey, bn: x.subjectKey })} · {tx(`Chapter ${x.chapterPosition}`, `অধ্যায় ${N(x.chapterPosition)}`)}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                      <dt className="text-ink-mid">{tx("Checked material", "যাচাই করা উপাদান")}</dt><dd>{x.coverage.material ? tx("Yes", "আছে") : tx("Not yet", "এখনো নেই")}</dd>
                      <dt className="text-ink-mid">{tx("Practice questions", "অনুশীলনের প্রশ্ন")}</dt><dd className="tnum">{N(x.coverage.questions)}</dd>
                      <dt className="text-ink-mid">{tx("Opened", "খোলা হয়েছে")}</dt><dd>{x.coverage.opened ? tx("Yes", "হ্যাঁ") : tx("No", "না")}</dd>
                      <dt className="text-ink-mid">{tx("Your answers", "তোমার উত্তর")}</dt><dd className="tnum">{N(x.coverage.answered)}</dd>
                      <dt className="text-ink-mid">{tx("Due for revision", "পুনরালোচনা বাকি")}</dt><dd className="tnum">{N(x.coverage.due)}</dd>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
            {d.unlinked.length > 0 && (
              <Panel tone="lilac" className="p-4 text-[15px]">
                {d.unlinked.map((c) => <p key={c.id}>{tx(`${c.title}: ${c.unlinked} practice questions aren't linked to a reviewed topic yet (their subtopic has no checked heading). They're still in Chapter practice.`, `${c.title}: ${N(c.unlinked)}টি অনুশীলন প্রশ্ন এখনো কোনো পর্যালোচিত টপিকের সঙ্গে যুক্ত নয় (উপটপিকের যাচাই করা শিরোনাম নেই)। এগুলো অধ্যায় অনুশীলনে আছে।`)}</p>)}
              </Panel>
            )}
            <details className="text-[14px] text-ink-mid"><summary className="cursor-pointer font-semibold text-ink">{tx("What the statuses mean", "অবস্থাগুলোর মানে")}</summary><ul className="mt-2 space-y-1">{(Object.keys(STATE) as TopicState[]).map((s) => <li key={s}><b>{t(STATE[s].label)}:</b> {t(STATE[s].means)}</li>)}</ul></details>
          </>
        )}
      </div>
    </Frame>
  );
}
