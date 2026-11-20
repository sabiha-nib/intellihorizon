import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call, msg } from "../components/auth/messages";
import { JourneyList, MissionList } from "../components/universe/dash";
import { Frame } from "../components/universe/Shell";
import { JudgeWelcome } from "../components/app/JudgeWelcome";
import { Icon, SubjectDot } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import { MODULES } from "../components/universe/modules";
import {
  Badge,
  Button,
  Empty,
  LevelRing,
  LinkButton,
  Loading,
  Panel,
  ProgressBar,
  SectionTitle,
  Stat,
} from "../components/universe/ui";
import type { L } from "../content/types";
import { getDashboard, startLearningSession } from "../lib/api/universe.functions";
import { subjectById } from "../lib/curriculum/registry";
import { GOALS } from "../lib/auth/config";
import { requireAccount } from "../lib/guard";
import { ACHIEVEMENTS } from "../lib/learning/rules";
import { MISCONCEPTIONS } from "../lib/learning/lessons";
import { useLearner } from "../lib/store";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => requireAccount("/dashboard"),
  head: () => ({
    meta: [{ title: "Dashboard | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Dashboard,
});

type Data = Extract<Awaited<ReturnType<typeof getDashboard>>, { ok: true }>;

function greeting(tx: (en: string, bn: string) => string) {
  const h = new Date().getHours();
  return h < 12
    ? tx("Good morning", "শুভ সকাল")
    : h < 17
      ? tx("Good afternoon", "শুভ অপরাহ্ন")
      : tx("Good evening", "শুভ সন্ধ্যা");
}

function Dashboard() {
  const { tx, t, lang, account } = useLearner();
  const navigate = useNavigate();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    void call(getDashboard()).then((r) => (r.ok ? setD(r as Data) : setErr(r.code)));
  }, []);
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));

  if (err)
    return (
      <Frame>
        <Empty
          icon="home"
          title={tx("Your dashboard didn't load", "ড্যাশবোর্ড লোড হয়নি")}
          body={t(msg(err)!)}
          action={
            <Button onClick={() => location.reload()}>{tx("Try again", "আবার চেষ্টা করো")}</Button>
          }
        />
      </Frame>
    );
  if (!d)
    return (
      <Frame>
        <Loading label={tx("Loading your dashboard", "ড্যাশবোর্ড লোড হচ্ছে")} />
      </Frame>
    );

  const startSession = async (chapterId: string) => {
    setStarting(true);
    const r = await call(startLearningSession({ data: { chapterId } }));
    setStarting(false);
    if (r.ok)
      void navigate({
        to: "/practice/session/$sessionId",
        params: { sessionId: (r as { id: string }).id },
      });
    else setErr(r.code);
  };
  const r = d.resume;
  const rs = r ? subjectById(r.subject) : null;
  const goals = (account?.goals ?? []).map((id) => GOALS.find((x) => x.id === id)).filter(Boolean).map((x) => t(x!.label));
  const latest = d.achievements.latest
    ? ACHIEVEMENTS.find((a) => a.id === d.achievements.latest!.achievement_id)
    : null;

  return (
    <Frame>
      <div className="space-y-10">
        {account?.demo && <JudgeWelcome />}
        {/* A + B: welcome and continue learning */}
        <section
          aria-labelledby="hello-h"
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"
        >
          <div className="flex flex-col justify-between gap-6 rounded-[28px] bg-lilac p-6 md:p-7">
            <div>
              <p className="text-[15px] font-semibold text-ink-mid">{greeting(tx)}</p>
              <h1
                id="hello-h"
                className="mt-1 font-display text-[34px] font-extrabold leading-[1.05] tracking-tight md:text-[42px]"
              >
                {d.name || tx("Welcome back", "আবার স্বাগতম")}
              </h1>
              <p className="mt-2 text-[15px] text-ink-mid">
                {goals.length ? (
                  <>{tx("Your goal: ", "তোমার লক্ষ্য: ")}<strong className="text-ink">{goals.join(", ")}</strong></>
                ) : (
                  <Link to="/account" className="font-semibold text-brand-deep hover:underline">{tx("Set a learning goal", "একটি শেখার লক্ষ্য ঠিক করো")}</Link>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <LevelRing
                level={d.level.level}
                progress={d.level.progress}
                size={72}
                label={tx(
                  `Level ${d.level.level}, ${Math.round(d.level.progress * 100)}% of the way to the next`,
                  `লেভেল ${d.level.level}, পরের লেভেলের ${Math.round(d.level.progress * 100)}% পথে`,
                )}
              />
              <div className="min-w-0">
                <p className="font-display text-[19px] font-bold">
                  {t(d.level.name)}{" "}
                  <span className="tnum font-sans text-[15px] font-semibold text-ink-mid">
                    · {N(d.level.xp)} XP
                  </span>
                </p>
                <p className="text-[14px] text-ink-mid">
                  {d.level.next !== null
                    ? tx(
                        `${d.level.toNext} XP to level ${d.level.level + 1}`,
                        `লেভেল ${bnDigits(d.level.level + 1)}-এ যেতে ${bnDigits(d.level.toNext)} এক্সপি`,
                      )
                    : tx("Top level reached", "সর্বোচ্চ লেভেল")}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-amber">
                  <Icon name="sun" size={16} />
                  {d.streak.current > 0
                    ? tx(
                        `${d.streak.current} learning day${d.streak.current > 1 ? "s" : ""} in a row${d.streak.activeToday ? "" : ": learn today to keep it"}`,
                        `টানা ${bnDigits(d.streak.current)} দিন শেখা${d.streak.activeToday ? "" : ": ধরে রাখতে আজ শেখো"}`,
                      )
                    : tx(
                        "Answer a question today to start a streak",
                        "ধারা শুরু করতে আজ একটি প্রশ্নের উত্তর দাও",
                      )}
                </p>
              </div>
            </div>
          </div>

          <Panel
            tone="lift"
            className="relative overflow-hidden p-6 md:p-7"
            aria-labelledby="cont-h"
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-6 h-48 w-72 text-brand/15"
              viewBox="0 0 280 180"
            >
              <path
                d="M10 160 C 80 150, 90 40, 170 60 S 250 30, 270 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="7 7"
              />
              <circle cx="170" cy="60" r="7" fill="currentColor" />
              <circle cx="270" cy="10" r="5" fill="currentColor" />
            </svg>
            <p id="cont-h" className="text-[15px] font-semibold text-brand-deep">
              {r?.kind === "session"
                ? tx("Pick up your session", "সেশন চালিয়ে যাও")
                : r?.kind === "chapter"
                  ? tx("Continue learning", "শেখা চালিয়ে যাও")
                  : tx("Your first session", "তোমার প্রথম সেশন")}
            </p>
            {r ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {rs && (
                    <Badge tone="brand">
                      <SubjectDot hue={rs.hue} size={8} />
                      {t(rs.short)}
                    </Badge>
                  )}
                  <span className="text-[14px] text-ink-mid">{r.book}</span>
                </div>
                <h2
                  className="mt-2 max-w-[28ch] font-display text-[26px] font-bold leading-tight md:text-[30px]"
                  lang={r.subject.startsWith("english") ? "en" : "bn"}
                >
                  {r.title}
                </h2>
                <p className="mt-2 text-[15px] text-ink-mid">
                  {r.kind === "session"
                    ? tx(
                        `${r.detail.answered} of ${r.detail.total} questions answered.`,
                        `${bnDigits(r.detail.total ?? 0)}টির মধ্যে ${bnDigits(r.detail.answered ?? 0)}টির উত্তর দেওয়া হয়েছে।`,
                      )
                    : r.kind === "chapter"
                      ? r.detail.questions
                        ? tx(
                            `You opened this last. ${r.detail.questions} checked questions are ready.`,
                            `সবশেষে এটি খুলেছিলে। ${bnDigits(r.detail.questions)}টি যাচাই করা প্রশ্ন প্রস্তুত।`,
                          )
                        : tx(
                            "You opened this last. A short lesson and explain-it-back are ready.",
                            "সবশেষে এটি খুলেছিলে।",
                          )
                      : tx(
                          `This chapter has the most checked questions so far (${r.detail.questions}). A session takes about 10 minutes.`,
                          `এ পর্যন্ত এই অধ্যায়ে সবচেয়ে বেশি যাচাই করা প্রশ্ন (${bnDigits(r.detail.questions ?? 0)}টি)। একটি সেশনে প্রায় ১০ মিনিট লাগে।`,
                        )}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {r.kind === "session" ? (
                    <LinkButton
                      to="/practice/session/$sessionId"
                      params={{ sessionId: r.id }}
                      size="lg"
                      icon="play"
                    >
                      {tx("Resume session", "সেশন চালিয়ে যাও")}
                    </LinkButton>
                  ) : (
                    <Button
                      size="lg"
                      icon="play"
                      disabled={starting}
                      onClick={() => void startSession(r.id)}
                    >
                      {starting
                        ? tx("Starting…", "শুরু হচ্ছে…")
                        : tx("Start a Learning Session", "লার্নিং সেশন শুরু করো")}
                    </Button>
                  )}
                  {r.kind !== "session" && (
                    <LinkButton
                      to="/chapters/$chapterId"
                      params={{ chapterId: r.id }}
                      variant="secondary"
                    >
                      {tx("Open the chapter", "অধ্যায় খোলো")}
                    </LinkButton>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 font-display text-[26px] font-bold leading-tight">
                  {tx("Choose a subject to begin", "শুরু করতে একটি বিষয় বেছে নাও")}
                </h2>
                <p className="mt-2 text-[15px] text-ink-mid">
                  {d.offering
                    ? tx("Your books are listed below.", "তোমার বইগুলো নিচে আছে।")
                    : tx(
                        "IntelliHorizon is built for Classes 6–10, Bangla Version and English Version. Textbooks for your class and version haven't been imported yet; today the content is Class 7, Bangla Version. You can change your class or version any time.",
                        "ইন্টেলিহরাইজন ৬ষ্ঠ–১০ম শ্রেণি, বাংলা ভার্সন ও ইংলিশ ভার্সনের জন্য তৈরি। তোমার শ্রেণি ও ভার্সনের পাঠ্যবই এখনো আমদানি হয়নি; আজ বিষয়বস্তু আছে ৭ম শ্রেণি, বাংলা ভার্সনের। যেকোনো সময় শ্রেণি বা ভার্সন বদলাতে পারো।",
                      )}
                </p>
                <div className="mt-5">
                  <LinkButton to="/learn" size="lg">
                    {tx("Explore subjects", "বিষয়গুলো দেখো")}
                  </LinkButton>
                </div>
              </>
            )}
          </Panel>
        </section>

        {/* C: today's journey + missions */}
        <section
          aria-labelledby="journey-h"
          id="journey"
          className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        >
          <Panel className="p-6">
            <SectionTitle
              id="journey-h"
              title={tx("Today's learning journey", "আজকের শেখার যাত্রা")}
              sub={tx(
                "Each step ticks itself off when you actually do it.",
                "সত্যি কাজটি করলে প্রতিটি ধাপে নিজে থেকেই টিক পড়ে।",
              )}
              action={
                <span className="tnum text-[14px] font-semibold text-ink-mid">
                  {tx(
                    `${d.plan.filter((x) => x.status === "done").length} of ${d.plan.length} done`,
                    `${bnDigits(d.plan.length)}টির ${bnDigits(d.plan.filter((x) => x.status === "done").length)}টি হয়েছে`,
                  )}
                </span>
              }
            />
            {d.plan.length ? (
              <JourneyList tasks={d.plan} />
            ) : (
              <p className="text-[15px] text-ink-mid">
                {tx(
                  "Your plan fills in once you've opened a chapter or answered a question.",
                  "একটি অধ্যায় খুললে বা প্রশ্নের উত্তর দিলে পরিকল্পনা তৈরি হবে।",
                )}
              </p>
            )}
          </Panel>
          <Panel className="p-6" aria-labelledby="mis-h">
            <SectionTitle
              id="mis-h"
              title={tx("Missions", "মিশন")}
              action={
                <Link
                  to="/missions"
                  className="text-[14px] font-semibold text-brand-deep hover:underline"
                >
                  {tx("All missions", "সব মিশন")}
                </Link>
              }
            />
            <MissionList missions={d.missions} />
            <p className="mt-4 text-[13px] text-ink-low">
              {tx(
                `Today: ${d.today.answered} answers, ${d.today.xpToday} XP. Daily goal: ${d.goal} questions (change it in Settings).`,
                `আজ: ${bnDigits(d.today.answered)}টি উত্তর, ${bnDigits(d.today.xpToday)} এক্সপি। দৈনিক লক্ষ্য: ${bnDigits(d.goal)}টি প্রশ্ন (সেটিংসে বদলাও)।`,
              )}
            </p>
          </Panel>
        </section>

        {/* Tutor, knowledge map and Horizon Path */}
        <section aria-label={tx("Tutor and your map", "টিউটর ও তোমার মানচিত্র")} className="grid gap-5 lg:grid-cols-3">
          <Link to="/tutor" className="group flex flex-col gap-2 rounded-[24px] border border-line bg-sheet p-6 hover:border-brand">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand-soft text-brand"><Icon name="tutor" /></span>
            <span className="font-display text-[20px] font-bold">{tx("Ask the AI Tutor", "এআই টিউটরকে জিজ্ঞেস করো")}</span>
            <span className="text-[15px] text-ink-mid">{tx("Five teaching approaches, one rule: answers come from checked pages of your book, or it tells you it can't find one.", "পাঁচ রকম শেখানোর ধরন, একটিই নিয়ম: উত্তর আসে বইয়ের যাচাই করা পাতা থেকে, না পেলে সেটাই জানায়।")}</span>
          </Link>
          <Link to="/knowledge-map" className="group flex flex-col gap-2 rounded-[24px] border border-line bg-sheet p-6 hover:border-brand">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand-soft text-brand"><Icon name="map" /></span>
            <span className="font-display text-[20px] font-bold">{tx("Knowledge Map", "জ্ঞান মানচিত্র")}</span>
            <span className="flex flex-wrap gap-1.5">
              <Badge tone="brand">{tx(`${d.progress.mastery.practising} practising`, `${bnDigits(d.progress.mastery.practising)}টি অনুশীলনে`)}</Badge>
              <Badge tone="amber">{tx(`${d.progress.mastery.developing} developing`, `${bnDigits(d.progress.mastery.developing)}টি এগোচ্ছে`)}</Badge>
              <Badge tone="mint">{tx(`${d.progress.mastery.demonstrated} demonstrated`, `${bnDigits(d.progress.mastery.demonstrated)}টি প্রমাণিত`)}</Badge>
            </span>
            <span className="text-[15px] text-ink-mid">{tx("Every chapter, coloured only by what your answers show.", "প্রতিটি অধ্যায়, শুধু তোমার উত্তরের প্রমাণ অনুযায়ী রঙে।")}</span>
          </Link>
          <Link to="/path" className="group flex flex-col gap-2 rounded-[24px] border border-line bg-sheet p-6 hover:border-brand">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand-soft text-brand"><Icon name="missions" /></span>
            <span className="font-display text-[20px] font-bold">{tx("Horizon Path", "হরাইজন পথ")}</span>
            <span className="text-[15px] text-ink-mid">{tx("Sessions you've finished, where you are now, and your next stops with the reason for each.", "শেষ করা সেশন, এখন কোথায় আছ, আর পরের ধাপগুলো কারণসহ।")}</span>
          </Link>
        </section>

        {/* D: subjects */}
        <section aria-labelledby="subj-h">
          <SectionTitle
            id="subj-h"
            title={tx("Your eight subjects", "তোমার আটটি বিষয়")}
            action={
              <Link
                to="/learn"
                className="text-[14px] font-semibold text-brand-deep hover:underline"
              >
                {tx("Learning paths", "শেখার পথ")}
              </Link>
            }
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.subjects.map((s) => (
              <li key={s.id}>
                <Link
                  to="/subjects/$subjectId"
                  params={{ subjectId: s.id }}
                  className="group flex h-full flex-col rounded-[20px] border border-line bg-sheet p-4 transition-colors hover:border-brand"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-[12px]"
                      style={{ background: `${s.hue}1f`, color: s.hue }}
                    >
                      <Icon name="book" size={20} />
                    </span>
                    <span className="min-w-0 font-display text-[17px] font-bold leading-tight">
                      {t(s.label)}
                    </span>
                  </span>
                  <span className="mt-3 text-[14px] text-ink-mid">
                    {s.attempts
                      ? tx(
                          `${s.correct} of ${s.attempts} answers right`,
                          `${bnDigits(s.attempts)}টি উত্তরের ${bnDigits(s.correct)}টি সঠিক`,
                        )
                      : s.questions
                        ? tx(
                            `${s.questions} checked questions to try`,
                            `${bnDigits(s.questions)}টি যাচাই করা প্রশ্ন`,
                          )
                        : s.books
                          ? tx(
                              "Reading and tutor; practice questions coming",
                              "পড়া ও টিউটর; প্রশ্ন আসছে",
                            )
                          : tx("No book for your version yet", "তোমার ভার্সনের বই এখনো নেই")}
                  </span>
                  {s.lastChapter && (
                    <span className="mt-1 line-clamp-1 text-[13px] text-ink-low">
                      {tx("Last: ", "সবশেষ: ")}
                      {s.lastChapter}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* E + G: progress and insights */}
        <section className="grid gap-5 lg:grid-cols-2">
          <Panel className="p-6" aria-labelledby="prog-h">
            <SectionTitle
              id="prog-h"
              title={tx("Your progress", "তোমার অগ্রগতি")}
              action={
                <Link
                  to="/progress"
                  className="text-[14px] font-semibold text-brand-deep hover:underline"
                >
                  {tx("Details", "বিস্তারিত")}
                </Link>
              }
            />
            <p className="text-[14px] font-semibold text-ink-mid">
              {tx("What you've done", "তুমি যা করেছ")}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-4">
              <Stat value={N(d.progress.attempts)} label={tx("answers", "উত্তর")} />
              <Stat value={N(d.progress.sessions)} label={tx("sessions", "সেশন")} />
              <Stat value={N(d.progress.learningDays)} label={tx("learning days", "শেখার দিন")} />
            </div>
            <p className="mt-6 text-[14px] font-semibold text-ink-mid">
              {tx("What your answers show", "তোমার উত্তর যা দেখায়")}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-4">
              <Stat
                value={N(d.progress.correctQuestions)}
                label={tx("questions right", "প্রশ্ন সঠিক")}
              />
              <Stat
                value={N(d.progress.mastery.developing)}
                label={tx("chapters developing", "অধ্যায় এগোচ্ছে")}
              />
              <Stat
                value={N(d.progress.mastery.demonstrated)}
                label={tx("chapters demonstrated", "অধ্যায় প্রমাণিত")}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LinkButton
                to="/revision"
                variant={d.progress.due ? "primary" : "secondary"}
                size="sm"
                icon="revision"
              >
                {d.progress.due
                  ? tx(`Revise ${d.progress.due} due`, `${bnDigits(d.progress.due)}টি পুনরালোচনা`)
                  : tx("Revision queue", "পুনরালোচনা")}
              </LinkButton>
              <Link
                to="/mastery"
                className="text-[14px] font-semibold text-brand-deep hover:underline"
              >
                {tx("How mastery is judged", "দক্ষতা কীভাবে বিচার হয়")}
              </Link>
            </div>
          </Panel>
          <Panel className="p-6" aria-labelledby="ins-h">
            <SectionTitle
              id="ins-h"
              title={tx("Insights for you", "তোমার জন্য পরামর্শ")}
              sub={tx("Each one says why it's here.", "প্রতিটি জানায় কেন এসেছে।")}
            />
            {d.insights.length ? (
              <ul className="space-y-3">
                {d.insights.map((x) => (
                  <Insight key={x.id} x={x} />
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-ink-mid">
                {tx(
                  "Insights appear after a few answers. Nothing is guessed before then.",
                  "কয়েকটি উত্তরের পর পরামর্শ দেখা যাবে। তার আগে কিছুই অনুমান করা হয় না।",
                )}
              </p>
            )}
          </Panel>
        </section>

        {/* F: universe */}
        <section aria-labelledby="uni-h">
          <SectionTitle id="uni-h" title={tx("Your learning universe", "তোমার শেখার জগৎ")} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {MODULES.filter((m) =>
              ["path", "mastery", "missions", "achievements", "revision", "mistakes"].includes(m.id),
            ).map((m) => (
              <li key={m.id}>
                <Link
                  to={m.to as "/"}
                  className="flex h-full flex-col gap-2 rounded-[18px] border border-line bg-sheet p-4 hover:border-brand"
                >
                  <Icon name={m.icon} className="text-brand" />
                  <span className="text-[15px] font-semibold leading-tight">{t(m.label)}</span>
                  <span className="text-[13px] leading-snug text-ink-mid">
                    {m.id === "achievements"
                      ? tx(
                          `${d.achievements.earned} of ${d.achievements.total} earned`,
                          `${bnDigits(d.achievements.total)}টির ${bnDigits(d.achievements.earned)}টি পেয়েছ`,
                        )
                      : t(m.blurb)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {latest && (
            <p className="mt-3 flex items-center gap-2 text-[14px] text-ink-mid">
              <Icon name="achievements" size={16} className="text-amber" />
              {tx("Latest achievement: ", "সর্বশেষ অর্জন: ")}
              <strong className="text-ink">{t(latest.title)}</strong>
            </p>
          )}
        </section>

        {/* H: recent */}
        <section aria-labelledby="rec-h">
          <SectionTitle
            id="rec-h"
            title={tx("Recent activity", "সাম্প্রতিক কাজ")}
            action={
              <Link
                to="/history"
                className="text-[14px] font-semibold text-brand-deep hover:underline"
              >
                {tx("Learning history", "শেখার ইতিহাস")}
              </Link>
            }
          />
          {d.recent.length ? (
            <ul className="divide-y divide-line rounded-[20px] border border-line bg-sheet">
              {d.recent.map((x) => (
                <RecentRow key={`${x.kind}-${x.id}`} x={x} />
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-ink-mid">
              {tx(
                "Chapters you open, sessions, tutor questions and saved notes will show up here.",
                "খোলা অধ্যায়, সেশন, টিউটরের প্রশ্ন ও সংরক্ষিত নোট এখানে দেখা যাবে।",
              )}
            </p>
          )}
        </section>
      </div>
    </Frame>
  );
}

function Insight({ x }: { x: Data["insights"][number] }) {
  const { tx, t } = useLearner();
  const box = "flex gap-3 rounded-[16px] bg-lilac p-4";
  if (x.kind === "due")
    return (
      <li className={box}>
        <Icon name="revision" className="shrink-0 text-brand" />
        <div>
          <p className="font-semibold">
            {tx(
              `${x.n} question${x.n > 1 ? "s are" : " is"} due for revision`,
              `${bnDigits(x.n)}টি প্রশ্ন পুনরালোচনার সময় হয়েছে`,
            )}
          </p>
          <p className="text-[14px] text-ink-mid">
            {tx(
              "Why: you answered them a while ago, and revising at the right time helps you keep them.",
              "কেন: কিছুদিন আগে উত্তর দিয়েছিলে, সঠিক সময়ে পুনরালোচনা মনে রাখতে সাহায্য করে।",
            )}
          </p>
          <Link
            to="/revision"
            className="text-[14px] font-semibold text-brand-deep hover:underline"
          >
            {tx("Start revising", "পুনরালোচনা শুরু করো")}
          </Link>
        </div>
      </li>
    );
  if (x.kind === "weak")
    return (
      <li className={box}>
        <Icon name="practice" className="shrink-0 text-pink" />
        <div>
          <p className="font-semibold">
            {tx(`Practise "${x.title}" again`, `"${x.title}" আবার অনুশীলন করো`)}
          </p>
          <p className="text-[14px] text-ink-mid">
            {tx(
              `Why: ${x.n} of your last ${x.m} answers there were right.`,
              `কেন: সেখানে শেষ ${bnDigits(x.m)}টি উত্তরের ${bnDigits(x.n)}টি সঠিক ছিল।`,
            )}
          </p>
          {x.chapterId && (
            <Link
              to="/chapters/$chapterId"
              params={{ chapterId: x.chapterId }}
              className="text-[14px] font-semibold text-brand-deep hover:underline"
            >
              {tx("Open the chapter", "অধ্যায় খোলো")}
            </Link>
          )}
        </div>
      </li>
    );
  if (x.kind === "pattern") {
    const m: L | undefined = x.tag ? MISCONCEPTIONS[x.tag] : undefined;
    return (
      <li className={box}>
        <Icon name="radar" className="shrink-0 text-again" />
        <div>
          <p className="font-semibold">{tx("A repeated mistake", "একটি বারবার হওয়া ভুল")}</p>
          <p className="text-[14px] text-ink-mid">
            {tx(
              `Why: on ${x.n} different questions, your answer suggests: `,
              `কেন: ${bnDigits(x.n)}টি ভিন্ন প্রশ্নে তোমার উত্তর ইঙ্গিত দেয়: `,
            )}
            {m ? t(m) : ""}
          </p>
          <Link
            to="/mistakes"
            className="text-[14px] font-semibold text-brand-deep hover:underline"
          >
            {tx("Open Misconception Radar", "ভুল ধারণার রাডার খোলো")}
          </Link>
        </div>
      </li>
    );
  }
  if (x.kind === "improving")
    return (
      <li className={box}>
        <Icon name="check" className="shrink-0 text-mint" />
        <div>
          <p className="font-semibold">
            {tx(
              `You've fixed ${x.n} earlier mistake${x.n > 1 ? "s" : ""}`,
              `আগের ${bnDigits(x.n)}টি ভুল শুধরেছ`,
            )}
          </p>
          <p className="text-[14px] text-ink-mid">
            {tx(
              "Why: these questions were wrong before and right on a later try.",
              "কেন: এই প্রশ্নগুলো আগে ভুল ছিল, পরে সঠিক হয়েছে।",
            )}
          </p>
        </div>
      </li>
    );
  return (
    <li className={box}>
      <Icon name="spark" className="shrink-0 text-brand" />
      <div>
        <p className="font-semibold">
          {tx(`A good place to start: "${x.title}"`, `শুরুর ভালো জায়গা: "${x.title}"`)}
        </p>
        <p className="text-[14px] text-ink-mid">
          {tx(
            `Why: it has ${x.n} checked questions, more than any other chapter right now.`,
            `কেন: এতে ${bnDigits(x.n)}টি যাচাই করা প্রশ্ন আছে, এখন যেকোনো অধ্যায়ের চেয়ে বেশি।`,
          )}
        </p>
      </div>
    </li>
  );
}

function RecentRow({ x }: { x: Data["recent"][number] }) {
  const { tx, lang } = useLearner();
  const icon =
    x.kind === "session"
      ? "practice"
      : x.kind === "tutor"
        ? "tutor"
        : x.kind === "saved"
          ? "saved"
          : "book";
  const label =
    x.kind === "session"
      ? tx("Learning Session", "লার্নিং সেশন")
      : x.kind === "tutor"
        ? tx("Tutor conversation", "টিউটরের সঙ্গে কথা")
        : x.kind === "saved"
          ? tx("Saved note", "সংরক্ষিত নোট")
          : tx("Chapter opened", "অধ্যায় খোলা");
  const to =
    x.kind === "session"
      ? { to: "/practice/session/$sessionId", params: { sessionId: x.id } }
      : x.kind === "tutor"
        ? { to: "/tutor/$threadId", params: { threadId: x.id } }
        : x.kind === "saved"
          ? { to: "/saved" }
          : { to: "/chapters/$chapterId", params: { chapterId: x.id } };
  return (
    <li>
      <Link
        to={to.to as "/"}
        params={("params" in to ? to.params : undefined) as never}
        className="flex items-center gap-3 px-4 py-3 hover:bg-lilac"
      >
        <Icon name={icon} size={20} className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{x.title ?? label}</span>
          <span className="text-[13px] text-ink-mid">{label}</span>
        </span>
        <time className="shrink-0 text-[13px] text-ink-low" dateTime={x.at}>
          {new Date(x.at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
            day: "numeric",
            month: "short",
          })}
        </time>
      </Link>
    </li>
  );
}
