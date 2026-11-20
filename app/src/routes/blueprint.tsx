import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { IgniteLink, NightPage, StarGlyph } from "../components/edu/ui";
import { AUDIT, CATEGORIES, DEFINING, DEMO, FEATURES, FLAGSHIPS, IDENTITY, PRINCIPLES, THESIS, TIERS } from "../content/blueprint";

export const Route = createFileRoute("/blueprint")({
  head: () => ({ meta: [{ title: "Concept book | IntelliHorizon" }, { name: "description", content: "Product thesis, 85 feature concepts, flagships, roadmap and demo plan for IntelliHorizon." }] }),
  component: Blueprint,
});

const SYSTEM: { name: string; text: string }[] = [
  { name: "Navigation", text: "Three permanent destinations: Sky (home, worlds, knowledge discovery), Exam tomorrow (focused practice) and Mirror (trust and control). Lessons, creation labs, Rumi and trials open in context from a star, never as tabs." },
  { name: "Visual direction", text: "Kantha night: an indigo sky stitched with running-stitch threads, one marigold accent for light and action, eight muted subject threads for identity only. Lessons move to daylight paper for reading comfort. Bricolage Grotesque for Latin display, Hind Siliguri for all Bangla and body text." },
  { name: "Motion", text: "Only motion that carries meaning: a star ignites when evidence arrives, a bridge thread draws when ideas connect, a fragile star flickers. Everything respects reduced motion." },
  { name: "First-time journey", text: "Language, class and a curious question: three taps, no diagnostic exam. The first lesson asks for a prediction within a minute, and the sky shows the first star lighting by the end." },
  { name: "Responsible AI", text: "No personal data needed; teacher and family sharing off by default; every diagnosis explained and contestable; content labelled by source; delete everything in one confirmed step; Rumi clearly simulated." },
  { name: "Bangla-first and global", text: "Content is authored in Bangla and English, switchable mid-question, with a language disguise in every trial set. Concepts map to NCTB chapters through a curriculum layer that can be swapped for other national curricula and languages." },
  { name: "Low-cost phones and offline", text: "Plain SVG and text, no mandatory 3D, a service worker that keeps visited lessons available, and a visible queue of evidence waiting to sync." },
  { name: "Honest pilot scope", text: "The prototype uses a transparent rule-based learner model and authored misconception maps. Generative explanations, handwriting feedback and teacher views are in the expansion stage and will be labelled as AI-generated." },
];

