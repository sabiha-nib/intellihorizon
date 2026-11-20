import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon, SubjectDot } from "../components/universe/icons";
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
import { getPracticeOverview } from "../lib/api/learning.functions";
import { BOOKS, subjectById } from "../lib/curriculum/registry";
import { requireAccount } from "../lib/guard";
import { LESSONS } from "../lib/learning/lessons";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/practice/")({
  beforeLoad: () => requireAccount("/practice"),
  head: () => ({
    meta: [{ title: "Practice | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Practice,
});

type Data = Extract<Awaited<ReturnType<typeof getPracticeOverview>>, { ok: true }>;

function Practice() {
  const { tx, t, lang } = useLearner();
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    void call(getPracticeOverview()).then((r) => r.ok && setData(r as Data));
  }, []);
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  const lessonOnly = Object.keys(LESSONS)
    .filter((id) => !data?.chapters.some((c) => c.id === id))
    .map((id) => {
      const b = BOOKS.find((x) => x.chapters.some((c) => c.id === id));
      const c = b?.chapters.find((x) => x.id === id);
      return b && c ? { id, title: c.title, book: b.title, subject: b.subjectId } : null;
    })
    .filter(Boolean) as { id: string; title: string; book: string; subject: string }[];
  return (
    <Frame>
      <div className="space-y-8">
        <PageTitle
          icon="practice"
          title={tx("Practice", "অনুশীলন")}
          sub={tx(
            "Every practice run is a Learning Session: a short idea, checked questions, a fix-up round and a recap. Due revision always comes first.",
            "প্রতিটি অনুশীলন একটি লার্নিং সেশন: ছোট ধারণা, যাচাই করা প্রশ্ন, শোধরানোর পালা ও সারসংক্ষেপ। পুনরালোচনা সবসময় আগে।",
          )}
        />
        <Panel tone="lilac" className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand"><Icon name="play" /></span>
            <div>
              <h2 className="font-display text-[20px] font-bold">{tx("IntelliQuiz", "ইন্টেলিকুইজ")}</h2>
              <p className="mt-0.5 text-[15px] text-ink-mid">{tx("Daily Five, mistake replay, weak spots, topic practice and timed exam simulation, with a full breakdown afterwards.", "দৈনিক পাঁচ, ভুল আবার করা, দুর্বল জায়গা, টপিক অনুশীলন আর সময় বাঁধা পরীক্ষা, শেষে পুরো বিশ্লেষণসহ।")}</p>
            </div>
          </div>
          <LinkButton to="/quiz" size="sm">{tx("Open IntelliQuiz", "ইন্টেলিকুইজ খোলো")}</LinkButton>
        </Panel>
        {!data ? (
          <Loading label={tx("Loading practice", "অনুশীলন লোড হচ্ছে")} />
        ) : (
          <>
            <Panel
              tone={data.due ? "lift" : "lilac"}
              className="flex flex-wrap items-center justify-between gap-4 p-6"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
                  <Icon name="revision" />
                </span>
                <div>
                  <h2 className="font-display text-[21px] font-bold">
                    {data.due
                      ? tx(
                          `${data.due} question${data.due > 1 ? "s" : ""} due for revision`,
                          `${N(data.due)}টি প্রশ্ন পুনরালোচনার সময়`,
                        )
                      : tx("Nothing due for revision", "এখন পুনরালোচনার কিছু নেই")}
                  </h2>
                  <p className="mt-1 text-[15px] text-ink-mid">
                    {!data.due && data.nextDue
                      ? tx(
                          `The next one returns on ${new Date(data.nextDue).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`,
                          `পরেরটি ফিরবে ${new Date(data.nextDue).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}।`,
                        )
                      : tx(
                          "A missed question returns the next day; a right one after 3, 7, 14 and 30 days.",
                          "ভুল প্রশ্ন পরদিন ফেরে; সঠিকটি ৩, ৭, ১৪ ও ৩০ দিন পরে।",
                        )}
                  </p>
                </div>
              </div>
              {data.due > 0 && (
                <LinkButton to="/revision" icon="play">
                  {tx("Start revision", "পুনরালোচনা শুরু")}
                </LinkButton>
              )}
            </Panel>

            <section aria-labelledby="sess-h">
              <SectionTitle
                id="sess-h"
                title={tx("Start a Learning Session", "লার্নিং সেশন শুরু করো")}
                sub={tx(
                  "Chapters with checked questions. More are added as editors review them.",
                  "যাচাই করা প্রশ্নসহ অধ্যায়। সম্পাদকেরা যাচাই করলে আরও যোগ হবে।",
                )}
              />
              {data.chapters.length === 0 ? (
                <Empty
                  icon="practice"
                  title={tx(
                    "No checked questions for your class yet",
                    "তোমার শ্রেণির জন্য এখনো যাচাই করা প্রশ্ন নেই",
                  )}
                  body={tx(
                    "IntelliHorizon is built for Classes 6–10. Checked questions exist so far for Class 7, Bangla Version. If that's your class, set it in your account.",
                    "ইন্টেলিহরাইজন ৬ষ্ঠ–১০ম শ্রেণির জন্য তৈরি। এখন পর্যন্ত যাচাই করা প্রশ্ন আছে ৭ম শ্রেণি, বাংলা ভার্সনের জন্য। এটি তোমার শ্রেণি হলে অ্যাকাউন্টে ঠিক করো।",
                  )}
                  action={
                    <LinkButton to="/account" variant="secondary">
                      {tx("Open account", "অ্যাকাউন্ট খোলো")}
                    </LinkButton>
                  }
                />
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {data.chapters.map((c) => {
                    const s = subjectById(c.subject_key);
                    return (
                      <li key={c.id}>
                        <Link
                          to="/practice/$chapterId"
                          params={{ chapterId: c.id }}
                          className="group flex h-full items-start gap-4 rounded-[20px] border border-line bg-sheet p-5 hover:border-brand"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform group-hover:scale-105">
                            <Icon name="play" size={20} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mid">
                              {s && <SubjectDot hue={s.hue} size={8} />}
                              {s ? t(s.label) : c.subject_name}
                            </span>
                            <span
                              className="mt-0.5 block font-display text-[19px] font-bold leading-tight"
                              lang={c.language}
                            >
                              {c.title}
                            </span>
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              <Badge>
                                {tx(
                                  `${c.questions} checked questions`,
                                  `${N(c.questions)}টি যাচাই করা প্রশ্ন`,
                                )}
                              </Badge>
                              {c.attempts > 0 && (
                                <Badge tone="mint">
                                  {tx(
                                    `${c.correct} of ${c.attempts} right so far`,
                                    `এ পর্যন্ত ${N(c.attempts)}টির ${N(c.correct)}টি সঠিক`,
                                  )}
                                </Badge>
                              )}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {lessonOnly.length > 0 && (
              <section aria-labelledby="les-h">
                <SectionTitle
                  id="les-h"
                  title={tx("Lesson and explain-it-back", "পাঠ ও নিজের ভাষায় বলা")}
                  sub={tx(
                    "These chapters have a checked lesson but no published questions yet.",
                    "এই অধ্যায়গুলোতে যাচাই করা পাঠ আছে, প্রকাশিত প্রশ্ন এখনো নেই।",
                  )}
                />
                <ul className="grid gap-3 md:grid-cols-2">
                  {lessonOnly.map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/practice/$chapterId"
                        params={{ chapterId: c.id }}
                        className="flex items-center gap-4 rounded-[20px] border border-line bg-sheet p-5 hover:border-brand"
                      >
                        <Icon name="pen" className="shrink-0 text-brand" />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-ink-mid" lang="bn">
                            {c.book}
                          </span>
                          <span className="block font-display text-[18px] font-bold" lang="bn">
                            {c.title}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-[15px] text-ink-mid">
              {tx("See the mistakes you repeat in ", "বারবার হওয়া ভুল দেখো ")}
              <Link to="/mistakes" className="font-semibold text-brand-deep hover:underline">
                {tx("Misconception Radar", "ভুল ধারণার রাডারে")}
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </Frame>
  );
}
