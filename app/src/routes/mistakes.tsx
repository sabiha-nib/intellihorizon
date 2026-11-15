import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import {
  Badge,
  Empty,
  LinkButton,
  Loading,
  PageTitle,
  Panel,
  SectionTitle,
} from "../components/universe/ui";
import { getMistakes } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { CORRECTIONS, MISCONCEPTIONS, SKILLS } from "../lib/learning/lessons";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/mistakes")({
  beforeLoad: () => requireAccount("/mistakes"),
  head: () => ({
    meta: [{ title: "Misconception Radar | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Mistakes,
});

type Data = Extract<Awaited<ReturnType<typeof getMistakes>>, { ok: true }>;
function Mistakes() {
  const { tx, t } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    void call(getMistakes()).then((r) => r.ok && setD(r as Data));
  }, []);
  const empty =
    d && !d.confirmed.length && !d.patterns.length && !d.weakSkills.length && !d.fixed.length;
  return (
    <Frame>
      <div className="mx-auto max-w-4xl space-y-8">
        <PageTitle
          icon="radar"
          title={tx("Misconception Radar", "ভুল ধারণার রাডার")}
          sub={tx(
            "Built only from your recorded answers. A single slip doesn't show up here; a mistake you repeat does.",
            "শুধু তোমার জমা উত্তর থেকে তৈরি। একবারের ভুল এখানে আসে না; বারবার হওয়া ভুল আসে।",
          )}
        />
        {!d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : empty ? (
          <Empty
            icon="radar"
            title={
              d.attempts
                ? tx("No repeated mistakes", "বারবার হওয়া কোনো ভুল নেই")
                : tx("Nothing to show yet", "এখনো দেখানোর কিছু নেই")
            }
            body={
              d.attempts
                ? tx(
                    `From your ${d.attempts} answers, nothing has gone wrong twice. Keep going.`,
                    `তোমার ${bnDigits(d.attempts)}টি উত্তরে কোনো ভুল দুবার হয়নি। চালিয়ে যাও।`,
                  )
                : tx(
                    "After you answer some questions, repeated mistakes and patterns will appear here.",
                    "কিছু প্রশ্নের উত্তর দিলে বারবার হওয়া ভুল আর ধরন এখানে দেখা যাবে।",
                  )
            }
            action={<LinkButton to="/practice">{tx("Practise", "অনুশীলন করো")}</LinkButton>}
          />
        ) : (
          <>
            {d.patterns.length > 0 && (
              <section aria-labelledby="pat-h">
                <SectionTitle
                  id="pat-h"
                  title={tx("Patterns", "ধরন")}
                  sub={tx(
                    "The same kind of wrong answer on two or more different questions.",
                    "দুই বা বেশি ভিন্ন প্রশ্নে একই ধরনের ভুল উত্তর।",
                  )}
                />
                <ul className="space-y-3">
                  {d.patterns.map((p) => (
                    <li key={p.tag}>
                      <Panel className="p-5">
                        <p className="flex items-center gap-2 font-semibold text-again">
                          <Icon name="radar" size={20} />
                          {MISCONCEPTIONS[p.tag] ? t(MISCONCEPTIONS[p.tag]) : p.tag}
                        </p>
                        <p className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={p.confidence === "likely" ? "again" : "amber"}>
                            {p.confidence === "likely" ? tx("Likely pattern", "সম্ভবত একটি ধরন") : tx("Possible pattern", "হতে পারে একটি ধরন")}
                          </Badge>
                          <Badge tone={p.status === "resolved" ? "mint" : p.status === "improving" ? "brand" : "neutral"}>
                            {p.status === "resolved" ? tx("Fixed on every question", "সব প্রশ্নে শুধরেছ") : p.status === "improving" ? tx(`Improving: fixed on ${p.improved} of ${p.questions.length}`, `উন্নতি হচ্ছে: ${bnDigits(p.questions.length)}টির ${bnDigits(p.improved)}টিতে শুধরেছ`) : tx("Not fixed yet", "এখনো শোধরায়নি")}
                          </Badge>
                        </p>
                        <p className="mt-2 text-[14px] text-ink-mid">
                          {tx(
                            `Evidence: ${p.wrongAnswers} wrong answer${p.wrongAnswers > 1 ? "s" : ""} of this kind across ${p.questions.length} different questions. ${p.confidence === "likely" ? "Three or more questions makes this likely, not certain." : "Two questions is a hint, not a conclusion."}`,
                            `প্রমাণ: ${bnDigits(p.questions.length)}টি ভিন্ন প্রশ্নে এই ধরনের ${bnDigits(p.wrongAnswers)}টি ভুল উত্তর। ${p.confidence === "likely" ? "তিন বা বেশি প্রশ্নে হলে এটি সম্ভাব্য, নিশ্চিত নয়।" : "দুটি প্রশ্ন একটি ইঙ্গিত মাত্র, সিদ্ধান্ত নয়।"}`,
                          )}
                        </p>
                        {p.lastSeen && (
                          <p className="mt-1 text-[14px] text-ink-mid">{tx(`Last seen ${p.lastSeen.slice(0, 10)}.`, `শেষ দেখা গেছে ${p.lastSeen.slice(0, 10)}।`)}</p>
                        )}
                        {CORRECTIONS[p.tag] && (
                          <p className="mt-2 rounded-[12px] bg-lilac px-3 py-2 text-[15px]">
                            <span className="font-semibold">{tx("Suggested fix: ", "যেভাবে ঠিক করবে: ")}</span>
                            {t(CORRECTIONS[p.tag])}
                            <span className="mt-0.5 block text-xs text-ink-low">{tx("IntelliHorizon's guidance, not textbook wording.", "ইন্টেলিহরাইজনের পরামর্শ, পাঠ্যবইয়ের ভাষা নয়।")}</span>
                          </p>
                        )}
                        <ul className="mt-2 space-y-1">
                          {p.questions.map((q) => (
                            <li key={q.id} className="flex items-start gap-2 text-[15px]" lang={q.language}>
                              <Icon name={q.fixed ? "check" : "revision"} size={16} className={`mt-1 shrink-0 ${q.fixed ? "text-mint" : "text-ink-low"}`} />
                              <span className="line-clamp-1">{q.prompt}</span>
                            </li>
                          ))}
                        </ul>
                        {p.questions[0] && (
                          <Link
                            to="/practice/$chapterId"
                            params={{ chapterId: p.questions[0].chapterId }}
                            className="mt-3 inline-block text-[15px] font-semibold text-brand-deep hover:underline"
                          >
                            {tx("Follow-up practice in this chapter", "এই অধ্যায়ে ফলো-আপ অনুশীলন")}
                          </Link>
                        )}
                      </Panel>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.confirmed.length > 0 && (
              <section aria-labelledby="con-h">
                <SectionTitle
                  id="con-h"
                  title={tx("Still not right", "এখনো ঠিক হয়নি")}
                  sub={tx(
                    "Wrong at least twice, and not yet right since.",
                    "অন্তত দুবার ভুল, এরপর এখনো সঠিক হয়নি।",
                  )}
                />
                <ul className="space-y-2">
                  {d.confirmed.map((q) => (
                    <li key={q.id}>
                      <Link
                        to="/practice/$chapterId"
                        params={{ chapterId: q.chapterId }}
                        className="flex items-center gap-3 rounded-[16px] border border-line bg-sheet p-4 hover:border-brand"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className="block line-clamp-2 text-[15px] font-semibold"
                            lang={q.language}
                          >
                            {q.prompt}
                          </span>
                          <span className="text-[13px] text-ink-mid" lang={q.language}>
                            {q.chapter}
                          </span>
                        </span>
                        <Badge tone="again">
                          {tx(`wrong ${q.wrong}×`, `${bnDigits(q.wrong)} বার ভুল`)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.weakSkills.length > 0 && (
              <section aria-labelledby="sk-h">
                <SectionTitle
                  id="sk-h"
                  title={tx("Skills to strengthen", "যে দক্ষতা মজবুত করতে হবে")}
                  sub={tx(
                    "Three or more answers, under 60% right.",
                    "তিন বা বেশি উত্তর, ৬০%-এর কম সঠিক।",
                  )}
                />
                <ul className="flex flex-wrap gap-2">
                  {d.weakSkills.map((s) => (
                    <li key={s.skill}>
                      <Badge tone="pink">
                        {SKILLS[s.skill] ? t(SKILLS[s.skill]) : s.skill}:{" "}
                        {tx(
                          `${s.correct}/${s.attempts}`,
                          `${bnDigits(s.correct)}/${bnDigits(s.attempts)}`,
                        )}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.fixed.length > 0 && (
              <section aria-labelledby="fx-h">
                <SectionTitle
                  id="fx-h"
                  title={tx("Fixed", "শুধরেছ")}
                  sub={tx("Wrong before, right on your latest try.", "আগে ভুল, শেষ চেষ্টায় সঠিক।")}
                />
                <ul className="space-y-1.5">
                  {d.fixed.map((q) => (
                    <li key={q.id} className="flex items-center gap-2 text-[15px]">
                      <Icon name="check" size={18} className="shrink-0 text-mint" />
                      <span className="line-clamp-1" lang={q.language}>
                        {q.prompt}
                      </span>
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
