import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Icon, SubjectDot } from "../components/universe/icons";
import { bnDigits } from "../components/universe/learning";
import { Badge, LinkButton, Loading, PageTitle, Panel } from "../components/universe/ui";
import type { L } from "../content/types";
import { getKnowledgeMap } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/knowledge-map")({
  beforeLoad: () => requireAccount("/knowledge-map"),
  head: () => ({
    meta: [{ title: "Knowledge map | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: KnowledgeMap,
});

type Data = Extract<Awaited<ReturnType<typeof getKnowledgeMap>>, { ok: true }>;
type Ch = Data["subjects"][number]["books"][number]["chapters"][number];
type NodeState = Ch["status"];
const NODE: Record<NodeState, { fill: string; stroke: string; label: L; means: L }> = {
  none: { fill: "#FFFFFF", stroke: "#C5BAC4", label: { en: "Not explored", bn: "দেখা হয়নি" }, means: { en: "You haven't opened this chapter in IntelliHorizon.", bn: "ইন্টেলিহরাইজনে এই অধ্যায় এখনো খোলোনি।" } },
  introduced: { fill: "#EDF1F2", stroke: "#5A6670", label: { en: "Introduced", bn: "পরিচিত" }, means: { en: "You've opened it, but haven't answered a question yet. Opening is not understanding.", bn: "খুলেছ, তবে এখনো কোনো প্রশ্নের উত্তর দাওনি। খোলা মানে বোঝা নয়।" } },
  practising: { fill: "#EDF1F2", stroke: "#57707A", label: { en: "Practising", bn: "অনুশীলন চলছে" }, means: { en: "You've answered at least one question here.", bn: "এখানে অন্তত একটি প্রশ্নের উত্তর দিয়েছ।" } },
  developing: { fill: "#F3B23E", stroke: "#9A6410", label: { en: "Developing", bn: "এগোচ্ছে" }, means: { en: "3 or more different questions, and 60% or more of your recent answers right.", bn: "৩ বা বেশি ভিন্ন প্রশ্ন, আর সাম্প্রতিক উত্তরের ৬০% বা বেশি সঠিক।" } },
  demonstrated: { fill: "#0D7A62", stroke: "#0D7A62", label: { en: "Demonstrated", bn: "প্রমাণিত" }, means: { en: "5 different questions right, a due revision right, and 70% or more recently.", bn: "৫টি ভিন্ন প্রশ্ন সঠিক, একটি পুনরালোচনা সঠিক, আর সাম্প্রতিক ৭০% বা বেশি।" } },
  needs_revision: { fill: "#FCE7F3", stroke: "#B0386F", label: { en: "Needs revision", bn: "পুনরালোচনা দরকার" }, means: { en: "Questions from this chapter are due back in your revision queue.", bn: "এই অধ্যায়ের প্রশ্ন তোমার পুনরালোচনায় ফিরে এসেছে।" } },
};

function KnowledgeMap() {
  const { tx, t } = useLearner();
  const [d, setD] = useState<Data | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [sel, setSel] = useState<Ch | null>(null);
  useEffect(() => {
    void call(getKnowledgeMap()).then((r) => {
      if (r.ok) {
        const x = r as Data;
        setD(x);
        setSubject(
          (
            x.subjects.find((s) =>
              s.books.some((b) => b.chapters.some((c) => c.status !== "none")),
            ) ?? x.subjects.find((s) => s.books.length)
          )?.id ?? null,
        );
      }
    });
  }, []);
  const subj = d?.subjects.find((s) => s.id === subject) ?? null;
  // "Related" means the chapters printed just before and after in the same book: the only relationship the books give us.
  const neighbours = (c: Ch): Ch[] => {
    const list = subj?.books.find((b) => b.chapters.some((x) => x.id === c.id))?.chapters ?? [];
    const i = list.findIndex((x) => x.id === c.id);
    return [list[i - 1], list[i + 1]].filter(Boolean) as Ch[];
  };
  return (
    <Frame>
      <div className="space-y-6">
        <PageTitle
          icon="map"
          title={tx("Knowledge map", "জ্ঞান মানচিত্র")}
          sub={tx(
            "Each dot is a chapter in your books, in the book's order, coloured by what your answers show. Tap one for its evidence and next step.",
            "প্রতিটি বিন্দু তোমার বইয়ের একটি অধ্যায়, বইয়ের ক্রমে, তোমার উত্তরের প্রমাণ অনুযায়ী রঙে। খুলতে চাপ দাও।",
          )}
        />
        <ul className="flex flex-wrap gap-3 text-[14px]" aria-label={tx("Legend", "চিহ্নের অর্থ")}>
          {(Object.keys(NODE) as NodeState[]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span
                className="h-4 w-4 rounded-full border-2"
                style={{ background: NODE[k].fill, borderColor: NODE[k].stroke }}
              />
              {t(NODE[k].label)}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white">
              ?
            </span>
            {tx("Has checked questions", "যাচাই করা প্রশ্ন আছে")}
          </li>
        </ul>
        {!d ? (
          <Loading label={tx("Loading", "লোড হচ্ছে")} />
        ) : (
          <>
            <div
              role="tablist"
              aria-label={tx("Subjects", "বিষয়")}
              className="flex gap-2 overflow-x-auto pb-1"
            >
              {d.subjects.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={subject === s.id}
                  onClick={() => {
                    setSubject(s.id);
                    setSel(null);
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3.5 py-2 text-[15px] font-semibold ${subject === s.id ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-sheet text-ink-mid"}`}
                >
                  <SubjectDot hue={s.hue} />
                  {t(s.short)}
                </button>
              ))}
            </div>
            {subj &&
              (subj.books.length === 0 ? (
                <Panel className="p-6 text-ink-mid">
                  {tx(
                    "No book for this subject in your version yet.",
                    "তোমার ভার্সনে এই বিষয়ের বই এখনো নেই।",
                  )}
                </Panel>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5">
                    {subj.books.map((b) => (
                      <Panel key={b.id} className="p-5">
                        <p className="font-display text-[18px] font-bold" lang={b.language}>
                          {b.title}
                        </p>
                        <div className="mt-3 hidden md:block">
                          <ChapterPath
                            chapters={b.chapters}
                            perRow={9}
                            sel={sel}
                            onSelect={setSel}
                            label={b.title}
                          />
                        </div>
                        <div className="mt-3 md:hidden">
                          <ChapterPath
                            chapters={b.chapters}
                            perRow={4}
                            sel={sel}
                            onSelect={setSel}
                            label={b.title}
                          />
                        </div>
                      </Panel>
                    ))}
                  </div>
                  <Panel tone="lift" className="h-fit p-5 lg:sticky lg:top-24" aria-live="polite">
                    {sel ? (
                      <NodeDetail sel={sel} neighbours={neighbours(sel)} onSelect={setSel} />
                    ) : (
                      <p className="flex items-start gap-2 text-[15px] text-ink-mid">
                        <Icon name="map" className="shrink-0 text-brand" />
                        {tx(
                          "Choose a chapter on the map to see what to do next.",
                          "কী করবে দেখতে মানচিত্রে একটি অধ্যায় বাছো।",
                        )}
                      </p>
                    )}
                    <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-low">
                      {tx(
                        "Chapters appear in the book's own order. IntelliHorizon doesn't draw prerequisite links between them, because the books don't state any.",
                        "অধ্যায়গুলো বইয়ের নিজের ক্রমে আছে। বইয়ে পূর্বশর্তের কথা নেই, তাই ইন্টেলিহরাইজন অধ্যায়ের মধ্যে কোনো পূর্বশর্তের রেখা আঁকে না।",
                      )}
                    </p>
                  </Panel>
                </div>
              ))}
          </>
        )}
        <p className="text-[14px] text-ink-mid">
          <Link to="/mastery" className="font-semibold text-brand-deep hover:underline">
            {tx("How chapter levels are decided", "অধ্যায়ের পর্যায় কীভাবে ঠিক হয়")}
          </Link>
        </p>
      </div>
    </Frame>
  );
}

/** Chapters as a winding path, a fixed number per row so every dot stays a comfortable size. */
function ChapterPath({
  chapters,
  perRow,
  sel,
  onSelect,
  label,
}: {
  chapters: Ch[];
  perRow: number;
  sel: Ch | null;
  onSelect: (c: Ch) => void;
  label: string;
}) {
  const { t } = useLearner();
  const gap = 76,
    rowH = 84,
    pad = 36;
  const pos = chapters.map((_, i) => {
    const r = Math.floor(i / perRow),
      c = i % perRow;
    const col = r % 2 ? perRow - 1 - c : c;
    return { x: pad + col * gap, y: pad + r * rowH };
  });
  const rows = Math.max(1, Math.ceil(chapters.length / perRow));
  const w = pad * 2 + (perRow - 1) * gap,
    h = pad * 2 + (rows - 1) * rowH;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="group" aria-label={label}>
      <path
        d={pos.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")}
        fill="none"
        stroke="#C5BAC4"
        strokeWidth="2.5"
        strokeDasharray="6 6"
      />
      {chapters.map((c, i) => {
        const n = NODE[c.status];
        const on = sel?.id === c.id;
        const { x, y } = pos[i];
        return (
          <g
            key={c.id}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${c.position}. ${c.title}: ${t(n.label)}`}
            onClick={() => onSelect(c)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(c);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x}
              cy={y}
              r={on ? 24 : 21}
              fill={n.fill}
              stroke={on ? "#191D23" : n.stroke}
              strokeWidth={on ? 3 : 2.5}
            />
            <text
              x={x}
              y={y + 6}
              textAnchor="middle"
              fontSize="17"
              fontWeight="700"
              fill={c.status === "demonstrated" ? "#fff" : "#191D23"}
              fontFamily="Figtree, system-ui"
            >
              {c.position}
            </text>
            {c.questions > 0 && (
              <circle cx={x + 16} cy={y - 16} r="7" fill="#57707A" stroke="#fff" strokeWidth="2" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

const bnOr = (n: number, tx: (en: string, bn: string) => string) => tx(String(n), bnDigits(n));

function NodeDetail({ sel, neighbours, onSelect }: { sel: Ch; neighbours: Ch[]; onSelect: (c: Ch) => void }) {
  const { tx, t } = useLearner();
  const n = NODE[sel.status];
  const tone = sel.status === "demonstrated" ? "mint" : sel.status === "developing" ? "amber" : sel.status === "practising" ? "brand" : sel.status === "needs_revision" ? "pink" : "neutral";
  const e = sel.evidence;
  const next =
    sel.status === "needs_revision"
      ? { to: "/revision", label: tx(`Revise ${sel.due} due question${sel.due > 1 ? "s" : ""}`, `${bnDigits(sel.due)}টি পুনরালোচনা করো`), why: tx("They're due today.", "এগুলো আজকের।") }
      : sel.questions > 0 && sel.status !== "demonstrated"
        ? { to: "/practice/$chapterId", label: tx("Start a Learning Session", "লার্নিং সেশন শুরু করো"), why: e ? tx(`${e.distinctCorrect} different questions right so far; 5 and a correct revision are needed.`, `এ পর্যন্ত ${bnDigits(e.distinctCorrect)}টি ভিন্ন প্রশ্ন সঠিক; দরকার ৫টি ও একটি সঠিক পুনরালোচনা।`) : tx("It has checked questions you haven't tried.", "এতে তোমার না-করা যাচাই করা প্রশ্ন আছে।") }
        : sel.hasLesson && sel.status !== "demonstrated"
          ? { to: "/practice/$chapterId", label: tx("Start the short lesson", "ছোট পাঠ শুরু করো"), why: tx("A checked lesson is ready; questions for this chapter are still being reviewed.", "যাচাই করা পাঠ প্রস্তুত; এই অধ্যায়ের প্রশ্ন এখনো পর্যালোচনায়।") }
          : { to: "/chapters/$chapterId", label: tx("Open the chapter", "অধ্যায় খোলো"), why: sel.status === "demonstrated" ? tx("You've shown this one. Revision will bring it back when it's time.", "এটি তুমি প্রমাণ করেছ। সময় হলে পুনরালোচনায় ফিরবে।") : tx("See its pages and learning outcomes.", "এর পৃষ্ঠা ও শিখনফল দেখো।") };
  return (
    <div className="space-y-3">
      <Badge tone={tone}>{t(n.label)}</Badge>
      <p className="font-display text-[20px] font-bold" lang="bn">{sel.position}. {sel.title}</p>
      <p className="text-[14px] text-ink-mid">{t(n.means)}</p>
      <dl className="grid grid-cols-2 gap-3 rounded-[14px] bg-lilac p-3 text-[13px]">
        <div><dt className="text-ink-mid">{tx("Questions right", "সঠিক প্রশ্ন")}</dt><dd className="tnum text-[17px] font-bold">{e ? bnOr(e.distinctCorrect, tx) : bnOr(0, tx)}<span className="text-[13px] font-medium text-ink-low">/{bnOr(sel.questions, tx)}</span></dd></div>
        <div><dt className="text-ink-mid">{tx("Recent accuracy", "সাম্প্রতিক সঠিকতা")}</dt><dd className="tnum text-[17px] font-bold">{e ? `${bnOr(Math.round(e.recentRate * 100), tx)}%` : "–"}</dd></div>
        <div><dt className="text-ink-mid">{tx("Right in revision", "পুনরালোচনায় সঠিক")}</dt><dd className="tnum text-[17px] font-bold">{e ? bnOr(e.reviewCorrect, tx) : bnOr(0, tx)}</dd></div>
        <div><dt className="text-ink-mid">{tx("Learning outcomes", "শিখনফল")}</dt><dd className="tnum text-[17px] font-bold">{sel.objectives ? bnOr(sel.objectives, tx) : "–"}</dd></div>
      </dl>
      <div>
        <p className="text-[13px] font-semibold text-ink-mid">{tx("Recommended next step", "পরের ধাপ")}</p>
        <p className="text-[14px] text-ink-mid">{next.why}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <LinkButton to={next.to} params={next.to.includes("$") ? { chapterId: sel.id } : undefined} size="sm">{next.label}</LinkButton>
          <LinkButton to="/tutor" search={{ chapter: sel.id }} size="sm" variant="quiet" icon="tutor">{tx("Ask the tutor", "টিউটরকে জিজ্ঞেস")}</LinkButton>
        </div>
      </div>
      {neighbours.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-ink-mid">{tx("Next to it in the book", "বইয়ে এর পাশে")}</p>
          <ul className="mt-1 space-y-1">
            {neighbours.map((c) => (
              <li key={c.id}><button type="button" onClick={() => onSelect(c)} className="text-left text-[14px] font-semibold text-brand-deep hover:underline" lang="bn">{c.position}. {c.title}</button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
