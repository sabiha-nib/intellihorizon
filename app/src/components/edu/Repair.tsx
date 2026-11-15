import { useState } from "react";

import type { L, Misconception, Style } from "../../content/types";
import { useLearner } from "../../lib/store";

const STYLES: { id: Style; label: L }[] = [
  { id: "visual", label: { en: "Show me", bn: "দেখাও" } },
  { id: "story", label: { en: "Tell a story", bn: "গল্পে বলো" } },
  { id: "steps", label: { en: "Step by step", bn: "ধাপে ধাপে" } },
  { id: "analogy", label: { en: "Compare it to something", bn: "তুলনা দিয়ে" } },
];

const REASONS: { id: string; label: L }[] = [
  { id: "misread", label: { en: "I misread the question", bn: "প্রশ্নটা ভুল পড়েছিলাম" } },
  { id: "mistap", label: { en: "I tapped the wrong answer", bn: "ভুল উত্তরে চাপ পড়েছে" } },
  { id: "other", label: { en: "I had a different reason", bn: "আমার কারণ অন্য ছিল" } },
];

/** Adaptive repair for one detected misconception, with student control over style and interpretation. */
export function Repair({ concept, mis }: { concept: string; mis: Misconception }) {
  const { t, tx, prefs, updatePrefs, record } = useLearner();
  const [style, setStyle] = useState<Style>(prefs.style);
  const [challenge, setChallenge] = useState<"closed" | "open" | "done">("closed");
  return (
    <div className="mt-4 rounded-[14px] border border-dashed border-ink-low/50 bg-paper p-4">
      <p className="text-sm text-ink-mid">
        {tx("Why you are seeing this: your answer matches a common, sensible idea called", "কেন এটা দেখছ: তোমার উত্তর একটি প্রচলিত, যুক্তিসংগত ধারণার সাথে মেলে, যার নাম")}{" "}
        <span className="font-semibold text-ink">"{t(mis.name)}"</span>. {tx("This is a guess from one answer, not a verdict.", "এটা একটি উত্তর থেকে অনুমান, রায় নয়।")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={tx("Explanation style", "ব্যাখ্যার ধরন")}>
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={style === s.id}
            onClick={() => {
              setStyle(s.id);
              updatePrefs({ style: s.id });
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${style === s.id ? "border-brand bg-brand text-sheet" : "border-ink-low/40 bg-sheet text-ink hover:border-ink"}`}
          >
            {t(s.label)}
          </button>
        ))}
      </div>
      <p className="mt-3 max-w-[65ch] text-[17px] leading-relaxed text-ink">{t(mis.repair[style])}</p>
      <p className="mt-2 text-xs text-ink-low">{tx("IntelliHorizon remembers which style you pick and starts with it next time.", "তুমি কোন ধরন বেছে নাও তা ইন্টেলিহরাইজন মনে রাখে, পরেরবার সেটা দিয়েই শুরু করে।")}</p>
      <div className="mt-3 border-t border-dashed border-ink-low/40 pt-3">
        {challenge === "closed" && (
          <button type="button" onClick={() => setChallenge("open")} className="text-sm font-semibold text-ink-mid underline decoration-dashed underline-offset-4 hover:text-ink">
            {tx("That's not what I was thinking", "আমি আসলে এটা ভাবিনি")}
          </button>
        )}
        {challenge === "open" && (
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  record({ concept, kind: "challenge", item: mis.id, correct: false, confidence: 2, detail: r.id });
                  setChallenge("done");
                }}
                className="rounded-full border border-dashed border-ink-low/60 px-3 py-1.5 text-sm hover:border-ink"
              >
                {t(r.label)}
              </button>
            ))}
          </div>
        )}
        {challenge === "done" && <p className="text-sm text-right">{tx("Noted. IntelliHorizon will not count this as a misconception. You can review this in your Mirror.", "নোট করা হলো। ইন্টেলিহরাইজন এটাকে ভুল ধারণা হিসেবে ধরবে না। আয়নায় দেখে নিতে পারো।")}</p>}
      </div>
    </div>
  );
}
