import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DISGUISE_LABEL } from "../components/edu/StarPanel";
import { GLOW_HINT, GLOW_LABEL, NightPage, StarGlyph, StitchLink } from "../components/edu/ui";
import { conceptById, PLAYABLE_IDS } from "../content/concepts";
import { findMisconception, PACKS } from "../content/packs";
import type { Disguise, L, Style } from "../content/types";
import type { EvidenceRow } from "../lib/model";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/mirror")({
  head: () => ({ meta: [{ title: "Mirror | IntelliHorizon" }] }),
  component: Mirror,
});

const CONF: Record<number, L> = { 1: { en: "guessing", bn: "আন্দাজে" }, 2: { en: "fairly sure", bn: "মোটামুটি নিশ্চিত" }, 3: { en: "certain", bn: "নিশ্চিত" } };

function describe(r: EvidenceRow): L {
  const pack = PACKS[r.concept];
  const q = pack ? [...pack.probe, ...pack.trials, ...pack.exam].find((x) => x.id === r.item) : undefined;
  const c = CONF[r.confidence] ?? CONF[2];
  if (r.kind === "lab") return { en: "Ran an experiment in the lab", bn: "ল্যাবে একটি পরীক্ষা চালিয়েছ" };
  if (r.kind === "explain") {
    const n = (r.detail ?? "").split(",").filter(Boolean).length;
    return { en: `Taught Rumi ${n} key idea${n === 1 ? "" : "s"}`, bn: `রুমিকে ${n}টি মূল ধারণা শিখিয়েছ` };
  }
  if (r.kind === "challenge") {
    const m = findMisconception(r.concept, r.item);
    return { en: `Told IntelliHorizon "${m?.name.en ?? r.item}" was not your thinking`, bn: `ইন্টেলিহরাইজনকে জানিয়েছ "${m?.name.bn ?? r.item}" তোমার ভাবনা নয়` };
  }
  if (r.kind === "trial") {
    const d = DISGUISE_LABEL[(r.detail ?? "context") as Disguise];
    return r.correct ? { en: `Survived the "${d.en}" disguise (${c.en})`, bn: `"${d.bn}" ছদ্মবেশে টিকেছ (${c.bn})` } : { en: `Did not yet survive the "${d.en}" disguise (${c.en})`, bn: `"${d.bn}" ছদ্মবেশে এখনো টেকেনি (${c.bn})` };
  }
  const verb = r.kind === "probe" ? { en: "Prediction", bn: "অনুমান" } : r.kind === "revise" ? { en: "Revised answer", bn: "সংশোধিত উত্তর" } : { en: "Practice answer", bn: "অনুশীলনের উত্তর" };
  const short = q ? { en: q.prompt.en.slice(0, 60) + (q.prompt.en.length > 60 ? "…" : ""), bn: q.prompt.bn.slice(0, 50) + (q.prompt.bn.length > 50 ? "…" : "") } : { en: r.item, bn: r.item };
  return r.correct ? { en: `${verb.en}, right (${c.en}): ${short.en}`, bn: `${verb.bn}, সঠিক (${c.bn}): ${short.bn}` } : { en: `${verb.en}, not yet (${c.en}): ${short.en}`, bn: `${verb.bn}, এখনো নয় (${c.bn}): ${short.bn}` };
}

const STYLE_L: Record<Style, L> = {
  visual: { en: "Show me", bn: "দেখাও" },
  story: { en: "Stories", bn: "গল্প" },
  steps: { en: "Step by step", bn: "ধাপে ধাপে" },
  analogy: { en: "Comparisons", bn: "তুলনা" },
};

