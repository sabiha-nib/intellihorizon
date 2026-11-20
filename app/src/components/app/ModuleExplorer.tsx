// The dashboard's module explorer: every student-facing IntelliHorizon tool, grouped the way a student thinks about
// studying. Each card is a link to a route that exists and works; nothing here is decorative.
import { Link } from "@tanstack/react-router";

import { Icon, type IconName } from "../universe/icons";
import { useLearner } from "../../lib/store";
import type { L } from "../../content/types";

type Item = { id: string; to: string; search?: Record<string, string>; icon: IconName; name: string; blurb: L };
type Group = { id: string; title: L; hint: L; tone: { card: string; icon: string; bar: string }; items: Item[] };

// Brand palette: teal and blue-grey carry learning and information, pink and mauve are accents, charcoal is text.
export const EXPLORER: Group[] = [
  {
    id: "learn", title: { en: "Learn", bn: "শেখো" }, hint: { en: "Understand it from your own textbook", bn: "নিজের পাঠ্যবই থেকে বোঝো" },
    tone: { card: "bg-[#EEF3F4] hover:border-[#57707A]", icon: "bg-[#57707A] text-white", bar: "bg-[#57707A]" },
    items: [
      { id: "tutor", to: "/tutor", icon: "tutor", name: "IntelliTutor", blurb: { en: "Ask anything; answers come from your book, with page references", bn: "যেকোনো প্রশ্ন করো; উত্তর আসে তোমার বই থেকে, পৃষ্ঠাসহ" } },
      { id: "library", to: "/learn", icon: "book", name: "Learning Library", blurb: { en: "Your eight subjects, book by book, chapter by chapter", bn: "তোমার আটটি বিষয়, বই ও অধ্যায় ধরে" } },
      { id: "topics", to: "/topics", icon: "layers", name: "TopicWise", blurb: { en: "One topic at a time: material, practice and evidence", bn: "এক একটি টপিক: পাঠ, অনুশীলন ও প্রমাণ" } },
      { id: "map", to: "/knowledge-map", icon: "map", name: "KnowledgeMap", blurb: { en: "See how chapters and topics fit together", bn: "অধ্যায় ও টপিক কীভাবে জুড়ে আছে দেখো" } },
      { id: "concepts", to: "/concepts", icon: "spark", name: "ConceptConnect", blurb: { en: "Reviewed links between ideas, with the reason for each", bn: "ধারণাগুলোর যাচাই করা সংযোগ, কারণসহ" } },
      { id: "formulas", to: "/formulas", icon: "pen", name: "FormulaVault", blurb: { en: "Checked formulas, each with its textbook page", bn: "যাচাই করা সূত্র, পাঠ্যবইয়ের পৃষ্ঠাসহ" } },
    ],
  },
  {
    id: "practise", title: { en: "Practice", bn: "অনুশীলন" }, hint: { en: "Short, checked questions every day", bn: "প্রতিদিন ছোট, যাচাই করা প্রশ্ন" },
    tone: { card: "bg-[#FCE7F3] hover:border-[#F9A8D4]", icon: "bg-[#F9A8D4] text-[#191D23]", bar: "bg-[#F9A8D4]" },
    items: [
      { id: "quiz", to: "/quiz", icon: "practice", name: "IntelliQuiz", blurb: { en: "Quick quizzes, chapter and topic practice", bn: "দ্রুত কুইজ, অধ্যায় ও টপিক অনুশীলন" } },
      { id: "daily", to: "/quiz", search: { mode: "daily" }, icon: "sun", name: "DailyHorizon", blurb: { en: "Today's Daily Five, picked for you", bn: "আজকের ডেইলি ফাইভ, তোমার জন্য বাছাই" } },
      { id: "replay", to: "/quiz", search: { mode: "mistakes" }, icon: "revision", name: "Mistake Replay", blurb: { en: "Try again the questions you last got wrong", bn: "শেষবার ভুল হওয়া প্রশ্ন আবার করো" } },
      { id: "weak", to: "/quiz", search: { mode: "weakness" }, icon: "radar", name: "Weak Spots", blurb: { en: "Practice aimed at what your answers show is weakest", bn: "যেখানে তুমি সবচেয়ে দুর্বল, সেখানে অনুশীলন" } },
    ],
  },
  {
    id: "assess", title: { en: "Assess", bn: "যাচাই" }, hint: { en: "Find out how ready you really are", bn: "সত্যিই কতটা প্রস্তুত, জেনে নাও" },
    tone: { card: "bg-[#F4F0F3] hover:border-[#C5BAC4]", icon: "bg-[#C5BAC4] text-[#191D23]", bar: "bg-[#C5BAC4]" },
    items: [
      { id: "exam", to: "/exam-arena", icon: "shield", name: "ExamArena", blurb: { en: "Chapter readiness, then a timed exam", bn: "অধ্যায়ের প্রস্তুতি, তারপর সময় ধরে পরীক্ষা" } },
      { id: "mastery", to: "/mastery", icon: "evidence", name: "MasteryEngine", blurb: { en: "What your answers actually show, topic by topic", bn: "তোমার উত্তর আসলে কী দেখায়, টপিক ধরে" } },
      { id: "radar", to: "/mistakes", icon: "radar", name: "Misconception Radar", blurb: { en: "Patterns in your mistakes, and how to fix them", bn: "ভুলের ধরন, আর কীভাবে ঠিক করবে" } },
    ],
  },
  {
    id: "progress", title: { en: "My Progress", bn: "আমার অগ্রগতি" }, hint: { en: "Built only from what you've actually done", bn: "শুধু তোমার আসল কাজ থেকে তৈরি" },
    tone: { card: "bg-[#EDF1F3] hover:border-[#7B919C]", icon: "bg-[#7B919C] text-white", bar: "bg-[#7B919C]" },
    items: [
      { id: "twin", to: "/twin", icon: "radar", name: "Learning Twin", blurb: { en: "What the evidence says about each topic", bn: "প্রতিটি টপিক নিয়ে প্রমাণ কী বলে" } },
      { id: "horizon", to: "/path", icon: "map", name: "HorizonPath", blurb: { en: "Where you've been and what's next", bn: "কোথায় ছিলে, এরপর কী" } },
      { id: "revision", to: "/revision", icon: "revision", name: "SmartRevision", blurb: { en: "Questions due back today, spaced for memory", bn: "আজ ফিরে আসা প্রশ্ন, মনে রাখার জন্য" } },
      { id: "analytics", to: "/progress", icon: "progress", name: "Learning Analytics", blurb: { en: "Activity, accuracy and your level over time", bn: "সময়ের সঙ্গে কাজ, নির্ভুলতা ও লেভেল" } },
      { id: "xp", to: "/achievements", icon: "achievements", name: "IntelliXP", blurb: { en: "XP, levels and achievements you've earned", bn: "অর্জিত এক্সপি, লেভেল ও অর্জন" } },
    ],
  },
  {
    id: "tools", title: { en: "Study Tools", bn: "পড়ার টুলস" }, hint: { en: "Your own notes, cards and reflections", bn: "তোমার নিজের নোট, কার্ড ও ভাবনা" },
    tone: { card: "bg-[#F1F1F3] hover:border-[#989DAA]", icon: "bg-[#989DAA] text-[#191D23]", bar: "bg-[#989DAA]" },
    items: [
      { id: "cards", to: "/cards", icon: "layers", name: "MemoryCards", blurb: { en: "Flashcards from your book's definitions", bn: "বইয়ের সংজ্ঞা থেকে ফ্ল্যাশকার্ড" } },
      { id: "notes", to: "/notes", icon: "pen", name: "SmartNotes", blurb: { en: "Private notes tied to chapters", bn: "অধ্যায়ভিত্তিক নিজের নোট" } },
      { id: "summary", to: "/summary", icon: "book", name: "IntelliSummary", blurb: { en: "Chapter summaries in the book's own sentences", bn: "বইয়ের নিজের বাক্যে অধ্যায়ের সারাংশ" } },
      { id: "explain", to: "/practice", icon: "spark", name: "Explain It Back", blurb: { en: "Explain a chapter in your words inside a Learning Session", bn: "লার্নিং সেশনে নিজের ভাষায় অধ্যায় বোঝাও" } },
      { id: "reflect", to: "/reflect", icon: "sun", name: "Reflection", blurb: { en: "What you learned and what to revisit", bn: "কী শিখলে, কী আবার দেখবে" } },
      { id: "desk", to: "/tutor", icon: "download", name: "Multimodal Desk", blurb: { en: "Ask IntelliTutor with a homework photo or your voice", bn: "হোমওয়ার্কের ছবি বা কণ্ঠ দিয়ে প্রশ্ন করো" } },
    ],
  },
];

