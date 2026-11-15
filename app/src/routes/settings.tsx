import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame, LangSwitch } from "../components/universe/Shell";
import { bnDigits } from "../components/universe/learning";
import { Button, PageTitle, Panel, SectionTitle } from "../components/universe/ui";
import { getProgression, saveDailyGoal } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { readUi, writeUi, type UiPrefs } from "../lib/ui-prefs";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/settings")({
  beforeLoad: () => requireAccount("/settings"),
  head: () => ({
    meta: [{ title: "Settings | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: Settings,
});

function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`h-11 rounded-[12px] border-2 px-4 text-[15px] font-semibold ${value === o.v ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-sheet text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Settings() {
  const { tx, account, lang } = useLearner();
  const [ui, setUi] = useState<UiPrefs>({ text: "normal", motion: "system" });
  const [goal, setGoal] = useState<number | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    setUi(readUi());
    void call(getProgression()).then((r) => r.ok && setGoal((r as { goal: number }).goal));
  }, []);
  const setPref = (p: Partial<UiPrefs>) => {
    const n = { ...ui, ...p };
    setUi(n);
    writeUi(n);
  };
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageTitle
          icon="settings"
          title={tx("Settings", "সেটিংস")}
          sub={tx(
            "Preferences for this account and this device.",
            "এই অ্যাকাউন্ট ও এই ডিভাইসের পছন্দ।",
          )}
        />
        <Panel className="space-y-4 p-6">
          <SectionTitle title={tx("Language", "ভাষা")} />
          <div>
            <p className="mb-2 text-[15px] font-semibold">
              {tx("Interface language", "ইন্টারফেসের ভাষা")}
            </p>
            <LangSwitch />
          </div>
          <p className="text-[15px] text-ink-mid">
            {tx(
              "Explanation language (what the tutor uses), class and version are part of your profile: ",
              "ব্যাখ্যার ভাষা (টিউটর যে ভাষায় বলে), শ্রেণি ও ভার্সন তোমার প্রোফাইলের অংশ: ",
            )}
            <Link to="/account" className="font-semibold text-brand-deep hover:underline">
              {tx("edit in Account", "অ্যাকাউন্টে বদলাও")}
            </Link>
            {account?.explainLang
              ? tx(
                  ` (now: ${account.explainLang === "bn" ? "Bangla" : "English"})`,
                  ` (এখন: ${account.explainLang === "bn" ? "বাংলা" : "ইংরেজি"})`,
                )
              : ""}
            .
          </p>
        </Panel>
        <Panel className="space-y-4 p-6">
          <SectionTitle
            title={tx("Daily goal", "দৈনিক লক্ষ্য")}
            sub={tx(
              "How many questions you aim to answer each day. It sets your first mission.",
              "প্রতিদিন কতটি প্রশ্নের উত্তর দিতে চাও। এটি তোমার প্রথম মিশন ঠিক করে।",
            )}
          />
          {goal !== null && (
            <Choice
              value={String(goal)}
              label={tx("Daily goal", "দৈনিক লক্ষ্য")}
              options={[3, 5, 10, 15].map((g) => ({
                v: String(g),
                label: tx(`${g} a day`, `দিনে ${N(g)}টি`),
              }))}
              onChange={async (v) => {
                setGoal(Number(v));
                const r = await call(saveDailyGoal({ data: { goal: Number(v) } }));
                setSaved(
                  r.ok
                    ? tx("Goal saved.", "লক্ষ্য সংরক্ষিত।")
                    : tx("Couldn't save. Try again.", "সংরক্ষণ হয়নি। আবার চেষ্টা করো।"),
                );
              }}
            />
          )}
          {saved && (
            <p role="status" className="text-[14px] text-mint">
              {saved}
            </p>
          )}
          <p className="text-[14px] text-ink-mid">
            {tx(
              "Taking a day off is fine: one rest day a week keeps your streak, and nothing you've earned is ever taken away.",
              "একদিন বিরতি নেওয়া ঠিক আছে: সপ্তাহে এক দিনের বিশ্রামে ধারা থাকে, আর অর্জিত কিছুই কখনো কাটা যায় না।",
            )}
          </p>
        </Panel>
        <Panel className="space-y-5 p-6">
          <SectionTitle
            title={tx("Reading and motion", "পড়া ও নড়াচড়া")}
            sub={tx("Saved on this device.", "এই ডিভাইসে সংরক্ষিত।")}
          />
          <div>
            <p className="mb-2 text-[15px] font-semibold">{tx("Text size", "লেখার আকার")}</p>
            <Choice
              value={ui.text}
              label={tx("Text size", "লেখার আকার")}
              onChange={(v) => setPref({ text: v })}
              options={[
                { v: "normal", label: tx("Normal", "স্বাভাবিক") },
                { v: "large", label: tx("Large", "বড়") },
                { v: "larger", label: tx("Larger", "আরও বড়") },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-[15px] font-semibold">{tx("Animation", "অ্যানিমেশন")}</p>
            <Choice
              value={ui.motion}
              label={tx("Animation", "অ্যানিমেশন")}
              onChange={(v) => setPref({ motion: v })}
              options={[
                { v: "system", label: tx("Follow my device", "ডিভাইস অনুযায়ী") },
                { v: "reduce", label: tx("Reduce", "কমাও") },
              ]}
            />
          </div>
        </Panel>
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-6">
          <p className="text-[15px] text-ink-mid">
            {tx(
              "Email, password, photo and signing out are in Account.",
              "ইমেইল, পাসওয়ার্ড, ছবি ও সাইন আউট অ্যাকাউন্টে।",
            )}
          </p>
          <Link to="/account">
            <Button variant="secondary" size="sm">
              {tx("Open Account", "অ্যাকাউন্ট খোলো")}
            </Button>
          </Link>
        </Panel>
      </div>
    </Frame>
  );
}
