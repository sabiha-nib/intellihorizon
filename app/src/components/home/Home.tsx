// IntelliHorizon homepage. Signature: the horizon, where a night sky of topic nodes meets a soft dawn line, the
// product's name made visible. Everything else stays quiet: familiar controls, generous spacing, one accent at a time.
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { L } from "../../content/types";
import type { ScopeCell } from "../../lib/curriculum/scope";
import { AVAILABILITY, MEDIA, SCOPE_GRADES, SCOPE_LINE, SCOPE_SENTENCE, gradeLabel } from "../../lib/curriculum/scope";
import { useLearner } from "../../lib/store";
import { MathText } from "../app/MathText";
import { type DemoLang, type DemoPersona, type DemoStyle, FLOWS, PERSONA_LEAD, PERSONA_NAME, SOURCES, STYLE_NAME, arrange } from "./demo";
import { useActiveIndex, useHeroDepth, useReducedMotion, useReveal } from "./motion";
import "./home.css";

type Props = { cells: ScopeCell[]; aiOn: boolean };

const bnNum = (s: string | number) => String(s).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

export function Home({ cells, aiOn }: Props) {
  const { lang } = useLearner();
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useReveal(root, reduce);
  return (
    <div ref={root} className="ih-home min-h-dvh" lang={lang}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-[10px] focus:bg-[#191D23] focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <HomeNav />
      <main id="main">
        <Hero reduce={reduce} aiOn={aiOn} />
        <Cycle />
        <TutorSection aiOn={aiOn} />
        <Curriculum cells={cells} />
        <Modules />
        <Trust aiOn={aiOn} />
        <About />
        <Closing />
      </main>
      <HomeFooter />
    </div>
  );
}

/* ─────────── A. Navigation ─────────── */

const NAV: { href: string; label: L }[] = [
  { href: "#platform", label: { en: "Platform", bn: "প্ল্যাটফর্ম" } },
  { href: "#tutor", label: { en: "IntelliTutor", bn: "ইন্টেলিটিউটর" } },
  { href: "#how", label: { en: "How It Works", bn: "কীভাবে কাজ করে" } },
  { href: "#curriculum", label: { en: "Curriculum", bn: "পাঠ্যক্রম" } },
  { href: "#about", label: { en: "About", bn: "পরিচিতি" } },
];

function LangToggle() {
  const { lang, updatePrefs, tx } = useLearner();
  return (
    <div role="group" aria-label={tx("Interface language", "ইন্টারফেসের ভাষা")} className="ih-seg">
      {(["bn", "en"] as const).map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => updatePrefs({ lang: l })} className="!min-h-[36px] !px-3">{l === "bn" ? "বাংলা" : "EN"}</button>
      ))}
    </div>
  );
}

function HomeNav() {
  const { t, tx, account } = useLearner();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); menuBtn.current?.focus(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <header className="ih-dark fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-5" style={{ background: "transparent" }}>
      <nav aria-label={tx("Main", "প্রধান")} className="ih-nav mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-full px-3 md:px-4" data-scrolled={scrolled || open} data-testid="home-nav">
        <a href="#top" className="flex shrink-0 items-center gap-2 rounded-full pr-2" aria-label="IntelliHorizon, top of page">
          <HorizonMark />
          <span lang="en" className="ih-display text-[17px] font-bold text-white">IntelliHorizon</span>
        </a>
        <ul className="ml-2 hidden items-center lg:flex">
          {NAV.map((n) => <li key={n.href}><a className="ih-navlink" href={n.href}>{t(n.label)}</a></li>)}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block"><LangToggle /></div>
          {account ? (
            <Link to="/dashboard" className="ih-btn ih-btn-primary !min-h-[40px] !px-4 text-[15px]">{tx("Open my dashboard", "আমার ড্যাশবোর্ড খোলো")}</Link>
          ) : (
            <>
              <Link to="/signin" className="ih-navlink hidden md:inline-flex">{tx("Sign In", "সাইন ইন")}</Link>
              <Link to="/start" className="ih-btn ih-btn-primary hidden !min-h-[40px] !px-4 text-[15px] sm:inline-flex">{tx("Get Started", "শুরু করো")}</Link>
            </>
          )}
          <button ref={menuBtn} type="button" className="ih-navlink inline-flex h-11 w-11 items-center justify-center lg:hidden" aria-expanded={open} aria-controls="home-menu" onClick={() => setOpen((o) => !o)}>
            <span className="sr-only">{open ? tx("Close menu", "মেনু বন্ধ করো") : tx("Open menu", "মেনু খোলো")}</span>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </nav>
      {open && (
        <div id="home-menu" className="mx-auto mt-2 max-w-6xl rounded-[24px] border border-[rgba(222,220,220,0.14)] bg-[#191D23] p-3 lg:hidden" data-testid="home-menu">
          <ul className="grid gap-1">
            {NAV.map((n) => <li key={n.href}><a className="ih-navlink flex min-h-[44px] items-center" href={n.href} onClick={() => setOpen(false)}>{t(n.label)}</a></li>)}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgba(222,220,220,0.14)] pt-3">
            <LangToggle />
            {!account && <Link to="/signin" className="ih-btn ih-btn-ghost !min-h-[44px]">{tx("Sign In", "সাইন ইন")}</Link>}
            {!account && <Link to="/start" className="ih-btn ih-btn-primary !min-h-[44px]">{tx("Get Started", "শুরু করো")}</Link>}
          </div>
        </div>
      )}
    </header>
  );
}

function HorizonMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <defs><linearGradient id="ih-mark" x1="0" x2="1"><stop offset="0" stopColor="#FCE7F3" /><stop offset="1" stopColor="#F9A8D4" /></linearGradient></defs>
      <circle cx="16" cy="16" r="15" fill="#20252D" stroke="rgba(222,220,220,0.25)" />
      <path d="M5 20c3.5-4 7.2-6 11-6s7.5 2 11 6" fill="none" stroke="url(#ih-mark)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="10" r="2.2" fill="#F9A8D4" />
    </svg>
  );
}

/* ─────────── B + C. Hero with layered depth ─────────── */

const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 73) % 100, y: (i * 37) % 62, r: i % 7 === 0 ? 1.6 : i % 3 === 0 ? 1.1 : 0.7 }));
// Topic nodes sit in the right half, behind the demonstration card, so they never cross the headline.
const NODES: { x: number; y: number; label: string; lx: number; ly: number; anchor: "start" | "end" }[] = [
  { x: 60, y: 12, label: "অনুপাত", lx: 61.6, ly: 15.4, anchor: "start" },
  { x: 74, y: 7, label: "ধারাবাহিক অনুপাত", lx: 75.6, ly: 10.4, anchor: "start" },
  { x: 90, y: 14, label: "সমানুপাত", lx: 88.4, ly: 17.4, anchor: "end" },
  { x: 95, y: 34, label: "বহুরাশিক অনুপাত", lx: 98.5, ly: 30.2, anchor: "end" },
  { x: 86, y: 52, label: "লাভ-ক্ষতি", lx: 84.4, ly: 55.4, anchor: "end" },
  { x: 66, y: 50, label: "শতকরা", lx: 67.6, ly: 53.4, anchor: "start" },
];
const LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];

