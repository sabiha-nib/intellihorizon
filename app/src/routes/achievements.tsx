import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import { Loading, PageTitle, ProgressBar } from "../components/universe/ui";
import { getProgression } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { ACHIEVEMENT_CATEGORY } from "../lib/learning/rules";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/achievements")({
  beforeLoad: () => requireAccount("/achievements"),
  head: () => ({
    meta: [{ title: "Achievements | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Achievements,
});

type Data = Extract<Awaited<ReturnType<typeof getProgression>>, { ok: true }>;
function Achievements() {
  const { tx, t, lang } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    void call(getProgression()).then((r) => r.ok && setD(r as Data));
  }, []);
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  const cats = Object.keys(ACHIEVEMENT_CATEGORY) as (keyof typeof ACHIEVEMENT_CATEGORY)[];
  return (
    <Frame>
      <div className="space-y-8">
        <PageTitle
          icon="achievements"
          title={tx("Achievements", "অর্জন")}
          sub={tx(
            "Each one is earned for something specific you did, read from your record. Time spent in the app never counts.",
            "প্রতিটি পাওয়া যায় তোমার করা নির্দিষ্ট কাজের জন্য, রেকর্ড থেকে। অ্যাপে কত সময় কাটালে তা কখনো গোনা হয় না।",
          )}
        />
        {!d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : (
          <>
            <p className="text-[16px] font-semibold">
              {tx(
                `${d.achievements.filter((a) => a.earnedAt).length} of ${d.achievements.length} earned`,
                `${N(d.achievements.length)}টির ${N(d.achievements.filter((a) => a.earnedAt).length)}টি পেয়েছ`,
              )}
            </p>
            {cats.map((c) => {
              const list = d.achievements.filter((a) => a.category === c);
              if (!list.length) return null;
              return (
                <section key={c} aria-labelledby={`cat-${c}`}>
                  <h2 id={`cat-${c}`} className="mb-3 font-display text-[20px] font-bold">
                    {t(ACHIEVEMENT_CATEGORY[c])}
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((a) => (
                      <li
                        key={a.id}
                        className={`flex gap-4 rounded-[20px] border p-5 ${a.earnedAt ? "border-transparent bg-amber-soft" : "border-line bg-sheet"}`}
                      >
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${a.earnedAt ? "bg-amber-fill text-ink" : "bg-lilac text-ink-low"}`}
                        >
                          <Icon name={a.earnedAt ? "achievements" : "lock"} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[18px] font-bold leading-tight">
                            {t(a.title)}
                          </p>
                          <p className="mt-0.5 text-[14px] text-ink-mid">{t(a.how)}</p>
                          {a.earnedAt ? (
                            <p className="mt-2 text-[13px] font-semibold text-amber">
                              {tx("Earned ", "পেয়েছ ")}
                              {new Date(a.earnedAt).toLocaleDateString(
                                lang === "bn" ? "bn-BD" : "en-GB",
                                { day: "numeric", month: "long" },
                              )}
                            </p>
                          ) : (
                            <div className="mt-3">
                              <ProgressBar
                                value={a.value}
                                max={a.target}
                                tone="amber"
                                size="sm"
                                label={t(a.title)}
                              />
                              <p className="mt-1 text-[13px] text-ink-low">
                                {N(a.value)} / {N(a.target)}
                              </p>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>
    </Frame>
  );
}
