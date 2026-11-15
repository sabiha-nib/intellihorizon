import { Link } from "@tanstack/react-router";

import { conceptById } from "../../content/concepts";
import { findMisconception } from "../../content/packs";
import { subjectById } from "../../content/subjects";
import type { Disguise, L } from "../../content/types";
import { useLearner } from "../../lib/store";
import { GLOW_HINT, GLOW_LABEL, IgniteLink, StarGlyph } from "./ui";

export const DISGUISE_LABEL: Record<Disguise, L> = {
  context: { en: "New situation", bn: "নতুন পরিস্থিতি" },
  representation: { en: "New form", bn: "নতুন রূপ" },
  language: { en: "Other language", bn: "অন্য ভাষা" },
  reverse: { en: "Argue it back", bn: "উল্টো যুক্তি" },
};

export function StarPanel({ id, onSelect, onClose }: { id: string; onSelect: (id: string) => void; onClose: () => void }) {
  const { t, tx, concept } = useLearner();
  const c = conceptById(id);
  if (!c) return null;
  const s = subjectById(c.subject)!;
  const m = concept(id);
  return (
    <section className="edu-rise rounded-[14px] border border-dashed border-stitch bg-night-1/90 p-5 backdrop-blur-sm" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-night-0" style={{ background: s.thread }}>
          {t(s.name)}
        </span>
        <button type="button" onClick={onClose} className="rounded-full px-2 text-sm text-cloth-low hover:text-cloth" aria-label={tx("Close", "বন্ধ করো")}>
          {tx("Close", "বন্ধ")}
        </button>
      </div>
      <h2 className="font-display mt-3 text-2xl font-bold leading-tight tracking-tight">{t(c.title)}</h2>
      <p className="mt-1 text-sm text-cloth-low">{t(c.nctb)}</p>
      <div className="mt-4 flex items-center gap-3">
        <svg width="34" height="34" viewBox="-17 -17 34 34" aria-hidden="true">
          <StarGlyph glow={m.glow} r={9} thread={s.thread} />
        </svg>
        <div>
          <p className="font-semibold">{t(GLOW_LABEL[m.glow])}</p>
          <p className="text-sm text-cloth-mid">{t(GLOW_HINT[m.glow])}</p>
        </div>
      </div>
      {m.attempts > 0 && (
        <div className="mt-4 border-t border-dashed border-stitch pt-3 text-sm text-cloth-mid">
          <p>
            {tx(`Disguises survived: ${m.disguises.length} of 4`, `টিকে থাকা ছদ্মবেশ: ৪টির মধ্যে ${m.disguises.length}টি`)}
            {m.disguises.length > 0 && <> ({m.disguises.map((d) => t(DISGUISE_LABEL[d as Disguise] ?? { en: d, bn: d })).join(", ")})</>}
          </p>
          {m.activeMisconceptions.map((mid) => (
            <p key={mid} className="mt-1">
              {tx("Seen in your answers:", "তোমার উত্তরে দেখা গেছে:")} <span className="font-semibold text-cloth">{t(findMisconception(id, mid)?.name ?? { en: mid, bn: mid })}</span>{" "}
              <Link to="/mirror" className="underline decoration-dashed underline-offset-4 hover:text-thread">
                {tx("Not what you think?", "এটা তোমার ভাবনা নয়?")}
              </Link>
            </p>
          ))}
        </div>
      )}
      {c.bridges.length > 0 && (
        <div className="mt-4 border-t border-dashed border-stitch pt-3">
          <p className="text-sm font-semibold text-thread">{tx("Bridges to other ideas", "অন্য ধারণার সেতু")}</p>
          <ul className="mt-2 space-y-2">
            {c.bridges.map((b) => {
              const to = conceptById(b.to)!;
              return (
                <li key={b.to}>
                  <button type="button" onClick={() => onSelect(b.to)} className="text-left text-sm text-cloth-mid hover:text-cloth">
                    <span className="font-semibold text-cloth">{t(to.title)}</span> <span className="text-cloth-low">({t(subjectById(to.subject)!.name)})</span>
                    <br />
                    {t(b.text)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="mt-5">
        {c.route ? (
          <IgniteLink to={c.route}>{m.attempts > 0 ? tx("Continue", "চালিয়ে যাও") : tx("Step inside", "ভেতরে চলো")}</IgniteLink>
        ) : (
          <div className="rounded-[14px] border border-dashed border-stitch p-3 text-sm text-cloth-mid">
            <p className="font-semibold text-cloth">{tx("Designed experience", "পরিকল্পিত অভিজ্ঞতা")}</p>
            <p className="mt-1">{t(c.preview ?? { en: "", bn: "" })}</p>
            <p className="mt-2 text-cloth-low">{tx("Opens after the pilot. Fall, fractions and plant mass are open now.", "পাইলটের পরে খুলবে। পড়ন্ত বস্তু, ভগ্নাংশ আর গাছের ভর এখন খোলা।")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
