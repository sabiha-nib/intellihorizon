import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call, msg } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { QuestionPlayer, bnDigits } from "../components/universe/learning";
import { Empty, LinkButton, Loading, PageTitle, Panel } from "../components/universe/ui";
import { getRevisionQueue } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/revision")({
  beforeLoad: () => requireAccount("/revision"),
  head: () => ({
    meta: [{ title: "Revision | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Revision,
});

type Data = Extract<Awaited<ReturnType<typeof getRevisionQueue>>, { ok: true }>;
function Revision() {
  const { tx, t, lang, refresh } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  useEffect(() => {
    void call(getRevisionQueue()).then((r) => (r.ok ? setD(r as Data) : setErr(r.code)));
  }, []);
  const date = (s: string) =>
    new Date(s).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
      day: "numeric",
      month: "long",
    });
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageTitle
          icon="revision"
          title={tx("Revision queue", "পুনরালোচনা")}
          sub={tx(
            "Questions come back on a schedule: the next day after a miss, then 3, 7, 14 and 30 days after each right answer.",
            "প্রশ্ন সময়মতো ফেরে: ভুলের পরদিন, তারপর প্রতিটি সঠিক উত্তরের পর ৩, ৭, ১৪ ও ৩০ দিনে।",
          )}
        />
        {err ? (
          <Empty title={tx("The queue didn't load", "তালিকা লোড হয়নি")} body={t(msg(err)!)} />
        ) : !d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : d.questions.length === 0 ? (
          <Empty
            icon="revision"
            title={tx("Nothing is due right now", "এখন কিছু বাকি নেই")}
            body={
              d.nextDue
                ? tx(
                    `${d.scheduled} question${d.scheduled === 1 ? " is" : "s are"} scheduled. The next comes back on ${date(d.nextDue)}.`,
                    `${bnDigits(d.scheduled)}টি প্রশ্ন নির্ধারিত। পরেরটি ফিরবে ${date(d.nextDue)}।`,
                  )
                : tx(
                    "Answer a few questions in a Learning Session and they'll start coming back here.",
                    "লার্নিং সেশনে কয়েকটি প্রশ্নের উত্তর দিলে সেগুলো এখানে ফিরতে শুরু করবে।",
                  )
            }
            action={<LinkButton to="/practice">{tx("Go to Practice", "অনুশীলনে যাও")}</LinkButton>}
          />
        ) : i < d.questions.length ? (
          <>
            <p className="text-[14px] text-ink-mid" lang={d.questions[i].language}>
              {d.questions[i].chapterTitle}
            </p>
            {d.questions[i].reason && (
              <p className="text-[14px] text-ink-mid" data-testid="revision-reason">
                {d.questions[i].reason.lastCorrect
                  ? tx(
                      `Why now: you got this right on ${date(d.questions[i].reason.lastAt)}. Reviewing after ${d.questions[i].reason.gapDays} day${d.questions[i].reason.gapDays > 1 ? "s" : ""} helps it stick; each right answer makes the next gap longer (1, 3, 7, 14, 30 days).`,
                      `কেন এখন: ${date(d.questions[i].reason.lastAt)} তারিখে এটি ঠিক করেছিলে। ${bnDigits(d.questions[i].reason.gapDays)} দিন পর আবার দেখলে মনে থাকে; প্রতিবার ঠিক হলে পরের বিরতি বাড়ে (১, ৩, ৭, ১৪, ৩০ দিন)।`,
                    )
                  : tx(
                      `Why now: you missed this on ${date(d.questions[i].reason.lastAt)}${d.questions[i].reason.lapses > 1 ? ` (${d.questions[i].reason.lapses} times so far)` : ""}, so it comes back after 1 day.`,
                      `কেন এখন: ${date(d.questions[i].reason.lastAt)} তারিখে এটি ভুল হয়েছিল${d.questions[i].reason.lapses > 1 ? ` (এ পর্যন্ত ${bnDigits(d.questions[i].reason.lapses)} বার)` : ""}, তাই ১ দিন পর ফিরেছে।`,
                    )}
              </p>
            )}
            <QuestionPlayer
              q={d.questions[i]}
              index={i}
              total={d.questions.length}
              sessionId={null}
              mode="review"
              onDone={(r) => {
                if (r && "correct" in r && r.correct) setRight(right + 1);
                setI(i + 1);
                window.scrollTo({ top: 0 });
                if (i + 1 >= d.questions.length) void refresh();
              }}
            />
          </>
        ) : (
          <Panel tone="lift" className="edu-rise p-6">
            <h2 className="font-display text-[26px] font-bold">
              {tx("Revision done for now", "আপাতত পুনরালোচনা শেষ")}
            </h2>
            <p className="mt-2 text-[16px] text-ink-mid">
              {tx(
                `${right} of ${d.questions.length} right. Each one has been rescheduled from today's answer.`,
                `${bnDigits(d.questions.length)}টির ${bnDigits(right)}টি সঠিক। আজকের উত্তর অনুযায়ী প্রতিটির পরের সময় ঠিক হয়েছে।`,
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton to="/dashboard">
                {tx("Back to dashboard", "ড্যাশবোর্ডে ফিরে যাও")}
              </LinkButton>
              <LinkButton to="/mistakes" variant="secondary">
                {tx("Open Misconception Radar", "ভুল ধারণার রাডার খোলো")}
              </LinkButton>
            </div>
          </Panel>
        )}
      </div>
    </Frame>
  );
}
