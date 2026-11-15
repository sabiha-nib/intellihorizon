import { useState } from "react";

import { TREE, TREE_EVIDENCE } from "../../content/tree";
import type { L } from "../../content/types";
import { useLearner } from "../../lib/store";
import { ConfidenceDial, IgniteButton, SourceTag } from "./ui";

type Verdict = "stronger" | "weaker" | "neither";
const READING: Record<string, Record<string, Verdict>> = {
  willow: { a: "weaker", b: "neither", c: "neither", d: "neither" },
  carbon: { a: "neither", b: "weaker", c: "stronger", d: "weaker" },
  stomata: { a: "neither", b: "neither", c: "stronger", d: "neither" },
  light: { a: "neither", b: "weaker", c: "neither", d: "neither" },
  equation: { a: "weaker", b: "weaker", c: "stronger", d: "stronger" },
  minerals: { a: "weaker", b: "neither", c: "neither", d: "neither" },
};
const WHY: Record<string, L> = {
  willow: { en: "If the tree were built from soil, the soil would have lost about 74 kg. It lost about 57 g. Van Helmont himself concluded the mass came from water, which later evidence overturned: even careful scientists revise.", bn: "গাছ মাটি দিয়ে তৈরি হলে মাটি প্রায় ৭৪ কেজি কমত। কমেছে প্রায় ৫৭ গ্রাম। ফন হেলমন্ট নিজে ভেবেছিলেন ভর পানি থেকে এসেছে, যা পরের প্রমাণে বাতিল হয়: সতর্ক বিজ্ঞানীরাও মত বদলান।" },
  carbon: { en: "Half of dry wood is carbon. Water and light contain no carbon, so the carbon has to come from somewhere else.", bn: "শুকনো কাঠের অর্ধেক কার্বন। পানি ও আলোতে কার্বন নেই, তাই কার্বন অন্য কোথাও থেকে আসতে হবে।" },
  stomata: { en: "Leaves have a doorway for carbon dioxide. That is the route the carbon takes into the plant.", bn: "পাতায় কার্বন ডাই-অক্সাইড ঢোকার পথ আছে। কার্বন এই পথেই গাছে ঢোকে।" },
  light: { en: "Light cannot become wood because it carries no atoms. It supplies the energy for the change.", bn: "আলো কাঠ হতে পারে না কারণ এতে পরমাণু নেই। এটি পরিবর্তনের শক্তি জোগায়।" },
  equation: { en: "Both CO₂ and water are ingredients. Light sits above the arrow as energy. Soil does not appear at all.", bn: "CO₂ আর পানি দুটোই উপাদান। আলো তীরের ওপরে, শক্তি হিসেবে। মাটি সমীকরণে নেই-ই।" },
  minerals: { en: "Soil matters, but only small amounts of minerals come from it. That cannot explain tonnes of wood.", bn: "মাটি জরুরি, কিন্তু এ থেকে অল্প খনিজই আসে। তা দিয়ে কয়েক টন কাঠ ব্যাখ্যা হয় না।" },
};
const VL: Record<Verdict, L> = {
  stronger: { en: "Makes it stronger", bn: "আরও জোরালো করে" },
  weaker: { en: "Makes it weaker", bn: "দুর্বল করে" },
  neither: { en: "Doesn't settle it", bn: "মীমাংসা করে না" },
};

