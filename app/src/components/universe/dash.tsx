// Pieces shared by the dashboard and the plan/missions pages.
import { Link } from "@tanstack/react-router";

import type { L } from "../../content/types";
import { useLearner } from "../../lib/store";
import { Icon } from "./icons";
import { bnDigits } from "./learning";

export type PlanTask = {
  id: string;
  kind: string;
  chapter_id: string | null;
  title: string;
  reason: string | null;
  status: string;
  done_by: string | null;
};

export function taskText(
  task: PlanTask,
  tx: (en: string, bn: string) => string,
): {
  title: string;
  why: string;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
} {
  if (task.kind === "review_due") {
    const n = task.title.split(":")[1] ?? "";
    return {
      title: tx(
        `Revise ${n} due question${n === "1" ? "" : "s"}`,
        `${bnDigits(n)}টি প্রশ্ন পুনরালোচনা`,
      ),
      why: tx(
        "Due today on your revision schedule. Ticks off when the queue is clear.",
        "পুনরালোচনার সময়সূচিতে আজকের। তালিকা খালি হলে টিক পড়বে।",
      ),
      to: "/revision",
    };
  }
  if (task.kind === "practice_chapter") {
    const [, ok, n] = (task.reason ?? "").split(":");
    return {
      title: tx(`Practise "${task.title}" again`, `"${task.title}" আবার অনুশীলন`),
      why: tx(
        `${ok} of your last ${n} answers here were right. Ticks off after 3 answers today.`,
        `এখানে শেষ ${bnDigits(n)}টি উত্তরের ${bnDigits(ok)}টি সঠিক ছিল। আজ ৩টি উত্তর দিলে টিক পড়বে।`,
      ),
      to: "/chapters/$chapterId",
      params: { chapterId: task.chapter_id! },
    };
  }
  if (task.kind === "study_chapter")
    return {
      title: tx(`Study "${task.title}"`, `"${task.title}" পড়ো`),
      why:
        (task.reason === "chosen"
          ? tx("You added this. ", "তুমি যোগ করেছ। ")
          : tx("You opened it most recently. ", "সবশেষে এটি খুলেছিলে। ")) +
        tx(
          "Ticks off when you finish a session or explain it.",
          "সেশন শেষ করলে বা ব্যাখ্যা করলে টিক পড়বে।",
        ),
      to: "/chapters/$chapterId",
      params: { chapterId: task.chapter_id! },
    };
  if (task.kind === "ask_tutor")
    return {
      title: task.title
        ? tx(
            `Ask the tutor one question about "${task.title}"`,
            `"${task.title}" নিয়ে টিউটরকে একটি প্রশ্ন করো`,
          )
        : tx("Ask the tutor one question", "টিউটরকে একটি প্রশ্ন করো"),
      why: tx(
        "Putting a question into words shows what isn't clear yet.",
        "প্রশ্ন গুছিয়ে লিখলে বোঝা যায় কোথায় অস্পষ্ট।",
      ),
      to: "/tutor",
      search: task.chapter_id ? { chapter: task.chapter_id } : {},
    };
  return { title: task.title, why: "", to: "/learn" };
}

export function JourneyList({ tasks }: { tasks: PlanTask[] }) {
  const { tx } = useLearner();
  return (
    <ol className="space-y-2.5">
      {tasks.map((task) => {
        const x = taskText(task, tx);
        const done = task.status === "done";
        return (
          <li key={task.id}>
            <Link
              to={x.to as "/"}
              params={x.params as never}
              search={x.search as never}
              className={`group flex items-start gap-3 rounded-[16px] border p-3.5 transition-colors ${done ? "border-transparent bg-mint-soft" : "border-line bg-sheet hover:border-brand"}`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-mint bg-mint text-white" : "border-line-strong text-transparent group-hover:border-brand"}`}
              >
                <Icon name="check" size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[16px] font-semibold ${done ? "text-mint" : "text-ink"}`}
                >
                  {x.title}
                </span>
                <span className="mt-0.5 block text-[14px] text-ink-mid">
                  {done
                    ? tx(
                        "Done: recorded from your activity today.",
                        "হয়েছে: আজকের কাজ থেকে জমা হয়েছে।",
                      )
                    : x.why}
                </span>
              </span>
              {!done && (
                <Icon
                  name="arrow"
                  size={18}
                  className="mt-1 shrink-0 text-ink-low group-hover:text-brand"
                />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function MissionList({
  missions,
}: {
  missions: { id: string; title: L; target: number; value: number; done: boolean; to: string }[];
}) {
  const { t, tx } = useLearner();
  return (
    <ul className="space-y-3">
      {missions.map((m) => (
        <li key={m.id}>
          <Link to={m.to as "/"} className="block rounded-[14px] p-1 hover:bg-lilac">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`flex items-center gap-2 text-[15px] font-semibold ${m.done ? "text-mint" : "text-ink"}`}
              >
                {m.done ? (
                  <Icon name="check" size={18} />
                ) : (
                  <Icon name="missions" size={18} className="text-brand" />
                )}
                {t(m.title)}
              </span>
              <span className="tnum text-[14px] text-ink-mid">
                {tx(`${m.value}/${m.target}`, `${bnDigits(m.value)}/${bnDigits(m.target)}`)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={t(m.title)}
              aria-valuemin={0}
              aria-valuemax={m.target}
              aria-valuenow={m.value}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-lilac-2"
            >
              <div
                className={`h-full rounded-full ${m.done ? "bg-mint" : "bg-brand"}`}
                style={{ width: `${(m.value / m.target) * 100}%` }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
