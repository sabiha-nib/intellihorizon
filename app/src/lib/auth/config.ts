// Configurable registration options. Add curricula, grades or countries here; server and client share it.
import type { L } from "../../content/types";

export const COUNTRIES: { code: "BD" | "OTHER"; label: L }[] = [
  { code: "BD", label: { en: "Bangladesh", bn: "বাংলাদেশ" } },
  { code: "OTHER", label: { en: "Another country", bn: "অন্য দেশ" } },
];

export const GRADES: { value: number; label: L }[] = [6, 7, 8, 9, 10].map((g) => ({
  value: g,
  label: { en: `Class ${g}`, bn: `${["৬ষ্ঠ", "৭ম", "৮ম", "৯ম", "১০ম"][g - 6]} শ্রেণি` },
}));

export type CurriculumId = "nctb-bangla" | "nctb-english" | "other";
export const CURRICULA: { id: CurriculumId; label: L; hint: L }[] = [
  { id: "nctb-bangla", label: { en: "NCTB, Bangla Medium", bn: "এনসিটিবি, বাংলা মাধ্যম" }, hint: { en: "National curriculum taught in Bangla", bn: "বাংলায় পড়ানো জাতীয় পাঠ্যক্রম" } },
  { id: "nctb-english", label: { en: "NCTB, English Version", bn: "এনসিটিবি, ইংলিশ ভার্সন" }, hint: { en: "National curriculum taught in English", bn: "ইংরেজিতে পড়ানো জাতীয় পাঠ্যক্রম" } },
  { id: "other", label: { en: "Another curriculum", bn: "অন্য পাঠ্যক্রম" }, hint: { en: "Madrasah, Cambridge, Edexcel and others", bn: "মাদ্রাসা, ক্যামব্রিজ, এডেক্সেল ও অন্যান্য" } },
];

export const OTHER_CURRICULA: { id: string; label: L }[] = [
  { id: "madrasah", label: { en: "Madrasah (Bangladesh Madrasah Education Board)", bn: "মাদ্রাসা (বাংলাদেশ মাদ্রাসা শিক্ষা বোর্ড)" } },
  { id: "cambridge", label: { en: "Cambridge (O Level / IGCSE)", bn: "ক্যামব্রিজ (ও লেভেল / আইজিসিএসই)" } },
  { id: "edexcel", label: { en: "Pearson Edexcel", bn: "পিয়ারসন এডেক্সেল" } },
  { id: "ib", label: { en: "International Baccalaureate", bn: "ইন্টারন্যাশনাল ব্যাকালরিয়েট" } },
  { id: "other", label: { en: "Something else", bn: "অন্য কিছু" } },
];

export const AVATAR_PRESETS = ["comet", "ringed", "moon", "star", "galaxy", "leaf", "atom", "kite"] as const;
export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // after client-side crop and resize
export const AVATAR_PICK_MAX_BYTES = 10 * 1024 * 1024; // original file the student selects

export const GOALS: { id: string; label: L }[] = [
  { id: "exam", label: { en: "Prepare for exams", bn: "পরীক্ষার প্রস্তুতি" } },
  { id: "understand", label: { en: "Understand lessons better", bn: "পাঠ আরও ভালো বোঝা" } },
  { id: "catch_up", label: { en: "Catch up on missed topics", bn: "বাদ পড়া বিষয় ধরা" } },
  { id: "get_ahead", label: { en: "Learn ahead", bn: "এগিয়ে শেখা" } },
];
