import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PublicFooter, PublicHeader } from "../components/universe/Shell";
import { Icon, SubjectDot } from "../components/universe/icons";
import { ContinuedRatioLab, bnDigits } from "../components/universe/learning";
import { Badge, LevelRing, LinkButton, ProgressBar } from "../components/universe/ui";
import type { L } from "../content/types";
import { publicCoverage } from "../lib/api/learning.functions";
import { BOOKS, SUBJECTS } from "../lib/curriculum/registry";
import { PERSONAS, PERSONA_IDS, STYLES, STYLE_IDS } from "../lib/tutor/teach";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/")({
  loader: () => publicCoverage(),
  head: () => ({
    meta: [
      { title: "IntelliHorizon: learning should understand you" },
      {
        name: "description",
        content:
          "IntelliHorizon is a personalised learning ecosystem for Class 7 NCTB students: a curriculum-grounded tutor, adaptive practice, a knowledge map and revision at the right time. Expand the horizons of learning.",
      },
    ],
  }),
  component: Landing,
});

/* The preview question is printed in the Class 7 Mathematics textbook (Exercise 2.3, question 4, page 35); the answer is the book's own key. */
const PREVIEW = {
  prompt: "৫ : ৩ এবং ২ : ৫ এর ধারাবাহিক অনুপাত কোনটি?",
  options: [
    { id: "ক", text: "১০ : ৬ : ১৫" },
    { id: "খ", text: "৩ : ৫ : ৬" },
    { id: "গ", text: "৫ : ৬ : ৫" },
    { id: "ঘ", text: "১৫ : ৬ : ১০" },
  ],
  answer: "ক",
  why: {
    ঘ: { en: "That reverses the order of the terms.", bn: "এতে রাশির ক্রম উল্টে গেছে।" },
    খ: { en: "The middle terms weren't made equal first.", bn: "আগে মাঝের রাশি সমান করা হয়নি।" },
    গ: { en: "The middle terms weren't made equal first.", bn: "আগে মাঝের রাশি সমান করা হয়নি।" },
  } as Record<string, L>,
  explanation: "৫ : ৩ = ১০ : ৬ এবং ২ : ৫ = ৬ : ১৫, তাই ধারাবাহিক অনুপাত ১০ : ৬ : ১৫।",
};

