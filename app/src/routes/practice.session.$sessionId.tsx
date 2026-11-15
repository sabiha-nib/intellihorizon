import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { call, msg } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon } from "../components/universe/icons";
import {
  AchievementNote,
  ContinuedRatioLab,
  ExplainBack,
  LessonSteps,
  QuestionPlayer,
  StageTrail,
  bnDigits,
  type Answered,
  type Stage,
} from "../components/universe/learning";
import {
  Badge,
  Button,
  Empty,
  LevelRing,
  LinkButton,
  Loading,
  Panel,
} from "../components/universe/ui";
import {
  completeLearningSession,
  getLearningSession,
  type SessionQuestion,
} from "../lib/api/universe.functions";
import { subjectById } from "../lib/curriculum/registry";
import { requireAccount } from "../lib/guard";
import { MISCONCEPTIONS } from "../lib/learning/lessons";
import { PRACTICE_LEVEL } from "../lib/learning/rules";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/practice/session/$sessionId")({
  beforeLoad: ({ params }) => requireAccount(`/practice/session/${params.sessionId}`),
  head: () => ({
    meta: [{ title: "Learning Session | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: SessionPage,
});

type Data = Extract<Awaited<ReturnType<typeof getLearningSession>>, { ok: true }>;
type Summary = Extract<Awaited<ReturnType<typeof completeLearningSession>>, { ok: true }>;
type Outcome = { q: SessionQuestion; res: Answered | null; queued: boolean };

function SessionPage() {
  const { sessionId } = Route.useParams();
  const { tx, t, refresh } = useLearner();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("discover");
  const [i, setI] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [retryIdx, setRetryIdx] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    void call(getLearningSession({ data: { id: sessionId } })).then((r) => {
      if (!r.ok) return setErr(r.code);
      const d = r as Data;
      setData(d);
      if (d.session.status === "completed") void finish(true);
    });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const missed = useMemo(
    () => outcomes.filter((o) => o.res && !o.res.correct).map((o) => o.q),
    [outcomes],
  );

  const finish = async (already = false) => {
    setFinishing(true);
    const r = await call(completeLearningSession({ data: { id: sessionId } }));
    setFinishing(false);
    if (!r.ok) return setErr(r.code);
    setSummary(r as Summary);
    setStage("celebrate");
    if (!already) void refresh();
  };

  if (err)
    return (
      <Frame>
        <div className="mx-auto max-w-2xl">
          <Empty
            icon="practice"
            title={
              err === "not_found"
                ? tx("This session isn't available", "এই সেশন পাওয়া যাচ্ছে না")
                : tx("The session couldn't load", "সেশন লোড হয়নি")
            }
            body={
              err === "not_found"
                ? tx(
                    "It may belong to another account, or the link is wrong.",
                    "হয়তো এটি অন্য অ্যাকাউন্টের, বা লিংকটি ভুল।",
                  )
                : t(msg(err)!)
            }
            action={<LinkButton to="/practice">{tx("Go to Practice", "অনুশীলনে যাও")}</LinkButton>}
          />
        </div>
      </Frame>
    );
  if (!data)
    return (
      <Frame>
        <div className="mx-auto max-w-3xl">
          <Loading label={tx("Loading your session", "সেশন লোড হচ্ছে")} />
        </div>
      </Frame>
    );

  const subj = subjectById(data.chapter.subject);
  const qs = data.questions;
  const lesson = data.lesson;
  const counts = {
    due: qs.filter((q) => q.why === "due").length,
    missed: qs.filter((q) => q.why === "missed").length,
    fresh: qs.filter((q) => q.why === "new").length,
  };
  const next = () => {
    const order: Stage[] = ["discover", "understand", "try", "improve", "remember"];
    const at = order.indexOf(stage);
    let s = order[at + 1];
    if (s === "try" && !qs.length) s = "remember";
    if (s === "improve" && !missed.length && !outcomes.some((o) => o.queued)) s = "remember";
    if (!s) return void finish();
    setStage(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/chapters/$chapterId"
            params={{ chapterId: data.chapter.id }}
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-mid hover:text-ink"
          >
            <Icon name="back" size={18} />
            {tx("Chapter", "অধ্যায়")}
          </Link>
          <span className="text-[14px] text-ink-mid">{tx("Learning Session", "লার্নিং সেশন")}</span>
        </div>
        <StageTrail stage={summary ? "continue" : stage} />

        {stage === "discover" && (
          <Panel tone="lift" className="edu-rise p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              {subj && <Badge tone="brand">{t(subj.label)}</Badge>}
              <span className="text-[14px] text-ink-mid" lang={data.chapter.language}>
                {data.chapter.bookTitle}
              </span>
            </div>
            <h1
              className="mt-3 font-display text-[30px] font-bold leading-tight tracking-tight md:text-[36px]"
              lang={data.chapter.language}
            >
              {data.chapter.title}
            </h1>
            <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ink-mid">
              {qs.length
                ? tx(
                    `About 10 minutes: a short idea, ${qs.length} checked question${qs.length > 1 ? "s" : ""}, a fix-up round for anything you miss, then a recap.`,
                    `প্রায় ১০ মিনিট: একটি ছোট ধারণা, ${bnDigits(qs.length)}টি যাচাই করা প্রশ্ন, ভুলগুলো শোধরানোর পালা, তারপর সারসংক্ষেপ।`,
                  )
                : tx(
                    "This chapter has no checked practice questions yet, so this session is a short lesson and a chance to explain it in your own words.",
                    "এই অধ্যায়ে এখনো যাচাই করা প্রশ্ন নেই, তাই এই সেশনে একটি ছোট পাঠ আর নিজের ভাষায় বলার সুযোগ থাকবে।",
                  )}
            </p>
            {qs.length > 0 && (
              <p className="mt-3 text-[15px] text-ink-mid">
                {tx("Chosen for you: ", "তোমার জন্য বাছাই: ")}
                {[
                  counts.due &&
                    tx(`${counts.due} due for revision`, `${bnDigits(counts.due)}টি পুনরালোচনার`),
                  counts.missed &&
                    tx(
                      `${counts.missed} you missed before`,
                      `${bnDigits(counts.missed)}টি আগে ভুল হয়েছিল`,
                    ),
                  counts.fresh && tx(`${counts.fresh} new`, `${bnDigits(counts.fresh)}টি নতুন`),
                ]
                  .filter(Boolean)
                  .join(", ")}
                .
              </p>
            )}
            {qs.length > 0 && data.session.level && (
              <p className="mt-2 text-[15px] text-ink-mid">
                <strong className="text-ink">{tx("Practice level: ", "অনুশীলনের স্তর: ")}{t(PRACTICE_LEVEL[data.session.level].label)}.</strong>{" "}
                {data.session.levelBasis && data.session.levelBasis.of >= 3
                  ? tx(`Because ${data.session.levelBasis.right} of your last ${data.session.levelBasis.of} answers in this chapter were right.`, `কারণ এই অধ্যায়ে তোমার শেষ ${bnDigits(data.session.levelBasis.of)}টি উত্তরের ${bnDigits(data.session.levelBasis.right)}টি সঠিক ছিল।`)
                  : tx("Because you have fewer than 3 answers in this chapter so far.", "কারণ এই অধ্যায়ে এখনো তোমার ৩টির কম উত্তর আছে।")}
              </p>
            )}
            {data.objectives.length > 0 && (
              <div className="mt-6 rounded-[18px] bg-lilac p-4">
                <p className="text-[14px] font-semibold text-ink-mid">
                  {tx(
                    "What this chapter aims for (from the book's learning outcomes)",
                    "এই অধ্যায়ের লক্ষ্য (বইয়ের শিখনফল থেকে)",
                  )}
                </p>
                <ul className="mt-2 space-y-1.5" lang={data.chapter.language}>
                  {data.objectives.slice(0, 4).map((o) => (
                    <li key={o.id} className="flex gap-2 text-[16px]">
                      <Icon name="check" size={18} className="mt-1 shrink-0 text-brand" />
                      {o.text}
                    </li>
                  ))}
                </ul>
                {data.objectives[0]?.printedPage && (
                  <p className="mt-2 text-[13px] text-ink-low">
                    {tx(
                      `Printed on page ${data.objectives[0].printedPage} of your book.`,
                      `তোমার বইয়ের ${bnDigits(data.objectives[0].printedPage)} পৃষ্ঠায় ছাপা।`,
                    )}
                  </p>
                )}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={next} icon="play">
                {tx("Start the session", "সেশন শুরু করো")}
              </Button>
            </div>
          </Panel>
        )}

        {stage === "understand" && (
          <section aria-labelledby="und-h" className="edu-rise space-y-5">
            <h1 id="und-h" className="font-display text-[28px] font-bold leading-tight">
              {tx("Understand the idea", "ধারণাটি বোঝো")}
            </h1>
            {lesson ? (
              <>
                <LessonSteps steps={lesson.steps} pages={lesson.pages} onFinished={next} />
                {lesson.interactive === "continued-ratio" && <ContinuedRatioLab />}
              </>
            ) : (
              <Panel className="space-y-4 p-6">
                <p className="text-[17px] leading-relaxed">
                  {data.chapter.printedPages
                    ? tx(
                        `Read pages ${data.chapter.printedPages[0]} to ${data.chapter.printedPages[1]} in your textbook first.`,
                        `আগে তোমার পাঠ্যবইয়ের ${bnDigits(data.chapter.printedPages[0])} থেকে ${bnDigits(data.chapter.printedPages[1])} পৃষ্ঠা পড়ো।`,
                      )
                    : tx(
                        "Read this chapter in your textbook first.",
                        "আগে পাঠ্যবইয়ে অধ্যায়টি পড়ো।",
                      )}
                </p>
                <p className="text-[15px] text-ink-mid">
                  {tx(
                    "IntelliHorizon hasn't written a checked explanation for this chapter yet, so it won't make one up.",
                    "এই অধ্যায়ের জন্য ইন্টেলিহরাইজন এখনো যাচাই করা ব্যাখ্যা লেখেনি, তাই বানিয়ে কিছু বলবে না।",
                  )}
                </p>
                <div className="flex flex-wrap gap-3">
                  {data.chapter.bookReady && (
                    <LinkButton
                      to="/tutor"
                      search={{ book: data.chapter.textbookId, chapter: data.chapter.id }}
                      variant="secondary"
                      icon="tutor"
                    >
                      {tx("Ask the tutor about it", "টিউটরকে জিজ্ঞেস করো")}
                    </LinkButton>
                  )}
                  <Button onClick={next} icon="arrow">
                    {qs.length
                      ? tx("I've read it, let me try", "পড়েছি, চেষ্টা করি")
                      : tx("Continue", "এগিয়ে চলো")}
                  </Button>
                </div>
              </Panel>
            )}
          </section>
        )}

        {stage === "try" && qs[i] && (
          <QuestionPlayer
            q={qs[i]}
            index={i}
            total={qs.length}
            sessionId={sessionId}
            onDone={(r) => {
              setOutcomes((o) => [
                ...o,
                { q: qs[i], res: r && "duplicate" in r ? r : null, queued: !!r && "queued" in r },
              ]);
              if (i + 1 < qs.length) {
                setI(i + 1);
                window.scrollTo({ top: 0 });
              } else next();
            }}
          />
        )}

        {stage === "improve" && (
          <section aria-labelledby="imp-h" className="edu-rise space-y-4">
            <h1 id="imp-h" className="font-display text-[28px] font-bold leading-tight">
              {tx("Fix what slipped", "যা ভুল হলো তা শোধরাও")}
            </h1>
            <p className="text-[16px] text-ink-mid">
              {tx(
                "Look at each one again. In the next step you'll get one more try at them.",
                "প্রতিটি আবার দেখো। পরের ধাপে আরেকবার চেষ্টার সুযোগ পাবে।",
              )}
            </p>
            {outcomes
              .filter((o) => o.res && !o.res.correct)
              .map((o) => (
                <Panel key={o.q.id} className="space-y-2 p-5">
                  <p className="whitespace-pre-line text-[16px] font-semibold" lang={o.q.language}>
                    {o.q.prompt}
                  </p>
                  <p className="text-[16px]" lang={o.q.language}>
                    {tx("Answer: ", "উত্তর: ")}
                    <strong className="math">{o.res!.correctAnswer}</strong>
                  </p>
                  {o.res!.misconception && MISCONCEPTIONS[o.res!.misconception] && (
                    <p className="text-[15px] text-again">
                      {tx("Watch out: ", "সাবধান: ")}
                      {t(MISCONCEPTIONS[o.res!.misconception])}
                    </p>
                  )}
                  {o.res!.explanation && (
                    <p
                      className="whitespace-pre-line text-[15px] leading-relaxed text-ink-mid"
                      lang={o.q.language}
                    >
                      {o.res!.explanation}
                    </p>
                  )}
                </Panel>
              ))}
            {outcomes.some((o) => o.queued) && (
              <p className="rounded-[14px] bg-amber-soft p-3 text-[15px]">
                {tx(
                  "Some answers were saved offline and will be checked when you reconnect.",
                  "কিছু উত্তর অফলাইনে জমা আছে, সংযোগ ফিরলে যাচাই হবে।",
                )}
              </p>
            )}
            <Button onClick={next} icon="arrow">
              {tx("Try them again", "আবার চেষ্টা করো")}
            </Button>
          </section>
        )}

        {stage === "remember" && (
          <section aria-labelledby="rem-h" className="edu-rise space-y-5">
            <h1 id="rem-h" className="font-display text-[28px] font-bold leading-tight">
              {tx("Remember it", "মনে রাখো")}
            </h1>
            {missed.length > 0 && retryIdx < missed.length ? (
              <QuestionPlayer
                q={missed[retryIdx]}
                index={retryIdx}
                total={missed.length}
                sessionId={sessionId}
                onDone={() => setRetryIdx(retryIdx + 1)}
              />
            ) : (
              <>
                {lesson && (
                  <Panel tone="lilac" className="p-5">
                    <p className="text-[14px] font-semibold text-ink-mid">
                      {tx("Recap", "সারসংক্ষেপ")}
                    </p>
                    <p className="mt-1 text-[18px] font-semibold leading-relaxed">
                      {t(lesson.recap)}
                    </p>
                  </Panel>
                )}
                {lesson && <ExplainBack chapterId={data.chapter.id} sessionId={sessionId} />}
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={() => void finish()}
                    disabled={finishing}
                    icon="achievements"
                  >
                    {finishing
                      ? tx("Saving…", "জমা হচ্ছে…")
                      : tx("Finish the session", "সেশন শেষ করো")}
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {(stage === "celebrate" || stage === "continue") && summary && (
          <Celebrate
            s={summary}
            chapterTitle={data.chapter.title}
            language={data.chapter.language}
            onAgain={() => navigate({ to: "/practice" })}
          />
        )}
      </div>
    </Frame>
  );
}

function Celebrate({
  s,
  chapterTitle,
  language,
}: {
  s: Summary;
  chapterTitle: string;
  language: string;
  onAgain: () => void;
}) {
  const { tx, t } = useLearner();
  const up = s.xp.levelAfter > s.xp.levelBefore;
  const nx = s.next;
  const nextLink =
    nx.kind === "revise"
      ? {
          to: "/revision",
          label: tx(
            `Revise ${nx.n} due question${nx.n > 1 ? "s" : ""}`,
            `${bnDigits(nx.n)}টি পুনরালোচনা করো`,
          ),
          why: tx(
            "They're due today on your revision schedule.",
            "তোমার পুনরালোচনার সময়সূচিতে এগুলো আজ।",
          ),
        }
      : nx.kind === "retry"
        ? {
            to: "/chapters/$chapterId",
            params: { chapterId: nx.chapterId! },
            label: tx("Practise this chapter again", "এই অধ্যায় আবার অনুশীলন করো"),
            why: tx(
              `${nx.n} question${nx.n > 1 ? "s" : ""} still need work.`,
              `${bnDigits(nx.n)}টি প্রশ্নে আরও কাজ দরকার।`,
            ),
          }
        : nx.kind === "continue"
          ? {
              to: "/chapters/$chapterId",
              params: { chapterId: nx.chapterId! },
              label: tx("Keep going in this chapter", "এই অধ্যায়ে এগিয়ে চলো"),
              why: tx(
                `${nx.n} checked question${nx.n > 1 ? "s" : ""} you haven't tried yet.`,
                `${bnDigits(nx.n)}টি যাচাই করা প্রশ্ন এখনো চেষ্টা করোনি।`,
              ),
            }
          : nx.kind === "other"
            ? {
                to: "/chapters/$chapterId",
                params: { chapterId: nx.chapterId! },
                label: tx(`Start "${nx.title}"`, `"${nx.title}" শুরু করো`),
                why: tx(
                  "It has checked questions you haven't tried.",
                  "এতে তোমার না-করা যাচাই করা প্রশ্ন আছে।",
                ),
              }
            : {
                to: "/learn",
                label: tx("Explore another subject", "অন্য বিষয় দেখো"),
                why: tx(
                  "You've tried every checked question available right now.",
                  "এই মুহূর্তের সব যাচাই করা প্রশ্ন তুমি করেছ।",
                ),
              };
  return (
    <section aria-labelledby="cel-h" className="edu-rise space-y-5">
      <Panel tone="lift" className="overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#5b3fd6_0%,#7a5cf0_55%,#c4407f_130%)] p-6 text-white md:p-8">
          <p className="text-[15px] font-semibold text-white/85" lang={language}>
            {chapterTitle}
          </p>
          <h1
            id="cel-h"
            className="mt-1 font-display text-[30px] font-bold leading-tight md:text-[36px]"
          >
            {s.answered ? tx("Session complete", "সেশন শেষ") : tx("Lesson complete", "পাঠ শেষ")}
          </h1>
          {s.answered > 0 && (
            <p className="mt-2 text-[17px] text-white/90">
              {tx(
                `${s.correctNow} of ${s.answered} right by the end (${s.correctFirstTry} on the first try).`,
                `শেষে ${bnDigits(s.answered)}টির মধ্যে ${bnDigits(s.correctNow)}টি সঠিক (প্রথম চেষ্টায় ${bnDigits(s.correctFirstTry)}টি)।`,
              )}
              {s.minutes ? tx(` About ${s.minutes} minute${s.minutes > 1 ? "s" : ""}.`, ` প্রায় ${bnDigits(s.minutes)} মিনিট।`) : ""}
            </p>
          )}
        </div>
        {s.misconceptions.length > 0 && (
          <div className="border-b border-line px-6 py-4 md:px-8">
            <p className="text-[14px] font-semibold text-ink-mid">{tx("What your wrong answers pointed to", "তোমার ভুল উত্তর যা ইঙ্গিত দিল")}</p>
            <ul className="mt-1 list-disc pl-5 text-[15px]">
              {s.misconceptions.map((m) => (MISCONCEPTIONS[m] ? <li key={m}>{t(MISCONCEPTIONS[m])}</li> : null))}
            </ul>
          </div>
        )}
        <div className="grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:items-center md:p-8">
          <LevelRing
            level={s.level.level}
            progress={s.level.progress}
            size={84}
            label={tx(`Level ${s.level.level}`, `লেভেল ${s.level.level}`)}
          />
          <div>
            <p className="font-display text-[22px] font-bold">
              {s.xp.session > 0
                ? tx(
                    `+${s.xp.session} XP from this session`,
                    `এই সেশন থেকে +${bnDigits(s.xp.session)} এক্সপি`,
                  )
                : tx("No new XP this time", "এবার নতুন এক্সপি নেই")}
            </p>
            <p className="mt-1 text-[15px] text-ink-mid">
              {s.xp.session > 0
                ? tx(
                    "XP comes only from recorded learning: first-time right answers, fixed mistakes, due revisions, explanations and finished sessions.",
                    "এক্সপি আসে শুধু জমা হওয়া শেখা থেকে: প্রথমবার সঠিক, শোধরানো ভুল, সময়মতো পুনরালোচনা, ব্যাখ্যা ও শেষ করা সেশন।",
                  )
                : tx(
                    "Repeating questions you already got right doesn't add XP. It still strengthens your memory.",
                    "আগে সঠিক করা প্রশ্ন আবার করলে এক্সপি বাড়ে না, তবে মনে রাখা শক্ত হয়।",
                  )}
            </p>
            {s.level.next !== null && (
              <p className="mt-1 text-[14px] text-ink-low">
                {tx(
                  `${s.level.toNext} XP to level ${s.level.level + 1}.`,
                  `লেভেল ${bnDigits(s.level.level + 1)}-এ যেতে ${bnDigits(s.level.toNext)} এক্সপি।`,
                )}
              </p>
            )}
            {up && (
              <p className="edu-pop mt-3 inline-flex items-center gap-2 rounded-full bg-amber-soft px-3 py-1.5 text-[15px] font-semibold text-amber">
                <Icon name="sun" size={18} />
                {tx(
                  `Level up: you're now ${t(s.level.name)}`,
                  `লেভেল বেড়েছে: তুমি এখন ${t(s.level.name)}`,
                )}
              </p>
            )}
          </div>
        </div>
      </Panel>
      {s.newAchievements.length > 0 && <AchievementNote ids={s.newAchievements} />}
      {s.needsWork.length > 0 && (
        <Panel className="p-5">
          <p className="font-semibold">{tx("Still needs work", "আরও কাজ দরকার")}</p>
          <ul className="mt-2 space-y-1.5 text-[15px] text-ink-mid">
            {s.needsWork.map((q) => (
              <li key={q.id} className="line-clamp-2" lang={q.language}>
                {q.prompt}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[14px] text-ink-low">
            {tx(
              "They'll come back in your revision queue tomorrow.",
              "আগামীকাল এগুলো পুনরালোচনায় ফিরে আসবে।",
            )}
          </p>
        </Panel>
      )}
      <Panel tone="lilac" className="p-5">
        <p className="text-[14px] font-semibold text-ink-mid">
          {tx("Your next step", "তোমার পরের ধাপ")}
        </p>
        <p className="mt-1 text-[15px] text-ink-mid">{nextLink.why}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <LinkButton
            to={nextLink.to}
            params={"params" in nextLink ? nextLink.params : undefined}
            icon="arrow"
          >
            {nextLink.label}
          </LinkButton>
          <LinkButton to="/dashboard" variant="secondary">
            {tx("Back to dashboard", "ড্যাশবোর্ডে ফিরে যাও")}
          </LinkButton>
        </div>
      </Panel>
    </section>
  );
}
