import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon } from "../components/universe/icons";
import { Empty, LinkButton, Loading, PageTitle } from "../components/universe/ui";
import { getHistory } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/history")({
  beforeLoad: () => requireAccount("/history"),
  head: () => ({
    meta: [{ title: "Learning history | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: History,
});

type Data = Extract<Awaited<ReturnType<typeof getHistory>>, { ok: true }>;
function History() {
  const { tx, lang } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    void call(getHistory()).then((r) => r.ok && setD(r as Data));
  }, []);
  const label = (k: string, detail: string | null) =>
    k === "session"
      ? detail === "completed"
        ? tx("Finished a Learning Session", "লার্নিং সেশন শেষ")
        : tx("Started a Learning Session", "লার্নিং সেশন শুরু")
      : k === "chapter"
        ? tx("Opened a chapter", "অধ্যায় খোলা")
        : k === "tutor"
          ? tx("Asked the tutor", "টিউটরকে প্রশ্ন")
          : k === "explain"
            ? tx("Explained in own words", "নিজের ভাষায় ব্যাখ্যা")
            : tx("Saved a note", "নোট সংরক্ষণ");
  const icon = (k: string) =>
    k === "session"
      ? "practice"
      : k === "chapter"
        ? "book"
        : k === "tutor"
          ? "tutor"
          : k === "explain"
            ? "pen"
            : "saved";
  const link = (x: Data["items"][number]) =>
    x.kind === "session"
      ? { to: "/practice/session/$sessionId", params: { sessionId: x.id } }
      : x.kind === "chapter" || x.kind === "explain"
        ? { to: "/chapters/$chapterId", params: { chapterId: x.id } }
        : x.kind === "tutor"
          ? { to: "/tutor/$threadId", params: { threadId: x.id } }
          : { to: "/saved", params: undefined };
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageTitle
          icon="history"
          title={tx("Learning history", "শেখার ইতিহাস")}
          sub={tx(
            "Your last 60 learning events, newest first. Only you can see this.",
            "তোমার শেষ ৬০টি শেখার ঘটনা, নতুনগুলো আগে। শুধু তুমিই দেখতে পাও।",
          )}
        />
        {!d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : !d.items.length ? (
          <Empty
            icon="history"
            title={tx("No history yet", "এখনো কোনো ইতিহাস নেই")}
            body={tx(
              "Open a chapter or start a session and it will be listed here.",
              "একটি অধ্যায় খোলো বা সেশন শুরু করো, এখানে তালিকায় আসবে।",
            )}
            action={<LinkButton to="/learn">{tx("Explore subjects", "বিষয়গুলো দেখো")}</LinkButton>}
          />
        ) : (
          <ol className="divide-y divide-line rounded-[20px] border border-line bg-sheet">
            {d.items.map((x, i) => {
              const l = link(x);
              return (
                <li key={i}>
                  <Link
                    to={l.to as "/"}
                    params={l.params as never}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-lilac"
                  >
                    <Icon name={icon(x.kind)} size={20} className="shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {x.title ?? ""}
                      </span>
                      <span className="text-[13px] text-ink-mid">{label(x.kind, x.detail)}</span>
                    </span>
                    <time className="shrink-0 text-[13px] text-ink-low" dateTime={x.at}>
                      {new Date(x.at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Frame>
  );
}