function Landing() {
  const { tx, t, lang } = useLearner();
  const cov = Route.useLoaderData();
  const N = (n: number) => (lang === "bn" ? bnDigits(n) : String(n));
  return (
    <div className="min-h-dvh bg-canvas" lang={lang}>
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[10px] focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <PublicHeader />
      <main>
        {/* B: hero */}
        <section id="hero" className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pb-24 lg:pt-20">
            <div>
              <Badge tone="brand" icon="book">
                {tx("Built on the Class 7 NCTB textbooks", "৭ম শ্রেণির এনসিটিবি পাঠ্যবই থেকে তৈরি")}
              </Badge>
              <h1 className="mt-5 font-display text-[44px] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink sm:text-[56px] lg:text-[68px]">
                {tx("Learning should understand you.", "শেখা হোক তোমাকে বুঝে।")}
              </h1>
              <p className="mt-6 max-w-[46ch] text-[18px] leading-relaxed text-ink-mid">
                {tx(
                  "Meet IntelliHorizon, a learning ecosystem that adapts to what your answers show, helps you close learning gaps and makes every learning journey personal. It starts with your own Class 7 NCTB books.",
                  "পরিচিত হও ইন্টেলিহরাইজনের সঙ্গে: এমন এক শেখার জগৎ যা তোমার উত্তরের প্রমাণ দেখে বদলায়, শেখার ফাঁক পূরণে সাহায্য করে, আর প্রতিটি যাত্রাকে করে তোমার নিজের। শুরু তোমার ৭ম শ্রেণির এনসিটিবি বই দিয়ে।",
                )}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton to="/signup" size="lg">
                  {tx("Start learning", "শেখা শুরু করো")}
                </LinkButton>
                <LinkButton to="/" hash="how" size="lg" variant="secondary">
                  {tx("Explore how it works", "কীভাবে কাজ করে দেখো")}
                </LinkButton>
              </div>
              <p className="mt-5 text-[14px] text-ink-low">
                {tx(
                  "Free to use. Bangla and English interface.",
                  "বিনামূল্যে। বাংলা ও ইংরেজি ইন্টারফেস।",
                )}
              </p>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* C: experience the product */}
        <section id="product" aria-labelledby="product-h" className="border-y border-line bg-sheet">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <h2
              id="product-h"
              className="max-w-[22ch] font-display text-[34px] font-bold leading-tight tracking-tight md:text-[44px]"
            >
              {tx("Try the loop yourself", "নিজেই চেষ্টা করে দেখো")}
            </h2>
            <p className="mt-3 max-w-[58ch] text-[17px] text-ink-mid">
              {tx(
                "Choose a subject, learn an idea, practise, get feedback, see progress. This preview runs right here; nothing is saved.",
                "বিষয় বাছো, ধারণা শেখো, অনুশীলন করো, উত্তরের ব্যাখ্যা পাও, অগ্রগতি দেখো। এই নমুনা এখানেই চলে; কিছু জমা হয় না।",
              )}
            </p>
            <LoopDemo />
          </div>
        </section>

        {/* Personalised learning + tutor */}
        <section id="personal" aria-labelledby="personal-h" className="mx-auto max-w-6xl px-4 pt-20 md:px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 id="personal-h" className="max-w-[18ch] font-display text-[34px] font-bold leading-tight tracking-tight md:text-[44px]">{tx("Personal, because it's built from your answers", "ব্যক্তিগত, কারণ এটি তোমার উত্তর থেকে তৈরি")}</h2>
              <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-ink-mid">{tx("IntelliHorizon never guesses who you are. It reads what you actually did and tells you why it recommends something.", "ইন্টেলিহরাইজন তোমাকে অনুমান করে না। তুমি আসলে কী করেছ তা দেখে, আর কেন কিছু সুপারিশ করছে তা বলে।")}</p>
              <ul className="mt-6 space-y-4">
                {PERSONAL.map((x) => (
                  <li key={x.icon} className="flex gap-3">
                    <Icon name={x.icon} className="mt-0.5 shrink-0 text-brand" />
                    <p className="text-[16px] leading-relaxed"><strong>{t(x.title)}</strong> <span className="text-ink-mid">{t(x.body)}</span></p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-[16px] bg-lilac p-4 text-[15px] text-ink">{tx("Example of a recommendation: “Strengthen Ratio and Profit-Loss. Why: your recent accuracy there is 40% over 5 answers.”", "সুপারিশের উদাহরণ: “সমানুপাত ও লাভ-ক্ষতি মজবুত করো। কেন: সেখানে ৫টি উত্তরে তোমার সাম্প্রতিক সঠিকতা ৪০%।”")}</p>
            </div>
            <div id="tutor" className="rounded-[28px] border border-line bg-sheet p-6 md:p-8">
              <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight">{tx("An AI tutor that stays inside your curriculum", "যে এআই টিউটর তোমার পাঠ্যক্রমের ভেতরেই থাকে")}</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-ink-mid">{tx("It knows your class, version, subject and chapter, searches only approved textbook pages, and shows the passage with its page number. If the book doesn't cover your question, it says so.", "এটি তোমার শ্রেণি, ভার্সন, বিষয় ও অধ্যায় জানে, শুধু অনুমোদিত পাঠ্যবইয়ের পাতায় খোঁজে, আর পৃষ্ঠা নম্বরসহ অংশটি দেখায়। বইয়ে না থাকলে সেটাই বলে।")}</p>
              <p className="mt-5 text-[14px] font-semibold text-ink-mid">{tx("Five teaching approaches", "পাঁচ রকম শেখানোর ধরন")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">{PERSONA_IDS.map((id) => <li key={id}><Badge tone="brand">{t(PERSONAS[id].name)}</Badge></li>)}</ul>
              <p className="mt-5 text-[14px] font-semibold text-ink-mid">{tx("Ask differently, any time", "যেকোনো সময় অন্যভাবে জিজ্ঞেস করো")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">{STYLE_IDS.map((id) => <li key={id}><Badge>{t(STYLES[id])}</Badge></li>)}</ul>
              <p className="mt-5 text-[14px] leading-relaxed text-ink-low">{tx("The tutor quotes and organises verified material; it does not write textbook content of its own. Photo, PDF and voice questions aren't available yet.", "টিউটর যাচাই করা লেখা উদ্ধৃত করে ও সাজায়; নিজে থেকে পাঠ্যবইয়ের লেখা তৈরি করে না। ছবি, পিডিএফ ও ভয়েস প্রশ্ন এখনো নেই।")}</p>
            </div>
          </div>
        </section>

        {/* D: features */}
        <section
          id="features"
          aria-labelledby="features-h"
          className="mx-auto max-w-6xl px-4 py-20 md:px-6"
        >
          <h2
            id="features-h"
            className="max-w-[24ch] font-display text-[34px] font-bold leading-tight tracking-tight md:text-[44px]"
          >
            {tx(
              "What makes IntelliHorizon different",
              "ইন্টেলিহরাইজন যেখানে আলাদা",
            )}
          </h2>
          <ul className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.icon} className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-brand-soft text-brand">
                  <Icon name={f.icon} size={24} />
                </span>
                <div>
                  <h3 className="font-display text-[21px] font-bold">{t(f.title)}</h3>
                  <p className="mt-1.5 max-w-[48ch] text-[16px] leading-relaxed text-ink-mid">
                    {t(f.body)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* E: subjects */}
        <section id="curriculum" aria-labelledby="cur-h" className="bg-lilac">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <h2
              id="cur-h"
              className="font-display text-[34px] font-bold leading-tight tracking-tight md:text-[44px]"
            >
              {tx("The eight Class 7 subjects", "৭ম শ্রেণির আটটি বিষয়")}
            </h2>
            <p className="mt-3 max-w-[62ch] text-[17px] text-ink-mid">
              {tx(
                "Bangla medium: all nine textbooks are in IntelliHorizon, with chapters mapped. English version: books aren't available in IntelliHorizon yet, and nothing is translated to fill the gap.",
                "বাংলা মাধ্যম: নয়টি পাঠ্যবই-ই ইন্টেলিহরাইজনে আছে, অধ্যায়সহ। ইংলিশ ভার্সন: বইগুলো এখনো ইন্টেলিহরাইজনে নেই, আর ফাঁক পূরণে কিছু অনুবাদ করা হয়নি।",
              )}
            </p>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SUBJECTS.map((s) => {
                const c = cov.subjects.find((x) => x.subject_key === s.id);
                const books = BOOKS.filter((b) => b.subjectId === s.id && b.medium === "bangla");
                return (
                  <li
                    key={s.id}
                    className="flex flex-col rounded-[20px] border border-line bg-sheet p-5"
                  >
                    <span className="flex items-center gap-2">
                      <SubjectDot hue={s.hue} size={12} />
                      <span className="font-display text-[18px] font-bold leading-tight">
                        {t(s.label)}
                      </span>
                    </span>
                    <span className="mt-2 text-[14px] text-ink-mid" lang="bn">
                      {books.map((b) => b.title).join(" ও ")}
                    </span>
                    <span className="mt-auto pt-4 text-[13px] text-ink-low">
                      {tx(
                        `${c?.chapters ?? books.reduce((n, b) => n + b.chapters.length, 0)} chapters`,
                        `${N(c?.chapters ?? books.reduce((n, b) => n + b.chapters.length, 0))}টি অধ্যায়`,
                      )}
                      {c?.questions
                        ? tx(
                            `, ${c.questions} checked questions`,
                            `, ${N(c.questions)}টি যাচাই করা প্রশ্ন`,
                          )
                        : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-[14px] text-ink-mid">
              {tx(
                `Textbook text open to the tutor: ${cov.indexed} of ${cov.total} books so far, added only after an editor checks the page text. NCTB's written permission is pending.`,
                `টিউটরের জন্য খোলা পাঠ্যবই: এ পর্যন্ত ${N(cov.total)}টির ${N(cov.indexed)}টি; পাতার লেখা সম্পাদক যাচাই করার পরেই যোগ হয়। এনসিটিবির লিখিত অনুমতি প্রক্রিয়াধীন।`,
              )}
            </p>
          </div>
        </section>

        {/* F: how learning works */}
        <section id="how" aria-labelledby="how-h" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
          <h2
            id="how-h"
            className="font-display text-[34px] font-bold leading-tight tracking-tight md:text-[44px]"
          >
            {tx("How learning works here", "এখানে শেখা যেভাবে চলে")}
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-5">
            {HOW.map((h, i) => (
              <li key={i} className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand font-display text-[17px] font-bold text-white">
                  {i + 1}
                </span>
                {i < HOW.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-12 right-0 top-5 hidden border-t-2 border-dashed border-line-strong md:block"
                  />
                )}
                <h3 className="mt-4 font-display text-[19px] font-bold">{t(h.title)}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-mid">{t(h.body)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Privacy and responsible AI */}
        <section id="trust" aria-labelledby="trust-h" className="border-t border-line bg-sheet">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <h2 id="trust-h" className="font-display text-[34px] font-bold leading-tight tracking-tight md:text-[44px]">{tx("Privacy and responsible AI", "গোপনীয়তা ও দায়িত্বশীল এআই")}</h2>
            <ul className="mt-10 grid gap-x-12 gap-y-6 md:grid-cols-2">
              {TRUST.map((x, i) => (
                <li key={i} className="flex gap-3">
                  <Icon name="shield" className="mt-0.5 shrink-0 text-mint" />
                  <p className="text-[16px] leading-relaxed"><strong>{t(x.title)}</strong> <span className="text-ink-mid">{t(x.body)}</span></p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-[15px]"><Link to="/privacy" className="font-semibold text-brand-deep hover:underline">{tx("Read the privacy page", "গোপনীয়তার পাতা পড়ো")}</Link></p>
          </div>
        </section>

        {/* G: conversion */}
        <section aria-labelledby="cta-h" className="px-4 pb-20 md:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[linear-gradient(130deg,#4329b2_0%,#5b3fd6_45%,#8a5cf0_80%,#c4407f_140%)] px-6 py-14 text-white md:px-14">
            <h2
              id="cta-h"
              className="max-w-[20ch] font-display text-[34px] font-bold leading-tight tracking-tight md:text-[46px]"
            >
              {tx("Your first session takes ten minutes.", "তোমার প্রথম সেশনে লাগে দশ মিনিট।")}
            </h2>
            <p className="mt-3 max-w-[50ch] text-[17px] text-white/85">
              {tx(
                "Create an account with your class and version, and IntelliHorizon opens on your own books.",
                "শ্রেণি ও ভার্সন দিয়ে অ্যাকাউন্ট খোলো, ইন্টেলিহরাইজন তোমার নিজের বই দিয়েই শুরু হবে।",
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex h-14 items-center rounded-[14px] bg-white px-7 text-[17px] font-semibold text-brand-deep transition-transform active:scale-[0.98]"
              >
                {tx("Create a free account", "বিনামূল্যে অ্যাকাউন্ট খোলো")}
              </Link>
              <Link
                to="/signin"
                className="inline-flex h-14 items-center rounded-[14px] border border-white/50 px-7 text-[17px] font-semibold text-white hover:bg-white/10"
              >
                {tx("I already have one", "আমার অ্যাকাউন্ট আছে")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

const PERSONAL: { icon: "radar" | "practice" | "revision" | "map"; title: L; body: L }[] = [
  { icon: "radar", title: { en: "Misconception Radar.", bn: "ভুল ধারণার রাডার।" }, body: { en: "When the same kind of wrong answer shows up on two or more questions, it names the likely misunderstanding, shows the evidence and tracks whether it's improving.", bn: "একই ধরনের ভুল দুই বা বেশি প্রশ্নে এলে সম্ভাব্য ভুল ধারণাটি জানায়, প্রমাণ দেখায়, আর উন্নতি হচ্ছে কি না দেখে।" } },
  { icon: "practice", title: { en: "Adaptive practice.", bn: "মানিয়ে নেওয়া অনুশীলন।" }, body: { en: "Your level moves from Foundation to Challenging by a published rule based on your last answers in that chapter.", bn: "ওই অধ্যায়ে তোমার শেষ উত্তরগুলোর ভিত্তিতে প্রকাশিত নিয়মে স্তর ভিত্তি থেকে চ্যালেঞ্জিং পর্যন্ত বদলায়।" } },
  { icon: "revision", title: { en: "Smart revision.", bn: "বুদ্ধিমান পুনরালোচনা।" }, body: { en: "Missed questions return the next day; right ones after 3, 7, 14 and 30 days.", bn: "ভুল প্রশ্ন পরদিন ফেরে; সঠিকগুলো ৩, ৭, ১৪ ও ৩০ দিন পরে।" } },
  { icon: "map", title: { en: "Knowledge Map and Horizon Path.", bn: "জ্ঞান মানচিত্র ও হরাইজন পথ।" }, body: { en: "See every chapter by the evidence you've built, and your own journey with the reason for each next stop.", bn: "নিজের গড়া প্রমাণ অনুযায়ী প্রতিটি অধ্যায় দেখো, আর প্রতিটি পরের ধাপের কারণসহ তোমার যাত্রা।" } },
];

const TRUST: { title: L; body: L }[] = [
  { title: { en: "Grounded answers.", bn: "ভিত্তিসহ উত্তর।" }, body: { en: "Tutor answers quote approved textbook pages with their source. Nothing is cited that isn't there.", bn: "টিউটরের উত্তরে অনুমোদিত পাঠ্যবইয়ের পাতা উৎসসহ থাকে। যা নেই তা উদ্ধৃত হয় না।" } },
  { title: { en: "Honest about limits.", bn: "সীমা নিয়ে সৎ।" }, body: { en: "When the book doesn't cover something, or a page hasn't been checked, IntelliHorizon says so instead of guessing.", bn: "বইয়ে কিছু না থাকলে বা পাতা যাচাই না হলে ইন্টেলিহরাইজন অনুমান না করে সেটাই জানায়।" } },
  { title: { en: "Checked before students see it.", bn: "শিক্ষার্থী দেখার আগে যাচাই।" }, body: { en: "Scanned textbook text and practice questions go through review and approval. Low-confidence scans are held back.", bn: "স্ক্যান করা লেখা ও অনুশীলনী প্রশ্ন পর্যালোচনা ও অনুমোদনের মধ্য দিয়ে যায়। কম নিশ্চয়তার স্ক্যান আটকে রাখা হয়।" } },
  { title: { en: "Clear labels.", bn: "স্পষ্ট লেবেল।" }, body: { en: "Textbook exercises, reviewed IntelliHorizon questions and IntelliHorizon's own explanations are each labelled as what they are.", bn: "পাঠ্যবইয়ের অনুশীলনী, পর্যালোচিত ইন্টেলিহরাইজন প্রশ্ন ও ইন্টেলিহরাইজনের নিজস্ব ব্যাখ্যা আলাদা করে চিহ্নিত।" } },
  { title: { en: "Private by default.", bn: "শুরু থেকেই গোপন।" }, body: { en: "No public profiles, no leaderboards, no advertising trackers. Your answers and conversations are visible only to you.", bn: "কোনো পাবলিক প্রোফাইল, লিডারবোর্ড বা বিজ্ঞাপন ট্র্যাকার নেই। তোমার উত্তর ও কথোপকথন শুধু তুমিই দেখো।" } },
  { title: { en: "Only what's needed.", bn: "শুধু যা দরকার।" }, body: { en: "Sign-up asks for what the product uses: your name, email, class, version and district. You can delete your account and its data at any time.", bn: "সাইন-আপে শুধু দরকারি তথ্য লাগে: নাম, ইমেইল, শ্রেণি, ভার্সন ও জেলা। যেকোনো সময় অ্যাকাউন্ট ও তথ্য মুছতে পারো।" } },
];

const FEATURES: {
  icon: "learn" | "tutor" | "practice" | "revision" | "map" | "achievements";
  title: L;
  body: L;
}[] = [
  {
    icon: "learn",
    title: { en: "Guided learning paths", bn: "নির্দেশিত শেখার পথ" },
    body: {
      en: "Each subject is laid out book by book and chapter by chapter, showing where you are, what's next and what needs revising.",
      bn: "প্রতিটি বিষয় বই ও অধ্যায় ধরে সাজানো: তুমি কোথায়, পরের ধাপ কী, কী পুনরালোচনা দরকার।",
    },
  },
  {
    icon: "tutor",
    title: { en: "A tutor that stays in your book", bn: "যে টিউটর তোমার বইয়ের মধ্যেই থাকে" },
    body: {
      en: "Answers quote checked pages of your textbook with the page number, and say plainly when the book doesn't cover something.",
      bn: "উত্তরে তোমার পাঠ্যবইয়ের যাচাই করা পাতা পৃষ্ঠা নম্বরসহ থাকে, আর বইয়ে না থাকলে সোজাসুজি জানায়।",
    },
  },
  {
    icon: "practice",
    title: { en: "Adaptive practice", bn: "তোমার মতো করে অনুশীলন" },
    body: {
      en: "Questions come from the book's own exercises with its answer key. Due revisions come first, then mistakes, then new ones.",
      bn: "প্রশ্ন আসে বইয়ের অনুশীলনী থেকে, বইয়ের উত্তরমালাসহ। আগে পুনরালোচনা, তারপর ভুলগুলো, তারপর নতুন।",
    },
  },
  {
    icon: "revision",
    title: { en: "Revision at the right time", bn: "সঠিক সময়ে পুনরালোচনা" },
    body: {
      en: "A missed question returns the next day; a right one after 3, 7, 14 and 30 days, so it stays with you.",
      bn: "ভুল প্রশ্ন পরের দিনই ফেরে; সঠিকটি ৩, ৭, ১৪ ও ৩০ দিন পরে, যাতে মনে থাকে।",
    },
  },
  {
    icon: "map",
    title: { en: "A knowledge map", bn: "জ্ঞান মানচিত্র" },
    body: {
      en: "All your chapters in one view, coloured by what your answers show, from not started to demonstrated.",
      bn: "তোমার সব অধ্যায় এক নজরে, উত্তরের প্রমাণ অনুযায়ী রঙে: শুরু হয়নি থেকে প্রমাণিত।",
    },
  },
  {
    icon: "achievements",
    title: { en: "Progress and achievements", bn: "অগ্রগতি ও অর্জন" },
    body: {
      en: "XP comes only from real learning events and can't be farmed. Missing a day never takes anything away.",
      bn: "এক্সপি আসে শুধু আসল শেখা থেকে, বারবার ক্লিক করে বাড়ানো যায় না। একদিন বাদ পড়লে কিছুই কাটা যায় না।",
    },
  },
];

const HOW: { title: L; body: L }[] = [
  {
    title: { en: "A small idea", bn: "একটি ছোট ধারণা" },
    body: {
      en: "A few short steps, checked against your book's pages, plus an example you can change.",
      bn: "কয়েকটি ছোট ধাপ, বইয়ের পাতার সঙ্গে মেলানো, সঙ্গে বদলানো যায় এমন উদাহরণ।",
    },
  },
  {
    title: { en: "Practice", bn: "অনুশীলন" },
    body: {
      en: "One question at a time, from the book's exercises.",
      bn: "একবারে একটি প্রশ্ন, বইয়ের অনুশীলনী থেকে।",
    },
  },
  {
    title: { en: "Feedback", bn: "উত্তরের ব্যাখ্যা" },
    body: {
      en: "The right answer, why, and what your wrong choice usually means.",
      bn: "সঠিক উত্তর, কেন, আর তোমার ভুল বাছাই সাধারণত কী বোঝায়।",
    },
  },
  {
    title: { en: "Revision", bn: "পুনরালোচনা" },
    body: {
      en: "Questions come back on a schedule until they stick.",
      bn: "মনে না থাকা পর্যন্ত প্রশ্ন সময়মতো ফিরে আসে।",
    },
  },
  {
    title: { en: "Shown, not assumed", bn: "অনুমান নয়, প্রমাণ" },
    body: {
      en: "A chapter counts as demonstrated after 5 different questions right, a correct revision and 70% recent accuracy.",
      bn: "৫টি ভিন্ন প্রশ্ন সঠিক, একটি সঠিক পুনরালোচনা আর সাম্প্রতিক ৭০% সঠিক হলে অধ্যায় প্রমাণিত ধরা হয়।",
    },
  },
];

function HeroPreview() {
  const { tx } = useLearner();
  return (
    <div
      className="relative"
      aria-label={tx(
        "Preview of a Learning Session question",
        "একটি লার্নিং সেশনের প্রশ্নের নমুনা",
      )}
      role="img"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 520 520"
        className="absolute -left-10 -top-10 h-[115%] w-[115%] text-brand/25"
      >
        <path
          d="M20 480 C 120 470, 110 330, 230 330 S 360 200, 300 140 S 400 30, 500 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="8 9"
        />
        {[
          [20, 480],
          [230, 330],
          [300, 140],
          [500, 30],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === 2 ? 10 : 7}
            fill={i === 2 ? "#5B3FD6" : "#D3CCE3"}
          />
        ))}
      </svg>
      <div className="relative rounded-[28px] border border-line bg-sheet p-5 shadow-[var(--shadow-lift)] md:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-ink-mid">
            {tx("Mathematics, Chapter 2", "গণিত, অধ্যায় ২")}
          </span>
          <Badge tone="pink">{tx("You missed this before", "আগে ভুল হয়েছিল")}</Badge>
        </div>
        <p className="mt-4 text-[19px] font-semibold leading-relaxed" lang="bn">
          {PREVIEW.prompt}
        </p>
        <div className="mt-4 grid gap-2" lang="bn">
          {PREVIEW.options.map((o) => (
            <div
              key={o.id}
              className={`flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-2.5 text-[16px] ${o.id === PREVIEW.answer ? "border-mint bg-mint-soft" : o.id === "ঘ" ? "border-again bg-again-soft" : "border-line opacity-60"}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-line-strong text-[13px] font-bold">
                {o.id}
              </span>
              <span className="math">{o.text}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[16px] bg-again-soft p-3.5">
          <p className="text-[15px] font-semibold text-again">
            {tx("Not yet. ১০ : ৬ : ১৫ is right.", "এখনো হয়নি। ১০ : ৬ : ১৫ সঠিক।")}
          </p>
          <p className="mt-1 text-[14px] text-ink">
            {tx(
              "This wrong answer often comes from reversing the order of the terms.",
              "এই ভুল সাধারণত আসে রাশির ক্রম উল্টে ফেলায়।",
            )}
          </p>
        </div>
        <p className="mt-3 text-[12px] text-ink-low">
          {tx(
            "Textbook: Exercise 2.3, question 4, page 35. Answer from the book's key.",
            "পাঠ্যবই: অনুশীলনী ২.৩, প্রশ্ন ৪, পৃষ্ঠা ৩৫। উত্তর বইয়ের উত্তরমালা থেকে।",
          )}
        </p>
      </div>
      <div className="relative -mt-6 ml-auto w-[78%] rounded-[22px] border border-line bg-sheet p-4 shadow-[var(--shadow-lift)]">
        <StageTrailMini />
      </div>
    </div>
  );
}

function StageTrailMini() {
  const { tx } = useLearner();
  const steps = [
    tx("Discover", "খোঁজো"),
    tx("Understand", "বোঝো"),
    tx("Try", "চেষ্টা"),
    tx("Improve", "শোধরাও"),
    tx("Remember", "মনে রাখো"),
  ];
  return (
    <ol className="flex items-center" aria-hidden="true">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none">
          <span className="flex flex-col items-center gap-1">
            <span
              className={`h-4 w-4 rounded-full ${i < 3 ? "bg-mint" : i === 3 ? "bg-brand ring-4 ring-brand-soft" : "border-2 border-line-strong bg-sheet"}`}
            />
            <span
              className={`text-[11px] font-semibold ${i === 3 ? "text-brand-deep" : "text-ink-low"}`}
            >
              {s}
            </span>
          </span>
          {i < steps.length - 1 && (
            <span
              className={`mx-1 mb-4 flex-1 border-t-2 border-dashed ${i < 3 ? "border-mint" : "border-line-strong"}`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

const LOOP: { id: string; label: L }[] = [
  { id: "subject", label: { en: "Choose a subject", bn: "বিষয় বাছো" } },
  { id: "learn", label: { en: "Learn a concept", bn: "ধারণা শেখো" } },
  { id: "practise", label: { en: "Practise", bn: "অনুশীলন" } },
  { id: "feedback", label: { en: "Get feedback", bn: "ব্যাখ্যা পাও" } },
  { id: "progress", label: { en: "See progress", bn: "অগ্রগতি দেখো" } },
];

function LoopDemo() {
  const { tx, t } = useLearner();
  const [tab, setTab] = useState("subject");
  const [subject, setSubject] = useState("mathematics");
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const idx = LOOP.findIndex((x) => x.id === tab);
  const go = (id: string) => setTab(id);
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div
        role="tablist"
        aria-label={tx("Steps", "ধাপ")}
        className="flex gap-2 overflow-x-auto lg:flex-col"
      >
        {LOOP.map((l, i) => (
          <button
            key={l.id}
            role="tab"
            id={`tab-${l.id}`}
            aria-selected={tab === l.id}
            aria-controls={`panel-${l.id}`}
            onClick={() => go(l.id)}
            className={`flex shrink-0 items-center gap-3 rounded-[14px] px-4 py-3 text-left text-[16px] font-semibold transition-colors ${tab === l.id ? "bg-brand text-white" : "bg-lilac text-ink hover:bg-lilac-2"}`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[14px] ${tab === l.id ? "bg-white/20" : "bg-sheet"}`}
            >
              {i + 1}
            </span>
            {t(l.label)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="min-h-[380px] rounded-[24px] border border-line bg-canvas p-5 md:p-7"
      >
        {tab === "subject" && (
          <div className="edu-rise">
            <p className="text-[16px] text-ink-mid">
              {tx(
                "Your dashboard shows all eight subjects. Pick one:",
                "তোমার ড্যাশবোর্ডে আটটি বিষয়ই থাকে। একটি বাছো:",
              )}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={subject === s.id}
                  onClick={() => setSubject(s.id)}
                  className={`flex items-center gap-2 rounded-[14px] border-2 p-3 text-left text-[15px] font-semibold ${subject === s.id ? "border-brand bg-brand-soft" : "border-line bg-sheet hover:border-line-strong"}`}
                >
                  <SubjectDot hue={s.hue} />
                  {t(s.short)}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[15px] text-ink-mid">
              {subject === "mathematics"
                ? tx(
                    "Mathematics has the most checked questions right now, so the preview continues there.",
                    "এখন গণিতে সবচেয়ে বেশি যাচাই করা প্রশ্ন, তাই নমুনা সেখানেই চলবে।",
                  )
                : tx(
                    "This preview continues with Mathematics, which has the most checked questions so far.",
                    "এ পর্যন্ত গণিতে সবচেয়ে বেশি যাচাই করা প্রশ্ন, তাই নমুনা গণিত দিয়েই চলবে।",
                  )}
            </p>
            <button
              type="button"
              onClick={() => go("learn")}
              className="mt-4 font-semibold text-brand-deep hover:underline"
            >
              {tx("Next: learn the idea", "পরের ধাপ: ধারণা শেখো")}
            </button>
          </div>
        )}
        {tab === "learn" && (
          <div className="edu-rise">
            <ContinuedRatioLab />
            <button
              type="button"
              onClick={() => go("practise")}
              className="mt-4 font-semibold text-brand-deep hover:underline"
            >
              {tx("Next: practise", "পরের ধাপ: অনুশীলন")}
            </button>
          </div>
        )}
        {(tab === "practise" || tab === "feedback") && (
          <div className="edu-rise">
            <p className="text-[18px] font-semibold leading-relaxed" lang="bn">
              {PREVIEW.prompt}
            </p>
            <div role="radiogroup" className="mt-4 grid gap-2" lang="bn">
              {PREVIEW.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={pick === o.id}
                  disabled={checked}
                  onClick={() => setPick(o.id)}
                  className={`flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-2.5 text-left text-[16px] ${checked && o.id === PREVIEW.answer ? "border-mint bg-mint-soft" : checked && pick === o.id ? "border-again bg-again-soft" : pick === o.id ? "border-brand bg-brand-soft" : "border-line bg-sheet"}`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-line-strong text-[13px] font-bold">
                    {o.id}
                  </span>
                  <span className="math">{o.text}</span>
                </button>
              ))}
            </div>
            {!checked ? (
              <button
                type="button"
                disabled={!pick}
                onClick={() => {
                  setChecked(true);
                  setTab("feedback");
                }}
                className="mt-4 inline-flex h-12 items-center rounded-[14px] bg-brand px-5 font-semibold text-white disabled:opacity-50"
              >
                {tx("Check my answer", "উত্তর যাচাই করো")}
              </button>
            ) : (
              <div className="mt-4 space-y-2" aria-live="polite">
                <p
                  className={`text-[17px] font-bold ${pick === PREVIEW.answer ? "text-mint" : "text-again"}`}
                >
                  {pick === PREVIEW.answer
                    ? tx("That's right.", "সঠিক।")
                    : tx("Not yet.", "এখনো হয়নি।")}
                </p>
                {pick && PREVIEW.why[pick] && (
                  <p className="text-[15px]">
                    {tx("This wrong answer often comes from: ", "এই ভুল সাধারণত আসে: ")}
                    {t(PREVIEW.why[pick])}
                  </p>
                )}
                <p className="text-[15px] text-ink-mid" lang="bn">
                  {PREVIEW.explanation}
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPick(null);
                      setChecked(false);
                      setTab("practise");
                    }}
                    className="font-semibold text-brand-deep hover:underline"
                  >
                    {tx("Try again", "আবার চেষ্টা")}
                  </button>
                  <button
                    type="button"
                    onClick={() => go("progress")}
                    className="font-semibold text-brand-deep hover:underline"
                  >
                    {tx("Next: see progress", "পরের ধাপ: অগ্রগতি")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === "progress" && (
          <div className="edu-rise">
            <Badge tone="amber">
              {tx("Example only: not a real student", "শুধু উদাহরণ: আসল শিক্ষার্থী নয়")}
            </Badge>
            <div className="mt-4 flex items-center gap-4">
              <LevelRing
                level={2}
                progress={0.07}
                size={76}
                label={tx("Example level 2", "উদাহরণ লেভেল ২")}
              />
              <div>
                <p className="font-display text-[20px] font-bold">
                  {tx("Discoverer, 67 XP", "আবিষ্কারক, ৬৭ এক্সপি")}
                </p>
                <p className="text-[14px] text-ink-mid">
                  {tx("93 XP to level 3", "লেভেল ৩-এ যেতে ৯৩ এক্সপি")}
                </p>
              </div>
            </div>
            <div className="mt-6 max-w-md space-y-3">
              <p className="text-[15px] font-semibold">
                {tx("Continued ratio: developing", "ধারাবাহিক অনুপাত: এগোচ্ছে")}
              </p>
              <ProgressBar
                value={3}
                max={5}
                label={tx("Different questions right", "ভিন্ন প্রশ্ন সঠিক")}
              />
              <p className="text-[14px] text-ink-mid">
                {tx(
                  "3 of the 5 different questions needed, plus one correct revision, before IntelliHorizon calls it demonstrated.",
                  "প্রমাণিত বলার আগে দরকার ৫টি ভিন্ন প্রশ্নের ৩টি হয়েছে, সঙ্গে একটি সঠিক পুনরালোচনা।",
                )}
              </p>
            </div>
            <LinkButton to="/signup" className="mt-6">
              {tx("Start for real", "সত্যি শুরু করো")}
            </LinkButton>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {tx(`Step ${idx + 1} of 5`, `ধাপ ${idx + 1} / ৫`)}
        </p>
      </div>
    </div>
  );
}
