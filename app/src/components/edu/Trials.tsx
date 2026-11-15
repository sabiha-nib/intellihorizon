import { useState } from "react";

import type { LessonPack } from "../../content/types";
import { useLearner } from "../../lib/store";
import { QuestionCard } from "./QuestionCard";
import { DISGUISE_LABEL } from "./StarPanel";
import { GLOW_LABEL, IgniteButton, StarGlyph } from "./ui";

/** Shapeshifter Trials: the same idea in four disguises. Light grows only when the idea survives. */
export function Trials({ pack, onDone }: { pack: LessonPack; onDone: () => void }) {
  const { t, tx, concept } = useLearner();
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const m = concept(pack.concept);
  const done = i >= pack.trials.length;
  const q = pack.trials[Math.min(i, pack.trials.length - 1)];
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-[14px] border border-dashed border-ink-low/50 bg-sheet/60 p-4">
        <svg width="56" height="56" viewBox="-28 -28 56 56" aria-hidden="true" className="rounded-full bg-night-0">
          <StarGlyph key={m.glow} glow={m.glow} r={12} ignite />
        </svg>
        <div className="flex-1">
          <p className="text-sm text-ink-mid">{tx("Your star right now", "তোমার তারা এখন")}</p>
          <p className="font-display text-lg font-bold">{t(GLOW_LABEL[m.glow])}</p>
        </div>
        <ol className="flex gap-1.5" aria-label={tx("Disguises", "ছদ্মবেশ")}>
          {pack.trials.map((tr, k) => (
            <li key={tr.id} className={`rounded-full border px-3 py-1 text-xs font-semibold ${k === i && !done ? "border-brand bg-brand text-sheet" : results[k] === true ? "border-right text-right" : results[k] === false ? "border-again text-again" : "border-dashed border-ink-low/50 text-ink-low"}`}>
              {t(DISGUISE_LABEL[tr.disguise!])}
            </li>
          ))}
        </ol>
      </div>
      {!done ? (
        <QuestionCard
          key={q.id}
          q={q}
          onDone={(a) => {
            setResults((r) => [...r, a.correct]);
            setI((k) => k + 1);
          }}
          cta={i < pack.trials.length - 1 ? tx("Next disguise", "পরের ছদ্মবেশ") : tx("See how my idea did", "দেখি কেমন টিকল")}
        />
      ) : (
        <div className="edu-rise rounded-[14px] bg-sheet p-6">
          <h3 className="font-display text-2xl font-bold tracking-tight">
            {tx(`Your idea survived ${results.filter(Boolean).length} of ${pack.trials.length} disguises.`, `তোমার ধারণা ${pack.trials.length}টির মধ্যে ${results.filter(Boolean).length}টি ছদ্মবেশে টিকেছে।`)}
          </h3>
          <p className="mt-2 max-w-[60ch] text-ink-mid">
            {results.every(Boolean)
              ? tx("That is the difference between remembering an answer and understanding an idea.", "উত্তর মনে রাখা আর ধারণা বোঝার পার্থক্য এটাই।")
              : tx("The disguises it did not survive show exactly where understanding is still forming. Come back tomorrow and try them again.", "যে ছদ্মবেশে টেকেনি, সেখানেই বোঝাপড়া এখনো গড়ে উঠছে। কাল আবার চেষ্টা করো।")}
          </p>
          <div className="mt-5">
            <IgniteButton onClick={onDone}>{tx("Compare then and now", "আগে আর এখন তুলনা করো")}</IgniteButton>
          </div>
        </div>
      )}
    </div>
  );
}