function Hero({ reduce, aiOn }: { reduce: boolean; aiOn: boolean }) {
  const { t, tx, lang } = useLearner();
  const hero = useRef<HTMLElement>(null);
  useHeroDepth(hero, reduce);
  return (
    <section id="top" ref={hero} className="ih-hero ih-dark overflow-hidden" aria-labelledby="hero-h" data-testid="hero">
      <div className="ih-layer ih-sky" aria-hidden="true" />
      <svg className="ih-layer ih-stars" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.15} fill="#DEDCDC" opacity={0.22 + (i % 4) * 0.09} />)}
      </svg>
      <svg className="ih-layer ih-nodes hidden lg:block" aria-hidden="true" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" style={{ opacity: 0.85 }}>
        {LINKS.map(([a, b], i) => <line key={i} className="ih-link-draw" x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="#7B919C" strokeWidth="0.12" opacity="0.7" />)}
        {NODES.map((n, i) => (
          <g key={i} className="ih-node-pulse" style={{ animationDelay: `${i * 0.7}s` }}>
            <circle cx={n.x} cy={n.y} r="0.75" fill="#F9A8D4" />
            <circle cx={n.x} cy={n.y} r="1.9" fill="none" stroke="#F9A8D4" strokeWidth="0.08" opacity="0.6" />
            <text x={n.lx} y={n.ly} textAnchor={n.anchor} fontSize="1.25" fill="#989DAA" fontFamily="Hind Siliguri, sans-serif">{n.label}</text>
          </g>
        ))}
      </svg>
      <svg className="ih-layer ih-horizon" aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
        <defs>
          <linearGradient id="ih-hz" x1="0" x2="1"><stop offset="0" stopColor="#C5BAC4" stopOpacity="0" /><stop offset="0.5" stopColor="#F9A8D4" /><stop offset="1" stopColor="#C5BAC4" stopOpacity="0" /></linearGradient>
          <radialGradient id="ih-dawn" cx="0.5" cy="1" r="0.6"><stop offset="0" stopColor="#FCE7F3" stopOpacity="0.55" /><stop offset="1" stopColor="#FCE7F3" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse className="ih-glow" cx="720" cy="1060" rx="980" ry="300" fill="url(#ih-dawn)" />
        <path d="M-40 900 Q720 740 1480 900" fill="none" stroke="url(#ih-hz)" strokeWidth="2.2" />
        <path d="M-40 930 Q720 800 1480 930" fill="none" stroke="url(#ih-hz)" strokeWidth="1" opacity="0.45" />
      </svg>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-32 md:px-6 md:pt-40 lg:min-h-[92svh] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pb-44">
        <div>
          <p className="ih-eyebrow text-[#F9A8D4] !tracking-[0.05em]">{t(SCOPE_LINE)}</p>
          <h1 id="hero-h" className="ih-display mt-5 text-[clamp(2.3rem,7vw,5rem)] font-extrabold leading-[1.02] text-white">
            {/* Line breaks are fixed, so the headline keeps its shape while web fonts load (no layout shift). */}
            {lang === "bn"
              ? <><span className="block">শেখা হোক</span>{" "}<span className="block"><span className="ih-editorial ih-gradient-text">তোমাকে বুঝে</span>।</span></>
              : <><span className="block lg:whitespace-nowrap">Learning <br className="hidden lg:inline" />should</span>{" "}<span className="block lg:whitespace-nowrap"><span className="ih-editorial ih-gradient-text pr-1">understand</span> <br className="hidden lg:inline" />you.</span></>}
          </h1>
          <p className="mt-6 max-w-[33rem] text-[clamp(1.05rem,1.6vw,1.25rem)] leading-relaxed text-[#DEDCDC]">{t(SCOPE_SENTENCE)}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/start" className="ih-btn ih-btn-primary" data-testid="cta-explore">{tx("Explore IntelliHorizon", "ইন্টেলিহরাইজন ঘুরে দেখো")}</Link>
            <a href="#tutor" className="ih-btn ih-btn-ghost" data-testid="cta-tutor">{tx("Meet Your AI Tutor", "তোমার এআই টিউটরের সঙ্গে পরিচিত হও")}</a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#989DAA]">
            {[tx("Answers from your own textbook", "উত্তর তোমার নিজের বই থেকে"), tx("Bangla, English or both", "বাংলা, ইংরেজি বা দুটোই"), tx("Says so when it doesn't know", "না জানলে সেটাই বলে")].map((x) => (
              <li key={x} className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F9A8D4]" />{x}</li>
            ))}
          </ul>
        </div>
        <div className="ih-card-float">
          <HeroTutorCard aiOn={aiOn} />
        </div>
      </div>
    </section>
  );
}

function HeroTutorCard({ aiOn }: { aiOn: boolean }) {
  const { tx } = useLearner();
  return (
    <figure className="ih-card-dark mx-auto max-w-md p-5 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.8)]" aria-label={tx("IntelliTutor demonstration", "ইন্টেলিটিউটর প্রদর্শনী")}>
      <div className="flex items-center justify-between gap-3">
        <span className="ih-display text-sm font-semibold text-white">IntelliTutor</span>
        <span className="ih-chip bg-[rgba(249,168,212,0.14)] text-[#F9A8D4]">{tx("Demonstration", "প্রদর্শনী")}</span>
      </div>
      <p lang="bn" className="ml-auto mt-4 w-fit max-w-[85%] rounded-[18px] rounded-br-[6px] bg-[#57707A] px-4 py-2.5 text-[15px] text-white">ধারাবাহিক অনুপাত কাকে বলে?</p>
      <div className="mt-3 rounded-[18px] rounded-bl-[6px] bg-[#191D23] p-4">
        <span className="ih-chip bg-[rgba(123,145,156,0.22)] text-[#DEDCDC]">{tx("From your textbook", "তোমার পাঠ্যবই থেকে")}</span>
        <blockquote lang="bn" className="mt-2 border-l-2 border-[#F9A8D4] pl-3 text-[15px] leading-relaxed text-[#DEDCDC]">“এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে।”</blockquote>
        <p className="mt-2 text-xs text-[#989DAA]">{tx("Mathematics (গণিত), Class 7 · printed page 18", "গণিত, ৭ম শ্রেণি · ছাপা পৃষ্ঠা ১৮")}</p>
      </div>
      <figcaption className="mt-3 text-xs leading-relaxed text-[#989DAA]">
        {tx("A layout example written by the IntelliHorizon team. The quotation is copied exactly from the checked textbook passage.", "ইন্টেলিহরাইজন দলের লেখা একটি বিন্যাসের উদাহরণ। উদ্ধৃতিটি যাচাই করা পাঠ্যাংশ থেকে হুবহু নেওয়া।")}
        {!aiOn && " " + tx("AI explanations are being switched on; today the live tutor answers with checked textbook text.", "এআই ব্যাখ্যা চালু হচ্ছে; আজ লাইভ টিউটর যাচাই করা পাঠ্যবইয়ের লেখা দিয়ে উত্তর দেয়।")}
      </figcaption>
    </figure>
  );
}

/* ─────────── D. The learning cycle ─────────── */

