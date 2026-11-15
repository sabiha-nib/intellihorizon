import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { JourneyList, MissionList } from "../components/universe/dash";
import { Frame } from "../components/universe/Shell";
import { Loading, PageTitle, Panel, SectionTitle } from "../components/universe/ui";
import { getDashboard } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/plan")({
  beforeLoad: () => requireAccount("/plan"),
  head: () => ({
    meta: [{ title: "Today's plan | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Plan,
});

type Data = Extract<Awaited<ReturnType<typeof getDashboard>>, { ok: true }>;
function Plan() {
  const { tx } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    void call(getDashboard()).then((r) => r.ok && setD(r as Data));
  }, []);
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageTitle
          icon="plan"
          title={tx("Today's plan", "আজকের পরিকল্পনা")}
          sub={tx(
            "Built from your own record: what's due, what needs another try, and where you left off. Steps tick themselves off when you do them.",
            "তোমার নিজের রেকর্ড থেকে তৈরি: কী বাকি, কী আবার চেষ্টা দরকার, কোথায় থেমেছিলে। কাজ করলে নিজেই টিক পড়ে।",
          )}
        />
        {!d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : (
          <>
            <Panel className="p-6">
              {d.plan.length ? (
                <JourneyList tasks={d.plan} />
              ) : (
                <p className="text-ink-mid">
                  {tx(
                    "Open a chapter or answer a question and your plan will fill in.",
                    "একটি অধ্যায় খোলো বা উত্তর দাও, পরিকল্পনা তৈরি হবে।",
                  )}
                </p>
              )}
            </Panel>
            <Panel className="p-6">
              <SectionTitle title={tx("Today's missions", "আজকের মিশন")} />
              <MissionList missions={d.missions} />
            </Panel>
          </>
        )}
      </div>
    </Frame>
  );
}
