import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { conceptById } from "../../content/concepts";
import { subjectById } from "../../content/subjects";
import type { L, LessonPack } from "../../content/types";
import type { Phase } from "../../lib/next";
import { useLearner } from "../../lib/store";
import { QuestionCard } from "./QuestionCard";
import { Sense } from "./Sense";
import { TeachBack } from "./TeachBack";
import { ThenNow } from "./ThenNow";
import { Trials } from "./Trials";
import { IgniteButton, PaperPage } from "./ui";

export const PHASES: { id: Phase; label: L; lead: L }[] = [
  { id: "wonder", label: { en: "Wonder", bn: "ভাবো" }, lead: { en: "Predict before you are told anything. Wrong guesses are welcome here.", bn: "কিছু জানার আগেই অনুমান করো। ভুল অনুমানেও কোনো সমস্যা নেই।" } },
  { id: "explore", label: { en: "Explore", bn: "খুঁজে দেখো" }, lead: { en: "Test your prediction yourself. Change one thing at a time.", bn: "নিজেই অনুমান যাচাই করো। একবারে একটা জিনিস বদলাও।" } },
  { id: "sense", label: { en: "Make sense", bn: "বুঝে নাও" }, lead: { en: "Your predictions meet what holds, explained the way that works for you.", bn: "তোমার অনুমান আর সত্যের মিলন, তোমার পছন্দের ব্যাখ্যায়।" } },
  { id: "teach", label: { en: "Teach Rumi", bn: "রুমিকে শেখাও" }, lead: { en: "If you can explain it to someone younger, you own it.", bn: "ছোট কাউকে বোঝাতে পারলে, ধারণাটা তোমার।" } },
  { id: "trials", label: { en: "Disguises", bn: "ছদ্মবেশ" }, lead: { en: "The same idea in four disguises. Understanding survives them; memorised answers usually do not.", bn: "একই ধারণা চার ছদ্মবেশে। বোঝা ধারণা টেকে; মুখস্থ উত্তর সাধারণত টেকে না।" } },
  { id: "then", label: { en: "Then and now", bn: "আগে ও এখন" }, lead: { en: "See how your thinking changed.", bn: "দেখো তোমার ভাবনা কীভাবে বদলেছে।" } },
];

function Wonder({ pack, onDone }: { pack: LessonPack; onDone: () => void }) {
  const { tx } = useLearner();
  const [i, setI] = useState(0);
  const q = pack.probe[i];
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink-mid">{tx(`Prediction ${i + 1} of ${pack.probe.length}`, `অনুমান ${i + 1} / ${pack.probe.length}`)}</p>
      <QuestionCard key={q.id} q={q} reveal={false} onDone={() => (i < pack.probe.length - 1 ? setI(i + 1) : onDone())} cta={i < pack.probe.length - 1 ? tx("Next prediction", "পরের অনুমান") : tx("Test it myself", "নিজে যাচাই করি")} />
    </div>
  );
}

export function LessonShell({ pack, phase, setPhase, explore, sense }: { pack: LessonPack; phase: Phase; setPhase: (p: Phase) => void; explore: ReactNode; sense?: ReactNode }) {
  const { t, tx } = useLearner();
  const c = conceptById(pack.concept)!;
  const s = subjectById(c.subject)!;
  const idx = PHASES.findIndex((p) => p.id === phase);
  const go = (p: Phase) => setPhase(p);
  const nextOf = (p: Phase) => PHASES[Math.min(PHASES.findIndex((x) => x.id === p) + 1, PHASES.length - 1)].id;
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, [phase]);

  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-4xl px-4 pt-2 md:px-6">
        <Link to="/world/$subject" params={{ subject: s.id }} className="text-sm text-ink-mid hover:text-ink">
          {tx(`Back to ${s.name.en}`, `${s.name.bn}-এ ফিরে যাও`)}
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span className="h-1 w-10 rounded-full" style={{ background: s.thread }} />
          <span className="text-sm text-ink-low">{t(c.nctb)}</span>
        </div>
        <h1 className="font-display mt-2 text-3xl font-bold leading-tight tracking-tighter md:text-5xl">{t(c.title)}</h1>

        <nav className="mt-6 overflow-x-auto pb-2" aria-label={tx("Lesson path", "পাঠের পথ")}>
          <ol className="flex min-w-max items-center">
            {PHASES.map((p, k) => (
              <li key={p.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => go(p.id)}
                  aria-current={phase === p.id ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${phase === p.id ? "bg-brand text-sheet" : k < idx ? "text-ink" : "text-ink-low hover:text-ink"}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${phase === p.id ? "border-thread bg-thread text-ink" : k < idx ? "border-ink" : "border-dashed border-ink-low"}`}>{k + 1}</span>
                  {t(p.label)}
                </button>
                {k < PHASES.length - 1 && <span className="mx-1 h-px w-5 border-t-2 border-dashed border-ink-low/50" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </nav>
        <p className="mt-3 max-w-[60ch] text-ink-mid">{t(PHASES[idx].lead)}</p>

        <div className="mt-6" key={phase}>
          {phase === "wonder" && <Wonder pack={pack} onDone={() => go("explore")} />}
          {phase === "explore" && (
            <div className="space-y-5">
              {explore}
              <IgniteButton onClick={() => go("sense")}>{tx("I've explored, let's make sense of it", "দেখা হলো, এবার বুঝে নিই")}</IgniteButton>
            </div>
          )}
          {phase === "sense" && (sense ?? <Sense pack={pack} onDone={() => go("teach")} />)}
          {phase === "teach" && <TeachBack pack={pack} onDone={() => go("trials")} />}
          {phase === "trials" && <Trials pack={pack} onDone={() => go(nextOf("trials"))} />}
          {phase === "then" && <ThenNow pack={pack} />}
        </div>
      </main>
    </PaperPage>
  );
}

export function parsePhase(p: unknown): Phase | undefined {
  return PHASES.some((x) => x.id === p) ? (p as Phase) : undefined;
}
