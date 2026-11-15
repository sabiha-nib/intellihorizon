import { conceptById } from "../../content/concepts";
import { findMisconception } from "../../content/packs";
import { subjectById } from "../../content/subjects";
import type { LessonPack } from "../../content/types";
import { useLearner } from "../../lib/store";
import { GLOW_HINT, GLOW_LABEL, IgniteLink, StarGlyph, StitchLink } from "./ui";

/** Then and now: the learner's own earlier belief beside their current understanding. */
export function ThenNow({ pack }: { pack: LessonPack }) {
  const { t, tx, rows, concept } = useLearner();
  const m = concept(pack.concept);
  const first = rows.find((r) => r.concept === pack.concept && r.kind === "probe");
  const firstQ = first ? pack.probe.find((q) => q.id === first.item) : undefined;
  const firstOpt = firstQ?.options.find((o) => o.id === first?.detail);
  const c = conceptById(pack.concept)!;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[14px] border border-dashed border-ink-low/60 p-5">
          <p className="text-sm font-semibold text-ink-low">{tx("Then", "তখন")}</p>
          {firstQ && firstOpt ? (
            <>
              <p className="mt-2 text-ink-mid">{t(firstQ.prompt)}</p>
              <p className="font-display mt-2 text-xl font-bold">"{t(firstOpt.text)}"</p>
              <p className="mt-1 text-sm text-ink-low">
                {first!.confidence === 3 ? tx("You were certain.", "তুমি নিশ্চিত ছিলে।") : first!.confidence === 1 ? tx("You were guessing.", "তুমি আন্দাজ করছিলে।") : tx("You were fairly sure.", "তুমি মোটামুটি নিশ্চিত ছিলে।")}
              </p>
            </>
          ) : (
            <p className="mt-2 text-ink-mid">{tx("You skipped the first prediction. Next time, try predicting before exploring.", "প্রথম অনুমানটা বাদ দিয়েছিলে। পরেরবার দেখার আগে অনুমান করে দেখো।")}</p>
          )}
        </section>
        <section className="rounded-[14px] bg-night-0 p-5 text-cloth">
          <p className="text-sm font-semibold text-thread">{tx("Now", "এখন")}</p>
          <div className="mt-2 flex items-center gap-3">
            <svg width="44" height="44" viewBox="-22 -22 44 44" aria-hidden="true">
              <StarGlyph glow={m.glow} r={11} ignite />
            </svg>
            <div>
              <p className="font-display text-xl font-bold">{t(GLOW_LABEL[m.glow])}</p>
              <p className="text-sm text-cloth-mid">{t(GLOW_HINT[m.glow])}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-cloth-mid">
            <li>{tx(`Survived ${m.disguises.length} of 4 disguises`, `৪টির মধ্যে ${m.disguises.length}টি ছদ্মবেশে টিকেছে`)}</li>
            <li>{tx(`Taught Rumi ${m.ideas.length} of ${pack.ideas.length} key ideas`, `রুমিকে ${pack.ideas.length}টির মধ্যে ${m.ideas.length}টি মূল ধারণা শিখিয়েছ`)}</li>
            {m.repairedMisconceptions.map((id) => (
              <li key={id} className="text-cloth">
                {tx("Let go of: ", "ছেড়ে দিয়েছ: ")}"{t(findMisconception(pack.concept, id)?.name ?? { en: id, bn: id })}"
              </li>
            ))}
            {m.activeMisconceptions.map((id) => (
              <li key={id}>
                {tx("Still forming: ", "এখনো গড়ছে: ")}"{t(findMisconception(pack.concept, id)?.name ?? { en: id, bn: id })}"
              </li>
            ))}
          </ul>
        </section>
      </div>
      {m.repairedMisconceptions.length > 0 && (
        <p className="rounded-[14px] border border-right/50 bg-right/10 p-4 font-semibold text-ink">
          {tx("You changed your mind because of evidence. That is exactly what scientists do, and it is the hardest thing to learn.", "প্রমাণ দেখে তুমি মত বদলেছ। বিজ্ঞানীরা ঠিক এটাই করেন, আর এটাই শেখা সবচেয়ে কঠিন।")}
        </p>
      )}
      {c.bridges.length > 0 && (
        <section>
          <h3 className="font-display text-xl font-bold">{tx("Where this idea leads", "এই ধারণা কোথায় নিয়ে যায়")}</h3>
          <ul className="mt-3 divide-y divide-dashed divide-ink-low/40 border-y border-dashed border-ink-low/40">
            {c.bridges.map((b) => {
              const to = conceptById(b.to)!;
              return (
                <li key={b.to} className="py-3">
                  <p className="font-semibold">
                    {t(to.title)} <span className="text-sm font-normal text-ink-low">({t(subjectById(to.subject)!.name)})</span>
                  </p>
                  <p className="text-ink-mid">{t(b.text)}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap items-center gap-5">
        <IgniteLink to="/sky">{tx("Back to my sky", "আমার আকাশে ফিরে যাও")}</IgniteLink>
        <StitchLink to="/tomorrow" tone="paper">{tx("Practise for an exam", "পরীক্ষার প্রস্তুতি নাও")}</StitchLink>
      </div>
    </div>
  );
}
