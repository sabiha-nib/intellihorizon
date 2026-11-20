// Product scope versus implemented coverage. IntelliHorizon is built for NCTB Classes 6–10 in both the Bangla Version
// and the English Version (separate textbook editions). What a student can actually learn from is decided by the
// database: only imported, checked and published text counts. Nothing here claims content that isn't there.
import type { L } from "../../content/types";

export const SCOPE_GRADES = [6, 7, 8, 9, 10] as const;
export type ScopeGrade = (typeof SCOPE_GRADES)[number];
export type Medium = "bangla" | "english";
export const MEDIA: { id: Medium; label: L; edition: L }[] = [
  { id: "bangla", label: { en: "Bangla Version", bn: "বাংলা ভার্সন" }, edition: { en: "Textbooks written in Bangla", bn: "বাংলায় লেখা পাঠ্যবই" } },
  { id: "english", label: { en: "English Version", bn: "ইংলিশ ভার্সন" }, edition: { en: "The separate English-medium edition", bn: "আলাদা ইংরেজি মাধ্যমের সংস্করণ" } },
];

export const SCOPE_LINE: L = {
  en: "Classes 6–10 · NCTB Bangladesh · Bangla Version and English Version",
  bn: "৬ষ্ঠ–১০ম শ্রেণি · এনসিটিবি বাংলাদেশ · বাংলা ভার্সন ও ইংলিশ ভার্সন",
};
export const SCOPE_SENTENCE: L = {
  en: "An AI-powered personalised learning ecosystem for Classes 6–10, aligned with Bangladesh's NCTB curriculum, for both Bangla Version and English Version students.",
  bn: "৬ষ্ঠ থেকে ১০ম শ্রেণির জন্য এআই-চালিত ব্যক্তিগত শিক্ষার ইকোসিস্টেম, বাংলাদেশের এনসিটিবি পাঠ্যক্রম অনুযায়ী, বাংলা ভার্সন ও ইংলিশ ভার্সন দুই ধরনের শিক্ষার্থীর জন্য।",
};

export type Availability = "available" | "partial" | "under_review" | "coming_soon";
export const AVAILABILITY: Record<Availability, { label: L; detail: L }> = {
  available: { label: { en: "Available", bn: "পাওয়া যাচ্ছে" }, detail: { en: "Every registered book has checked, published text.", bn: "নিবন্ধিত প্রতিটি বইয়ের যাচাই করা, প্রকাশিত লেখা আছে।" } },
  partial: { label: { en: "Partially available", bn: "আংশিক পাওয়া যাচ্ছে" }, detail: { en: "Some checked text is published; the rest is still being imported or reviewed.", bn: "কিছু যাচাই করা লেখা প্রকাশিত; বাকিটা এখনো আমদানি বা পর্যালোচনা চলছে।" } },
  under_review: { label: { en: "Content under review", bn: "বিষয়বস্তু পর্যালোচনায়" }, detail: { en: "Books are registered but no text is published to students yet.", bn: "বই নিবন্ধিত, তবে শিক্ষার্থীদের জন্য এখনো কোনো লেখা প্রকাশিত হয়নি।" } },
  coming_soon: { label: { en: "Coming soon", bn: "শীঘ্রই আসছে" }, detail: { en: "Designed for, but no textbooks have been imported yet.", bn: "এর জন্য তৈরি, তবে এখনো কোনো পাঠ্যবই আমদানি হয়নি।" } },
};

export type CellStats = { books: number; chapters: number; booksWithText: number; publishedPassages: number; publishedQuestions: number; topics: number };
export type ScopeCell = CellStats & { grade: number; medium: Medium; availability: Availability };

/** Availability from real counts only. */
export function availabilityOf(s: CellStats): Availability {
  if (s.books === 0) return "coming_soon";
  if (s.publishedPassages === 0) return "under_review";
  return s.booksWithText >= s.books ? "available" : "partial";
}

export const emptyStats = (): CellStats => ({ books: 0, chapters: 0, booksWithText: 0, publishedPassages: 0, publishedQuestions: 0, topics: 0 });

export function buildMatrix(rows: (Partial<CellStats> & { grade: number; medium: string })[]): ScopeCell[] {
  return SCOPE_GRADES.flatMap((grade) => MEDIA.map(({ id: medium }) => {
    const r = rows.find((x) => x.grade === grade && x.medium === medium);
    const s: CellStats = { ...emptyStats(), ...(r ? Object.fromEntries(Object.entries(r).filter(([k]) => k in emptyStats()).map(([k, v]) => [k, Number(v) || 0])) : {}) } as CellStats;
    return { grade, medium, ...s, availability: availabilityOf(s) };
  }));
}

export const gradeLabel = (g: number): L => ({ en: `Class ${g}`, bn: `${["", "১ম", "২য়", "৩য়", "৪র্থ", "৫ম", "৬ষ্ঠ", "৭ম", "৮ম", "৯ম", "১০ম"][g] ?? g} শ্রেণি` });
