// The interactive pieces of a Learning Session: question player, feedback, rewards, lesson steps,
// the continued-ratio lab and Explain It Back. Correctness and rewards always come from the server.
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState } from "react";

import type { L } from "../../content/types";
import type { SessionQuestion } from "../../lib/api/universe.functions";
import { submitExplanation } from "../../lib/api/universe.functions";
import { ACHIEVEMENTS, XP_RULES, type XpKind } from "../../lib/learning/rules";
import { MISCONCEPTIONS, SKILLS } from "../../lib/learning/lessons";
import { useLearner, type AnswerOutcome } from "../../lib/store";
import { call, msg } from "../auth/messages";
import { Icon } from "./icons";
import { Badge, Button } from "./ui";

const BN = "০১২৩৪৫৬৭৮৯";
const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);

export const bnDigits = (s: string | number) => String(s).replace(/\d/g, (d) => BN[Number(d)]);

export type Answered = Extract<AnswerOutcome, { ok: true; duplicate: boolean }>;

const WHY: Record<SessionQuestion["why"], L> = {
  due: { en: "Due for revision today", bn: "আজ পুনরালোচনার দিন" },
  missed: { en: "You missed this before", bn: "আগে এটি ভুল হয়েছিল" },
  new: { en: "New to you", bn: "তোমার জন্য নতুন" },
  again: { en: "One more time keeps it fresh", bn: "আরেকবার করলে মনে থাকে" },
};

function inputHelp(q: SessionQuestion, tx: (en: string, bn: string) => string) {
  if (q.answerKind === "ratio")
    return tx(
      "Write the ratio with colons, like 3 : 6 : 10.",
      "কোলন দিয়ে অনুপাত লেখো, যেমন ৩ : ৬ : ১০।",
    );
  if (q.answerKind === "list")
    return tx(
      "Write the numbers in order, separated by commas.",
      "সংখ্যাগুলো ক্রম মেনে কমা দিয়ে লেখো।",
    );
  if (q.type === "numeric")
    return tx(
      "A whole number, decimal or fraction. Mixed numbers like 9 3/5 are fine.",
      "পূর্ণসংখ্যা, দশমিক বা ভগ্নাংশ। ৯ ৩/৫ এর মতো মিশ্র ভগ্নাংশও চলবে।",
    );
  return tx("A word or short phrase.", "একটি শব্দ বা ছোট বাক্যাংশ।");
}

