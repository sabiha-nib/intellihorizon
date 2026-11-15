import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { MissionList } from "../components/universe/dash";
import { Frame } from "../components/universe/Shell";
import { bnDigits } from "../components/universe/learning";
import { Loading, PageTitle, Panel, SectionTitle } from "../components/universe/ui";
import { getProgression } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { XP_RULES } from "../lib/learning/rules";
import { XP } from "../lib/learning/rules";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/missions")({
  beforeLoad: () => requireAccount("/missions"),
  head: () => ({
    meta: [{ title: "Missions | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Missions,
});

type Data = Extract<Awaited<ReturnType<typeof getProgression>>, { ok: true }>;
function Missions() {
  const { tx, t, lang } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    void call(getProgression()).then((r) => r.ok && setD(r as Data));
  }, []);
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageTitle
          icon="missions"
          title={tx("Missions", "মিশন")}
          sub={tx(
            "Four small goals for today. Each one fills from what you actually do, and resets tomorrow.",
            "আজকের জন্য চারটি ছোট লক্ষ্য। যা সত্যি করো তা দিয়েই ভরে, কাল আবার নতুন।",
          )}
        />
        {!d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : (
          <>
            <Panel className="p-6">
              <MissionList missions={d.missions} />
              <p className="mt-4 text-[14px] text-ink-mid">
                {tx(
                  `${d.missions.filter((m) => m.done).length} of ${d.missions.length} done today. Daily goal: ${d.goal} questions.`,
                  `আজ ${N(d.missions.length)}টির ${N(d.missions.filter((m) => m.done).length)}টি হয়েছে। দৈনিক লক্ষ্য: ${N(d.goal)}টি প্রশ্ন।`,
                )}
              </p>
            </Panel>
            <Panel tone="lilac" className="p-6">
              <SectionTitle
                title={tx("How XP is earned", "এক্সপি কীভাবে আসে")}
                sub={tx(
                  "Every reward is tied to one recorded event and can be earned once, so repeating or re-sending an answer adds nothing.",
                  "প্রতিটি পুরস্কার একটি জমা হওয়া ঘটনার সঙ্গে বাঁধা এবং একবারই পাওয়া যায়, তাই একই উত্তর বারবার দিলে কিছু যোগ হয় না।",
                )}
              />
              <ul className="space-y-2">
                {XP_RULES.map((r) => (
                  <li key={r.kind} className="flex items-center justify-between gap-4 text-[15px]">
                    <span>{t(r.label)}</span>
                    <span className="tnum shrink-0 font-semibold text-brand-deep">
                      +{N(XP[r.kind])} XP
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </div>
    </Frame>
  );
}
