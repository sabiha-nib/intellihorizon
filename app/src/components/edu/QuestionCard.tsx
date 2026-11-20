import { useState } from "react";

import { findMisconception } from "../../content/packs";
import type { Lang, Option, Question } from "../../content/types";
import { useLearner } from "../../lib/store";
import { Repair } from "./Repair";
import { ConfidenceDial, IgniteButton, ReadAloud, SourceTag } from "./ui";

export type Answer = { optionId: string; correct: boolean; misconception: string | null; confidence: 1 | 2 | 3 };

function MiniGraph({ lines }: { lines: NonNullable<Option["graph"]> }) {
  const colors = ["#E8644A", "#191D23"];
  return (
    <svg viewBox="-14 -8 128 120" className="h-24 w-28 shrink-0" aria-hidden="true">
      <line x1="0" y1="100" x2="104" y2="100" stroke="#5A6670" strokeWidth="1.5" />
      <line x1="0" y1="100" x2="0" y2="-4" stroke="#5A6670" strokeWidth="1.5" />
      <text x="104" y="112" fontSize="10" textAnchor="end" fill="#465C65">t</text>
      <text x="-10" y="4" fontSize="10" fill="#465C65">v</text>
      {lines.map((l, i) => (
        <g key={i}>
          <polyline points={l.pts.map(([x, y]) => `${x},${100 - y}`).join(" ")} fill="none" stroke={colors[i % 2]} strokeWidth={i === 0 ? 4 : 2} strokeDasharray={i === 1 ? "5 3" : undefined} opacity={0.9} />
          {l.label && (
            <text x={l.pts[l.pts.length - 1][0] - 2} y={100 - l.pts[l.pts.length - 1][1] + (i === 0 ? 12 : -4)} fontSize="9" textAnchor="end" fill={colors[i % 2]}>
              {l.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function NumberLine({ options, lang }: { options: Option[]; lang: Lang }) {
  const x = (v: number) => 20 + v * 180;
  const bn = ["ক", "খ", "গ", "ঘ"];
  return (
    <svg viewBox="0 0 400 70" className="mt-4 w-full max-w-md" role="img" aria-label="Number line from 0 to 2">
      <line x1="10" y1="40" x2="390" y2="40" stroke="#191D23" strokeWidth="2" />
      {[0, 0.5, 1, 1.5, 2].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={34} x2={x(v)} y2={46} stroke="#191D23" strokeWidth={v % 1 === 0 ? 2 : 1} />
          <text x={x(v)} y={64} fontSize="12" textAnchor="middle" fill="#465C65">
            {v === 0.5 ? "1/2" : v === 1.5 ? "3/2" : String(v)}
          </text>
        </g>
      ))}
      {options.map((o, i) =>
        o.mark === undefined ? null : (
          <g key={o.id}>
            <circle cx={x(o.mark)} cy={40} r={6} fill="#57707A" stroke="#191D23" strokeWidth={1.5} />
            <text x={x(o.mark)} y={22} fontSize="13" fontWeight={700} textAnchor="middle" fill="#191D23">
              {lang === "bn" ? bn[i] : String.fromCharCode(65 + i)}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}

/**
 * One question with confidence capture.
 * reveal=false is "prediction mode": the answer is recorded but not judged yet (discovery first).
 */
export function QuestionCard({ q, reveal = true, onDone, cta }: { q: Question; reveal?: boolean; onDone: (a: Answer) => void; cta?: string }) {
  const { lang, t, tx, record } = useLearner();
  const [choice, setChoice] = useState<string | null>(null);
  const [conf, setConf] = useState<1 | 2 | 3 | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const disguised = q.disguise === "language";
  const [showMine, setShowMine] = useState(false);
  const view: Lang = disguised && !showMine ? (lang === "en" ? "bn" : "en") : lang;
  const hasMarks = q.options.some((o) => o.mark !== undefined);

  const submit = () => {
    if (!choice || !conf) return;
    const o = q.options.find((x) => x.id === choice)!;
    const a: Answer = { optionId: o.id, correct: !!o.correct, misconception: o.misconception ?? null, confidence: conf };
    setAnswer(a);
    record({
      concept: q.concept,
      kind: q.kind,
      item: q.id,
      correct: a.correct,
      confidence: conf,
      misconception: a.correct ? null : a.misconception,
      detail: q.kind === "trial" ? q.disguise ?? null : o.id,
    });
  };

  const mis = answer && !answer.correct ? findMisconception(q.concept, answer.misconception) : undefined;

  return (
    <article className="rounded-[14px] bg-sheet p-5 shadow-[0_1px_0_rgba(52,36,140,0.08),0_12px_32px_-18px_rgba(52,36,140,0.35)] md:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <SourceTag source={q.source} />
        <ReadAloud text={q.prompt[view]} lang={view} />
        {disguised && (
          <button type="button" onClick={() => setShowMine((v) => !v)} className="rounded-full border border-dashed border-ink-low/50 px-3 py-1 text-xs font-semibold text-ink-mid hover:text-ink">
            {showMine ? tx("Back to the disguise", "ছদ্মবেশে ফেরো") : tx("Show in my language", "আমার ভাষায় দেখাও")}
          </button>
        )}
      </div>
      <h3 className="font-display mt-4 max-w-[60ch] text-xl font-bold leading-snug tracking-tight md:text-2xl" lang={view}>
        {q.prompt[view]}
      </h3>
      {hasMarks && <NumberLine options={q.options} lang={view} />}
      <div className="mt-5 grid gap-2.5" role="radiogroup">
        {q.options.map((o) => {
          const picked = choice === o.id;
          const judged = answer && reveal;
          const tone = judged ? (o.correct ? "border-right bg-right/10" : picked ? "border-again bg-again/10" : "border-ink-low/30 opacity-70") : picked ? "border-brand bg-brand text-sheet" : "border-ink-low/40 bg-sheet hover:border-ink";
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={!!answer}
              onClick={() => setChoice(o.id)}
              className={`flex items-center gap-3 rounded-[14px] border px-4 py-3 text-left text-base font-medium transition-colors ${tone}`}
              lang={view}
            >
              {o.graph && <MiniGraph lines={o.graph} />}
              <span>{o.text[view]}</span>
            </button>
          );
        })}
      </div>
      {!answer && (
        <>
          <ConfidenceDial value={conf} onChange={setConf} />
          <div className="mt-5">
            <IgniteButton onClick={submit} disabled={!choice || !conf}>
              {reveal ? tx("Check my answer", "উত্তর যাচাই করো") : tx("Lock in my prediction", "আমার অনুমান জমা দাও")}
            </IgniteButton>
          </div>
        </>
      )}
      {answer && !reveal && (
        <div className="edu-rise mt-5 rounded-[14px] border border-dashed border-ink-low/50 p-4">
          <p className="font-semibold">{tx("Prediction saved. Hold that thought: you are about to test it yourself.", "অনুমান জমা হলো। ভাবনাটা ধরে রাখো: এবার নিজেই যাচাই করবে।")}</p>
          <div className="mt-3">
            <IgniteButton onClick={() => onDone(answer)}>{cta ?? tx("Next", "পরের ধাপ")}</IgniteButton>
          </div>
        </div>
      )}
      {answer && reveal && (
        <div className="edu-rise mt-5" aria-live="polite">
          {answer.correct ? (
            <p className="font-semibold text-right">
              {answer.confidence === 1
                ? tx("Right, and you said you were guessing. Good to know: a disguise will show if it really holds.", "সঠিক, আর তুমি বলেছিলে আন্দাজ করছ। ভালো তথ্য: ছদ্মবেশে দেখা যাবে সত্যিই টেকে কিনা।")
                : tx("That holds.", "এটা টিকেছে।")}
            </p>
          ) : (
            <p className="font-semibold text-again">
              {answer.confidence === 3
                ? tx("You were certain, and many people think this way. That makes this a great thing to look at closely.", "তুমি নিশ্চিত ছিলে, আর অনেকেই এভাবে ভাবে। তাই এটা কাছ থেকে দেখার মতো।")
                : tx("Not this time. Mistakes like this one show us exactly where to look.", "এবার হয়নি। এমন ভুলই দেখায় ঠিক কোথায় তাকাতে হবে।")}
            </p>
          )}
          <p className="mt-2 max-w-[65ch] leading-relaxed text-ink">{t(q.explain)}</p>
          {mis && <Repair concept={q.concept} mis={mis} />}
          <div className="mt-5">
            <IgniteButton onClick={() => onDone(answer)}>{cta ?? tx("Continue", "এগিয়ে চলো")}</IgniteButton>
          </div>
        </div>
      )}
    </article>
  );
}
