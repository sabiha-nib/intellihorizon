import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon, type IconName } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import { Badge, LevelRing, LinkButton, Loading, PageTitle, ProgressBar } from "../components/universe/ui";
import { getHorizonPath } from "../lib/api/universe.functions";
import { subjectById } from "../lib/curriculum/registry";
import { requireAccount } from "../lib/guard";
import { PRACTICE_LEVEL, type PracticeLevel } from "../lib/learning/rules";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/path")({
  beforeLoad: () => requireAccount("/path"),
  head: () => ({ meta: [{ title: "Horizon Path | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: HorizonPath,
});

type Data = Extract<Awaited<ReturnType<typeof getHorizonPath>>, { ok: true }>;

/** One stop on the path: a marker on the stitched line, then its content. */
function Stop({ icon, tone, children, last }: { icon: IconName; tone: "done" | "now" | "ahead" | "check"; children: ReactNode; last?: boolean }) {
  const ring = tone === "done" ? "border-mint bg-mint text-white" : tone === "now" ? "border-brand bg-brand text-white" : tone === "check" ? "border-pink bg-pink-soft text-pink" : "border-line-strong bg-sheet text-ink-mid";
  return (
    <li className="relative flex gap-4 pb-6">
      {!last && <span aria-hidden="true" className={`absolute left-[19px] top-10 bottom-0 border-l-2 border-dashed ${tone === "done" ? "border-mint" : "border-line-strong"}`} />}
      <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${ring}`}><Icon name={icon} size={20} /></span>
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  );
}

function HorizonPath() {
  const { tx, t, lang } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { void call(getHorizonPath()).then((r) => r.ok && setD(r as Data)); }, []);
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  const date = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short" });
  const subj = (id: string | null) => (id ? subjectById(id) : null);

  const aheadText = (a: Data["ahead"][number]) => {
    switch (a.kind) {
      case "resume": return { title: tx(`Finish your session in "${a.title}"`, `"${a.title}"-এর সেশন শেষ করো`), why: tx(`You've answered ${a.n} of ${a.m} questions.`, `${N(a.m)}টির ${N(a.n)}টির উত্তর দিয়েছ।`), to: "/practice/session/$sessionId", params: { sessionId: a.sessionId! }, cta: tx("Resume", "চালিয়ে যাও") };
      case "revise": return { title: tx(`Revise ${a.n} due question${a.n > 1 ? "s" : ""}`, `${N(a.n)}টি প্রশ্ন পুনরালোচনা করো`), why: tx("They've come due on your revision schedule.", "তোমার পুনরালোচনার সময়সূচিতে এগুলোর সময় হয়েছে।"), to: "/revision", params: undefined, cta: tx("Revise", "পুনরালোচনা") };
      case "strengthen": return { title: tx(`Strengthen "${a.title}"`, `"${a.title}" মজবুত করো`), why: tx(`Your recent accuracy there is ${a.n}% over ${a.m} answers.`, `সেখানে ${N(a.m)}টি উত্তরে তোমার সাম্প্রতিক সঠিকতা ${N(a.n)}%।`), to: "/practice/$chapterId", params: { chapterId: a.chapterId! }, cta: tx("Practise", "অনুশীলন") };
      case "practise_new": return { title: tx(`Keep going in "${a.title}"`, `"${a.title}"-এ এগিয়ে চলো`), why: tx(`${a.n} checked question${a.n > 1 ? "s" : ""} you haven't tried.`, `${N(a.n)}টি যাচাই করা প্রশ্ন এখনো করোনি।`), to: "/practice/$chapterId", params: { chapterId: a.chapterId! }, cta: tx("Practise", "অনুশীলন") };
      case "next_chapter": return { title: tx(`Next in your book: "${a.title}"`, `বইয়ে পরেরটি: "${a.title}"`), why: tx("It follows the chapter you opened last, in the book's own order.", "বইয়ের ক্রমে এটি তোমার শেষ খোলা অধ্যায়ের পরে।"), to: "/chapters/$chapterId", params: { chapterId: a.chapterId! }, cta: tx("Open", "খোলো") };
      default: return { title: tx(`Start with "${a.title}"`, `"${a.title}" দিয়ে শুরু করো`), why: tx(`It has ${a.n} checked questions, the most of any chapter right now.`, `এতে ${N(a.n)}টি যাচাই করা প্রশ্ন আছে, এখন সবচেয়ে বেশি।`), to: "/practice/$chapterId", params: { chapterId: a.chapterId! }, cta: tx("Start", "শুরু") };
    }
  };

  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageTitle icon="missions" title={tx("Horizon Path", "হরাইজন পথ")} sub={tx("Your own journey: what you've finished, where you are now, and what comes next. Every stop is built from your record and says why it's there.", "তোমার নিজের যাত্রা: কী শেষ করেছ, এখন কোথায়, এরপর কী। প্রতিটি ধাপ তোমার রেকর্ড থেকে তৈরি, কেন আছে তাও বলে।")} />
        {!d ? <Loading label={tx("Loading your path", "পথ লোড হচ্ছে")} /> : (
          <ol>
            {[...d.behind].reverse().map((s) => {
              const sj = subj(s.subject);
              return (
                <Stop key={s.id} icon="check" tone="done">
                  <Link to="/practice/session/$sessionId" params={{ sessionId: s.id }} className="block rounded-[16px] border border-line bg-sheet p-4 hover:border-brand">
                    <p className="text-[13px] font-semibold text-ink-mid">{sj ? t(sj.short) : ""} · {date(s.at)}</p>
                    <p className="font-display text-[18px] font-bold" lang="bn">{s.title}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {s.attempted !== null && <Badge tone="mint">{tx(`${s.correct} of ${s.attempted} right`, `${N(s.attempted)}টির ${N(s.correct ?? 0)}টি সঠিক`)}</Badge>}
                      {s.level && PRACTICE_LEVEL[s.level as PracticeLevel] && <Badge>{t(PRACTICE_LEVEL[s.level as PracticeLevel].label)}</Badge>}
                      {s.xp ? <Badge tone="brand">+{N(s.xp)} XP</Badge> : null}
                      {s.minutes ? <Badge>{tx(`${s.minutes} min`, `${N(s.minutes)} মিনিট`)}</Badge> : null}
                    </p>
                  </Link>
                </Stop>
              );
            })}
            {d.earned.map((a) => (
              <Stop key={a.id} icon="achievements" tone="done">
                <p className="text-[15px]"><strong>{a.title ? t(a.title) : a.id}</strong> <span className="text-ink-mid">{tx("earned ", "পেয়েছ ")}{date(a.at)}</span></p>
              </Stop>
            ))}
            <Stop icon="spark" tone="now">
              <div className="flex items-center gap-4 rounded-[20px] bg-lilac p-4">
                <LevelRing level={d.level.level} progress={d.level.progress} size={64} label={tx(`Level ${d.level.level}`, `লেভেল ${d.level.level}`)} />
                <div>
                  <p className="text-[13px] font-semibold text-brand-deep">{tx("You are here", "তুমি এখানে")}</p>
                  <p className="font-display text-[20px] font-bold">{t(d.level.name)}</p>
                  <p className="text-[14px] text-ink-mid">{tx(`${d.totals.sessions} session${d.totals.sessions === 1 ? "" : "s"} finished, ${d.totals.demonstrated} chapter${d.totals.demonstrated === 1 ? "" : "s"} demonstrated.`, `${N(d.totals.sessions)}টি সেশন শেষ, ${N(d.totals.demonstrated)}টি অধ্যায় প্রমাণিত।`)}</p>
                </div>
              </div>
            </Stop>
            {d.ahead.map((a, i) => {
              const x = aheadText(a);
              return (
                <Stop key={i} icon={a.kind === "revise" ? "revision" : a.kind === "next_chapter" ? "book" : "practice"} tone="ahead">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-sheet p-4">
                    <div className="min-w-0">
                      <p className="font-semibold">{x.title}</p>
                      <p className="text-[14px] text-ink-mid">{tx("Why: ", "কেন: ")}{x.why}</p>
                    </div>
                    <LinkButton to={x.to} params={x.params as Record<string, string> | undefined} size="sm" variant={i === 0 ? "primary" : "secondary"}>{x.cta}</LinkButton>
                  </div>
                </Stop>
              );
            })}
            {d.checkpoints.map((c) => (
              <Stop key={c.day} icon="revision" tone="check">
                <p className="text-[15px]"><strong>{tx("Revision checkpoint", "পুনরালোচনার চেকপয়েন্ট")}</strong> <span className="text-ink-mid">{date(c.day)}: {tx(`${c.n} question${c.n > 1 ? "s" : ""} come back`, `${N(c.n)}টি প্রশ্ন ফিরবে`)}</span></p>
              </Stop>
            ))}
            {d.nextAchievements.map((a, i) => (
              <Stop key={a.id} icon="lock" tone="ahead" last={i === d.nextAchievements.length - 1}>
                <p className="text-[15px]"><strong>{t(a.title)}</strong> <span className="text-ink-mid">{t(a.how)}</span></p>
                <div className="mt-2 max-w-xs"><ProgressBar value={a.value} max={a.target} tone="amber" size="sm" label={t(a.title)} /></div>
                <p className="mt-1 text-[13px] text-ink-low">{N(a.value)} / {N(a.target)}</p>
              </Stop>
            ))}
          </ol>
        )}
        <p className="text-[14px] text-ink-mid">
          <Link to="/knowledge-map" className="font-semibold text-brand-deep hover:underline">{tx("See every chapter on the Knowledge Map", "জ্ঞান মানচিত্রে সব অধ্যায় দেখো")}</Link>
        </p>
      </div>
    </Frame>
  );
}
