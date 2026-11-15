import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { SubjectDot } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import {
  Badge,
  Empty,
  LinkButton,
  Loading,
  PageTitle,
  Panel,
  ProgressBar,
} from "../components/universe/ui";
import type { L } from "../content/types";
import { getMastery } from "../lib/api/universe.functions";
import { subjectById } from "../lib/curriculum/registry";
import { requireAccount } from "../lib/guard";
import type { MasteryStatus } from "../lib/learning/rules";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/mastery")({
  beforeLoad: () => requireAccount("/mastery"),
  head: () => ({
    meta: [{ title: "Mastery evidence | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Mastery,
});

const STATUS: Record<MasteryStatus, { label: L; tone: "neutral" | "brand" | "amber" | "mint" }> = {
  none: { label: { en: "Not started", bn: "শুরু হয়নি" }, tone: "neutral" },
  practising: { label: { en: "Practising", bn: "অনুশীলন চলছে" }, tone: "brand" },
  developing: { label: { en: "Developing", bn: "এগোচ্ছে" }, tone: "amber" },
  demonstrated: { label: { en: "Demonstrated", bn: "প্রমাণিত" }, tone: "mint" },
};

type Data = Extract<Awaited<ReturnType<typeof getMastery>>, { ok: true }>;
function Mastery() {
  const { tx, t, lang } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    void call(getMastery()).then((r) => r.ok && setD(r as Data));
  }, []);
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  return (
    <Frame>
      <div className="mx-auto max-w-4xl space-y-8">
        <PageTitle
          icon="evidence"
          title={tx("Mastery evidence", "দক্ষতার প্রমাণ")}
          sub={tx(
            "What your answers in IntelliHorizon actually show, chapter by chapter. It's evidence from practice here, not an exam grade.",
            "ইন্টেলিহরাইজনে তোমার উত্তর আসলে কী দেখায়, অধ্যায় ধরে। এটি এখানকার অনুশীলনের প্রমাণ, পরীক্ষার নম্বর নয়।",
          )}
        />
        <Panel tone="lilac" className="p-5">
          <p className="font-semibold">
            {tx("How each level is decided", "প্রতিটি পর্যায় কীভাবে ঠিক হয়")}
          </p>
          <ul className="mt-2 space-y-1.5 text-[15px] text-ink-mid">
            <li>
              <Badge tone="brand">{t(STATUS.practising.label)}</Badge>{" "}
              {tx(
                "you've answered at least one question here.",
                "এখানে অন্তত একটি প্রশ্নের উত্তর দিয়েছ।",
              )}
            </li>
            <li>
              <Badge tone="amber">{t(STATUS.developing.label)}</Badge>{" "}
              {tx(
                "3 or more different questions, and at least 60% of your last 10 answers right.",
                "৩ বা বেশি ভিন্ন প্রশ্ন, আর শেষ ১০টি উত্তরের অন্তত ৬০% সঠিক।",
              )}
            </li>
            <li>
              <Badge tone="mint">{t(STATUS.demonstrated.label)}</Badge>{" "}
              {tx(
                "5 or more different questions right, a due revision answered correctly, and at least 70% of your last 10 right.",
                "৫ বা বেশি ভিন্ন প্রশ্ন সঠিক, সময়মতো একটি পুনরালোচনা সঠিক, আর শেষ ১০টির অন্তত ৭০% সঠিক।",
              )}
            </li>
          </ul>
        </Panel>
        {!d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : !d.chapters.length ? (
          <Empty
            icon="evidence"
            title={tx("No evidence yet", "এখনো কোনো প্রমাণ নেই")}
            body={tx(
              "Nothing is assumed. Answer questions in a chapter and this page will show what they add up to.",
              "কিছুই ধরে নেওয়া হয় না। কোনো অধ্যায়ে প্রশ্নের উত্তর দিলে এই পাতায় তার ফল দেখা যাবে।",
            )}
            action={
              <LinkButton to="/practice">{tx("Start practising", "অনুশীলন শুরু করো")}</LinkButton>
            }
          />
        ) : (
          <ul className="space-y-3">
            {d.chapters.map((c) => {
              const s = subjectById(c.subject);
              return (
                <li key={c.chapterId}>
                  <Panel className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mid">
                          {s && <SubjectDot hue={s.hue} size={8} />}
                          {s ? t(s.label) : ""}
                        </p>
                        <Link
                          to="/chapters/$chapterId"
                          params={{ chapterId: c.chapterId }}
                          className="font-display text-[19px] font-bold hover:underline"
                          lang="bn"
                        >
                          {c.title}
                        </Link>
                      </div>
                      <Badge tone={STATUS[c.status].tone}>{t(STATUS[c.status].label)}</Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <dt className="text-[13px] text-ink-mid">
                          {tx("Different questions tried", "চেষ্টা করা ভিন্ন প্রশ্ন")}
                        </dt>
                        <dd className="tnum font-display text-[22px] font-bold">
                          {N(c.distinct)}
                          <span className="text-[15px] text-ink-low">/{N(c.published)}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[13px] text-ink-mid">
                          {tx("Different questions right", "সঠিক ভিন্ন প্রশ্ন")}
                        </dt>
                        <dd className="tnum font-display text-[22px] font-bold">
                          {N(c.distinctCorrect)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[13px] text-ink-mid">
                          {tx("Recent accuracy", "সাম্প্রতিক সঠিকতা")}
                        </dt>
                        <dd className="tnum font-display text-[22px] font-bold">
                          {N(Math.round(c.recentRate * 100))}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[13px] text-ink-mid">
                          {tx("Right in revision", "পুনরালোচনায় সঠিক")}
                        </dt>
                        <dd className="tnum font-display text-[22px] font-bold">
                          {N(c.reviewCorrect)}
                        </dd>
                      </div>
                    </dl>
                    {c.status !== "demonstrated" && (
                      <div className="mt-4">
                        <ProgressBar
                          value={Math.min(c.distinctCorrect, 5)}
                          max={5}
                          tone="mint"
                          label={tx(
                            "Different questions right, out of 5 needed",
                            "দরকারি ৫টির মধ্যে সঠিক ভিন্ন প্রশ্ন",
                          )}
                        />
                        <Needed c={c} />
                        {c.attempts < 4 && (
                          <p className="mt-1 text-[13px] text-ink-low">
                            {tx(
                              `Based on only ${c.attempts} answer${c.attempts > 1 ? "s" : ""}: too few to judge the chapter.`,
                              `মাত্র ${bnDigits(c.attempts)}টি উত্তরের ভিত্তিতে: অধ্যায় বিচারের জন্য যথেষ্ট নয়।`,
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Frame>
  );
}

function Needed({ c }: { c: Data["chapters"][number] }) {
  const { tx } = useLearner();
  const need = [
    c.distinctCorrect < 5 &&
      tx(
        `${5 - c.distinctCorrect} more different question${5 - c.distinctCorrect > 1 ? "s" : ""} right`,
        `আরও ${bnDigits(5 - c.distinctCorrect)}টি ভিন্ন প্রশ্ন সঠিক`,
      ),
    c.reviewCorrect < 1 && tx("one due revision right", "একটি পুনরালোচনা সঠিক"),
    c.recentRate < 0.7 && tx("70% of your last 10 right", "শেষ ১০টির ৭০% সঠিক"),
  ].filter(Boolean);
  return need.length ? (
    <p className="mt-2 text-[14px] text-ink-mid">
      {tx("Still needed: ", "আরও দরকার: ")}
      {need.join(", ")}.
    </p>
  ) : null;
}
