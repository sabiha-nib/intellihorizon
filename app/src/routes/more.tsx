import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Frame } from "../components/universe/Shell";
import { Icon } from "../components/universe/icons";
import { GROUPS, MODULES } from "../components/universe/modules";
import { PageTitle } from "../components/universe/ui";
import { requireAccount } from "../lib/guard";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/more")({
  beforeLoad: () => requireAccount("/more"),
  head: () => ({
    meta: [{ title: "Everything in IntelliHorizon | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: More,
});

function More() {
  const { t, tx, account } = useLearner();
  const [q, setQ] = useState("");
  const mods = MODULES.filter(
    (m) =>
      (!m.admin || account?.role === "admin") &&
      (!q ||
        `${m.label.en} ${m.label.bn} ${m.blurb.en} ${m.blurb.bn}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  return (
    <Frame>
      <div className="space-y-8">
        <PageTitle
          icon="more"
          title={tx("Everything in IntelliHorizon", "ইন্টেলিহরাইজনের সবকিছু")}
          sub={tx("Every part of the app, in one place.", "অ্যাপের প্রতিটি অংশ, এক জায়গায়।")}
        />
        <label className="block max-w-md">
          <span className="sr-only">{tx("Filter modules", "মডিউল খোঁজো")}</span>
          <span className="flex h-12 items-center gap-2 rounded-[14px] border-2 border-line bg-sheet px-3 focus-within:border-brand">
            <Icon name="search" className="text-ink-low" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tx("Find a module", "মডিউল খোঁজো")}
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            />
          </span>
        </label>
        {GROUPS.map((g) => {
          const list = mods.filter((m) => m.group === g.id);
          if (!list.length) return null;
          return (
            <section key={g.id} aria-labelledby={`g-${g.id}`}>
              <h2 id={`g-${g.id}`} className="mb-3 font-display text-[20px] font-bold">
                {t(g.label)}
              </h2>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {list.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={m.to as "/"}
                      className="flex h-full flex-col gap-2 rounded-[20px] border border-line bg-sheet p-4 hover:border-brand"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand-soft text-brand">
                        <Icon name={m.icon} />
                      </span>
                      <span className="text-[16px] font-semibold leading-tight">{t(m.label)}</span>
                      <span className="text-[13px] leading-snug text-ink-mid">{t(m.blurb)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Frame>
  );
}
