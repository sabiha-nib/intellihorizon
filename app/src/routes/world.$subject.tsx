import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";

import { Sky } from "../components/edu/Sky";
import { StarPanel } from "../components/edu/StarPanel";
import { GLOW_LABEL, NightPage, StarGlyph } from "../components/edu/ui";
import { CONCEPTS } from "../content/concepts";
import { subjectById } from "../content/subjects";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/world/$subject")({
  loader: ({ params }) => {
    if (!subjectById(params.subject)) throw notFound();
    return { subject: params.subject };
  },
  head: ({ params }) => ({ meta: [{ title: `${subjectById(params.subject)?.name.en ?? "World"} | IntelliHorizon` }] }),
  component: World,
});

function World() {
  const { subject } = Route.useLoaderData();
  const s = subjectById(subject)!;
  const { t, tx, concept } = useLearner();
  const stars = CONCEPTS.filter((c) => c.subject === s.id);
  const [selected, setSelected] = useState<string | null>(stars.find((c) => c.route)?.id ?? null);
  return (
    <NightPage>
      <main className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
        <Link to="/sky" className="text-sm text-cloth-low hover:text-cloth">
          {tx("Back to the whole sky", "পুরো আকাশে ফিরে যাও")}
        </Link>
        <div className="mt-3 grid gap-8 md:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <span className="block h-1 w-14 rounded-full" style={{ background: s.thread }} />
            <h1 className="font-display mt-3 text-4xl font-bold tracking-tighter md:text-5xl">{t(s.name)}</h1>
            <p className="mt-2 max-w-[52ch] text-cloth-mid">{t(s.signature)}</p>
            <div className="mt-4 rounded-[14px] border border-dashed border-stitch bg-night-1/40">
              <Sky only={s.id} selected={selected} onSelect={(id) => setSelected(id)} />
            </div>
            <h2 className="font-display mt-8 text-xl font-bold">{tx("Chapters in this world", "এই জগতের অধ্যায়")}</h2>
            <ul className="mt-3 divide-y divide-dashed divide-stitch border-y border-dashed border-stitch">
              {stars.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setSelected(c.id)} className="flex w-full items-center gap-3 py-3 text-left hover:text-thread">
                    <svg width="28" height="28" viewBox="-14 -14 28 28" aria-hidden="true">
                      <StarGlyph glow={concept(c.id).glow} r={7} thread={s.thread} />
                    </svg>
                    <span className="flex-1">
                      <span className="block font-semibold">{t(c.title)}</span>
                      <span className="block text-sm text-cloth-low">{t(c.nctb)}</span>
                    </span>
                    <span className="text-xs text-cloth-low">{c.route ? t(GLOW_LABEL[concept(c.id).glow]) : tx("Preview", "প্রিভিউ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:pt-14">{selected && <StarPanel id={selected} onSelect={setSelected} onClose={() => setSelected(null)} />}</div>
        </div>
      </main>
    </NightPage>
  );
}
