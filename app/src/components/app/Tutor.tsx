import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { L } from "../../content/types";
import { explainBack, saveExcerpt, setFeedback, tutorScope } from "../../lib/api/tutor.functions";
import type { TutorMessage, TutorPayload } from "../../lib/tutor/types";
import { useLearner } from "../../lib/store";
import { AskInputs } from "./AskInputs";
import { call } from "../auth/messages";
import { SourceCard } from "./kit";
import { AiExplanation } from "./AiExplanation";
import { SpeakButton } from "./Speak";
import { SUBJECTS, subjectById, type SubjectId } from "../../lib/curriculum/registry";
import { PERSONAS, PERSONA_IDS, STYLES, STYLE_IDS, type PersonaId, type StyleId } from "../../lib/tutor/teach";

const LANG_KEY = "edu_tutor_lang_v1";
export type TutorLang = "auto" | "bn" | "en" | "mixed";
/** The explanation language the student chose for the tutor (separate from the interface language). */
export function useTutorLang(): [TutorLang, (l: TutorLang) => void] {
  const [v, setV] = useState<TutorLang>("auto");
  useEffect(() => { try { const x = window.localStorage.getItem(LANG_KEY); if (x === "bn" || x === "en" || x === "mixed" || x === "auto") setV(x); } catch { /* storage unavailable */ } }, []);
  return [v, (l) => { setV(l); try { window.localStorage.setItem(LANG_KEY, l); } catch { /* applies for this visit */ } }];
}
export function LangPicker({ value, onChange }: { value: TutorLang; onChange: (l: TutorLang) => void }) {
  const { tx } = useLearner();
  const opts: [TutorLang, string][] = [["auto", tx("Same as my question", "প্রশ্নের ভাষায়")], ["bn", "বাংলা"], ["en", "English"], ["mixed", tx("Bangla + English terms", "বাংলা + ইংরেজি শব্দ")]];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink-mid">{tx("Explanation language", "ব্যাখ্যার ভাষা")}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {opts.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)} className={`inline-flex h-9 items-center rounded-full border px-3 text-sm font-semibold ${value === id ? "border-brand bg-brand text-sheet" : "border-ink-low/30 bg-sheet hover:border-ink"}`}>{label}</button>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-mid">{tx("Textbook text is always shown in the book's own language; only explanations change language.", "পাঠ্যবইয়ের লেখা সবসময় বইয়ের নিজের ভাষায় থাকে; শুধু ব্যাখ্যার ভাষা বদলায়।")}</p>
    </fieldset>
  );
}

const PERSONA_KEY = "edu_tutor_persona_v1";
/** The student's chosen teaching approach, remembered on this device. */
export function usePersona(): [PersonaId, (p: PersonaId) => void] {
  const [persona, setPersona] = useState<PersonaId>("mentor");
  useEffect(() => {
    try { const v = window.localStorage.getItem(PERSONA_KEY); if (v && (PERSONA_IDS as readonly string[]).includes(v)) setPersona(v as PersonaId); } catch { /* storage unavailable */ }
  }, []);
  return [persona, (p) => { setPersona(p); try { window.localStorage.setItem(PERSONA_KEY, p); } catch { /* applies for this visit */ } }];
}

export function PersonaPicker({ value, onChange }: { value: PersonaId; onChange: (p: PersonaId) => void }) {
  const { t, tx } = useLearner();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink-mid">{tx("Teaching approach", "শেখানোর ধরন")}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {PERSONA_IDS.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)} className={`inline-flex h-9 items-center rounded-full border px-3 text-sm font-semibold transition-colors ${value === id ? "border-brand bg-brand text-sheet" : "border-ink-low/30 bg-sheet hover:border-ink"}`}>{t(PERSONAS[id].name)}</button>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-mid">{t(PERSONAS[value].how)} {tx("Every approach uses the same checked textbook passages.", "সব ধরনেই একই যাচাই করা পাঠ্যবইয়ের অংশ ব্যবহার হয়।")}</p>
    </fieldset>
  );
}

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const usable = terms.filter((x) => [...x].length >= 2).sort((a, b) => b.length - a.length);
  if (!usable.length) return <>{text}</>;
  // Extend each match to the end of its word so stemmed terms ("photosynthesi") highlight whole words.
  const re = new RegExp(`((?:${usable.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[\\p{L}\\p{M}\\p{N}]*)`, "giu");
  const parts = text.split(re);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="rounded-[3px] bg-thread/40 text-ink">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

const LEAD: Record<string, L> = {
  grounded: { en: "Here's what your textbook says.", bn: "তোমার পাঠ্যবই যা বলে।" },
  partial: { en: "I couldn't find a passage that answers this directly. These are the closest parts of your textbook, so read them carefully.", bn: "সরাসরি উত্তর দেয় এমন অংশ পাইনি। এগুলো তোমার বইয়ের সবচেয়ে কাছাকাছি অংশ, মনোযোগ দিয়ে পড়ো।" },
  not_found: { en: "I couldn't find this in the NCTB textbooks available to me for your class, so I won't guess.", bn: "তোমার শ্রেণির যে এনসিটিবি বইগুলো আমার কাছে আছে, সেখানে এটি পাইনি। তাই আমি অনুমান করব না।" },
  no_books: { en: "The textbooks for this search aren't ready for the tutor yet, so I have nothing to check this against.", bn: "এই খোঁজার পাঠ্যবইগুলো এখনো টিউটরের জন্য প্রস্তুত নয়, তাই মেলানোর মতো কিছু নেই।" },
  unsupported_subject: { en: "That subject isn't one IntelliHorizon covers.", bn: "এই বিষয়টি ইন্টেলিহরাইজনে নেই।" },
  subject_conflict: { en: "Your question is about a different book or subject from the one you chose.", bn: "তোমার প্রশ্নটি তোমার বাছাই করা বিষয় বা বইয়ের বাইরের।" },
  working_check: { en: "I checked your working line by line with exact arithmetic.", bn: "তোমার কাজ লাইন ধরে ধরে নির্ভুল হিসাবে মিলিয়েছি।" },
  ambiguous: { en: "This idea appears in more than one subject. Which one are you studying?", bn: "এই ধারণাটি একাধিক বিষয়ে আছে। তুমি কোনটি পড়ছ?" },
  needs_context: { en: "Tell me a little more. Use a word or two from your textbook, like the name of the idea you're stuck on.", bn: "আরেকটু বলো। পাঠ্যবইয়ের একটি-দুটি শব্দ লেখো, যেমন যে ধারণায় আটকে আছ তার নাম।" },
};