export function ModuleExplorer() {
  const { t, tx } = useLearner();
  return (
    <section aria-labelledby="explore-h" data-testid="module-explorer">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="explore-h" className="font-display text-[24px] font-bold tracking-tight">{tx("Everything you can do here", "এখানে যা যা করতে পারো")}</h2>
          <p className="text-[15px] text-ink-mid">{tx("Every tool below opens the real thing. Pick where to start.", "নিচের প্রতিটি টুল সত্যিকারের অংশ খোলে। কোথা থেকে শুরু করবে বেছে নাও।")}</p>
        </div>
      </div>
      <div className="space-y-6">
        {EXPLORER.map((g) => (
          <div key={g.id} data-group={g.id}>
            <div className="mb-2 flex items-center gap-2">
              <span aria-hidden="true" className={`h-4 w-1.5 rounded-full ${g.tone.bar}`} />
              <h3 className="font-display text-[15px] font-bold uppercase tracking-[0.08em] text-ink">{t(g.title)}</h3>
              <span className="text-[13px] text-ink-mid">· {t(g.hint)}</span>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((m) => (
                <li key={m.id}>
                  <Link
                    to={m.to as "/"}
                    search={m.search as never}
                    data-module={m.id}
                    className={`group flex h-full items-start gap-3 rounded-[18px] border border-transparent p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#57707A] ${g.tone.card}`}
                  >
                    <span className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${g.tone.icon}`}><Icon name={m.icon} size={20} /></span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold leading-tight text-ink">{m.name}</span>
                      <span className="mt-1 block text-[13px] leading-snug text-ink-mid">{t(m.blurb)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
