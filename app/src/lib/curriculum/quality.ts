// Content quality warnings for extracted passages. Pure and shared by the in-app importer, the offline import
// pipeline (scripts/content) and the review workspace, so a passage gets the same warnings whichever way it arrives.
// A "blocking" warning keeps the passage away from students until a reviewer clears it (see BLOCKING); nothing is
// published automatically because an import succeeded.
import { mathOcrTier } from "../learning/ocr";
import { OCR_REVIEW_CONFIDENCE } from "./text";

export type QualityFlag =
  | "low_confidence"     // the page was read by OCR with confidence below the review threshold
  | "math_unverified"    // Mathematics text with expressions OCR often breaks; a reviewer must check every expression
  | "math_markup_invalid" // structured maths markup ($...$) is unbalanced
  | "duplicate"          // the same text already exists elsewhere in this book
  | "short"              // suspiciously short extraction
  | "no_printed_page"    // the PDF page has no printed page number (front matter) or the book's offset is unknown
  | "no_chapter";        // the page is outside every chapter's page range

/**
 * Warnings that mean the TEXT may be wrong hold a passage back from students until a reviewer clears them.
 * Missing metadata (no printed page, no chapter) and very short text are shown to reviewers as warnings but don't
 * hide text of an approved book: its source card then shows the PDF page, clearly labelled as such.
 */
export const BLOCKING: QualityFlag[] = ["low_confidence", "math_unverified", "math_markup_invalid", "duplicate"];

export const FLAG_TEXT: Record<QualityFlag, { en: string; bn: string }> = {
  low_confidence: { en: `OCR confidence below ${OCR_REVIEW_CONFIDENCE}%`, bn: `OCR আস্থা ${OCR_REVIEW_CONFIDENCE}%-এর নিচে` },
  math_unverified: { en: "Mathematics not yet checked against the page", bn: "গণিত এখনো পৃষ্ঠার সঙ্গে মেলানো হয়নি" },
  math_markup_invalid: { en: "Maths markup is unbalanced", bn: "গণিতের চিহ্নরূপ অসম্পূর্ণ" },
  duplicate: { en: "Same text appears elsewhere in this book", bn: "একই লেখা বইয়ের অন্য জায়গায় আছে" },
  short: { en: "Very short extraction", bn: "খুব ছোট লেখা" },
  no_printed_page: { en: "No printed page number", bn: "ছাপা পৃষ্ঠা নম্বর নেই" },
  no_chapter: { en: "Not inside any chapter", bn: "কোনো অধ্যায়ের ভেতরে নয়" },
};

/** Text that contains mathematical expressions: operators between numbers, ratios, fractions, powers, roots or equations. */
const MATH = /[0-9০-৯]\s*[+\-−×÷*/:=<>≤≥]\s*[0-9০-৯a-zA-Zক-হ(]|[√∛π∠△°²³⁴⁵⁶⁷⁸⁹¹⁰₀₁₂₃∞≈≠±]|\$[^$]+\$|[a-zA-Z]\s*[=^]\s*[0-9a-zA-Z]/;
export function hasMath(text: string): boolean {
  return MATH.test(text);
}

/** Checks the small maths markup reviewers may use: $...$ spans with ^{}, _{}, \frac{}{} and \sqrt{}. */
export function mathMarkupValid(text: string): boolean {
  if ((text.match(/(?<!\\)\$/g) ?? []).length % 2) return false;
  for (const m of text.matchAll(/\$([^$]*)\$/g)) {
    let depth = 0;
    for (const ch of m[1]) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (depth < 0) return false;
    }
    if (depth) return false;
  }
  return true;
}

export type PassageCheck = { flags: QualityFlag[]; blocked: boolean };

export function checkPassage(p: {
  text: string;
  confidence: number | null;
  subjectKey: string;
  printedPage: number | null;
  inChapter: boolean;
  duplicate: boolean;
  /** true once a reviewer has confirmed every expression against the page */
  mathConfirmed?: boolean;
}): PassageCheck {
  const flags: QualityFlag[] = [];
  const t = p.text.trim();
  if (p.confidence !== null && p.confidence < OCR_REVIEW_CONFIDENCE) flags.push("low_confidence");
  if (p.subjectKey === "mathematics" && !p.mathConfirmed && (hasMath(t) || mathOcrTier(t, p.confidence).tier !== "clean")) flags.push("math_unverified");
  if (!mathMarkupValid(t)) flags.push("math_markup_invalid");
  if (p.duplicate) flags.push("duplicate");
  if ([...t].length < 60) flags.push("short");
  if (p.printedPage === null || p.printedPage < 1) flags.push("no_printed_page");
  if (!p.inChapter) flags.push("no_chapter");
  return { flags, blocked: flags.some((f) => BLOCKING.includes(f)) };
}

/** Rows that a re-import or a page correction must never delete or overwrite: anything a person reviewed or published. */
export const PROTECTED_SQL = "(review_status IS NOT NULL OR publish_status IN ('approved', 'published', 'withdrawn'))";
