import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Sky } from "../components/edu/Sky";
import { StarPanel } from "../components/edu/StarPanel";
import { GLOW_LABEL, IgniteLink, NightPage, StarGlyph, StitchLink } from "../components/edu/ui";
import { CONCEPTS, conceptById, PLAYABLE_IDS } from "../content/concepts";
import { SUBJECTS } from "../content/subjects";
import type { Lang } from "../content/types";
import { GLOW_ORDER, glowLevel } from "../lib/model";
import { nextStep } from "../lib/next";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/sky")({
  head: () => ({ meta: [{ title: "Understanding Sky | IntelliHorizon" }] }),
  component: Home,
});

function Welcome() {
  const { tx, t, updatePrefs, prefs } = useLearner();
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  return (
    <section className="edu-rise rounded-[14px] border border-dashed border-thread/60 bg-night-1/90 p-5" aria-label={tx("Welcome", "স্বাগতম")}>
      <p className="text-sm font-semibold text-thread">{tx(`Step ${step + 1} of 3`, `ধাপ ${["১", "২", "৩"][step]} / ৩`)}</p>
      {step === 0 && (
        <>
          <h2 className="font-display mt-2 text-2xl font-bold leading-tight">{tx("Which language feels like home?", "কোন ভাষায় শিখতে স্বচ্ছন্দ?")}</h2>
          <p className="mt-1 text-sm text-cloth-mid">{tx("You can switch any time, even in the middle of a question.", "যেকোনো সময় বদলাতে পারবে, এমনকি প্রশ্নের মাঝখানেও।")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["bn", "en"] as Lang[]).map((l) => (
              <button key={l} type="button" lang={l} onClick={() => { updatePrefs({ lang: l }); setStep(1); }} className="rounded-[14px] border border-dashed border-stitch px-4 py-4 text-lg font-bold hover:border-thread hover:text-thread active:scale-[0.98]">
                {l === "bn" ? "বাংলা" : "English"}
              </button>
            ))}
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <h2 className="font-display mt-2 text-2xl font-bold leading-tight">{tx("Which class are you in?", "তুমি কোন শ্রেণিতে পড়ো?")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {[6, 7, 8, 9, 10].map((g) => (
              <button key={g} type="button" aria-pressed={prefs.grade === g} onClick={() => updatePrefs({ grade: g })} className={`h-11 w-11 rounded-full border text-base font-bold ${prefs.grade === g ? "border-thread bg-thread text-night-0" : "border-stitch hover:border-thread"}`}>
                {t({ en: String(g), bn: ["৬", "৭", "৮", "৯", "১০"][g - 6] })}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-cloth-mid">{tx("Your textbook version", "তোমার বইয়ের ভার্সন")}</p>
          <div className="mt-2 flex gap-2">
            {(["bangla", "english"] as const).map((md) => (
              <button key={md} type="button" aria-pressed={prefs.medium === md} onClick={() => updatePrefs({ medium: md })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${prefs.medium === md ? "border-thread bg-thread text-night-0" : "border-stitch hover:border-thread"}`}>
                {md === "bangla" ? tx("Bangla version", "বাংলা ভার্সন") : tx("English version", "ইংলিশ ভার্সন")}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4">
            <button type="button" onClick={() => setStep(2)} className="rounded-[14px] bg-thread px-5 py-2.5 font-bold text-night-0 active:scale-[0.98]">
              {tx("Next", "পরের ধাপ")}
            </button>
            <p className="text-xs text-cloth-low">{tx("No name, phone number or email needed.", "নাম, ফোন নম্বর বা ইমেইল লাগবে না।")}</p>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="font-display mt-2 text-2xl font-bold leading-tight">{tx("Pick something you wonder about", "কোনটা নিয়ে তোমার কৌতূহল?")}</h2>
          <ul className="mt-4 space-y-2">
            {PLAYABLE_IDS.map((id) => {
              const c = conceptById(id)!;
              return (
                <li key={id}>
                  <button type="button" onClick={() => { updatePrefs({ onboarded: true }); void navigate({ to: c.route! }); }} className="w-full rounded-[14px] border border-dashed border-stitch p-3 text-left hover:border-thread">
                    <span className="block font-semibold">{t(c.hook!)}</span>
                    <span className="block text-sm text-cloth-low">{t(c.nctb)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <button type="button" onClick={() => updatePrefs({ onboarded: true })} className="mt-4 text-sm text-cloth-low underline decoration-dashed underline-offset-4 hover:text-cloth">
        {tx("Just let me look around", "আগে একটু ঘুরে দেখি")}
      </button>
    </section>
  );
}

function Invitation() {
  const { t, tx, model, rows } = useLearner();
  const step = nextStep(model);
  const returning = rows.length > 0;
  return (
    <section className="edu-rise">
      <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tighter md:text-5xl">{tx("Your sky lights up as you understand.", "যত বুঝবে, তত জ্বলবে তোমার আকাশ।")}</h1>
      <p className="mt-3 max-w-[46ch] text-base leading-relaxed text-cloth-mid">
        {tx("Stars brighten only on evidence: an explanation, a fixed misconception, an idea that survives a disguise.", "তারা জ্বলে শুধু প্রমাণে: একটি ব্যাখ্যা, শুধরে নেওয়া ভুল ধারণা, ছদ্মবেশে টিকে থাকা ধারণা।")}
      </p>
      <div className="mt-6 rounded-[14px] border border-dashed border-thread/60 bg-night-1/80 p-4">
        <p className="text-sm font-semibold text-thread">{returning ? tx("Most useful next step", "সবচেয়ে কাজের পরের ধাপ") : tx("A good first wonder", "শুরু করার মতো একটি প্রশ্ন")}</p>
        <p className="font-display mt-1 text-xl font-bold leading-snug">{t(step.title)}</p>
        <p className="mt-1 text-sm leading-relaxed text-cloth-mid">{t(step.reason)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <IgniteLink to={step.to} search={{ phase: step.phase }}>{returning ? tx("Go", "চলো") : tx("Start", "শুরু করো")}</IgniteLink>
          <StitchLink to="/tomorrow">{tx("Exam tomorrow?", "কাল পরীক্ষা?")}</StitchLink>
        </div>
      </div>
    </section>
  );
}

function Home() {
  const { t, tx, prefs, concept } = useLearner();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <NightPage>
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-2 md:grid-cols-[minmax(0,1fr)_360px] md:gap-8 md:px-6 md:pt-6">
        <div className="order-2 md:order-1">
          <Sky selected={selected} onSelect={setSelected} />
          <p className="mt-1 text-center text-xs text-cloth-low">{tx("Tap any star. Dashed rings mark the three worlds open in this pilot.", "যেকোনো তারায় চাপ দাও। ড্যাশ দেওয়া বৃত্ত মানে এই পাইলটে খোলা তিনটি জগৎ।")}</p>
        </div>
        <div className="order-1 md:order-2 md:pt-6">
          {selected ? <StarPanel id={selected} onSelect={setSelected} onClose={() => setSelected(null)} /> : prefs.onboarded ? <Invitation /> : <Welcome />}
        </div>
      </main>

      <section className="mx-auto mt-14 w-full max-w-6xl px-4 md:px-6" aria-labelledby="worlds-h">
        <h2 id="worlds-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">{tx("Eight worlds, each with its own way of thinking", "আটটি জগৎ, প্রতিটির নিজস্ব ভাবনার ধরন")}</h2>
        <ul className="mt-5 flex snap-x gap-4 overflow-x-auto pb-4">
          {SUBJECTS.map((s) => {
            const stars = CONCEPTS.filter((c) => c.subject === s.id);
            const lit = stars.filter((c) => glowLevel(concept(c.id).glow) >= 3).length;
            return (
              <li key={s.id} className="w-64 shrink-0 snap-start">
                <Link to="/world/$subject" params={{ subject: s.id }} className="block h-full rounded-[14px] border border-dashed border-stitch bg-night-1/60 p-4 transition-colors hover:border-thread">
                  <span className="block h-1 w-12 rounded-full" style={{ background: s.thread }} />
                  <span className="font-display mt-3 block text-lg font-bold">{t(s.name)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-cloth-mid">{t(s.world)}</span>
                  <span className="mt-3 block text-xs text-cloth-low">{tx(`${lit} of ${stars.length} stars lit`, `${stars.length}টির মধ্যে ${lit}টি তারা জ্বলছে`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto mt-12 w-full max-w-6xl px-4 md:px-6" aria-labelledby="glow-h">
        <h2 id="glow-h" className="font-display text-2xl font-bold tracking-tight md:text-3xl">{tx("What a star's light means", "তারার আলোর মানে")}</h2>
        <p className="mt-2 max-w-[60ch] text-cloth-mid">{tx("No points, no streaks. Light is earned by evidence of understanding, and it never drops because you took a break.", "কোনো পয়েন্ট বা স্ট্রিক নেই। আলো আসে বোঝার প্রমাণ থেকে, আর বিরতি নিলে তা কমে না।")}</p>
        <ol className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {GLOW_ORDER.map((g) => (
            <li key={g} className="flex items-center gap-3">
              <svg width="36" height="36" viewBox="-18 -18 36 36" aria-hidden="true">
                <StarGlyph glow={g} r={9} />
              </svg>
              <span className="text-sm font-semibold leading-tight">{t(GLOW_LABEL[g])}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-cloth-low">
          {tx("Curious how IntelliHorizon decides? ", "ইন্টেলিহরাইজন কীভাবে সিদ্ধান্ত নেয় জানতে চাও? ")}
          <StitchLink to="/mirror">{tx("Open your Mirror", "তোমার আয়না খোলো")}</StitchLink>
        </p>
      </section>

      <footer className="mx-auto mt-16 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-dashed border-stitch px-4 py-6 text-sm text-cloth-low md:px-6">
        <p>{tx("IntelliHorizon pilot for NCTB Grades 6 to 10. Curriculum mapping is being verified with teachers.", "এনসিটিবি ষষ্ঠ-দশম শ্রেণির জন্য ইন্টেলিহরাইজন পাইলট। পাঠ্যক্রমের মিল শিক্ষকদের সাথে যাচাই চলছে।")}</p>
        <Link to="/blueprint" className="font-semibold text-cloth-mid underline decoration-dashed underline-offset-4 hover:text-thread">
          {tx("Concept book", "ধারণাপত্র")}
        </Link>
      </footer>
    </NightPage>
  );
}