const INTENT_HINT: Record<string, L> = {
  define: { en: "Read the definition, then try explaining it in your own words below.", bn: "সংজ্ঞাটি পড়ো, তারপর নিচে নিজের ভাষায় ব্যাখ্যা করে দেখো।" },
  why: { en: "Look for the reason the textbook gives. Can you say it as a 'because' sentence?", bn: "বই কী কারণ দিয়েছে খোঁজো। 'কারণ' দিয়ে একটি বাক্যে বলতে পারো?" },
  how: { en: "Notice the steps in order. Try listing them yourself before reading again.", bn: "ধাপগুলো ক্রমানুসারে লক্ষ করো। আবার পড়ার আগে নিজে তালিকা করে দেখো।" },
  compare: { en: "Pick out one thing that is the same and one that is different.", bn: "একটি মিল আর একটি অমিল খুঁজে বের করো।" },
  example: { en: "Can you think of one more example from your own life?", bn: "নিজের জীবন থেকে আরেকটি উদাহরণ ভাবতে পারো?" },
  general: { en: "Read it once, then explain it back to check you've understood.", bn: "একবার পড়ো, তারপর বুঝেছ কিনা দেখতে নিজের ভাষায় বলো।" },
};

function Chip({ children, onClick, to, params, search }: { children: ReactNode; onClick?: () => void; to?: string; params?: Record<string, string>; search?: Record<string, unknown> }) {
  const cls = "inline-flex items-center gap-1.5 rounded-full border border-ink-low/30 bg-sheet px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink active:scale-[0.98]";
  if (to) return <Link to={to as "/"} params={params as never} search={search as never} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

/** One line saying exactly which subject and book were searched, and why. */
function ScopeLine({ p }: { p: TutorPayload }) {
  const { t, tx } = useLearner();
  const sid = p.subject?.subjectId ?? p.scope.subjectKey ?? null;
  const subj = sid ? subjectById(sid) : null;
  const why = p.subject?.from === "question" ? tx(" (named in your question)", " (তোমার প্রশ্নে উল্লেখ আছে)") : p.subject?.from === "book" ? tx(" (book named in your question)", " (প্রশ্নে বইয়ের নাম আছে)") : "";
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-low">
      {tx("Searched: ", "খোঁজা হয়েছে: ")}
      <span className="normal-case text-ink-mid">{subj ? t(subj.label) : tx("all eight subjects", "আটটি বিষয়েই")}{p.subject?.book ? ` · ${p.subject.book.title}` : ""}{why}</span>
    </p>
  );
}

function SubjectList() {
  const { t } = useLearner();
  return <ul className="flex flex-wrap gap-1.5">{SUBJECTS.map((s) => <li key={s.id}><Link to="/subjects/$subjectId" params={{ subjectId: s.id }} className="inline-flex rounded-full border border-ink-low/25 bg-sheet px-2.5 py-1 text-xs font-semibold hover:border-ink">{t(s.label)}</Link></li>)}</ul>;
}