const CYCLE: { name: L; body: L; modules: string }[] = [
  { name: { en: "Discover", bn: "আবিষ্কার" }, body: { en: "Your class, your textbook version, your subjects. The knowledge map shows every chapter and what your evidence says about it.", bn: "তোমার শ্রেণি, পাঠ্যবইয়ের ভার্সন, তোমার বিষয়। জ্ঞান মানচিত্রে প্রতিটি অধ্যায় আর তোমার প্রমাণ কী বলে তা দেখা যায়।" }, modules: "KnowledgeMap · TopicWise · HorizonPath" },
  { name: { en: "Understand", bn: "বোঝা" }, body: { en: "IntelliTutor explains from checked textbook passages, in Bangla, English or both, and labels what comes from the book.", bn: "ইন্টেলিটিউটর যাচাই করা পাঠ্যাংশ থেকে বাংলা, ইংরেজি বা দুই ভাষায় বোঝায়, আর কোনটি বই থেকে তা চিহ্নিত করে।" }, modules: "IntelliTutor · IntelliSummary · FormulaVault" },
  { name: { en: "Practice", bn: "অনুশীলন" }, body: { en: "Questions from the textbook's own exercises, graded on the server. Duplicate submissions never count twice.", bn: "পাঠ্যবইয়ের নিজস্ব অনুশীলনীর প্রশ্ন, সার্ভারে মূল্যায়ন। একই উত্তর দুবার জমা দিলে দুবার গোনা হয় না।" }, modules: "IntelliQuiz · ExamArena · LearnLab" },
  { name: { en: "Improve", bn: "উন্নতি" }, body: { en: "Repeated mistakes become visible patterns, with a targeted correction instead of a lecture.", bn: "বারবার হওয়া ভুল চোখে পড়ার মতো নমুনা হয়ে ওঠে, সঙ্গে লক্ষ্যভেদী সংশোধন, লম্বা বক্তৃতা নয়।" }, modules: "Misconception Radar · step checker" },
  { name: { en: "Master", bn: "দক্ষতা" }, body: { en: "A topic is called mastered only when enough answers show it. One lucky answer never does.", bn: "যথেষ্ট উত্তর প্রমাণ দিলেই কেবল একটি টপিককে আয়ত্ত বলা হয়। একবার ভাগ্যে মেলা উত্তরে নয়।" }, modules: "Learning Twin · LearningAnalytics" },
  { name: { en: "Remember", bn: "মনে রাখা" }, body: { en: "Spaced revision brings questions and cards back just before you'd forget them.", bn: "বিরতি দিয়ে পুনরালোচনা প্রশ্ন ও কার্ডকে ঠিক ভুলে যাওয়ার আগে ফিরিয়ে আনে।" }, modules: "SmartRevision · MemoryCards · SmartNotes" },
];