function Toggle({ on, onChange, label, note }: { on: boolean; onChange: (v: boolean) => void; label: string; note: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-stitch py-4">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-0.5 text-sm text-cloth-mid">{note}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${on ? "border-thread bg-thread" : "border-stitch bg-night-2"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${on ? "translate-x-[22px] bg-night-0" : "translate-x-0.5 bg-cloth-low"}`} />
      </button>
    </div>
  );
}

function Mirror() {
  const { t, tx, rows, concept, record, prefs, updatePrefs, forget, storage } = useLearner();
  const [confirm, setConfirm] = useState(false);
  const [gone, setGone] = useState(false);
  return (
    <NightPage>
      <main className="mx-auto w-full max-w-4xl px-4 pt-4 md:px-6">
        <h1 className="font-display text-4xl font-bold tracking-tighter md:text-5xl">{tx("Your Mirror", "তোমার আয়না")}</h1>
        <p className="mt-3 max-w-[60ch] text-cloth-mid">{tx("Everything IntelliHorizon believes about your learning, the evidence behind it, and the switches you control. These are estimates, not judgements, and you can correct them.", "তোমার শেখা নিয়ে ইন্টেলিহরাইজন যা ভাবে, তার পেছনের প্রমাণ, আর তোমার হাতের নিয়ন্ত্রণ। এগুলো অনুমান, রায় নয়, আর তুমি সংশোধন করতে পারো।")}</p>

        <section className="mt-10" aria-labelledby="sees">
          <h2 id="sees" className="font-display text-2xl font-bold">{tx("What IntelliHorizon sees", "ইন্টেলিহরাইজন যা দেখে")}</h2>
          {rows.length === 0 && <p className="mt-3 text-cloth-mid">{tx("Nothing yet. IntelliHorizon assumes nothing about you until you show it something.", "এখনো কিছু না। তুমি কিছু না দেখানো পর্যন্ত ইন্টেলিহরাইজন তোমার সম্পর্কে কিছুই ধরে নেয় না।")}</p>}
          <div className="mt-4 space-y-5">
            {PLAYABLE_IDS.map((id) => {
              const m = concept(id);
              if (m.attempts === 0 && m.disputedMisconceptions.length === 0) return null;
              const c = conceptById(id)!;
              const ev = rows.filter((r) => r.concept === id).slice(-8).reverse();
              return (
                <article key={id} className="rounded-[14px] border border-dashed border-stitch bg-night-1/60 p-5">
                  <div className="flex items-center gap-3">
                    <svg width="34" height="34" viewBox="-17 -17 34 34" aria-hidden="true"><StarGlyph glow={m.glow} r={9} /></svg>
                    <div>
                      <h3 className="font-display text-lg font-bold">{t(c.title)}</h3>
                      <p className="text-sm text-cloth-mid">{t(GLOW_LABEL[m.glow])}. {t(GLOW_HINT[m.glow])}</p>
                    </div>
                  </div>
                  {m.activeMisconceptions.map((mid) => {
                    const mis = findMisconception(id, mid);
                    return (
                      <div key={mid} className="mt-4 rounded-[14px] bg-night-0/60 p-3">
                        <p className="text-sm">
                          {tx("Possible misconception: ", "সম্ভাব্য ভুল ধারণা: ")}
                          <span className="font-semibold">"{t(mis?.name ?? { en: mid, bn: mid })}"</span>
                        </p>
                        <p className="mt-0.5 text-sm text-cloth-mid">{t(mis?.looksLike ?? { en: "", bn: "" })}</p>
                        <button type="button" onClick={() => record({ concept: id, kind: "challenge", item: mid, correct: false, confidence: 2, detail: "mirror" })} className="mt-2 text-sm font-semibold text-thread underline decoration-dashed underline-offset-4">
                          {tx("This isn't how I think", "আমি এভাবে ভাবি না")}
                        </button>
                      </div>
                    );
                  })}
                  {m.disputedMisconceptions.length > 0 && (
                    <p className="mt-3 text-sm text-cloth-mid">
                      {tx("You corrected IntelliHorizon about: ", "তুমি ইন্টেলিহরাইজনকে সংশোধন করেছ: ")}
                      {m.disputedMisconceptions.map((d) => `"${t(findMisconception(id, d)?.name ?? { en: d, bn: d })}"`).join(", ")}
                    </p>
                  )}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-cloth-mid hover:text-cloth">{tx("Show the evidence", "প্রমাণ দেখাও")}</summary>
                    <ul className="mt-2 space-y-1 text-sm text-cloth-mid">
                      {ev.map((r) => (
                        <li key={r.id}>{t(describe(r))}</li>
                      ))}
                    </ul>
                  </details>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="how">
          <h2 id="how" className="font-display text-2xl font-bold">{tx("How IntelliHorizon decides", "ইন্টেলিহরাইজন কীভাবে সিদ্ধান্ত নেয়")}</h2>
          <ol className="mt-4 max-w-[65ch] list-decimal space-y-2 pl-5 text-cloth-mid">
            <li>{tx("Each answer is evidence, together with how sure you said you were.", "প্রতিটি উত্তর একটি প্রমাণ, সাথে তুমি কতটা নিশ্চিত ছিলে সেটাও।")}</li>
            <li>{tx("Wrong options are mapped to well-known misconceptions written by teachers. A match is a guess, shown to you, never hidden.", "ভুল বিকল্পগুলো শিক্ষকদের লেখা পরিচিত ভুল ধারণার সাথে মেলানো। মিল পাওয়া মানে অনুমান, যা তোমাকে দেখানো হয়, লুকানো হয় না।")}</li>
            <li>{tx("A misconception counts as let go once you answer correctly after it appeared, or as removed if you say it was not your thinking.", "ভুল ধারণা দেখা যাওয়ার পর সঠিক উত্তর দিলে তা ছেড়ে দেওয়া হিসেবে ধরা হয়, আর তুমি অস্বীকার করলে বাদ যায়।")}</li>
            <li>{tx("A star is fully lit only when the idea survives disguises: a new situation, a new form, the other language, and arguing it back.", "ধারণা ছদ্মবেশে টিকলে তবেই তারা পুরো জ্বলে: নতুন পরিস্থিতি, নতুন রূপ, অন্য ভাষা আর উল্টো যুক্তি।")}</li>
            <li>{tx("In this pilot the rules are fixed and visible here. No hidden scores, no ranking against other students.", "এই পাইলটে নিয়মগুলো নির্দিষ্ট এবং এখানে দেখা যায়। কোনো গোপন স্কোর বা অন্যদের সাথে তুলনা নেই।")}</li>
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="pref">
          <h2 id="pref" className="font-display text-2xl font-bold">{tx("How you like explanations", "তোমার পছন্দের ব্যাখ্যা")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(STYLE_L) as Style[]).map((s) => (
              <button key={s} type="button" aria-pressed={prefs.style === s} onClick={() => updatePrefs({ style: s })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${prefs.style === s ? "border-thread bg-thread text-night-0" : "border-stitch hover:border-thread"}`}>
                {t(STYLE_L[s])}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-cloth-low">{tx("This is a starting point, not a label. You can switch style on any explanation.", "এটা শুরুর বিন্দু, কোনো তকমা নয়। যেকোনো ব্যাখ্যায় ধরন বদলাতে পারো।")}</p>
        </section>

        <section className="mt-12" aria-labelledby="share">
          <h2 id="share" className="font-display text-2xl font-bold">{tx("Who can see your learning", "তোমার শেখা কে দেখতে পারে")}</h2>
          <div className="mt-2 border-t border-dashed border-stitch">
            <Toggle on={prefs.share_teacher} onChange={(v) => updatePrefs({ share_teacher: v })} label={tx("Share with my teacher", "শিক্ষকের সাথে শেয়ার")} note={tx("Star levels and ideas still forming. Never your words, voice or time spent.", "তারার মাত্রা আর গড়ে ওঠা ধারণা। কখনোই তোমার লেখা, কণ্ঠ বা সময় নয়।")} />
            <Toggle on={prefs.share_family} onChange={(v) => updatePrefs({ share_family: v })} label={tx("Share with my family", "পরিবারের সাথে শেয়ার")} note={tx("A plain-language weekly note about what you explored. No marks, no rankings.", "কী শিখেছ তা নিয়ে সহজ ভাষায় সাপ্তাহিক নোট। নম্বর বা র‍্যাংকিং নয়।")} />
          </div>
          <p className="mt-3 text-sm text-cloth-low">{tx("Both are off unless you turn them on. Teacher and family views open in the school pilot; your choice is saved now.", "তুমি চালু না করলে দুটোই বন্ধ। শিক্ষক ও পরিবারের দৃশ্য স্কুল পাইলটে চালু হবে; তোমার পছন্দ এখনই সংরক্ষিত।")}</p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2" aria-labelledby="data">
          <div>
            <h2 id="data" className="font-display text-2xl font-bold">{tx("Your data", "তোমার তথ্য")}</h2>
            <ul className="mt-3 space-y-1.5 text-cloth-mid">
              <li>{tx("Stored: an anonymous ID, your answers as short tags, confidence, and your settings.", "সংরক্ষিত: একটি বেনামি আইডি, সংক্ষিপ্ত ট্যাগ হিসেবে উত্তর, আত্মবিশ্বাস আর সেটিংস।")}</li>
              <li>{tx("Never stored: your name, phone, email, what you write to Rumi, or your voice.", "কখনো সংরক্ষিত নয়: নাম, ফোন, ইমেইল, রুমিকে লেখা কথা বা তোমার কণ্ঠ।")}</li>
              <li>{storage ? tx("Saved on IntelliHorizon's server so it works on a shared phone.", "ইন্টেলিহরাইজনের সার্ভারে সংরক্ষিত, তাই শেয়ার করা ফোনেও চলে।") : tx("Server storage is not connected right now; nothing leaves this phone.", "সার্ভার সংরক্ষণ এখন যুক্ত নেই; কিছুই এই ফোনের বাইরে যায় না।")}</li>
            </ul>
            {gone ? (
              <p className="mt-4 font-semibold text-thread">{tx("Everything has been deleted. Your sky is fresh.", "সব মুছে ফেলা হয়েছে। তোমার আকাশ নতুন।")}</p>
            ) : !confirm ? (
              <button type="button" onClick={() => setConfirm(true)} className="mt-4 rounded-[14px] border border-again px-4 py-2 font-semibold text-[#f08c76] hover:bg-again/15">
                {tx("Delete everything", "সব মুছে ফেলো")}
              </button>
            ) : (
              <div className="mt-4 rounded-[14px] border border-again p-4">
                <p>{tx("This permanently removes your sky and all evidence. It cannot be undone.", "এটি তোমার আকাশ আর সব প্রমাণ স্থায়ীভাবে মুছে দেবে। আর ফেরানো যাবে না।")}</p>
                <div className="mt-3 flex gap-3">
                  <button type="button" onClick={async () => { await forget(); setConfirm(false); setGone(true); }} className="rounded-[14px] bg-again px-4 py-2 font-semibold text-sheet">{tx("Yes, delete", "হ্যাঁ, মুছে দাও")}</button>
                  <button type="button" onClick={() => setConfirm(false)} className="rounded-[14px] px-4 py-2 font-semibold text-cloth-mid hover:text-cloth">{tx("Keep it", "রেখে দাও")}</button>
                </div>
              </div>
            )}
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">{tx("What IntelliHorizon can get wrong", "ইন্টেলিহরাইজন যেখানে ভুল করতে পারে")}</h2>
            <ul className="mt-3 space-y-1.5 text-cloth-mid">
              <li>{tx("One answer can be a slip. That is why every guess can be challenged.", "একটি উত্তর অসাবধানতাও হতে পারে। তাই প্রতিটি অনুমান চ্যালেঞ্জ করা যায়।")}</li>
              <li>{tx("Rumi only listens for key ideas, so a correct explanation in unusual words may be missed.", "রুমি শুধু মূল ধারণা খোঁজে, তাই অপ্রচলিত শব্দে বলা সঠিক ব্যাখ্যা ধরা নাও পড়তে পারে।")}</li>
              <li>{tx("Every text carries a label: checked curriculum fact, historical record, or IntelliHorizon explanation.", "প্রতিটি লেখায় লেবেল থাকে: যাচাই করা পাঠ্যক্রম তথ্য, ঐতিহাসিক নথি বা ইন্টেলিহরাইজনের ব্যাখ্যা।")}</li>
              <li>{tx("If something feels wrong or upsetting, talk to a teacher or a trusted adult. IntelliHorizon is a study tool, not a replacement for people.", "কিছু ভুল বা খারাপ লাগলে শিক্ষক বা বিশ্বস্ত বড় কারও সাথে কথা বলো। ইন্টেলিহরাইজন পড়ার সহায়ক, মানুষের বিকল্প নয়।")}</li>
            </ul>
            <p className="mt-4"><StitchLink to="/blueprint">{tx("Read the full concept book", "পুরো ধারণাপত্র পড়ো")}</StitchLink></p>
          </div>
        </section>
      </main>
    </NightPage>
  );
}
