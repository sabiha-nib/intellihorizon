import { findMisconception } from "../../content/packs";
import type { LessonPack } from "../../content/types";
import { useLearner } from "../../lib/store";
import { Repair } from "./Repair";
import { IgniteButton, SourceTag } from "./ui";

/** Make sense: predictions meet reality, and each misconception gets an adaptive repair. */
export function Sense({ pack, onDone }: { pack: LessonPack; onDone: () => void }) {
  const { t, tx, rows } = useLearner();
  const latest = (item: string) => [...rows].reverse().find((r) => r.item === item && (r.kind === "probe" || r.kind === "revise"));
  const answered = pack.probe.filter((q) => latest(q.id));
  return (
    <div className="space-y-5">
      {answered.length === 0 && (
        <p className="rounded-[14px] border border-dashed border-ink-low/50 p-4 text-ink-mid">{tx("You have not made a prediction yet. That is fine: here is what holds, and why.", "তুমি এখনো অনুমান করোনি। সমস্যা নেই: কী সত্য আর কেন, তা এখানে।")}</p>
      )}
      {(answered.length ? answered : pack.probe).map((q) => {
        const r = latest(q.id);
        const picked = r ? q.options.find((o) => o.id === r.detail) : undefined;
        const right = q.options.find((o) => o.correct)!;
        const mis = r && !r.correct ? findMisconception(pack.concept, r.misconception) : undefined;
        return (
          <article key={q.id} className="rounded-[14px] bg-sheet p-5 md:p-7">
            <SourceTag source={q.source} />
            <h3 className="font-display mt-3 max-w-[60ch] text-xl font-bold leading-snug tracking-tight">{t(q.prompt)}</h3>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-dashed border-ink-low/50 p-3">
                <dt className="text-xs font-semibold text-ink-low">{tx("You predicted", "তোমার অনুমান")}</dt>
                <dd className="mt-1 font-semibold">{picked ? t(picked.text) : tx("No prediction", "কোনো অনুমান নেই")}</dd>
              </div>
              <div className={`rounded-[14px] border p-3 ${r?.correct ? "border-right bg-right/10" : "border-ink-low/30 bg-paper"}`}>
                <dt className="text-xs font-semibold text-ink-low">{tx("What holds", "যা সত্য")}</dt>
                <dd className="mt-1 font-semibold">{t(right.text)}</dd>
              </div>
            </dl>
            <p className="mt-3 max-w-[65ch] leading-relaxed">{t(q.explain)}</p>
            {r?.correct && r.confidence === 1 && <p className="mt-2 text-sm text-ink-mid">{tx("You were right while guessing. The disguises later will check whether it was luck or understanding.", "আন্দাজে সঠিক হয়েছিল। পরের ছদ্মবেশগুলো দেখাবে এটা ভাগ্য নাকি বোঝা।")}</p>}
            {mis && <Repair concept={pack.concept} mis={mis} />}
          </article>
        );
      })}
      <IgniteButton onClick={onDone}>{tx("Now teach it to Rumi", "এবার রুমিকে শেখাও")}</IgniteButton>
    </div>
  );
}