function Cycle() {
  const { t, tx, lang } = useLearner();
  const refs = useRef<(HTMLElement | null)[]>([]);
  const active = useActiveIndex(refs, CYCLE.length);
  const R = 92;
  const pos = (i: number) => { const a = (i / CYCLE.length) * Math.PI * 2 - Math.PI / 2; return { x: 120 + R * Math.cos(a), y: 120 + R * Math.sin(a) }; };
  return (
    <section id="how" aria-labelledby="how-h" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-6 md:py-32">
        <p className="ih-eyebrow ih-muted ih-reveal">{tx("How it works", "কীভাবে কাজ করে")}</p>
        <h2 id="how-h" className="ih-display ih-reveal ih-reveal-2 mt-3 max-w-[20ch] text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.08]">{tx("Built from what you actually do", "তুমি আসলে যা করো, তা থেকেই তৈরি")}</h2>
        <p className="ih-reveal ih-reveal-3 mt-4 max-w-[56ch] text-lg leading-relaxed ih-muted">{tx("IntelliHorizon never guesses who you are. It reads your answers, your mistakes and your revision, and explains every recommendation.", "ইন্টেলিহরাইজন তোমাকে অনুমান করে না। তোমার উত্তর, ভুল আর পুনরালোচনা দেখে, আর প্রতিটি সুপারিশের কারণ বলে।")}</p>
        <div className="mt-14 grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <svg viewBox="0 0 240 240" className="mx-auto w-56 lg:w-full" role="img" aria-label={tx(`Learning cycle, step ${active + 1} of 6: ${t(CYCLE[active].name)}`, `শেখার চক্র, ৬টির মধ্যে ${bnNum(active + 1)} নম্বর ধাপ: ${t(CYCLE[active].name)}`)}>
              <circle cx="120" cy="120" r={R} fill="none" stroke="#DEDCDC" strokeWidth="2" />
              {CYCLE.map((_, i) => {
                const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
                const p0 = { x: 120 + R * Math.cos(a0), y: 120 + R * Math.sin(a0) }, p1 = { x: 120 + R * Math.cos(a1), y: 120 + R * Math.sin(a1) };
                return <path key={i} className="ih-ring-seg" d={`M${p0.x} ${p0.y} A${R} ${R} 0 0 1 ${p1.x} ${p1.y}`} fill="none" stroke={i <= active ? "#57707A" : "transparent"} strokeWidth={i === active ? 5 : 3} strokeLinecap="round" />;
              })}
              {CYCLE.map((c, i) => { const p = pos(i); return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={i === active ? 9 : 6} fill={i === active ? "#F9A8D4" : i < active ? "#57707A" : "#FFFFFF"} stroke="#57707A" strokeWidth="2" className="ih-ring-seg" />
                </g>
              ); })}
              <text x="120" y="114" textAnchor="middle" fontSize="13" fill="#57707A" fontFamily="Montserrat, Hind Siliguri, sans-serif" fontWeight="600">{lang === "bn" ? `ধাপ ${bnNum(active + 1)}/৬` : `Step ${active + 1}/6`}</text>
              <text x="120" y="136" textAnchor="middle" fontSize="18" fill="#191D23" fontFamily="Montserrat, Hind Siliguri, sans-serif" fontWeight="700">{t(CYCLE[active].name)}</text>
            </svg>
            <p className="mt-4 text-center text-sm ih-muted" lang="en">Discover → Understand → Practice → Improve → Master → Remember</p>
          </div>
          <ol className="space-y-5">
            {CYCLE.map((c, i) => (
              <li key={i} ref={(el) => { refs.current[i] = el; }} data-index={i} className={`ih-step ih-reveal rounded-[24px] border p-6 md:p-8 ${i === active ? "border-[#57707A] bg-[#FCE7F3]/60" : "border-[#DEDCDC]"}`} aria-current={i === active ? "step" : undefined}>
                <p className="ih-eyebrow ih-muted">{lang === "bn" ? `${bnNum(i + 1)}` : `0${i + 1}`}</p>
                <h3 className="ih-display mt-2 text-2xl font-bold">{t(c.name)}</h3>
                <p className="mt-2 max-w-[58ch] text-[17px] leading-relaxed text-[#191D23]/85">{t(c.body)}</p>
                <p className="mt-3 text-sm font-semibold ih-muted" lang="en">{c.modules}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ─────────── E. Meet IntelliTutor ─────────── */

const BASIS_LABEL: Record<string, L> = {
  textbook: { en: "From your textbook", bn: "তোমার পাঠ্যবই থেকে" },
  derived: { en: "Worked out from your textbook", bn: "পাঠ্যবই থেকে কষে বের করা" },
  practice: { en: "Practice question", bn: "অনুশীলন প্রশ্ন" },
  general: { en: "IntelliHorizon note", bn: "ইন্টেলিহরাইজনের নোট" },
  app: { en: "Checked by the app's calculator", bn: "অ্যাপের হিসাব-যন্ত্রে যাচাই" },
};
const BASIS_TONE: Record<string, string> = {
  textbook: "bg-[rgba(252,231,243,0.14)] text-[#FCE7F3]",
  derived: "bg-[rgba(123,145,156,0.25)] text-[#DEDCDC]",
  practice: "bg-[rgba(249,168,212,0.16)] text-[#F9A8D4]",
  general: "bg-[rgba(152,157,170,0.18)] text-[#DEDCDC]",
  app: "bg-[rgba(123,145,156,0.25)] text-[#DEDCDC]",
};

function TutorSection({ aiOn }: { aiOn: boolean }) {
  const { t, tx, lang: ui } = useLearner();
  const [dl, setDl] = useState<DemoLang>(ui === "en" ? "en" : "bn");
  const [persona, setPersona] = useState<DemoPersona>("mentor");
  const [style, setStyle] = useState<DemoStyle>("default");
  const [flowId, setFlowId] = useState(FLOWS[0].id);
  const flow = FLOWS.find((f) => f.id === flowId)!;
  const blocks = arrange(flow, persona, style);
  const pick = <T extends string>(o: Record<"bn" | "en" | "mixed", T> | { bn: string; en: string; mixed: string }) => o[dl];
  const langName: Record<DemoLang, string> = { bn: "বাংলা", en: "English", mixed: tx("Mixed", "মিশ্র") };
  const textLang = dl === "en" ? "en" : "bn";
  return (
    <section id="tutor" aria-labelledby="tutor-h" className="ih-dark scroll-mt-20 relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_80%_0%,rgba(249,168,212,0.18),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-24 md:px-6 md:py-32">
        <p className="ih-eyebrow text-[#F9A8D4] ih-reveal">{tx("Meet IntelliTutor", "পরিচিত হও ইন্টেলিটিউটরের সঙ্গে")}</p>
        <h2 id="tutor-h" className="ih-display ih-reveal ih-reveal-2 mt-3 max-w-[22ch] text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-[1.04] text-white">
          {byLang(ui, <>A tutor that reads <span className="ih-editorial ih-gradient-text">your</span> textbook, and says when it can't help.</>, <>যে টিউটর <span className="ih-editorial ih-gradient-text">তোমার</span> বই পড়ে, আর না পারলে সেটাই বলে।</>)}
        </h2>
        <p className="ih-reveal ih-reveal-3 mt-5 max-w-[60ch] text-lg leading-relaxed text-[#DEDCDC]">{tx("It knows your class, textbook version, subject and chapter. It searches only approved pages of your own edition, explains in the language you choose, and labels every part: from your book, worked out from it, or general.", "এটি তোমার শ্রেণি, পাঠ্যবইয়ের ভার্সন, বিষয় ও অধ্যায় জানে। শুধু তোমার নিজের সংস্করণের অনুমোদিত পাতায় খোঁজে, তুমি যে ভাষা বাছো তাতে বোঝায়, আর প্রতিটি অংশ চিহ্নিত করে: বই থেকে, বই থেকে কষে বের করা, নাকি সাধারণ।")}</p>

        <div className="mt-12 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]" data-testid="tutor-preview">
          <div className="space-y-6">
            <fieldset>
              <legend className="text-sm font-semibold text-white">{tx("Explanation language", "ব্যাখ্যার ভাষা")}</legend>
              <div className="ih-seg mt-2" role="radiogroup" aria-label={tx("Explanation language", "ব্যাখ্যার ভাষা")}>
                {(["bn", "en", "mixed"] as DemoLang[]).map((l) => <button key={l} type="button" role="radio" aria-checked={dl === l} data-demo-lang={l} onClick={() => setDl(l)}>{langName[l]}</button>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-white">{tx("Teaching approach", "শেখানোর ধরন")}</legend>
              <div className="ih-seg mt-2" role="radiogroup" aria-label={tx("Teaching approach", "শেখানোর ধরন")}>
                {(Object.keys(PERSONA_NAME) as DemoPersona[]).map((p) => <button key={p} type="button" role="radio" aria-checked={persona === p} data-demo-persona={p} onClick={() => setPersona(p)}>{pick(PERSONA_NAME[p])}</button>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-white">{tx("Ask differently", "অন্যভাবে জিজ্ঞেস করো")}</legend>
              <div className="ih-seg mt-2" role="radiogroup" aria-label={tx("Ask differently", "অন্যভাবে জিজ্ঞেস করো")}>
                {(Object.keys(STYLE_NAME) as DemoStyle[]).map((s) => <button key={s} type="button" role="radio" aria-checked={style === s} data-demo-style={s} onClick={() => setStyle(s)}>{pick(STYLE_NAME[s])}</button>)}
              </div>
            </fieldset>
          </div>

          <div className="ih-card-dark p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="ih-seg" role="tablist" aria-label={tx("Sample questions", "নমুনা প্রশ্ন")}>
                {FLOWS.map((f) => <button key={f.id} type="button" role="tab" aria-selected={flowId === f.id} aria-controls="demo-panel" data-demo-flow={f.id} onClick={() => setFlowId(f.id)}>{pick(f.label)}</button>)}
              </div>
              <span className="ih-chip bg-[rgba(249,168,212,0.14)] text-[#F9A8D4]" data-testid="demo-label">{tx("Demonstration · not a live model response", "প্রদর্শনী · লাইভ মডেলের উত্তর নয়")}</span>
            </div>
            <div id="demo-panel" role="tabpanel" aria-live="polite" className="mt-5 space-y-3">
              <p lang={textLang} className="ml-auto w-fit max-w-[88%] whitespace-pre-line rounded-[18px] rounded-br-[6px] bg-[#57707A] px-4 py-2.5 text-[15px] text-white" data-testid="demo-question">{pick(flow.question)}</p>
              <div className="rounded-[18px] rounded-bl-[6px] bg-[#191D23] p-4 md:p-5">
                {flow.id !== "outside" && flow.id !== "working" && <p lang={textLang} className="mb-3 text-sm italic text-[#989DAA]" data-testid="demo-lead">{pick(PERSONA_LEAD[persona])}</p>}
                <ol className="space-y-3">
                  {blocks.map((b, i) => (
                    <li key={`${flow.id}-${i}`} className="space-y-1.5">
                      <span className={`ih-chip ${BASIS_TONE[b.basis]}`}>{t(BASIS_LABEL[b.basis])}{b.cite ? ` · ${tx(`source ${b.cite}`, `উৎস ${bnNum(b.cite)}`)}` : ""}</span>
                      <p lang={textLang} className={`text-[15.5px] leading-relaxed ${b.role === "notice" ? "text-[#FCE7F3]" : "text-[#DEDCDC]"}`}><MathText text={pick(b.text)} /></p>
                    </li>
                  ))}
                </ol>
                {flow.quote && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-[#989DAA]">{tx("Exact words from your book (never translated)", "তোমার বইয়ের হুবহু কথা (কখনো অনুবাদ করা হয় না)")}</p>
                    <blockquote lang="bn" className="mt-1 border-l-2 border-[#F9A8D4] pl-3 text-[15.5px] text-white">“{flow.quote.text}”</blockquote>
                  </div>
                )}
              </div>
              {!flow.noSources && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {([1, 2] as const).filter((s) => flow.blocks.some((b) => b.cite === s) || flow.quote?.source === s).map((s) => (
                    <div key={s} className="rounded-[14px] border border-[rgba(222,220,220,0.14)] p-3 text-sm">
                      <p className="font-semibold text-white">{tx(`Source ${s}`, `উৎস ${bnNum(s)}`)} · <span lang="bn">{SOURCES[s].book}</span> · {tx(SOURCES[s].pageEn, SOURCES[s].page)}</p>
                      <p lang="bn" className="mt-1 text-[#989DAA]">{SOURCES[s].text}</p>
                    </div>
                  ))}
                </div>
              )}
              <ul className="flex flex-wrap gap-2 text-xs text-[#989DAA]" aria-label={tx("How this answer is checked", "এই উত্তর কীভাবে যাচাই হয়")}>
                {flow.checks.map((c, i) => <li key={i} className="flex items-center gap-1.5"><span aria-hidden="true">✓</span>{pick(c)}</li>)}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link to="/tutor" className="ih-btn ih-btn-primary">{tx("Try the real tutor", "আসল টিউটর চেষ্টা করো")}</Link>
          <p className="max-w-[60ch] text-sm text-[#989DAA]">{tx("The preview above is written by the IntelliHorizon team to show the layout. The real tutor answers your own questions with the same checks.", "ওপরের নমুনাটি বিন্যাস দেখাতে ইন্টেলিহরাইজন দলের লেখা। আসল টিউটর একই যাচাই দিয়ে তোমার নিজের প্রশ্নের উত্তর দেয়।")}{!aiOn && " " + tx("AI explanations are being switched on; until then it answers with checked textbook passages.", "এআই ব্যাখ্যা চালু হচ্ছে; ততক্ষণ যাচাই করা পাঠ্যাংশ দিয়ে উত্তর দেয়।")}</p>
        </div>
      </div>
    </section>
  );
}

const byLang = (ui: string, en: ReactNode, bn: ReactNode) => (ui === "bn" ? bn : en);

/* ─────────── F. Curriculum ─────────── */

const TONE: Record<string, string> = {
  available: "bg-[#57707A] text-white",
  partial: "bg-[#191D23] text-white",
  under_review: "bg-[#FCE7F3] text-[#191D23] border border-[#C5BAC4]",
  coming_soon: "bg-white text-[#57707A] border border-[#C5BAC4]",
};

function Curriculum({ cells }: { cells: ScopeCell[] }) {
  const { t, tx, lang: ui } = useLearner();
  const [grade, setGrade] = useState<number>(7);
  const N = (n: number) => (ui === "bn" ? bnNum(n) : String(n));
  return (
    <section id="curriculum" aria-labelledby="cur-h" className="scroll-mt-20 bg-[#FCE7F3]">
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-6 md:py-32">
        <p className="ih-eyebrow text-[#465C65] ih-reveal">{tx("Curriculum", "পাঠ্যক্রম")}</p>
        <h2 id="cur-h" className="ih-display ih-reveal ih-reveal-2 mt-3 text-[clamp(1.9rem,4.2vw,3.2rem)] font-bold leading-[1.1]">
          {tx("Classes 6–10 | NCTB | Bangla Version + English Version", "৬ষ্ঠ–১০ম শ্রেণি | এনসিটিবি | বাংলা ভার্সন + ইংলিশ ভার্সন")}
        </h2>
        <p className="ih-reveal ih-reveal-3 mt-4 max-w-[62ch] text-lg leading-relaxed text-[#191D23]/85">{tx("Bangla Version and English Version are separate editions with their own wording and page numbers, so they're kept apart. Availability below is counted live from what has actually been imported and checked.", "বাংলা ভার্সন আর ইংলিশ ভার্সন আলাদা সংস্করণ, যাদের লেখা ও পৃষ্ঠা নম্বর নিজস্ব, তাই এগুলো আলাদা রাখা হয়। নিচের প্রাপ্যতা আসলে আমদানি ও যাচাই হওয়া বিষয়বস্তু থেকে সরাসরি গোনা।")}</p>
        <div className="mt-10 ih-seg ih-seg-light ih-seg-grades" role="tablist" aria-label={tx("Class", "শ্রেণি")} data-testid="grade-tabs">
          {SCOPE_GRADES.map((g) => <button key={g} type="button" role="tab" aria-selected={grade === g} aria-controls="grade-panel" data-grade={g} onClick={() => setGrade(g)} className="!min-h-[44px] text-[14px] sm:text-[15px]">{t(gradeLabel(g))}</button>)}
        </div>
        <div id="grade-panel" role="tabpanel" className="mt-6 grid gap-4 md:grid-cols-2" data-testid="grade-panel">
          {MEDIA.map((m) => {
            const c = cells.find((x) => x.grade === grade && x.medium === m.id);
            const a = c?.availability ?? "coming_soon";
            const demo = grade === 7 && m.id === "bangla" && c && c.publishedPassages > 0;
            return (
              <article key={m.id} className="ih-card p-6" data-medium={m.id} data-availability={a}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="ih-display text-xl font-bold">{t(gradeLabel(grade))} · {t(m.label)}</h3>
                  <span className={`ih-chip ${TONE[a]}`}>{t(AVAILABILITY[a].label)}</span>
                </div>
                <p className="mt-2 text-[15px] text-[#57707A]">{t(AVAILABILITY[a].detail)}</p>
                {c && c.books > 0 && (
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    {[[c.books, tx("books", "বই")], [c.chapters, tx("chapters", "অধ্যায়")], [c.publishedPassages, tx("checked passages", "যাচাই করা অংশ")], [c.publishedQuestions, tx("questions", "প্রশ্ন")]].map(([n, l], i) => (
                      <div key={i}><dt className="text-[#57707A]">{l}</dt><dd className="ih-display text-2xl font-bold tnum">{N(n as number)}</dd></div>
                    ))}
                  </dl>
                )}
                {demo && <p className="mt-4 rounded-[14px] bg-[#FCE7F3] px-3 py-2 text-sm font-semibold">{tx("The working demonstration path today. More chapters are being imported and checked.", "আজকের সচল প্রদর্শনী-পথ। আরও অধ্যায় আমদানি ও যাচাই চলছে।")}</p>}
              </article>
            );
          })}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link to="/start" className="ih-btn ih-btn-primary">{tx("Choose your class and version", "তোমার শ্রেণি ও ভার্সন বাছো")}</Link>
          <p className="text-sm text-[#465C65]">{tx("Nothing unavailable is shown as ready.", "যা নেই তা প্রস্তুত বলে দেখানো হয় না।")}</p>
        </div>
      </div>
    </section>
  );
}

/* ─────────── G. Platform modules ─────────── */

type Mod = { id: string; name: string; to: string; stage: "understand" | "practise" | "track" | "remember"; what: L; evidence: L };
const MODS: Mod[] = [
  { id: "tutor", name: "IntelliTutor", to: "/tutor", stage: "understand", what: { en: "Explains from checked passages of your own edition, in Bangla, English or both, with five teaching approaches and Ask Differently.", bn: "তোমার নিজের সংস্করণের যাচাই করা অংশ থেকে বাংলা, ইংরেজি বা দুই ভাষায় বোঝায়, পাঁচ রকম শেখানোর ধরন আর \"অন্যভাবে জিজ্ঞেস করো\"-সহ।" }, evidence: { en: "Every citation, quotation and calculation is checked before you see it.", bn: "তুমি দেখার আগে প্রতিটি উৎস, উদ্ধৃতি ও হিসাব যাচাই হয়।" } },
  { id: "summary", name: "IntelliSummary", to: "/summary", stage: "understand", what: { en: "Chapter summaries made from the book's own sentences.", bn: "বইয়ের নিজের বাক্য থেকে অধ্যায়ের সারসংক্ষেপ।" }, evidence: { en: "Only checked text is used, so a chapter without it says so.", bn: "শুধু যাচাই করা লেখা ব্যবহৃত হয়, তাই যে অধ্যায়ে নেই সেখানে সেটাই বলে।" } },
  { id: "formulas", name: "FormulaVault", to: "/formulas", stage: "understand", what: { en: "Checked formulas, each with its textbook page and a worked example.", bn: "যাচাই করা সূত্র, প্রতিটির পাঠ্যবইয়ের পৃষ্ঠা ও একটি সমাধান করা উদাহরণসহ।" }, evidence: { en: "A formula appears only after it's been checked against the page.", bn: "পাতার সঙ্গে মেলানোর পরেই সূত্র দেখা যায়।" } },
  { id: "topics", name: "TopicWise", to: "/topics", stage: "understand", what: { en: "Topic by topic: material, practice, evidence and revision.", bn: "টপিক ধরে ধরে: বিষয়বস্তু, অনুশীলন, প্রমাণ ও পুনরালোচনা।" }, evidence: { en: "Five separate signals, never blended into one score.", bn: "পাঁচটি আলাদা সংকেত, কখনো একটি স্কোরে মেশানো নয়।" } },
  { id: "lab", name: "LearnLab", to: "/sky", stage: "understand", what: { en: "Hands-on concept explorations you can play with.", bn: "হাতে-কলমে ধারণা অন্বেষণ, যা নিয়ে খেলা যায়।" }, evidence: { en: "Labelled as general learning, not as textbook content.", bn: "সাধারণ শেখা হিসেবে চিহ্নিত, পাঠ্যবইয়ের বিষয় হিসেবে নয়।" } },
  { id: "quiz", name: "IntelliQuiz", to: "/quiz", stage: "practise", what: { en: "Daily Five, mistake replay, topic practice and timed exams.", bn: "দৈনিক পাঁচ, ভুল আবার করা, টপিক অনুশীলন ও সময় বাঁধা পরীক্ষা।" }, evidence: { en: "Graded on the server; a repeated submission never counts twice.", bn: "সার্ভারে মূল্যায়ন; একই উত্তর দুবার গোনা হয় না।" } },
  { id: "exam", name: "ExamArena", to: "/exam-arena", stage: "practise", what: { en: "Chapter readiness from four visible factors, then a timed exam.", bn: "চারটি দৃশ্যমান কারণে অধ্যায়ের প্রস্তুতি, তারপর সময় বাঁধা পরীক্ষা।" }, evidence: { en: "You can see exactly why readiness is what it is.", bn: "প্রস্তুতি কেন এমন, তা ঠিক কোথা থেকে এল দেখা যায়।" } },
  { id: "map", name: "KnowledgeMap", to: "/knowledge-map", stage: "track", what: { en: "Every chapter, coloured by your evidence.", bn: "প্রতিটি অধ্যায়, তোমার প্রমাণ অনুযায়ী রঙ করা।" }, evidence: { en: "No colour without answers behind it.", bn: "পেছনে উত্তর ছাড়া কোনো রঙ নয়।" } },
  { id: "twin", name: "Learning Twin", to: "/twin", stage: "track", what: { en: "What your evidence says about each topic, and a way to correct it.", bn: "প্রতিটি টপিক নিয়ে তোমার প্রমাণ কী বলে, আর তা সংশোধনের উপায়।" }, evidence: { en: "Never infers personal traits; you can disagree with it.", bn: "ব্যক্তিগত বৈশিষ্ট্য অনুমান করে না; তুমি দ্বিমত জানাতে পারো।" } },
  { id: "path", name: "HorizonPath", to: "/path", stage: "track", what: { en: "Where you've been, where you are, what's next.", bn: "কোথায় ছিলে, কোথায় আছ, এরপর কী।" }, evidence: { en: "Every next step comes with its reason.", bn: "প্রতিটি পরের ধাপের সঙ্গে কারণ থাকে।" } },
  { id: "analytics", name: "LearningAnalytics", to: "/progress", stage: "track", what: { en: "Activity, accuracy and progress over time.", bn: "সময়ের সঙ্গে কাজ, সঠিকতা ও অগ্রগতি।" }, evidence: { en: "Built only from your real activity, never sample data.", bn: "শুধু তোমার আসল কাজ থেকে, কখনো নমুনা ডেটা নয়।" } },
  { id: "revision", name: "SmartRevision", to: "/revision", stage: "remember", what: { en: "Questions come back just before you'd forget them.", bn: "ভুলে যাওয়ার ঠিক আগে প্রশ্ন ফিরে আসে।" }, evidence: { en: "Spacing set by your own answers.", bn: "বিরতি ঠিক হয় তোমার নিজের উত্তরে।" } },
  { id: "cards", name: "MemoryCards", to: "/cards", stage: "remember", what: { en: "Flashcards from your book's definitions, spaced for recall.", bn: "বইয়ের সংজ্ঞা থেকে ফ্ল্যাশকার্ড, মনে রাখার বিরতিতে।" }, evidence: { en: "Cards come from checked text or from you.", bn: "কার্ড আসে যাচাই করা লেখা বা তোমার কাছ থেকে।" } },
  { id: "notes", name: "SmartNotes", to: "/notes", stage: "remember", what: { en: "Your own private notes, searchable, tied to chapters.", bn: "তোমার নিজের গোপন নোট, খোঁজা যায়, অধ্যায়ের সঙ্গে যুক্ত।" }, evidence: { en: "Private to you; never used to train anything.", bn: "শুধু তোমার; কোনো কিছু শেখাতে ব্যবহার হয় না।" } },
];
const STAGES: { id: Mod["stage"]; label: L }[] = [
  { id: "understand", label: { en: "Understand", bn: "বোঝো" } },
  { id: "practise", label: { en: "Practise", bn: "অনুশীলন" } },
  { id: "track", label: { en: "See your progress", bn: "অগ্রগতি দেখো" } },
  { id: "remember", label: { en: "Remember", bn: "মনে রাখো" } },
];

function Modules() {
  const { t, tx } = useLearner();
  const [sel, setSel] = useState("tutor");
  const m = MODS.find((x) => x.id === sel)!;
  return (
    <section id="platform" aria-labelledby="plat-h" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-6 md:py-32">
        <p className="ih-eyebrow ih-muted ih-reveal">{tx("The platform", "প্ল্যাটফর্ম")}</p>
        <h2 id="plat-h" className="ih-display ih-reveal ih-reveal-2 mt-3 max-w-[20ch] text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.08]">{tx("One ecosystem, one learner profile", "একটি ইকোসিস্টেম, একটি শিক্ষার্থী-প্রোফাইল")}</h2>
        <p className="ih-reveal ih-reveal-3 mt-4 max-w-[58ch] text-lg leading-relaxed ih-muted">{tx("Fourteen connected tools share the same evidence about you, so practising in one changes what the others suggest.", "চৌদ্দটি যুক্ত টুল তোমার সম্পর্কে একই প্রমাণ ভাগ করে, তাই একটিতে অনুশীলন করলে অন্যগুলোর পরামর্শও বদলায়।")}</p>
        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="grid gap-6 sm:grid-cols-2">
            {STAGES.map((s) => (
              <div key={s.id} className="ih-reveal">
                <h3 className="ih-eyebrow ih-muted">{t(s.label)}</h3>
                <ul className="mt-3 space-y-2">
                  {MODS.filter((x) => x.stage === s.id).map((x) => (
                    <li key={x.id}>
                      <button type="button" aria-pressed={sel === x.id} aria-controls="module-detail" data-module={x.id} onClick={() => setSel(x.id)} onMouseEnter={() => setSel(x.id)} onFocus={() => setSel(x.id)}
                        className={`ih-module flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[16px] border px-4 text-left ${sel === x.id ? "border-[#57707A] bg-[#FCE7F3]" : "border-[#DEDCDC] bg-white"}`}>
                        <span lang="en" className="ih-display font-semibold">{x.name}</span>
                        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${sel === x.id ? "bg-[#F9A8D4]" : "bg-[#C5BAC4]"}`} />
                      </button>
                      {sel === x.id && (
                        // On small screens the detail opens right under the module; on large screens it's the side panel.
                        <div className="mt-2 rounded-[16px] bg-[#191D23] p-4 text-[15px] text-[#DEDCDC] lg:hidden" data-testid="module-inline">
                          <p>{t(x.what)}</p>
                          <p className="mt-2 text-[#989DAA]">{t(x.evidence)}</p>
                          <Link to={x.to as never} className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-[#F9A8D4] underline underline-offset-4">{tx(`Open ${x.name}`, `${x.name} খোলো`)}</Link>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <aside id="module-detail" aria-live="polite" className="ih-dark relative hidden self-start overflow-hidden rounded-[28px] p-7 lg:sticky lg:top-28 lg:block" data-testid="module-detail">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(249,168,212,0.35),transparent_70%)]" />
            <p className="ih-eyebrow text-[#F9A8D4]">{t(STAGES.find((s) => s.id === m.stage)!.label)}</p>
            <h3 lang="en" className="ih-display mt-2 text-3xl font-bold text-white">{m.name}</h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[#DEDCDC]">{t(m.what)}</p>
            <p className="mt-4 flex gap-2 text-[15px] text-[#989DAA]"><span aria-hidden="true" className="text-[#F9A8D4]">◆</span>{t(m.evidence)}</p>
            <Link to={m.to as never} className="ih-btn ih-btn-primary mt-6">{tx(`Open ${m.name}`, `${m.name} খোলো`)}</Link>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ─────────── H. Responsible AI ─────────── */

const PRINCIPLES: { title: L; body: L }[] = [
  { title: { en: "Curriculum-grounded retrieval", bn: "পাঠ্যক্রমভিত্তিক খোঁজ" }, body: { en: "Answers come from approved passages of your own class and edition, never another grade's book.", bn: "উত্তর আসে তোমার নিজের শ্রেণি ও সংস্করণের অনুমোদিত অংশ থেকে, অন্য শ্রেণির বই থেকে নয়।" } },
  { title: { en: "Verified source references", bn: "যাচাই করা উৎস" }, body: { en: "Every citation must be a retrieved passage; every quotation must match it word for word.", bn: "প্রতিটি উৎসনির্দেশ খুঁজে পাওয়া অংশ হতে হবে; প্রতিটি উদ্ধৃতি হুবহু মিলতে হবে।" } },
  { title: { en: "Transparent uncertainty", bn: "স্বচ্ছ অনিশ্চয়তা" }, body: { en: "When the book doesn't cover something, the tutor says so instead of guessing.", bn: "বইয়ে না থাকলে টিউটর অনুমান না করে সেটাই বলে।" } },
  { title: { en: "Bilingual, without distortion", bn: "দ্বিভাষিক, বিকৃতি ছাড়া" }, body: { en: "Explanations follow your language; quotations stay in the book's own words.", bn: "ব্যাখ্যা তোমার ভাষায়; উদ্ধৃতি থাকে বইয়ের নিজের ভাষায়।" } },
  { title: { en: "Evidence-based personalisation", bn: "প্রমাণভিত্তিক ব্যক্তিগতকরণ" }, body: { en: "Recommendations come from your answers, with the reason shown. No personal traits are inferred.", bn: "সুপারিশ আসে তোমার উত্তর থেকে, কারণসহ। কোনো ব্যক্তিগত বৈশিষ্ট্য অনুমান করা হয় না।" } },
  { title: { en: "Safeguards that fail closed", bn: "যে সুরক্ষা ব্যর্থ হলে বন্ধ থাকে" }, body: { en: "Anything that fails a check is withheld. Instructions hidden in a question can't override the rules.", bn: "যাচাইয়ে না টিকলে দেখানো হয় না। প্রশ্নে লুকানো নির্দেশ নিয়ম বদলাতে পারে না।" } },
];

function Trust({ aiOn }: { aiOn: boolean }) {
  const { t, tx } = useLearner();
  const flow: L[] = [
    { en: "Your question", bn: "তোমার প্রশ্ন" },
    { en: "Your class and edition", bn: "তোমার শ্রেণি ও সংস্করণ" },
    { en: "Approved textbook passages", bn: "অনুমোদিত পাঠ্যাংশ" },
    { en: "Claude, Gemini or OpenAI, as the task needs", bn: "কাজ অনুযায়ী Claude, Gemini বা OpenAI" },
    { en: "Citation, quotation and arithmetic checks", bn: "উৎস, উদ্ধৃতি ও হিসাব যাচাই" },
    { en: "An answer, or an honest \"not in your book\"", bn: "উত্তর, বা সৎভাবে \"তোমার বইয়ে নেই\"" },
  ];
  return (
    <section id="trust" aria-labelledby="trust-h" className="ih-dark scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-6 md:py-32">
        <p className="ih-eyebrow text-[#F9A8D4] ih-reveal">{tx("Responsible AI", "দায়িত্বশীল এআই")}</p>
        <h2 id="trust-h" className="ih-display ih-reveal ih-reveal-2 mt-3 max-w-[22ch] text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.08] text-white">{tx("Your textbook is the authority. The AI is not.", "কর্তৃত্ব তোমার পাঠ্যবইয়ের। এআই-এর নয়।")}</h2>
        <p className="ih-reveal ih-reveal-3 mt-4 max-w-[62ch] text-lg leading-relaxed text-[#DEDCDC]">{tx("IntelliHorizon can use three AI providers. They reason and explain; they are never treated as a source of curriculum facts, and agreement between them is never treated as proof. No AI system is free of mistakes, so the product is built to show its evidence and hold back what it can't support.", "ইন্টেলিহরাইজন তিনটি এআই প্রদানকারী ব্যবহার করতে পারে। তারা যুক্তি দেয় ও বোঝায়; কখনো পাঠ্যক্রমের তথ্যের উৎস ধরা হয় না, আর তাদের একমত হওয়াকে প্রমাণ ধরা হয় না। কোনো এআই ভুলমুক্ত নয়, তাই পণ্যটি তার প্রমাণ দেখায় আর যা সমর্থন করতে পারে না তা আটকে রাখে।")}</p>
        <ol className="mt-12 grid gap-3 md:grid-cols-6" aria-label={tx("How an answer is made", "উত্তর কীভাবে তৈরি হয়")}>
          {flow.map((f, i) => (
            <li key={i} className="ih-reveal relative rounded-[18px] border border-[rgba(222,220,220,0.14)] p-4 text-[15px] text-[#DEDCDC]">
              <span className="ih-display block text-xs font-semibold text-[#F9A8D4]">{i + 1}</span>
              <span className="mt-1 block">{t(f)}</span>
            </li>
          ))}
        </ol>
        <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <li key={i} className="ih-reveal border-t border-[rgba(222,220,220,0.18)] pt-5">
              <h3 className="ih-display text-lg font-semibold text-white">{t(p.title)}</h3>
              <p className="mt-2 text-[15.5px] leading-relaxed text-[#989DAA]">{t(p.body)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-[#989DAA]" data-testid="ai-status">{aiOn ? tx("AI explanations are switched on.", "এআই ব্যাখ্যা চালু আছে।") : tx("AI explanations are being switched on. Until then the tutor answers with checked textbook passages only, and says so.", "এআই ব্যাখ্যা চালু হচ্ছে। ততক্ষণ টিউটর শুধু যাচাই করা পাঠ্যাংশ দিয়ে উত্তর দেয়, আর সেটা জানিয়ে দেয়।")}</p>
      </div>
    </section>
  );
}

/* ─────────── About ─────────── */

function About() {
  const { tx } = useLearner();
  return (
    <section id="about" aria-labelledby="about-h" className="scroll-mt-20 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:px-6">
        <h2 id="about-h" className="ih-display ih-reveal text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold leading-[1.1]">{tx("About IntelliHorizon", "ইন্টেলিহরাইজন পরিচিতি")}</h2>
        <div className="ih-reveal ih-reveal-2 space-y-4 text-[17px] leading-relaxed text-[#191D23]/85">
          <p>{tx("IntelliHorizon is an independent learning platform for students in Bangladesh. Its tutor is built around the NCTB textbooks students already use, in both the Bangla Version and the English Version.", "ইন্টেলিহরাইজন বাংলাদেশের শিক্ষার্থীদের জন্য একটি স্বাধীন শেখার প্ল্যাটফর্ম। এর টিউটর তৈরি শিক্ষার্থীরা আগে থেকেই যে এনসিটিবি পাঠ্যবই ব্যবহার করে তাকে ঘিরে, বাংলা ভার্সন ও ইংলিশ ভার্সন দুটোতেই।")}</p>
          <p className="ih-muted">{tx("IntelliHorizon is not affiliated with or endorsed by NCTB. Textbook excerpts are short and cited; NCTB's written permission is still pending. Students' answers and notes stay private to them.", "ইন্টেলিহরাইজন এনসিটিবির সঙ্গে যুক্ত বা অনুমোদিত নয়। পাঠ্যবইয়ের অংশ ছোট ও উৎসসহ; এনসিটিবির লিখিত অনুমতি এখনো প্রক্রিয়াধীন। শিক্ষার্থীর উত্তর ও নোট শুধু তার নিজের কাছে থাকে।")}</p>
          <p><Link to="/privacy" className="font-semibold underline decoration-[#C5BAC4] underline-offset-4">{tx("How we handle data", "আমরা ডেটা কীভাবে রাখি")}</Link></p>
        </div>
      </div>
    </section>
  );
}

/* ─────────── I. Closing ─────────── */

function Closing() {
  const { tx, lang: ui } = useLearner();
  return (
    <section aria-labelledby="close-h" className="ih-dark relative overflow-hidden">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] w-full" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <defs><radialGradient id="ih-close" cx="0.5" cy="1" r="0.7"><stop offset="0" stopColor="#F9A8D4" stopOpacity="0.4" /><stop offset="1" stopColor="#F9A8D4" stopOpacity="0" /></radialGradient></defs>
        <rect width="1440" height="400" fill="url(#ih-close)" />
        <path d="M0 330 Q720 200 1440 330" fill="none" stroke="#F9A8D4" strokeOpacity="0.6" strokeWidth="1.5" />
      </svg>
      <div className="relative mx-auto max-w-4xl px-4 py-28 text-center md:px-6 md:py-36">
        <h2 id="close-h" className="ih-display ih-reveal text-[clamp(2.2rem,6vw,4.6rem)] font-extrabold leading-[1.04] text-white">
          {byLang(ui, <>Expand the <span className="ih-editorial ih-gradient-text">horizons</span> of learning.</>, <>শেখার <span className="ih-editorial ih-gradient-text">দিগন্ত</span> প্রসারিত করো।</>)}
        </h2>
        <p className="ih-reveal ih-reveal-2 mx-auto mt-5 max-w-[48ch] text-lg text-[#DEDCDC]">{tx("Choose your class and version, and start with the books you already have.", "তোমার শ্রেণি ও ভার্সন বাছো, আর যে বই তোমার কাছে আছে তা দিয়েই শুরু করো।")}</p>
        <div className="ih-reveal ih-reveal-3 mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/start" className="ih-btn ih-btn-primary">{tx("Get Started", "শুরু করো")}</Link>
          <a href="#tutor" className="ih-btn ih-btn-ghost">{tx("Meet Your AI Tutor", "তোমার এআই টিউটরের সঙ্গে পরিচিত হও")}</a>
        </div>
      </div>
    </section>
  );
}

function HomeFooter() {
  const { tx } = useLearner();
  const links: [string, string][] = [["/start", tx("Get started", "শুরু করো")], ["/signin", tx("Sign in", "সাইন ইন")], ["/help", tx("Help & accessibility", "সাহায্য ও প্রবেশযোগ্যতা")], ["/privacy", tx("Privacy", "গোপনীয়তা")], ["/judge", tx("Judge access", "বিচারক প্রবেশ")]];
  return (
    <footer className="ih-dark border-t border-[rgba(222,220,220,0.12)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-2"><HorizonMark /><span lang="en" className="ih-display font-bold text-white">IntelliHorizon</span></div>
        <nav aria-label={tx("Footer", "ফুটার")}><ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{links.map(([to, l]) => <li key={to}><Link to={to as never} className="text-[#DEDCDC] underline-offset-4 hover:underline">{l}</Link></li>)}</ul></nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-[#989DAA] md:px-6">{tx("Independent; not affiliated with or endorsed by NCTB.", "স্বাধীন; এনসিটিবির সঙ্গে যুক্ত বা অনুমোদিত নয়।")}</p>
    </footer>
  );
}