function TutorBubble({ m, onAppend, readOnly, onAskDifferently, onAskInSubject }: { m: TutorMessage; onAppend: (ms: TutorMessage[]) => void; readOnly?: boolean; onAskDifferently?: (style: StyleId) => void; onAskInSubject?: (subjectId: string) => void }) {
  const { t, tx, lang: uiLang } = useLearner();
  const [open, setOpen] = useState(false);
  const p = m.payload as TutorPayload;
  const [fb, setFb] = useState<number | null>(m.feedback);
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [explaining, setExplaining] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (p.status === "calculation" && p.calc) {
    return (
      <div className="space-y-2">
        {"error" in p.calc ? (
          <p>{tx("I couldn't read that as a calculation. Check the brackets and symbols.", "এটিকে হিসাব হিসেবে পড়তে পারিনি। বন্ধনী আর চিহ্নগুলো দেখে নাও।")}</p>
        ) : (
          <>
            <p className="font-display text-2xl font-bold tabular-nums">{p.calc.expression} = {p.calc.decimal}{p.calc.fraction ? ` (${p.calc.fraction})` : ""}</p>
            <p className="text-sm text-ink-mid">{tx("Calculated exactly by IntelliHorizon's calculator, not taken from your textbook. Check your own working against it.", "ইন্টেলিহরাইজনের ক্যালকুলেটরে নির্ভুলভাবে হিসাব করা, পাঠ্যবই থেকে নয়। নিজের হিসাবের সাথে মিলিয়ে দেখো।")}</p>
          </>
        )}
      </div>
    );
  }
  if (p.status === "explain_check" && p.check) {
    const all = p.check.covered.length + p.check.missing.length;
    return (
      <div className="space-y-2">
        <p className="font-semibold">{p.check.missing.length === 0 ? tx("You used all the key words from the passage. Nicely done.", "অংশটির সব মূল শব্দ তুমি ব্যবহার করেছ। চমৎকার।") : tx(`You used ${p.check.covered.length} of ${all} key words from the passage.`, `অংশটির ${all}টি মূল শব্দের মধ্যে ${p.check.covered.length}টি ব্যবহার করেছ।`)}</p>
        {p.check.missing.length > 0 && <p className="text-ink-mid">{tx("Look again for: ", "আবার খোঁজো: ")}<span className="font-semibold text-ink">{p.check.missing.join(", ")}</span></p>}
        <p className="text-sm text-ink-low">{tx("This checks for the textbook's key words, not whether your meaning is right. Ask your teacher if you're unsure.", "এটি শুধু পাঠ্যবইয়ের মূল শব্দ খোঁজে, অর্থ ঠিক কিনা নয়। নিশ্চিত না হলে শিক্ষককে জিজ্ঞেস করো।")}</p>
      </div>
    );
  }

  if (p.status === "unsupported_subject") {
    return (
      <div className="space-y-3">
        <p className="text-[16px] leading-relaxed">{p.unsupported ? tx(`${p.unsupported.en} isn't one of the subjects IntelliHorizon covers, so I can't answer from a textbook.`, `${p.unsupported.bn} ইন্টেলিহরাইজনের বিষয়ের মধ্যে নেই, তাই পাঠ্যবই থেকে উত্তর দিতে পারছি না।`) : t(LEAD.unsupported_subject)}</p>
        <p className="text-sm text-ink-mid">{tx("IntelliHorizon covers exactly these eight Class 7 subjects:", "ইন্টেলিহরাইজন ৭ম শ্রেণির ঠিক এই আটটি বিষয় কভার করে:")}</p>
        <SubjectList />
        <p className="text-sm text-ink-mid">{tx("For other subjects, please ask your teacher.", "অন্য বিষয়ের জন্য শিক্ষককে জিজ্ঞেস করো।")}</p>
      </div>
    );
  }
  if (p.status === "subject_conflict" && p.conflict) {
    const sel = subjectById(p.conflict.selected);
    const named = subjectById(p.conflict.named);
    return (
      <div className="space-y-3">
        <p className="text-[16px] leading-relaxed">{tx(`You're searching ${sel ? sel.label.en : "one subject"}, but your question names a book from ${named ? named.label.en : "another subject"}. I didn't search outside what you chose.`, `তুমি ${sel ? sel.label.bn : "একটি বিষয়ে"} খুঁজছ, কিন্তু প্রশ্নে ${named ? named.label.bn : "অন্য বিষয়ের"} একটি বইয়ের নাম আছে। তোমার বাছাইয়ের বাইরে খুঁজিনি।`)}</p>
        {!readOnly && named && <div className="flex flex-wrap gap-2"><Chip to="/tutor" search={{ subject: named.id, book: p.conflict.bookId ?? undefined }}>{tx(`Ask in ${named.label.en}`, `${named.label.bn}-এ জিজ্ঞেস করো`)}</Chip></div>}
      </div>
    );
  }

  const lead = LEAD[p.status] ?? LEAD.needs_context;
  const teach = p.teach;
  const found = p.status === "grounded" || p.status === "partial";
  const say = (l: L) => (teach?.lang ? l[teach.lang] : t(l));
  const folded = !!teach?.guide && found && !open;
  const bookLang = p.excerpts[0]?.source.language;
  const mentioned = p.conflict && p.status !== "subject_conflict" ? subjectById(p.conflict.named) : null;
  const noBooksWhy = p.status === "no_books"
    ? !p.offering
      ? tx("IntelliHorizon is built for Classes 6–10, but only Class 7 has textbooks so far. Your profile is set to a different class, so I won't answer from another class's books; you can still browse the Class 7 books.", "ইন্টেলিহরাইজন ৬ষ্ঠ–১০ম শ্রেণির জন্য তৈরি, তবে এখন পর্যন্ত শুধু ৭ম শ্রেণির পাঠ্যবই আছে। তোমার প্রোফাইলে অন্য শ্রেণি দেওয়া আছে, তাই অন্য শ্রেণির বই থেকে উত্তর দেব না; তবু ৭ম শ্রেণির বই দেখতে পারো।")
      : p.offering.status === "books_not_supplied"
        ? tx("The English-version textbooks haven't been added yet. Nothing has been made up to fill the gap.", "ইংলিশ ভার্সনের পাঠ্যবই এখনো যোগ হয়নি। ফাঁক পূরণে কিছু বানানো হয়নি।")
        : tx("These books are registered but their text hasn't been imported and checked yet.", "বইগুলো নিবন্ধিত, কিন্তু লেখা এখনো আমদানি ও যাচাই হয়নি।")
    : null;
  return (
    <div className="space-y-4">
      {p.status !== "needs_context" && <ScopeLine p={p} />}
      {teach && found && PERSONAS[teach.persona as PersonaId] && (
        <p className="text-xs font-semibold text-ink-mid">{say(PERSONAS[teach.persona as PersonaId].name)}{teach.style && STYLES[teach.style as StyleId] ? `: ${say(STYLES[teach.style as StyleId])}` : ""}</p>
      )}
      <p className="text-[16px] leading-relaxed">{say(lead)}</p>
      {teach?.lang && found && bookLang && bookLang !== teach.lang && (
        <p className="text-sm text-ink-mid">{teach.lang === "en" ? "The passage below stays in the book's own language. IntelliHorizon doesn't translate textbook text, because a translation is not the official book." : "নিচের অংশটি বইয়ের নিজের ভাষাতেই আছে। ইন্টেলিহরাইজন পাঠ্যবইয়ের লেখা অনুবাদ করে না, কারণ অনুবাদ মূল বই নয়।"}</p>
      )}
      {teach?.guide && found && (
        <div className="rounded-[14px] bg-thread/10 p-3.5">
          <p className="text-sm font-semibold">{say({ en: "Think first", bn: "আগে ভাবো" })}</p>
          <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-[15px]">{teach.guide.map((q, i) => <li key={i}>{say(q)}</li>)}</ol>
          {!open && <button type="button" onClick={() => setOpen(true)} className="mt-3 h-10 rounded-full bg-brand px-4 text-sm font-semibold text-sheet">{say({ en: "I've thought about it. Show the passage", bn: "ভেবেছি। অংশটি দেখাও" })}</button>}
        </div>
      )}
      {teach?.steps && (
        <div className="rounded-[14px] border border-ink-low/15 bg-sheet p-3.5">
          <p className="text-sm font-semibold">{say({ en: "Step by step", bn: "ধাপে ধাপে" })}</p>
          <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed">{teach.steps.steps.map((x, i) => <li key={i}>{say(x)}</li>)}</ol>
          <p className="mt-2 text-xs text-ink-low">{say({ en: `IntelliHorizon's explanation, checked against pages ${teach.steps.pages} of your book. It is not the textbook's wording.`, bn: `ইন্টেলিহরাইজনের ব্যাখ্যা, তোমার বইয়ের ${teach.steps.pages} পৃষ্ঠার সঙ্গে মেলানো। এটি পাঠ্যবইয়ের ভাষা নয়।` })}</p>
        </div>
      )}
      {teach && teach.steps === null && found && (
        <p className="text-sm text-ink-mid">{say({ en: "A checked step-by-step walkthrough hasn't been written for this chapter yet, so I'm showing the passage only.", bn: "এই অধ্যায়ের জন্য যাচাই করা ধাপে ধাপে ব্যাখ্যা এখনো লেখা হয়নি, তাই শুধু অংশটি দেখাচ্ছি।" })}</p>
      )}
      {noBooksWhy && <p className="text-sm text-ink-mid">{noBooksWhy}</p>}
      {p.status === "ambiguous" && p.choices && !readOnly && (
        <div className="flex flex-wrap gap-2">
          {p.choices.map((c) => <Chip key={c.subjectId} onClick={onAskInSubject ? () => onAskInSubject(c.subjectId) : undefined} to={onAskInSubject ? undefined : "/tutor"} search={onAskInSubject ? undefined : { subject: c.subjectId }}>{t(subjectById(c.subjectId)?.label ?? { en: c.name, bn: c.name })}</Chip>)}
        </div>
      )}
      {p.rewrite && (
        <p className="rounded-[12px] bg-lilac px-3 py-2 text-sm" data-testid="rewrite">{p.rewrite.from === "en" ? tx(`You asked in English and your book is in Bangla, so I searched it for: ${p.rewrite.searched.join(", ")} (from "${p.rewrite.matched.join(", ")}").`, `তুমি ইংরেজিতে জিজ্ঞেস করেছ আর তোমার বই বাংলায়, তাই বইয়ে খুঁজেছি: ${p.rewrite.searched.join(", ")}।`) : tx(`I searched the English book for: ${p.rewrite.searched.join(", ")}.`, `ইংরেজি বইয়ে খুঁজেছি: ${p.rewrite.searched.join(", ")}।`)}</p>
      )}
      {p.followUp && <p className="text-xs text-ink-mid">{tx("Continuing from your previous question.", "তোমার আগের প্রশ্নের ধারাবাহিকতায়।")}</p>}
      {p.working && <WorkingView w={p.working} />}
      {p.doubt && !readOnly && (
        <div className="rounded-[14px] border border-brand/25 bg-sheet p-3.5 text-[15px]" role="note">
          <p>{tx("You've asked for this to be explained again a few times. Would a different way help?", "তুমি কয়েকবার আবার বুঝিয়ে বলতে বলেছ। অন্যভাবে দেখলে কি সুবিধা হবে?")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {onAskDifferently && <Chip onClick={() => onAskDifferently("steps")}>{tx("Step by step", "ধাপে ধাপে")}</Chip>}
            {onAskDifferently && <Chip onClick={() => onAskDifferently("analogy")}>{tx("With an analogy", "তুলনা দিয়ে")}</Chip>}
            {onAskDifferently && <Chip onClick={() => onAskDifferently("testme")}>{tx("Check what I know", "আমি কী জানি যাচাই করো")}</Chip>}
            <Chip to="/topics">{tx("Pick a topic to practise", "অনুশীলনের টপিক বাছো")}</Chip>
          </div>
        </div>
      )}
      {p.ai && found && !folded && <AiExplanation ai={p.ai} excerpts={p.excerpts} lang={p.language?.explanation ?? null} />}
      {found && !folded && (
        <TrustLine p={p} />
      )}
      {found && !folded && !p.ai?.blocks.length && p.excerpts.length > 0 && !readOnly && (
        <SpeakButton lang={p.excerpts[0].source.language} parts={p.excerpts.map((e) => `${tx("From your textbook", "তোমার পাঠ্যবই থেকে")}: ${e.text}`)} />
      )}
      {mentioned && !readOnly && (
        <p className="rounded-[12px] bg-thread/15 px-3 py-2 text-sm">
          {tx(`Your question mentions ${mentioned.label.en}, but I only searched the subject you chose. `, `তোমার প্রশ্নে ${mentioned.label.bn}-এর কথা আছে, কিন্তু আমি শুধু তোমার বাছাই করা বিষয়ে খুঁজেছি। `)}
          <Link to="/tutor" search={{ subject: mentioned.id }} className="font-semibold underline decoration-dashed underline-offset-4">{tx(`Ask in ${mentioned.label.en}`, `${mentioned.label.bn}-এ জিজ্ঞেস করো`)}</Link>
        </p>
      )}
      {!folded && p.excerpts.map((e, i) => (
        <figure key={e.source.passageId} className="rounded-[18px] border border-ink-low/15 bg-sheet p-4">
          <blockquote lang={e.source.language} className="border-l-[3px] border-thread pl-3.5 text-[16px] leading-[1.75] text-ink">
            <Highlight text={e.text} terms={p.terms} />
          </blockquote>
          {p.ai?.status === "ok" && <p className="mt-2 text-xs font-semibold text-ink-mid">{tx(`Source ${i + 1}`, `উৎস ${i + 1}`)}</p>}
          <SourceCard source={e.source} />
          {!readOnly && <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={saved[i]} onClick={async () => { const r = await call(saveExcerpt({ data: { messageId: m.id, index: i } })); if (r.ok) setSaved((s) => ({ ...s, [i]: true })); }} className="text-sm font-semibold text-ink-mid underline decoration-dashed underline-offset-4 hover:text-ink disabled:no-underline disabled:text-right">
              {saved[i] ? tx("Saved", "সংরক্ষিত") : tx("Save to my notes", "নোটে রাখো")}
            </button>
          </div>}
        </figure>
      ))}
      {found && !folded ? <p className="text-sm text-ink-mid">{say(INTENT_HINT[p.intent] ?? INTENT_HINT.general)}</p> : null}
      {teach?.exam && found && (
        <div className="rounded-[14px] border border-ink-low/15 bg-sheet p-3.5">
          <p className="text-sm font-semibold">{say({ en: "For your exam preparation", bn: "পরীক্ষার প্রস্তুতির জন্য" })}</p>
          {teach.exam.objectives.length > 0 ? (
            <>
              <p className="mt-1 text-sm text-ink-mid">{say({ en: "This chapter's learning outcomes, as printed in your book:", bn: "তোমার বইয়ে ছাপা এই অধ্যায়ের শিখনফল:" })}</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px]" lang={bookLang}>{teach.exam.objectives.map((o, i) => <li key={i}>{o.text}</li>)}</ul>
            </>
          ) : <p className="mt-1 text-sm text-ink-mid">{say({ en: "This chapter's learning outcomes haven't been entered and checked yet.", bn: "এই অধ্যায়ের শিখনফল এখনো যোগ ও যাচাই হয়নি।" })}</p>}
          <p className="mt-2 text-sm text-ink-mid">{teach.exam.exercises > 0 ? say({ en: `${teach.exam.exercises} questions from the textbook's own exercises are ready to practise. These are textbook exercises, not past exam papers.`, bn: `পাঠ্যবইয়ের অনুশীলনী থেকে ${teach.exam.exercises}টি প্রশ্ন অনুশীলনের জন্য প্রস্তুত। এগুলো বইয়ের অনুশীলনী, বিগত পরীক্ষার প্রশ্ন নয়।` }) : say({ en: "No textbook exercise questions have been checked for this chapter yet.", bn: "এই অধ্যায়ের পাঠ্যবইয়ের অনুশীলনী এখনো যাচাই হয়নি।" })}</p>
        </div>
      )}
      {teach && "challenge" in teach && found && (
        <p className="rounded-[14px] bg-thread/10 p-3.5 text-[15px]">
          {teach.challenge
            ? say({ en: `Challenge: ${teach.challenge.count} harder checked question${teach.challenge.count > 1 ? "s" : ""} in this chapter that you haven't solved yet.`, bn: `চ্যালেঞ্জ: এই অধ্যায়ে ${teach.challenge.count}টি কঠিন যাচাই করা প্রশ্ন আছে যা তুমি এখনো সমাধান করোনি।` })
            : say({ en: "There are no harder checked questions left for you in this chapter right now. I won't invent one.", bn: "এই অধ্যায়ে তোমার জন্য আর কঠিন যাচাই করা প্রশ্ন নেই। আমি বানিয়ে দেব না।" })}
          {teach.challenge && !readOnly && <> <Link to="/practice/$chapterId" params={{ chapterId: teach.challenge.chapterId }} className="font-semibold underline decoration-dashed underline-offset-4">{say({ en: "Take the challenge", bn: "চ্যালেঞ্জ নাও" })}</Link></>}
        </p>
      )}
      {(p.status === "not_found" || p.status === "partial") && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-mid">
          <li>{tx("Choose the chapter you're studying so I search the right pages.", "যে অধ্যায় পড়ছ সেটি বেছে নাও, যাতে ঠিক পৃষ্ঠাগুলোতে খুঁজি।")}</li>
          <li>{tx("Use the exact word your textbook uses (Bangla or English, matching your book).", "পাঠ্যবইয়ে যে শব্দ আছে হুবহু সেটি লেখো (তোমার বইয়ের ভাষায়)।")}</li>
          <li>{tx("Ask a narrower question, for example about one word or one step.", "আরও নির্দিষ্ট প্রশ্ন করো, যেমন একটি শব্দ বা একটি ধাপ নিয়ে।")}</li>
          <li>{tx("Ask your teacher: the checked textbook text available here doesn't cover this yet.", "শিক্ষককে জিজ্ঞেস করো: এখানে থাকা যাচাই করা পাঠ্যবইয়ের লেখা এখনো এটি ধরে না।")}</li>
        </ul>
      )}
      {!readOnly && <div className="flex flex-wrap gap-2">
        {p.keyTerms.length > 0 && !explaining && <Chip onClick={() => setExplaining(true)}>{tx("Explain it back", "নিজের ভাষায় বলো")}</Chip>}
        {p.practice && <Chip to="/practice/$chapterId" params={{ chapterId: p.practice.chapterId }}>{tx(`Practise this chapter (${p.practice.count})`, `এই অধ্যায় অনুশীলন (${p.practice.count})`)}</Chip>}
        {p.excerpts[0]?.source.chapter && <Chip to="/chapters/$chapterId" params={{ chapterId: p.excerpts[0].source.chapter.id }}>{tx("Open the chapter", "অধ্যায়টি খোলো")}</Chip>}
        {p.lesson && <Chip to={p.lesson.route}>{tx("Try the interactive lesson", "ইন্টারঅ্যাকটিভ পাঠ চেষ্টা করো")}</Chip>}
        {p.status === "no_books" && <Chip to="/learn">{tx("See what's available", "কী আছে দেখো")}</Chip>}
      </div>}
      {explaining && (
        <form
          className="edu-rise space-y-3 rounded-[18px] bg-paper p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim() || busy) return;
            setBusy(true);
            setErr(null);
            const r = await call(explainBack({ data: { messageId: m.id, text: draft } }));
            setBusy(false);
            if (!r.ok) return setErr(r.code);
            setExplaining(false);
            setDraft("");
            onAppend(r.messages);
          }}
        >
          <label htmlFor={`eb-${m.id}`} className="block text-sm font-semibold">{tx("In your own words, without looking:", "না দেখে, নিজের ভাষায়:")}</label>
          <textarea id={`eb-${m.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={1500} className="w-full rounded-[14px] border border-ink-low/35 bg-sheet p-3 text-[16px] outline-none focus:border-ink" />
          {err && <p className="text-sm text-again" role="alert">{tx("That didn't send. Please try again.", "পাঠানো যায়নি। আবার চেষ্টা করো।")}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !draft.trim()} className="h-10 rounded-full bg-brand px-4 text-sm font-semibold text-sheet disabled:opacity-50">{busy ? tx("Checking…", "দেখছি…") : tx("Check my explanation", "আমার ব্যাখ্যা দেখো")}</button>
            <button type="button" onClick={() => setExplaining(false)} className="h-10 rounded-full px-3 text-sm font-semibold text-ink-mid">{tx("Cancel", "বাতিল")}</button>
          </div>
        </form>
      )}
      {!readOnly && onAskDifferently && found && (
        <div className="border-t border-ink-low/15 pt-3">
          <p className="mb-2 text-sm font-semibold text-ink-mid">{tx("Ask differently", "অন্যভাবে জিজ্ঞেস করো")}</p>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_IDS.filter((id) => id !== teach?.style && !(id === "bangla" && (teach?.lang ?? uiLang) === "bn") && !(id === "english" && (teach?.lang ?? uiLang) === "en")).map((id) => (
              <button key={id} type="button" onClick={() => onAskDifferently(id)} className="inline-flex min-h-9 items-center rounded-full border border-ink-low/30 bg-sheet px-3 py-1 text-sm font-semibold hover:border-ink">{t(STYLES[id])}</button>
            ))}
          </div>
        </div>
      )}
      {!readOnly && (p.status === "grounded" || p.status === "partial") && (
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-low/15 pt-3 text-sm text-ink-mid">
          <span>{tx("Was this useful?", "এটি কি কাজে লেগেছে?")}</span>
          {([1, -1] as const).map((v) => (
            <button key={v} type="button" aria-pressed={fb === v} onClick={async () => { const nv = fb === v ? 0 : v; setFb(nv || null); await call(setFeedback({ data: { messageId: m.id, value: nv } })); }} className={`rounded-full border px-3 py-1 font-semibold ${fb === v ? "border-brand bg-brand text-sheet" : "border-ink-low/30 hover:border-ink"}`}>
              {v === 1 ? tx("Yes", "হ্যাঁ") : tx("No", "না")}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              const text = p.excerpts.map((e) => `${e.text}\n(${e.source.title}, ${e.source.printedPage ?? "PDF p. " + e.source.pdfPage})`).join("\n\n");
              try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
            }}
            className="ml-auto font-semibold underline decoration-dashed underline-offset-4 hover:text-ink"
          >
            {copied ? tx("Copied", "কপি হয়েছে") : tx("Copy", "কপি")}
          </button>
        </div>
      )}
    </div>
  );
}

export function MessageList({ messages, onAppend, pending, readOnly, onAskDifferently, onAskInSubject }: { messages: TutorMessage[]; onAppend: (ms: TutorMessage[]) => void; pending: string | null; readOnly?: boolean; onAskDifferently?: (question: string, style: StyleId) => void; onAskInSubject?: (question: string, subjectId: string) => void }) {
  const questionFor = (i: number) => { for (let k = i - 1; k >= 0; k--) if (messages[k].role === "student") return messages[k].text; return null; };
  const { tx } = useLearner();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!readOnly) end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, pending, readOnly]);
  return (
    <ol className="space-y-6" aria-live="polite">
      {messages.map((m, i) =>
        m.role === "student" ? (
          <li key={m.id} className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] bg-brand px-4 py-2.5 text-[16px] leading-relaxed text-sheet">{m.text}</p>
          </li>
        ) : (
          <li key={m.id} className="edu-rise flex gap-3">
            <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night-0" aria-hidden="true">
              <svg width="16" height="16" viewBox="-8 -8 16 16"><path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#5B3FD6" /></svg>
            </span>
            <div className="min-w-0 flex-1 rounded-[20px] rounded-tl-[6px] bg-paper/70 p-4">{m.payload ? <TutorBubble m={m} onAppend={onAppend} readOnly={readOnly} onAskDifferently={onAskDifferently && !pending && questionFor(i) ? (style) => onAskDifferently(questionFor(i)!, style) : undefined} onAskInSubject={onAskInSubject && !pending && questionFor(i) ? (sid) => onAskInSubject(questionFor(i)!, sid) : undefined} /> : null}</div>
          </li>
        ),
      )}
      {pending && (
        <>
          <li className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] bg-ink/80 px-4 py-2.5 text-[16px] text-sheet">{pending}</p></li>
          <li className="flex gap-3" role="status">
            <span className="mt-1 h-8 w-8 shrink-0 rounded-full bg-night-0" aria-hidden="true" />
            <div className="flex-1 space-y-2 rounded-[20px] bg-paper/70 p-4">
              <p className="text-sm text-ink-mid">{tx("Searching your textbooks…", "তোমার পাঠ্যবইয়ে খুঁজছি…")}</p>
              <div className="h-3 w-3/4 animate-pulse rounded bg-ink-low/20 motion-reduce:animate-none" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-ink-low/20 motion-reduce:animate-none" />
            </div>
          </li>
        </>
      )}
      <div ref={end} />
    </ol>
  );
}

type ScopeData = Awaited<ReturnType<typeof tutorScope>>;
export type TutorContext = { subject: SubjectId | null; book: string | null; chapter: string | null };

/** Subject first (always the eight registry subjects), then a book within that subject, then a chapter. */
export function ContextPicker({ value, onChange }: { value: TutorContext; onChange: (v: TutorContext) => void }) {
  const { tx, t } = useLearner();
  const [scope, setScope] = useState<ScopeData | null>(null);
  useEffect(() => {
    void call(tutorScope()).then((r) => setScope(r as ScopeData));
  }, []);
  const ok = scope && scope.ok ? scope : null;
  const subjectBooks = ok && value.subject ? ok.subjects.find((s) => s.id === value.subject)?.books ?? [] : [];
  const chapters = ok ? ok.chapters.filter((c) => c.textbook_id === value.book) : [];
  const ready = (id: string) => !!ok?.books.some((b) => b.id === id);
  const sel = "h-11 w-full rounded-[12px] border border-ink-low/30 bg-sheet px-3 text-[15px] text-ink outline-none focus:border-ink";
  const pill = (on: boolean) => `inline-flex h-9 items-center rounded-full border px-3 text-sm font-semibold transition-colors ${on ? "border-brand bg-brand text-sheet" : "border-ink-low/30 bg-sheet hover:border-ink"}`;
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-mid">{tx("Subject", "বিষয়")}</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup">
          <button type="button" role="radio" aria-checked={value.subject === null} className={pill(value.subject === null)} onClick={() => onChange({ subject: null, book: null, chapter: null })}>{tx("All subjects", "সব বিষয়")}</button>
          {SUBJECTS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={value.subject === s.id} className={pill(value.subject === s.id)} onClick={() => onChange({ subject: s.id, book: null, chapter: null })}>
              <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: s.hue }} />{t(s.short)}
            </button>
          ))}
        </div>
      </fieldset>
      {value.subject && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink-mid">
            {tx("Book", "বই")}
            <select className={`${sel} mt-1`} value={value.book ?? ""} onChange={(e) => onChange({ ...value, book: e.target.value || null, chapter: null })}>
              <option value="">{subjectBooks.length > 1 ? tx(`Both ${t(subjectById(value.subject)!.short)} books`, `${t(subjectById(value.subject)!.short)}-এর সব বই`) : tx("This subject's book", "এই বিষয়ের বই")}</option>
              {subjectBooks.map((b) => <option key={b.id} value={b.id} disabled={!ready(b.id)}>{b.title}{ready(b.id) ? "" : tx(" (not ready yet)", " (এখনো প্রস্তুত নয়)")}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink-mid">
            {tx("Chapter", "অধ্যায়")}
            <select className={`${sel} mt-1`} value={value.chapter ?? ""} disabled={!value.book || !chapters.length} onChange={(e) => onChange({ ...value, chapter: e.target.value || null })}>
              <option value="">{tx("Any chapter", "যেকোনো অধ্যায়")}</option>
              {chapters.map((c) => <option key={c.id} value={c.id}>{(c.label ? c.label + ": " : c.position + ". ") + c.title}</option>)}
            </select>
          </label>
        </div>
      )}
      {ok && !ok.offering && <p className="text-sm text-ink-mid">{tx("IntelliHorizon is built for Classes 6–10, but your class's textbooks haven't been imported yet, so the tutor has no book of yours to quote. It will say so rather than use another class's books.", "ইন্টেলিহরাইজন ৬ষ্ঠ–১০ম শ্রেণির জন্য তৈরি, তবে তোমার শ্রেণির পাঠ্যবই এখনো আমদানি হয়নি, তাই টিউটরের কাছে তোমার বই থেকে উদ্ধৃতি নেই। অন্য শ্রেণির বই ব্যবহার না করে সেটিই জানাবে।")}</p>}
      {ok && ok.offering?.status === "books_not_supplied" && <p className="text-sm text-ink-mid">{tx("English-version textbooks haven't been added yet, so the tutor has no book to quote for you. It will say so rather than guess.", "ইংলিশ ভার্সনের বই এখনো যোগ হয়নি, তাই টিউটরের কাছে উদ্ধৃত করার মতো বই নেই। অনুমান না করে সেটিই জানাবে।")}</p>}
      {ok && ok.offering?.status === "books_supplied" && ok.books.length === 0 && <p className="text-sm text-ink-mid">{tx("Your eight subjects are set up, but no book text has been imported and approved yet. You can ask; I'll say honestly that I can't check it.", "তোমার আটটি বিষয় প্রস্তুত, তবে কোনো বইয়ের লেখা এখনো আমদানি ও অনুমোদিত হয়নি। প্রশ্ন করতে পারো; মেলাতে না পারলে সরাসরি জানাব।")}</p>}
    </div>
  );
}

export function Composer({ onSend, busy, autoFocus, initial = "" }: { onSend: (text: string) => Promise<boolean>; busy: boolean; autoFocus?: boolean; initial?: string }) {
  const { tx } = useLearner();
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const submit = async () => {
    const v = text.trim();
    if (!v || busy) return;
    const ok = await onSend(v);
    if (ok) setText("");
  };
  return (
    <div>
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex items-end gap-2 rounded-[22px] border border-ink-low/25 bg-sheet p-2 shadow-[0_18px_40px_-26px_rgba(52,36,140,0.6)] focus-within:border-ink">
      <label htmlFor="ask" className="sr-only">{tx("Your question", "তোমার প্রশ্ন")}</label>
      <textarea
        id="ask"
        ref={ref}
        value={text}
        rows={1}
        maxLength={1000}
        onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
        placeholder={tx("Ask a question or try 3/4 + 1/6", "প্রশ্ন করো বা লেখো ৩/৪ + ১/৬")}
        className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink-low/80"
      />
      <button type="submit" disabled={busy || !text.trim()} aria-label={tx("Send", "পাঠাও")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sheet transition-transform active:scale-95 disabled:opacity-40">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-sheet border-t-transparent motion-reduce:animate-none" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
      </button>
    </form>
    <AskInputs disabled={busy} onText={(t) => { setText((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t).slice(0, 1000)); ref.current?.focus(); }} />
    </div>
  );
}

/** Why this answer can be trusted, or where it is limited: how the evidence was found and what language is what. */
function TrustLine({ p }: { p: TutorPayload }) {
  const { tx } = useLearner();
  const bookLang = p.excerpts[0]?.source.language;
  const exp = p.language?.explanation;
  const translated = p.ai?.status === "ok" && bookLang && exp && exp !== "mixed" && exp !== bookLang;
  return (
    <p className="text-xs text-ink-low" data-testid="trust-line">
      {p.retrieval?.mode === "hybrid"
        ? tx("Found by keyword and meaning search in approved textbook text.", "অনুমোদিত পাঠ্যবইয়ের লেখায় শব্দ ও অর্থ দুইভাবে খুঁজে পাওয়া।")
        : tx("Found by keyword search in approved textbook text (meaning-based search isn't switched on).", "অনুমোদিত পাঠ্যবইয়ের লেখায় শব্দ মিলিয়ে খুঁজে পাওয়া (অর্থভিত্তিক খোঁজ চালু নেই)।")}
      {translated ? tx(` The explanation is in ${exp === "en" ? "English" : "Bangla"}; the textbook text and quotations stay in the book's language, as printed.`, ` ব্যাখ্যা ${exp === "en" ? "ইংরেজিতে" : "বাংলায়"}; পাঠ্যবইয়ের লেখা ও উদ্ধৃতি বইয়ের ভাষাতেই, যেমন ছাপা।`) : ""}
    </p>
  );
}