export function EvidenceBoard() {
  const { t, tx, rows, record } = useLearner();
  const probe = TREE.probe[0];
  const latest = [...rows].reverse().find((r) => r.item === probe.id);
  const [mine, setMine] = useState<string | null>(latest?.detail ?? null);
  const [marks, setMarks] = useState<Record<string, Verdict>>({});
  const [rev, setRev] = useState<string | null>(null);
  const [conf, setConf] = useState<1 | 2 | 3 | null>(null);
  const [revised, setRevised] = useState<null | "changed" | "kept-right" | "kept">(null);
  const myOpt = probe.options.find((o) => o.id === mine);
  const marked = Object.keys(marks).length;

  if (!myOpt) {
    return (
      <div className="rounded-[14px] bg-sheet p-5 md:p-7">
        <h2 className="font-display text-2xl font-bold">{tx("First, your current idea", "প্রথমে, তোমার এখনকার ধারণা")}</h2>
        <p className="mt-1 text-ink-mid">{t(probe.prompt)}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {probe.options.map((o) => (
            <button key={o.id} type="button" onClick={() => setMine(o.id)} className="rounded-[14px] border border-ink-low/40 px-4 py-3 text-left font-medium hover:border-ink">
              {t(o.text)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const submit = () => {
    if (!rev || !conf) return;
    const o = probe.options.find((x) => x.id === rev)!;
    record({ concept: "tree", kind: "revise", item: probe.id, correct: !!o.correct, confidence: conf, misconception: o.correct ? null : o.misconception ?? null, detail: o.id });
    setRevised(o.correct && !myOpt.correct ? "changed" : o.correct ? "kept-right" : "kept");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[14px] bg-night-0 p-5 text-cloth">
        <p className="text-sm font-semibold text-thread">{tx("Your current answer", "তোমার এখনকার উত্তর")}</p>
        <p className="font-display mt-1 text-2xl font-bold">{t(myOpt.text)}</p>
        <p className="mt-1 text-sm text-cloth-mid">{tx("Read each piece of evidence. Does it make your answer stronger or weaker?", "প্রতিটি প্রমাণ পড়ো। এটা তোমার উত্তরকে জোরালো করে নাকি দুর্বল?")}</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {TREE_EVIDENCE.map((e) => {
          const m = marks[e.id];
          const ours = READING[e.id][myOpt.id];
          return (
            <li key={e.id} className="flex flex-col rounded-[14px] bg-sheet p-5">
              <div className="flex flex-wrap items-center gap-2">
                <SourceTag source={e.kind} />
                <span className="text-xs text-ink-low">{t(e.source)}</span>
              </div>
              <p className="mt-3 text-[17px] leading-relaxed">{t(e.text)}</p>
              {!m ? (
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {(["stronger", "weaker", "neither"] as Verdict[]).map((v) => (
                    <button key={v} type="button" onClick={() => setMarks((x) => ({ ...x, [e.id]: v }))} className="rounded-full border border-ink-low/40 px-3 py-1.5 text-sm font-semibold hover:border-ink">
                      {t(VL[v])}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="edu-rise mt-4 border-t border-dashed border-ink-low/40 pt-3 text-sm">
                  <p>
                    <span className="text-ink-low">{tx("You: ", "তুমি: ")}</span>
                    <span className="font-semibold">{t(VL[m])}</span>
                    <span className="text-ink-low">{tx(" · IntelliHorizon: ", " · ইন্টেলিহরাইজন: ")}</span>
                    <span className="font-semibold">{t(VL[ours])}</span>
                  </p>
                  {m !== ours && <p className="mt-1 text-ink-mid">{tx("We read this differently. Here is our reasoning, and you may still disagree:", "আমরা এটা ভিন্নভাবে পড়েছি। আমাদের যুক্তি এই, তুমি দ্বিমত করতেই পারো:")}</p>}
                  <p className="mt-1 leading-relaxed text-ink">{t(WHY[e.id])}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {marked >= 4 && (
        <section className="edu-rise rounded-[14px] bg-sheet p-5 md:p-7">
          <h3 className="font-display text-2xl font-bold">{tx("Weigh it up: has your answer changed?", "সব মিলিয়ে: তোমার উত্তর কি বদলাল?")}</h3>
          <p className="mt-1 text-ink-mid">{t(probe.prompt)}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {probe.options.map((o) => (
              <button key={o.id} type="button" disabled={!!revised} aria-pressed={rev === o.id} onClick={() => setRev(o.id)} className={`rounded-[14px] border px-4 py-3 text-left font-medium ${rev === o.id ? "border-brand bg-brand text-sheet" : "border-ink-low/40 hover:border-ink"}`}>
                {t(o.text)}
              </button>
            ))}
          </div>
          {!revised ? (
            <>
              <ConfidenceDial value={conf} onChange={setConf} />
              <div className="mt-4">
                <IgniteButton onClick={submit} disabled={!rev || !conf}>{tx("Save my answer", "উত্তর জমা দাও")}</IgniteButton>
              </div>
            </>
          ) : (
            <p className="edu-rise mt-4 font-semibold">
              {revised === "changed"
                ? tx("You changed your mind because of evidence. That takes courage, and it is how science moves forward.", "প্রমাণ দেখে তুমি মত বদলেছ। এতে সাহস লাগে, আর বিজ্ঞান এভাবেই এগোয়।")
                : revised === "kept-right"
                  ? tx("Your answer held up against all six pieces of evidence.", "তোমার উত্তর ছয়টি প্রমাণের সামনেই টিকে গেছে।")
                  : tx("Your answer stayed the same. That is allowed. In the next step we look at it together.", "তোমার উত্তর একই রইল। এতে দোষ নেই। পরের ধাপে আমরা একসাথে দেখব।")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
