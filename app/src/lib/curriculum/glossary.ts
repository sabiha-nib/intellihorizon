// Curriculum glossary for cross-language retrieval (pure). An English question about a Bangla-medium book is
// rewritten into the Bangla terms the book uses, so it can find the real passage. This only changes WHAT IS SEARCHED;
// nothing here is shown to students as textbook content, and the rewrite is reported with every answer.
// Terms are standard Class 7 vocabulary for the subjects that currently have checked text; add pairs as content grows.
export const GLOSSARY: { en: string[]; bn: string[] }[] = [
  { en: ["continued ratio", "continuous ratio"], bn: ["ধারাবাহিক অনুপাত"] },
  { en: ["multiple ratio", "ratio of several quantities", "ratio of three quantities"], bn: ["বহুরাশিক অনুপাত"] },
  { en: ["proportion", "proportional"], bn: ["সমানুপাত"] },
  { en: ["ratio", "ratios"], bn: ["অনুপাত"] },
  { en: ["antecedent", "first term"], bn: ["পূর্ব রাশি"] },
  { en: ["consequent", "second term"], bn: ["উত্তর রাশি"] },
  { en: ["profit and loss", "profit", "gain"], bn: ["লাভ"] },
  { en: ["loss"], bn: ["ক্ষতি"] },
  { en: ["cost price"], bn: ["ক্রয়মূল্য"] },
  { en: ["selling price"], bn: ["বিক্রয়মূল্য"] },
  { en: ["unitary method"], bn: ["ঐকিক নিয়ম"] },
  { en: ["cell", "cells"], bn: ["কোষ"] },
  { en: ["organism", "living being", "living things"], bn: ["জীবদেহ", "জীব"] },
  { en: ["plant cell"], bn: ["উদ্ভিদকোষ"] },
  { en: ["animal cell"], bn: ["প্রাণিকোষ"] },
  { en: ["cell wall"], bn: ["কোষপ্রাচীর"] },
  { en: ["tissue"], bn: ["টিস্যু"] },
  { en: ["weaver", "weavers"], bn: ["তাঁতি"] },
  { en: ["sari", "saree"], bn: ["শাড়ি"] },
  { en: ["kabuliwala"], bn: ["কাবুলিওয়ালা"] },
  { en: ["mini"], bn: ["মিনি"] },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds glossary phrases in an English (or mixed) question, longest first, and returns the Bangla terms to search.
 * Returns [] when nothing in the question is in the glossary (then the tutor abstains instead of guessing).
 */
export function rewriteToBangla(question: string): { matched: string[]; terms: string[] } {
  let q = ` ${question.toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ")} `;
  const pairs = GLOSSARY.flatMap((g) => g.en.map((e) => ({ e, bn: g.bn }))).sort((a, b) => b.e.length - a.e.length);
  const matched: string[] = [];
  const terms: string[] = [];
  for (const p of pairs) {
    const re = new RegExp(` ${esc(p.e)} `);
    if (re.test(q)) {
      matched.push(p.e);
      for (const t of p.bn) if (!terms.includes(t)) terms.push(t);
      q = q.replace(re, " ");
    }
  }
  return { matched, terms };
}

/** The reverse direction, for English-version books: Bangla glossary terms in the question -> English terms. */
export function rewriteToEnglish(question: string): { matched: string[]; terms: string[] } {
  const matched: string[] = [];
  const terms: string[] = [];
  const pairs = GLOSSARY.flatMap((g) => g.bn.map((b) => ({ b, en: g.en[0] }))).sort((a, b) => b.b.length - a.b.length);
  let q = question;
  for (const p of pairs) {
    if (q.includes(p.b)) { matched.push(p.b); if (!terms.includes(p.en)) terms.push(p.en); q = q.split(p.b).join(" "); }
  }
  return { matched, terms };
}