/** One question at a time: answer, check, see why. */
export function QuestionPlayer({
  q,
  index,
  total,
  sessionId,
  mode = "practice",
  onDone,
}: {
  q: SessionQuestion;
  index: number;
  total: number;
  sessionId: string | null;
  mode?: "practice" | "review";
  onDone: (r: Answered | { queued: true } | null) => void;
}) {
  const { tx, t, lang, answer } = useLearner();
  const [resp, setResp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Answered | null>(null);
  const [queued, setQueued] = useState(false);
  const [hint, setHint] = useState(false);
  const inputId = useId();
  useEffect(() => {
    setResp("");
    setRes(null);
    setErr(null);
    setQueued(false);
    setHint(false);
  }, [q.id]);

  const submit = async () => {
    if (!resp.trim() || busy || res) return;
    setBusy(true);
    setErr(null);
    const r = await answer({ questionId: q.id, response: resp, confidence: null, mode, sessionId });
    setBusy(false);
    if (!r.ok) return setErr(r.code);
    if ("queued" in r) return setQueued(true);
    setRes(r);
  };
  const source =
    q.source === "textbook_exercise"
      ? [
          q.exercise
            ? tx(`Textbook: ${q.exercise}`, `পাঠ্যবই: ${q.exercise}`)
            : tx("Textbook exercise", "পাঠ্যবইয়ের অনুশীলনী"),
          q.printedPage ? tx(`page ${q.printedPage}`, `পৃষ্ঠা ${bnDigits(q.printedPage)}`) : null,
        ]
          .filter(Boolean)
          .join(", ")
      : tx(
          "IntelliHorizon question, reviewed before publishing",
          "ইন্টেলিহরাইজনের প্রশ্ন, প্রকাশের আগে পর্যালোচিত",
        );

  return (
    <article
      className="rounded-[24px] border border-line bg-sheet p-5 shadow-[var(--shadow-quiet)] md:p-7"
      aria-labelledby={`${inputId}-q`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-ink-mid">
          {tx(
            `Question ${index + 1} of ${total}`,
            `প্রশ্ন ${bnDigits(index + 1)} / ${bnDigits(total)}`,
          )}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={q.why === "due" ? "amber" : q.why === "missed" ? "pink" : "neutral"}>
            {t(WHY[q.why])}
          </Badge>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-ink-low">{source}</p>
      <h2
        id={`${inputId}-q`}
        className="mt-4 whitespace-pre-line text-[19px] font-semibold leading-relaxed md:text-[21px]"
        lang={q.language}
      >
        {q.prompt}
      </h2>

      {q.type === "mcq" && q.options ? (
        <div
          role="radiogroup"
          aria-labelledby={`${inputId}-q`}
          className="mt-5 grid gap-2.5"
          lang={q.language}
        >
          {q.options.map((o) => {
            const chosen = resp === o.id;
            const right = res && res.correctAnswer === o.text;
            const wrong = res && chosen && !res.correct;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={!!res || queued}
                onClick={() => setResp(o.id)}
                className={`flex min-h-[54px] items-center gap-3 rounded-[14px] border-2 px-4 py-3 text-left text-[17px] font-medium transition-colors ${right ? "border-mint bg-mint-soft" : wrong ? "border-again bg-again-soft" : chosen ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong"} ${res && !right && !wrong ? "opacity-60" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[14px] font-bold ${chosen ? "border-brand bg-brand text-white" : "border-line-strong text-ink-mid"}`}
                >
                  {o.id === "true" || o.id === "false" ? (o.id === "true" ? "✓" : "✗") : o.id}
                </span>
                <span className="math-ish">{o.text}</span>
                {right && <Icon name="check" className="ml-auto text-mint" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-5">
          <label htmlFor={inputId} className="block text-[15px] font-semibold text-ink">
            {tx("Your answer", "তোমার উত্তর")}
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id={inputId}
              value={resp}
              disabled={!!res || queued}
              maxLength={200}
              autoComplete="off"
              lang={q.language}
              inputMode={q.type === "numeric" ? "decimal" : "text"}
              aria-describedby={`${inputId}-help`}
              onChange={(e) => setResp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              className="math h-14 min-w-0 flex-1 rounded-[14px] border-2 border-line bg-sheet px-4 text-[20px] outline-none focus:border-brand"
            />
            {q.unit && (
              <span className="shrink-0 text-[16px] font-semibold text-ink-mid" lang={q.language}>
                {q.unit}
              </span>
            )}
          </div>
          <p id={`${inputId}-help`} className="mt-2 text-[14px] text-ink-low">
            {inputHelp(q, tx)}
          </p>
        </div>
      )}

      {q.hint && !res && (
        <div className="mt-4">
          {hint ? (
            <p
              className="flex gap-2 rounded-[14px] bg-amber-soft p-3 text-[15px] text-ink"
              lang={q.language}
            >
              <Icon name="hint" className="shrink-0 text-amber" />
              {q.hint}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setHint(true)}
              className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-amber hover:underline"
            >
              <Icon name="hint" size={18} />
              {tx("Show a hint", "একটি ইঙ্গিত দেখাও")}
            </button>
          )}
        </div>
      )}

      {err && (
        <p
          role="alert"
          className="mt-4 rounded-[14px] bg-again-soft p-3 text-[15px] font-medium text-again"
        >
          {t(msg(err)!)}
        </p>
      )}

      {!res && !queued && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => void submit()} disabled={!resp.trim() || busy}>
            {busy ? tx("Checking…", "দেখছি…") : tx("Check my answer", "উত্তর যাচাই করো")}
          </Button>
        </div>
      )}

      {queued && (
        <div role="status" className="mt-6 space-y-3 rounded-[18px] bg-amber-soft p-4">
          <p className="flex items-center gap-2 font-semibold text-amber">
            <Icon name="offline" />
            {tx("Saved on this device", "এই ডিভাইসে জমা হয়েছে")}
          </p>
          <p className="text-[15px] text-ink">
            {tx(
              "You're offline, so this answer hasn't been checked. It will be sent once, automatically, when you're back online, and your progress will update then.",
              "তুমি অফলাইনে, তাই উত্তরটি এখনো যাচাই হয়নি। সংযোগ ফিরলে এটি নিজে থেকে একবারই পাঠানো হবে, তখন অগ্রগতি হালনাগাদ হবে।",
            )}
          </p>
          <Button onClick={() => onDone({ queued: true })}>
            {index + 1 < total ? tx("Next question", "পরের প্রশ্ন") : tx("Continue", "এগিয়ে চলো")}
          </Button>
        </div>
      )}

      {res && (
        <Feedback
          res={res}
          q={q}
          lang={lang}
          onNext={() => onDone(res)}
          last={index + 1 >= total}
        />
      )}
    </article>
  );
}

function Feedback({
  res,
  q,
  onNext,
  last,
}: {
  res: Answered;
  q: SessionQuestion;
  lang: string;
  onNext: () => void;
  last: boolean;
}) {
  const { tx, t } = useLearner();
  const mis = res.misconception ? MISCONCEPTIONS[res.misconception] : null;
  const prov = res.provenance as Record<string, string | number | null> | null;
  return (
    <div className="edu-rise mt-6 space-y-4" aria-live="polite">
      <div className={`rounded-[18px] p-4 ${res.correct ? "bg-mint-soft" : "bg-again-soft"}`}>
        <p
          className={`flex items-center gap-2 text-[18px] font-bold ${res.correct ? "text-mint" : "text-again"}`}
        >
          <Icon name={res.correct ? "check" : "revision"} />
          {res.correct
            ? tx("That's right.", "সঠিক।")
            : tx("Not yet. Here's the answer.", "এখনো হয়নি। উত্তরটি দেখো।")}
        </p>
        {!res.correct && (
          <p className="mt-2 text-[17px]" lang={q.language}>
            {tx("Answer: ", "উত্তর: ")}
            <strong className="math">{res.correctAnswer}</strong>
          </p>
        )}
        {mis && (
          <p className="mt-2 text-[15px] text-ink">
            <span className="font-semibold">
              {tx("This wrong answer often comes from: ", "এই ভুল উত্তর সাধারণত আসে: ")}
            </span>
            {t(mis)}
          </p>
        )}
        {res.xp.gained > 0 && res.xp.kind && <RewardNote xp={res.xp.gained} kind={res.xp.kind} />}
        {res.duplicate && (
          <p className="mt-2 text-[14px] text-ink-mid">
            {tx(
              "This answer was already recorded, so it wasn't counted twice.",
              "এই উত্তর আগেই জমা হয়েছিল, তাই দুবার গোনা হয়নি।",
            )}
          </p>
        )}
      </div>
      {res.explanation && (
        <div className="rounded-[18px] border border-line p-4">
          <p className="text-[14px] font-semibold text-ink-mid">{tx("Why", "কেন")}</p>
          <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed" lang={q.language}>
            {res.explanation}
          </p>
          {prov?.answerFrom && (
            <p className="mt-3 text-[13px] text-ink-low">
              {tx(
                `Answer source: ${String(prov.answerFrom)}.`,
                `উত্তরের উৎস: ${String(prov.answerFrom)}।`,
              )}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onNext} icon={last ? undefined : "arrow"}>
          {last ? tx("Continue", "এগিয়ে চলো") : tx("Next question", "পরের প্রশ্ন")}
        </Button>
        {res.nextReviewDays > 0 && (
          <span className="text-[14px] text-ink-mid">
            {tx(
              `Comes back for revision in ${res.nextReviewDays} day${res.nextReviewDays === 1 ? "" : "s"}.`,
              `${bnDigits(res.nextReviewDays)} দিন পরে পুনরালোচনায় ফিরবে।`,
            )}
          </span>
        )}
        {res.skill && SKILLS[res.skill] && <Badge>{t(SKILLS[res.skill])}</Badge>}
      </div>
      {res.newAchievements.length > 0 && <AchievementNote ids={res.newAchievements} />}
    </div>
  );
}

export function RewardNote({ xp, kind }: { xp: number; kind: XpKind }) {
  const { t, tx } = useLearner();
  const rule = XP_RULES.find((r) => r.kind === kind);
  return (
    <p className="edu-pop mt-3 inline-flex items-center gap-2 rounded-full bg-sheet px-3 py-1.5 text-[14px] font-semibold text-brand-deep shadow-[var(--shadow-quiet)]">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] text-white">
        +
      </span>
      {tx(`${xp} XP`, `${bnDigits(xp)} এক্সপি`)}{" "}
      <span className="font-medium text-ink-mid">{rule ? t(rule.label) : ""}</span>
    </p>
  );
}

export function AchievementNote({ ids }: { ids: string[] }) {
  const { t, tx } = useLearner();
  return (
    <div className="edu-pop flex items-start gap-3 rounded-[18px] bg-amber-soft p-4" role="status">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-fill text-ink">
        <Icon name="achievements" />
      </span>
      <div>
        <p className="font-semibold">{tx("Achievement earned", "অর্জন পেয়েছ")}</p>
        <ul className="text-[15px] text-ink-mid">
          {ids.map((id) => {
            const a = ACHIEVEMENTS.find((x) => x.id === id);
            return a ? (
              <li key={id}>
                <strong className="text-ink">{t(a.title)}</strong>: {t(a.how)}
              </li>
            ) : null;
          })}
        </ul>
        <Link
          to="/achievements"
          className="text-[14px] font-semibold text-amber underline-offset-4 hover:underline"
        >
          {tx("See your collection", "তোমার সংগ্রহ দেখো")}
        </Link>
      </div>
    </div>
  );
}

/** Explanation steps revealed one at a time. */
export function LessonSteps({
  steps,
  pages,
  onFinished,
}: {
  steps: L[];
  pages: string;
  onFinished: () => void;
}) {
  const { t, tx } = useLearner();
  const [n, setN] = useState(1);
  return (
    <div>
      <ol className="space-y-3">
        {steps.slice(0, n).map((s, i) => (
          <li
            key={i}
            className={`edu-rise flex gap-3 rounded-[18px] p-4 ${i === n - 1 ? "bg-brand-soft" : "bg-lilac"}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[14px] font-bold text-white">
              {i + 1}
            </span>
            <p className="text-[17px] leading-relaxed">{t(s)}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[13px] text-ink-low">
        {tx(
          `IntelliHorizon's explanation, checked against your book's pages ${pages}. It is not the textbook's wording.`,
          `ইন্টেলিহরাইজনের ব্যাখ্যা, তোমার বইয়ের ${bnDigits(pages)} পৃষ্ঠার সঙ্গে মিলিয়ে দেখা। এটি পাঠ্যবইয়ের ভাষা নয়।`,
        )}
      </p>
      <div className="mt-4">
        {n < steps.length ? (
          <Button onClick={() => setN(n + 1)} icon="arrow">
            {tx("Next idea", "পরের ধারণা")}
          </Button>
        ) : (
          <Button onClick={onFinished} icon="arrow">
            {tx("I'm ready to try", "আমি চেষ্টা করতে প্রস্তুত")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Continued ratio builder: change two ratios and watch each step of the book's rule. Exact integer arithmetic. */
export function ContinuedRatioLab() {
  const { tx, lang } = useLearner();
  const [v, setV] = useState({ a: 2, b: 3, c: 4, d: 5 });
  const [step, setStep] = useState(0);
  const r = useMemo(() => {
    const x1 = v.a * v.c,
      x2 = v.b * v.c,
      x3 = v.b * v.d,
      g = gcd(gcd(x1, x2), x3);
    return { x1, x2, x3, g };
  }, [v]);
  const n = (k: keyof typeof v, label: string) => (
    <input
      type="number"
      min={1}
      max={99}
      value={v[k]}
      aria-label={label}
      onChange={(e) => {
        const x = Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1)));
        setV({ ...v, [k]: x });
        setStep(0);
      }}
      className="math h-12 w-16 rounded-[12px] border-2 border-line bg-sheet text-center text-[20px] outline-none focus:border-brand"
    />
  );
  const D = (x: number) => (lang === "bn" ? bnDigits(x) : String(x));
  const lines = [
    v.b === v.c
      ? tx(`The shared term is already equal (${v.b}).`, `মাঝের রাশি আগে থেকেই সমান (${D(v.b)})।`)
      : tx(
          `The shared term is ${v.b} in the first ratio and ${v.c} in the second, so make them equal.`,
          `মাঝের রাশি প্রথম অনুপাতে ${D(v.b)}, দ্বিতীয়টিতে ${D(v.c)}, তাই সমান করতে হবে।`,
        ),
    `${D(v.a)} : ${D(v.b)} = ${D(v.a)} × ${D(v.c)} : ${D(v.b)} × ${D(v.c)} = ${D(r.x1)} : ${D(r.x2)}`,
    `${D(v.c)} : ${D(v.d)} = ${D(v.c)} × ${D(v.b)} : ${D(v.d)} × ${D(v.b)} = ${D(r.x2)} : ${D(r.x3)}`,
    `${tx("Continued ratio", "ধারাবাহিক অনুপাত")} = ${D(r.x1)} : ${D(r.x2)} : ${D(r.x3)}${r.g > 1 ? ` = ${D(r.x1 / r.g)} : ${D(r.x2 / r.g)} : ${D(r.x3 / r.g)}` : ""}`,
  ];
  return (
    <div className="rounded-[24px] border border-line bg-sheet p-5">
      <p className="font-display text-[19px] font-bold">
        {tx("Try it: build a continued ratio", "নিজে করো: ধারাবাহিক অনুপাত বানাও")}
      </p>
      <p className="mt-1 text-[15px] text-ink-mid">
        {tx("Change the numbers, then step through.", "সংখ্যা বদলাও, তারপর ধাপে ধাপে দেখো।")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-ink-mid">{tx("a : b", "ক : খ")}</span>
          {n("a", "a")}
          <b>:</b>
          {n("b", "b")}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-ink-mid">{tx("b : c", "খ : গ")}</span>
          {n("c", "b (second ratio)")}
          <b>:</b>
          {n("d", "c")}
        </div>
      </div>
      <ol className="mt-4 space-y-2" aria-live="polite">
        {lines.slice(0, step + 1).map((l, i) => (
          <li
            key={i}
            className={`edu-rise math rounded-[12px] px-3 py-2 text-[17px] ${i === 3 ? "bg-brand-soft font-semibold text-brand-deep" : "bg-lilac"}`}
          >
            {l}
          </li>
        ))}
      </ol>
      <div className="mt-3">
        {step < 3 ? (
          <Button size="sm" variant="secondary" onClick={() => setStep(step + 1)}>
            {tx("Show next step", "পরের ধাপ দেখাও")}
          </Button>
        ) : (
          <Button size="sm" variant="quiet" onClick={() => setStep(0)}>
            {tx("Start again", "আবার শুরু")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Explain It Back: the student writes, the server compares with the chapter's key ideas and says which were found. */
export function ExplainBack({
  chapterId,
  sessionId,
  onDone,
}: {
  chapterId: string;
  sessionId: string | null;
  onDone?: (counted: boolean) => void;
}) {
  const { tx, t } = useLearner();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Extract<
    Awaited<ReturnType<typeof submitExplanation>>,
    { ok: true }
  > | null>(null);
  const id = useId();
  const send = async () => {
    setBusy(true);
    setErr(null);
    const r = await call(submitExplanation({ data: { chapterId, sessionId, text } }));
    setBusy(false);
    if (!r.ok) return setErr(r.code);
    setRes(r as never);
    onDone?.((r as { counts: boolean }).counts);
  };
  return (
    <div className="rounded-[24px] border border-line bg-sheet p-5">
      <p className="font-display text-[19px] font-bold">
        {tx("Explain it back", "নিজের ভাষায় বলো")}
      </p>
      <p className="mt-1 text-[15px] text-ink-mid">
        {tx(
          "Without looking, explain the main idea in a few sentences, in Bangla or English.",
          "না দেখে কয়েক বাক্যে মূল কথাটি বলো, বাংলা বা ইংরেজিতে।",
        )}
      </p>
      <label htmlFor={id} className="sr-only">
        {tx("Your explanation", "তোমার ব্যাখ্যা")}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!!res}
        maxLength={1500}
        rows={4}
        className="mt-3 w-full rounded-[14px] border-2 border-line bg-sheet p-3 text-[16px] leading-relaxed outline-none focus:border-brand"
      />
      {err && (
        <p role="alert" className="mt-2 text-[15px] text-again">
          {t(msg(err)!)}
        </p>
      )}
      {!res ? (
        <div className="mt-3">
          <Button onClick={() => void send()} disabled={busy || text.trim().length < 10}>
            {busy ? tx("Reading…", "পড়ছি…") : tx("Check my explanation", "আমার ব্যাখ্যা দেখো")}
          </Button>
        </div>
      ) : (
        <div className="edu-rise mt-4 space-y-3" aria-live="polite">
          <ul className="space-y-2">
            {res.ideas.map((k) => {
              const ok = res.covered.includes(k.id);
              return (
                <li
                  key={k.id}
                  className={`flex items-start gap-2 rounded-[12px] p-3 text-[15px] ${ok ? "bg-mint-soft" : "bg-lilac"}`}
                >
                  <Icon
                    name={ok ? "check" : "spark"}
                    size={18}
                    className={ok ? "text-mint" : "text-ink-low"}
                  />
                  <span>
                    <strong>
                      {ok
                        ? tx("You covered: ", "তুমি বলেছ: ")
                        : tx("Not found yet: ", "এখনো পাওয়া যায়নি: ")}
                    </strong>
                    {t(k.label)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[15px]">
            {res.counts
              ? tx(
                  "That counts as an explanation in your own words.",
                  "এটি নিজের ভাষায় ব্যাখ্যা হিসেবে গণ্য হলো।",
                )
              : tx(
                  "Add the missing ideas to make your explanation complete. Two or more ideas and a couple of sentences are needed.",
                  "ব্যাখ্যা সম্পূর্ণ করতে বাদ পড়া ধারণাগুলো যোগ করো। অন্তত দুটি ধারণা আর দু-এক বাক্য লাগবে।",
                )}
          </p>
          {res.ai?.status === "ok" && (res.ai.feedback || res.ai.misunderstandings.length > 0 || res.ai.recognised.some((x) => !res.byKeyword.includes(x))) && (
            <div className="rounded-[12px] border border-brand/25 p-3 text-[15px]" data-ai-feedback>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">{tx("AI feedback, a second opinion", "এআই মতামত, দ্বিতীয় মত")}</p>
              {res.ai.recognised.filter((x) => !res.byKeyword.includes(x)).length > 0 && (
                <p className="mt-1">{tx("Explained in your own words: ", "নিজের ভাষায় বলেছ: ")}{res.ideas.filter((k) => res.ai.recognised.includes(k.id) && !res.byKeyword.includes(k.id)).map((k) => t(k.label)).join("; ")}</p>
              )}
              {res.ai.feedback && <p className="mt-1">{res.ai.feedback}</p>}
              {res.ai.misunderstandings.length > 0 && <ul className="mt-1 list-disc pl-5">{res.ai.misunderstandings.map((m, i) => <li key={i}>{m}</li>)}</ul>}
              <p className="mt-1 text-xs text-ink-low">{tx("Written by an AI model; it can be wrong. Ask your teacher if you disagree.", "এআই মডেলের লেখা; ভুল হতে পারে। একমত না হলে শিক্ষককে জিজ্ঞেস করো।")}</p>
            </div>
          )}
          {res.xpGained > 0 && <RewardNote xp={res.xpGained} kind="explain" />}
          <p className="text-[13px] text-ink-low">
            {tx(
              res.ai?.status === "ok" ? "IntelliHorizon looks for the words of each key idea, and an AI second opinion looks for the same ideas in your own words. It is a guide, not a grade." : "IntelliHorizon looks for the words of each key idea, so a correct idea in very different words can be missed. It is a guide, not a grade.",
              "ইন্টেলিহরাইজন প্রতিটি মূল ধারণার শব্দ খোঁজে, তাই একদম ভিন্ন শব্দে বলা সঠিক ধারণাও বাদ পড়তে পারে। এটি দিকনির্দেশনা, নম্বর নয়।",
            )}
          </p>
          {!res.counts && (
            <Button variant="secondary" size="sm" onClick={() => setRes(null)}>
              {tx("Edit and try again", "সম্পাদনা করে আবার চেষ্টা")}
            </Button>
          )}
          {res.newAchievements.length > 0 && <AchievementNote ids={res.newAchievements} />}
        </div>
      )}
    </div>
  );
}

/** The seven moments of a Learning Session, drawn as a stitched path. */
export const STAGES = [
  "discover",
  "understand",
  "try",
  "improve",
  "remember",
  "celebrate",
  "continue",
] as const;
export type Stage = (typeof STAGES)[number];
const STAGE_LABEL: Record<Stage, L> = {
  discover: { en: "Discover", bn: "খোঁজো" },
  understand: { en: "Understand", bn: "বোঝো" },
  try: { en: "Try", bn: "চেষ্টা" },
  improve: { en: "Improve", bn: "শোধরাও" },
  remember: { en: "Remember", bn: "মনে রাখো" },
  celebrate: { en: "Celebrate", bn: "উদ্‌যাপন" },
  continue: { en: "Continue", bn: "এগিয়ে চলো" },
};
export function StageTrail({ stage }: { stage: Stage }) {
  const { t, tx } = useLearner();
  const at = STAGES.indexOf(stage);
  return (
    <nav aria-label={tx("Session steps", "সেশনের ধাপ")} className="overflow-x-auto">
      <ol className="flex min-w-[560px] items-center">
        {STAGES.map((s, i) => (
          <li
            key={s}
            className="flex flex-1 items-center last:flex-none"
            aria-current={i === at ? "step" : undefined}
          >
            <span className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-bold ${i < at ? "border-mint bg-mint text-white" : i === at ? "border-brand bg-brand text-white" : "border-line-strong bg-sheet text-ink-low"}`}
              >
                {i < at ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <span
                className={`text-[12px] font-semibold ${i === at ? "text-brand-deep" : "text-ink-low"}`}
              >
                {t(STAGE_LABEL[s])}
              </span>
            </span>
            {i < STAGES.length - 1 && (
              <span
                aria-hidden="true"
                className={`mx-1 mb-5 h-0 flex-1 border-t-2 border-dashed ${i < at ? "border-mint" : "border-line-strong"}`}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
