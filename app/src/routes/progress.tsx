import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import {
  Empty,
  LevelRing,
  LinkButton,
  Loading,
  PageTitle,
  Panel,
  SectionTitle,
  Stat,
} from "../components/universe/ui";
import { getProgression } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { LEVELS, XP_RULES } from "../lib/learning/rules";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/progress")({
  beforeLoad: () => requireAccount("/progress"),
  head: () => ({
    meta: [{ title: "Progress | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Progress,
});

type Data = Extract<Awaited<ReturnType<typeof getProgression>>, { ok: true }>;
function Progress() {
  const { tx, t, lang } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    void call(getProgression()).then((r) => r.ok && setD(r as Data));
  }, []);
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  const maxWeek = d ? Math.max(1, ...d.weekly.map((w) => w.attempts)) : 1;
  return (
    <Frame>
      <div className="space-y-8">
        <PageTitle
          icon="progress"
          title={tx("Progress", "অগ্রগতি")}
          sub={tx(
            "Everything here is counted from your own recorded answers, sessions and explanations.",
            "এখানের সবকিছু তোমার নিজের জমা উত্তর, সেশন ও ব্যাখ্যা থেকে গোনা।",
          )}
        />
        {!d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : (
          <>
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <Panel tone="lift" className="flex items-center gap-5 p-6">
                <LevelRing
                  level={d.level.level}
                  progress={d.level.progress}
                  size={96}
                  label={tx(`Level ${d.level.level}`, `লেভেল ${d.level.level}`)}
                />
                <div>
                  <p className="font-display text-[24px] font-bold">{t(d.level.name)}</p>
                  <p className="tnum text-[16px] text-ink-mid">{N(d.level.xp)} XP</p>
                  <p className="mt-1 text-[14px] text-ink-mid">
                    {d.level.next !== null
                      ? tx(
                          `${d.level.toNext} XP to ${t(LEVELS[d.level.level].name)}`,
                          `${t(LEVELS[d.level.level].name)} হতে ${bnDigits(d.level.toNext)} এক্সপি`,
                        )
                      : tx("You've reached the top level.", "সর্বোচ্চ লেভেলে পৌঁছেছ।")}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-amber">
                    <Icon name="sun" size={16} />
                    {tx(
                      `${d.streak.current}-day streak (best ${d.streak.best})`,
                      `${bnDigits(d.streak.current)} দিনের ধারা (সেরা ${bnDigits(d.streak.best)})`,
                    )}
                  </p>
                </div>
              </Panel>
              <Panel className="p-6">
                <SectionTitle
                  title={tx("Activity and what it shows", "কাজ আর তার প্রমাণ")}
                  sub={tx(
                    "Doing things and showing understanding are counted separately.",
                    "কাজ করা আর বোঝা দেখানো আলাদা করে গোনা হয়।",
                  )}
                />
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  <Stat value={N(d.stats.attempts)} label={tx("answers given", "উত্তর দিয়েছ")} />
                  <Stat
                    value={N(d.stats.sessionsCompleted)}
                    label={tx("sessions finished", "সেশন শেষ")}
                  />
                  <Stat
                    value={N(d.stats.correctQuestions)}
                    label={tx("different questions right", "ভিন্ন প্রশ্ন সঠিক")}
                  />
                  <Stat
                    value={N(d.stats.demonstratedChapters)}
                    label={tx("chapters demonstrated", "অধ্যায় প্রমাণিত")}
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-4 text-[15px] font-semibold">
                  <Link to="/mastery" className="text-brand-deep hover:underline">
                    {tx("Mastery evidence", "দক্ষতার প্রমাণ")}
                  </Link>
                  <Link to="/achievements" className="text-brand-deep hover:underline">
                    {tx("Achievements", "অর্জন")}
                  </Link>
                  <Link to="/mistakes" className="text-brand-deep hover:underline">
                    {tx("Misconception Radar", "ভুল ধারণার রাডার")}
                  </Link>
                </div>
              </Panel>
            </section>

            {d.stats.attempts === 0 ? (
              <Empty
                icon="progress"
                title={tx("Your progress starts with one answer", "একটি উত্তর দিয়েই অগ্রগতি শুরু")}
                body={tx(
                  "Nothing is filled in for you. Finish a Learning Session and this page comes to life.",
                  "তোমার হয়ে কিছুই পূরণ করা হয় না। একটি লার্নিং সেশন শেষ করলে এই পাতা জেগে উঠবে।",
                )}
                action={
                  <LinkButton to="/practice">{tx("Start a session", "সেশন শুরু করো")}</LinkButton>
                }
              />
            ) : (
              <section className="grid gap-5 lg:grid-cols-2">
                <Panel className="p-6">
                  <SectionTitle
                    title={tx("Answers per week", "সপ্তাহে উত্তর")}
                    sub={tx(
                      "The darker part of each bar is answers that were right.",
                      "প্রতিটি দণ্ডের গাঢ় অংশ সঠিক উত্তর।",
                    )}
                  />
                  <ul
                    className="flex h-44 items-end gap-2"
                    aria-label={tx(
                      "Answers per week, last 8 weeks",
                      "গত ৮ সপ্তাহে প্রতি সপ্তাহের উত্তর",
                    )}
                  >
                    {d.weekly.map((w) => (
                      <li
                        key={w.week}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                        aria-label={tx(
                          `Week ${w.week}: ${w.correct} of ${w.attempts} right`,
                          `সপ্তাহ ${w.week}: ${w.attempts}টির ${w.correct}টি সঠিক`,
                        )}
                      >
                        <div
                          className="flex w-full max-w-[38px] flex-col justify-end overflow-hidden rounded-t-[8px] bg-lilac-2"
                          style={{ height: `${(w.attempts / maxWeek) * 100}%` }}
                        >
                          <div
                            className="w-full bg-brand"
                            style={{
                              height: `${w.attempts ? (w.correct / w.attempts) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-ink-low">{w.week.slice(5)}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel className="p-6">
                  <SectionTitle
                    title={tx("Personal best", "ব্যক্তিগত সেরা")}
                    sub={tx(
                      "Questions you answered more than once: first try against latest try.",
                      "যে প্রশ্নের একাধিকবার উত্তর দিয়েছ: প্রথম চেষ্টা বনাম শেষ চেষ্টা।",
                    )}
                  />
                  {d.retake ? (
                    <div className="grid grid-cols-2 gap-5">
                      <Stat
                        value={`${N(d.retake.firstRight)}/${N(d.retake.questions)}`}
                        label={tx("right on first try", "প্রথম চেষ্টায় সঠিক")}
                      />
                      <Stat
                        value={`${N(d.retake.nowRight)}/${N(d.retake.questions)}`}
                        label={tx("right on latest try", "শেষ চেষ্টায় সঠিক")}
                      />
                    </div>
                  ) : (
                    <p className="text-[15px] text-ink-mid">
                      {tx(
                        "This appears once you've answered some questions twice, for example in revision.",
                        "কিছু প্রশ্নের দুবার উত্তর দিলে (যেমন পুনরালোচনায়) এটি দেখা যাবে।",
                      )}
                    </p>
                  )}
                  <div className="mt-8">
                    <SectionTitle title={tx("Recent XP", "সাম্প্রতিক এক্সপি")} />
                  </div>
                  <ul className="space-y-1.5 text-[14px]">
                    {d.ledger.slice(0, 8).map((x, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate text-ink-mid">
                          {t(
                            XP_RULES.find((r) => r.kind === x.kind)?.label ?? {
                              en: x.kind,
                              bn: x.kind,
                            },
                          )}
                          {x.chapter_title ? `: ${x.chapter_title}` : ""}
                        </span>
                        <span className="tnum shrink-0 font-semibold text-brand-deep">
                          +{N(x.xp)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </section>
            )}
          </>
        )}
      </div>
    </Frame>
  );
}
