// Teaching approaches for the IntelliHorizon tutor. A persona or an "ask differently" style changes HOW verified
// material is presented (order, prompts, follow-ups). It never changes WHAT counts as a fact: every passage still
// comes from approved textbook text, and nothing here generates textbook content.
import type { L } from "../../content/types";

export const PERSONA_IDS = ["mentor", "socratic", "challenger", "simplifier", "exam"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];
export const STYLE_IDS = ["beginner", "example", "steps", "bangla", "english", "questions", "harder", "analogy", "realworld", "derivation", "testme", "direct"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const PERSONAS: Record<PersonaId, { name: L; how: L }> = {
  mentor: { name: { en: "The Mentor", bn: "মেন্টর" }, how: { en: "Shows the passage, points out the key words, then checks you understood.", bn: "অংশটি দেখায়, মূল শব্দ ধরিয়ে দেয়, তারপর বুঝেছ কি না দেখে।" } },
  socratic: { name: { en: "The Socratic Guide", bn: "প্রশ্নকারী গাইড" }, how: { en: "Asks you questions first. The passage stays folded until you've tried.", bn: "আগে তোমাকে প্রশ্ন করে। চেষ্টা না করা পর্যন্ত অংশটি ভাঁজ করা থাকে।" } },
  challenger: { name: { en: "The Challenger", bn: "চ্যালেঞ্জার" }, how: { en: "Shows the passage, then sends you to the hardest checked questions you haven't solved.", bn: "অংশটি দেখিয়ে তোমার না-করা সবচেয়ে কঠিন যাচাই করা প্রশ্নে পাঠায়।" } },
  simplifier: { name: { en: "The Simplifier", bn: "সহজকারী" }, how: { en: "One short passage at a time, with a plain-language walkthrough where one has been checked.", bn: "একবারে একটি ছোট অংশ, আর যেখানে যাচাই করা আছে সেখানে সহজ ভাষার ধাপ।" } },
  exam: { name: { en: "The Exam Coach", bn: "পরীক্ষার কোচ" }, how: { en: "Ties the passage to the chapter's printed learning outcomes and textbook exercises.", bn: "অংশটিকে অধ্যায়ের ছাপা শিখনফল ও পাঠ্যবইয়ের অনুশীলনীর সঙ্গে মেলায়।" } },
};

export const STYLES: Record<StyleId, L> = {
  beginner: { en: "Explain like I'm a beginner", bn: "একদম নতুনের মতো বোঝাও" },
  example: { en: "Give me an example from the book", bn: "বই থেকে একটি উদাহরণ দাও" },
  steps: { en: "Show the steps", bn: "ধাপগুলো দেখাও" },
  bangla: { en: "Explain in Bangla", bn: "বাংলায় বোঝাও" },
  english: { en: "Explain in English", bn: "ইংরেজিতে বোঝাও" },
  questions: { en: "Ask me questions instead", bn: "বরং আমাকে প্রশ্ন করো" },
  harder: { en: "Give me a harder challenge", bn: "আরও কঠিন চ্যালেঞ্জ দাও" },
  analogy: { en: "Use an analogy", bn: "একটি তুলনা দিয়ে বোঝাও" },
  realworld: { en: "Give a real-world example", bn: "বাস্তব জীবনের উদাহরণ দাও" },
  derivation: { en: "Show the mathematical working", bn: "গাণিতিক ধাপ দেখাও" },
  testme: { en: "Test my understanding", bn: "আমার বোঝা যাচাই করো" },
  direct: { en: "Just explain it directly", bn: "সরাসরি বুঝিয়ে দাও" },
};

/** How each style changes what the AI is asked to do (presentation only; evidence rules never change). */
export const STYLE_PROMPT: Record<StyleId, string> = {
  beginner: "Explain as simply as possible, short sentences, everyday words.",
  example: "Lead with an example taken from the sources if there is one; label any other example as general.",
  steps: "Give numbered steps.",
  bangla: "Write in Bangla.",
  english: "Write in English.",
  questions: "Teach through questions: ask one guiding question first and do not reveal the full answer yet.",
  harder: "After explaining, give a harder application question.",
  analogy: "Use one simple analogy from a Bangladeshi student's daily life, labelled as an analogy (general).",
  realworld: "Give one real-world example, labelled as general unless it comes from the sources.",
  derivation: "Show the mathematical working step by step; every arithmetic step must be correct.",
  testme: "Do not explain again; ask two short questions that test understanding of the sources.",
  direct: "Explain directly and completely now, even if you were asking guiding questions before.",
};

/** What a persona plus an optional one-off style means for this answer. A style wins over the persona's default. */
export function teachingMode(persona: PersonaId, style: StyleId | null) {
  return {
    simplify: style === "beginner" || (style === null && persona === "simplifier"),
    guide: style === "questions" || style === "testme" || (style === null && persona === "socratic"),
    challenge: style === "harder" || (style === null && persona === "challenger"),
    exam: style === null && persona === "exam",
    steps: style === "steps" || style === "beginner" || style === "derivation" || (style === null && persona === "simplifier"),
    example: style === "example",
    lang: style === "bangla" ? ("bn" as const) : style === "english" ? ("en" as const) : null,
  };
}

/** Extra search words for a style. They only widen what is looked for in approved text. */
export function styleTerms(style: StyleId | null): string[] {
  if (style === "example") return ["উদাহরণ", "example", "যেমন"];
  if (style === "steps") return ["সমাধান", "solution", "ধাপ"];
  return [];
}

/** Guiding questions built from the passage's own key words. They ask; they never assert anything about the content. */
export function guideQuestions(keyTerms: string[]): L[] {
  const [a, b] = keyTerms;
  const out: L[] = [];
  if (a) out.push({ en: `Before reading: what do you already think "${a}" means?`, bn: `পড়ার আগে: "${a}" বলতে তুমি এখন কী বোঝো?` });
  if (a && b) out.push({ en: `How do you think "${a}" and "${b}" are connected?`, bn: `"${a}" আর "${b}"-এর মধ্যে সম্পর্ক কী বলে তোমার মনে হয়?` });
  out.push({ en: "Now open the passage. Which sentence answers your question? Say it in your own words.", bn: "এবার অংশটি খোলো। কোন বাক্যটি তোমার প্রশ্নের উত্তর দেয়? নিজের ভাষায় বলো।" });
  out.push({ en: "What would you ask next to be sure you understood?", bn: "ঠিক বুঝেছ নিশ্চিত হতে এরপর কী জিজ্ঞেস করবে?" });
  return out;
}