function Blueprint() {
  const [cat, setCat] = useState<string>("all");
  const [liveOnly, setLiveOnly] = useState(false);
  const list = useMemo(() => FEATURES.filter((f) => (cat === "all" || f.cat === cat) && (!liveOnly || f.live)), [cat, liveOnly]);
  const live = FEATURES.filter((f) => f.live).length;
  return (
    <NightPage>
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-6" lang="en">
        <p className="text-sm font-semibold text-thread">Concept book, International AI Builders Congress 2026</p>
        <h1 className="font-display mt-2 text-4xl font-bold leading-[1.05] tracking-tighter md:text-6xl">An AI teacher that knows the difference.</h1>
        <p className="mt-4 max-w-[60ch] text-lg text-cloth-mid">{THESIS.why}</p>
        <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-cloth-mid" aria-label="Sections">
          {[["thesis", "Thesis"], ["principles", "Principles"], ["flagships", "Flagships"], ["defining", "Defining feature"], ["portfolio", "85 features"], ["system", "Product system"], ["roadmap", "Roadmap"], ["audit", "Audit"], ["demo", "3-minute demo"], ["identity", "Identity"]].map(([id, n]) => (
            <a key={id} href={`#${id}`} className="underline decoration-dashed underline-offset-4 hover:text-thread">{n}</a>
          ))}
        </nav>

        <section id="thesis" className="mt-14 grid gap-6 border-t border-dashed border-stitch pt-8 md:grid-cols-2">
          {([["Vision", THESIS.vision], ["The student problem", THESIS.problem], ["Category", THESIS.category], ["Core promise", THESIS.promise], ["Main differentiation", THESIS.differentiation]] as const).map(([k, v]) => (
            <div key={k} className={k === "Main differentiation" ? "md:col-span-2" : ""}>
              <h2 className="text-sm font-semibold text-thread">{k}</h2>
              <p className="mt-1 text-lg leading-relaxed">{v}</p>
            </div>
          ))}
        </section>

        <section id="principles" className="mt-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">Design principles</h2>
          <ol className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <li key={p.name} className="flex gap-4">
                <span className="font-display text-2xl font-bold text-thread tabular-nums">{i + 1}</span>
                <span>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-cloth-mid">{p.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section id="flagships" className="mt-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">Three flagship experiences</h2>
          <div className="mt-6 space-y-6">
            {FLAGSHIPS.map((f, i) => (
              <article key={f.name} className="rounded-[14px] border border-dashed border-stitch bg-night-1/60 p-6">
                <p className="text-sm font-semibold text-thread">Flagship {i + 1}</p>
                <h3 className="font-display mt-1 text-2xl font-bold">{f.name}</h3>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  {([["What the student sees", f.sees], ["What the student does", f.does], ["What makes it different", f.different], ["Why it matters", f.meaningful], ["What a judge observes", f.judge], ["How to evaluate it", f.evaluate], ["Why a chatbot or quiz app can't simply copy it", f.hard]] as const).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-sm font-semibold text-cloth-low">{k}</dt>
                      <dd className="mt-0.5 leading-relaxed text-cloth-mid">{v}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section id="defining" className="mt-16 rounded-[14px] bg-thread p-6 text-night-0 md:p-8">
          <p className="text-sm font-bold">The generation-defining feature</p>
          <h2 className="font-display mt-1 text-3xl font-bold tracking-tight md:text-4xl">{DEFINING.name}</h2>
          <p className="mt-3 max-w-[70ch] text-lg leading-relaxed">{DEFINING.idea}</p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {([["Prototype (running now)", DEFINING.prototype], ["Expansion", DEFINING.expansion], ["Future vision", DEFINING.future]] as const).map(([k, v]) => (
              <div key={k} className="rounded-[14px] border border-dashed border-night-0/40 p-4">
                <p className="font-bold">{k}</p>
                <p className="mt-1 leading-relaxed">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-[70ch] leading-relaxed">{DEFINING.distinct}</p>
          <div className="mt-6"><IgniteLink to="/learn/fall">Try it now</IgniteLink></div>
        </section>

        <section id="portfolio" className="mt-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">Feature portfolio</h2>
          <p className="mt-2 text-cloth-mid">85 concepts in 15 categories. {live} are running in this prototype.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" aria-pressed={cat === "all"} onClick={() => setCat("all")} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${cat === "all" ? "border-thread bg-thread text-night-0" : "border-stitch hover:border-thread"}`}>All</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${cat === c.id ? "border-thread bg-thread text-night-0" : "border-stitch hover:border-thread"}`}>
                {c.id}. {c.name}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-cloth-mid">
            <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} className="h-4 w-4 accent-[#57707A]" />
            Show only features running now
          </label>
          <ul className="mt-5 divide-y divide-dashed divide-stitch border-y border-dashed border-stitch">
            {list.map((f) => (
              <li key={f.name}>
                <details className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true"><StarGlyph glow={f.live ? "shapeshifter" : f.tier <= 2 ? "holding" : "glimpsed"} r={6} /></svg>
                    <span className="flex-1 font-semibold group-open:text-thread">{f.name}</span>
                    <span className="hidden text-xs text-cloth-low sm:inline">{CATEGORIES.find((c) => c.id === f.cat)?.name}</span>
                    <span className="rounded-full border border-dashed border-stitch px-2 py-0.5 text-xs text-cloth-mid">Tier {f.tier}</span>
                    {f.live && <span className="rounded-full bg-thread px-2 py-0.5 text-xs font-bold text-night-0">Running</span>}
                  </summary>
                  <dl className="mt-3 grid gap-3 pl-9 md:grid-cols-2">
                    {([["Student experience", f.exp], ["The difference", f.diff], ["Educational value", f.value], ["Evidence of success", f.evidence]] as const).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-semibold text-cloth-low">{k}</dt>
                        <dd className="text-cloth-mid">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section id="system" className="mt-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">Product system</h2>
          <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
            {SYSTEM.map((s) => (
              <div key={s.name} className="border-t border-dashed border-stitch pt-3">
                <h3 className="font-semibold text-thread">{s.name}</h3>
                <p className="mt-1 leading-relaxed text-cloth-mid">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="roadmap" className="mt-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">Prioritised roadmap</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {([1, 2, 3, 4] as const).map((tier) => {
              const fs = FEATURES.filter((f) => f.tier === tier);
              return (
                <div key={tier} className="rounded-[14px] border border-dashed border-stitch p-5">
                  <p className="text-sm font-semibold text-thread">Tier {tier} · {fs.length} features</p>
                  <h3 className="font-display mt-1 text-xl font-bold">{TIERS[tier].name}</h3>
                  <p className="mt-1 text-sm text-cloth-mid">{TIERS[tier].why}</p>
                  <p className="mt-3 text-sm leading-relaxed text-cloth-low">{fs.map((f) => f.name).join(" · ")}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="audit" className="mt-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">Differentiation audit</h2>
          <p className="mt-2 text-cloth-mid">Generic ideas we considered and replaced.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-cloth-low">
                <tr><th className="py-2 pr-4 font-semibold">Weak idea</th><th className="py-2 pr-4 font-semibold">Problem</th><th className="py-2 font-semibold">Replaced with</th></tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-stitch border-y border-dashed border-stitch">
                {AUDIT.map((a) => (
                  <tr key={a.weak}><td className="py-3 pr-4 font-semibold">{a.weak}</td><td className="py-3 pr-4 text-cloth-mid">{a.problem}</td><td className="py-3 text-cloth">{a.replaced}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="demo" className="mt-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">The three-minute demonstration</h2>
          <ol className="mt-6 space-y-4 border-l-2 border-dashed border-thread pl-6">
            {DEMO.map((d) => (
              <li key={d.t}>
                <p className="text-sm font-semibold text-thread tabular-nums">{d.t} · {d.beat}</p>
                <p className="mt-0.5 text-cloth-mid">{d.show}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="identity" className="mt-16 mb-6 rounded-[14px] border border-dashed border-thread/60 bg-night-1/70 p-6 md:p-8">
          <h2 className="font-display text-3xl font-bold tracking-tight">Final product identity</h2>
          <dl className="mt-5 grid gap-5 md:grid-cols-2">
            <div><dt className="text-sm font-semibold text-thread">Five most distinctive concepts</dt><dd className="mt-1 text-cloth-mid">{IDENTITY.five.join(" · ")}</dd></div>
            <div><dt className="text-sm font-semibold text-thread">Most compelling flagship</dt><dd className="mt-1 text-cloth-mid">{IDENTITY.flagship}</dd></div>
            <div><dt className="text-sm font-semibold text-thread">Clearest outcome to validate</dt><dd className="mt-1 text-cloth-mid">{IDENTITY.outcome}</dd></div>
            <div><dt className="text-sm font-semibold text-thread">Most important principle</dt><dd className="mt-1 text-cloth-mid">{IDENTITY.principle}</dd></div>
          </dl>
          <p className="font-display mt-6 text-2xl font-bold leading-snug">{IDENTITY.remember}</p>
        </section>
      </main>
    </NightPage>
  );
}
