import { useLearner } from "../../lib/store";

export const BAND: Record<string, [string, string]> = { no_evidence: ["Not enough evidence yet", "এখনো যথেষ্ট প্রমাণ নেই"], early: ["Early", "শুরুর দিকে"], building: ["Building", "গড়ে উঠছে"], strong: ["Strong on all four factors", "চারটি কারণেই শক্ত"] };
const FACTOR: Record<string, [string, string, string, string]> = {
  coverage: ["Questions tried", "চেষ্টা করা প্রশ্ন", "at least 70% of this chapter's questions", "অধ্যায়ের অন্তত ৭০% প্রশ্ন"],
  recent_accuracy: ["Last 10 answers right", "শেষ ১০ উত্তরে ঠিক", "at least 5 answers and 80% right", "অন্তত ৫টি উত্তর ও ৮০% ঠিক"],
  due_reviews: ["Reviews due", "বাকি রিভিউ", "none due", "কোনোটি বাকি নেই"],
  recency: ["Days since last practice", "শেষ অনুশীলনের পর দিন", "7 days or fewer", "৭ দিন বা কম"],
};
export function ReadinessFactors({ r }: { r: { band: string; factors: { key: string; value: string; ok: boolean }[] } }) {
  const { tx } = useLearner();
  return (
    <div>
      <p className="font-semibold">{tx(BAND[r.band][0], BAND[r.band][1])}</p>
      <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">{r.factors.map((f) => (
        <li key={f.key} className="flex items-baseline gap-1.5"><span aria-hidden="true">{f.ok ? "✓" : "○"}</span><span>{tx(FACTOR[f.key][0], FACTOR[f.key][1])}: <span className="font-semibold">{f.value}</span> <span className="text-ink-low">({tx(`target: ${FACTOR[f.key][2]}`, `লক্ষ্য: ${FACTOR[f.key][3]}`)})</span><span className="sr-only">{f.ok ? tx(" met", " পূরণ") : tx(" not met", " পূরণ হয়নি")}</span></span></li>
      ))}</ul>
    </div>
  );
}