/** Line-by-line result of the working checker: what holds, the earliest step that doesn't, and what it equals. */
function WorkingView({ w }: { w: NonNullable<TutorPayload["working"]> }) {
  const { tx } = useLearner();
  return (
    <div className="space-y-2 rounded-[14px] border border-ink-low/15 bg-sheet p-3.5" data-testid="working">
      <ol className="space-y-1.5">
        {w.steps.map((st, i) => (
          <li key={i} className={`flex flex-wrap items-baseline gap-2 rounded-[10px] px-2 py-1 text-[15px] ${st.status === "wrong" && i === w.firstWrong ? "bg-again-soft" : st.status === "ok" ? "bg-mint-soft/60" : ""}`}>
            <span className="font-mono">{st.line}</span>
            <span className="text-xs font-semibold">
              {st.status === "ok" ? tx("holds", "ঠিক") : st.status === "wrong" ? tx(`doesn't hold: the left side is ${st.detail?.left}, the right side is ${st.detail?.right}`, `মেলে না: বাম দিক ${st.detail?.left}, ডান দিক ${st.detail?.right}`) : st.status === "unchecked" ? tx("couldn't read this line, not checked", "লাইনটি পড়া যায়নি, যাচাই হয়নি") : tx("no equation to check", "যাচাইয়ের মতো সমীকরণ নেই")}
            </span>
          </li>
        ))}
      </ol>
      {w.firstWrong !== null ? (
        <p className="text-[15px]">{tx(`The first step that doesn't hold is line ${w.firstWrong + 1}. Everything before it is right. Look again at what changed from the line above.`, `প্রথম যে ধাপ মেলে না তা ${w.firstWrong + 1} নম্বর লাইন। তার আগের সব ঠিক। আগের লাইন থেকে কী বদলেছে আবার দেখো।`)}</p>
      ) : w.checked > 0 ? (
        <p className="text-[15px]">{tx(`All ${w.checked} checkable steps hold. (This checks the arithmetic, not whether you chose the right method.)`, `যাচাইযোগ্য ${w.checked}টি ধাপই ঠিক। (এটি হিসাব যাচাই করে, পদ্ধতি ঠিক কি না নয়।)`)}</p>
      ) : (
        <p className="text-[15px]">{tx("I couldn't read any line as a calculation, so nothing was checked. Write one step per line, like 7 × 8 = 56.", "কোনো লাইন হিসাব হিসেবে পড়া যায়নি, তাই কিছু যাচাই হয়নি। প্রতি লাইনে একটি ধাপ লেখো, যেমন ৭ × ৮ = ৫৬।")}</p>
      )}
    </div>
  );
}
