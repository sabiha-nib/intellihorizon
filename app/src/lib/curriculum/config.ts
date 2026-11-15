// Curriculum configuration shared by server and client.
import type { L } from "../../content/types";
import { SUBJECTS } from "./registry";

export const ACTIVE_VERSION = "nctb-2026";

/** Subjects come only from the canonical registry (registry.ts). There is no other subject list. */
export const SUBJECT_KEYS: { key: string; label: L }[] = SUBJECTS.map((s) => ({ key: s.id, label: s.label }));

/** Religion subjects are out of scope for this phase (product constraint). */
export const EXCLUDED_SUBJECT_PATTERN = /(religio|islam|hindu|buddh|christ|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিষ্ট|খ্রিস্ট)/i;

export const subjectLabel = (key: string): L => SUBJECT_KEYS.find((s) => s.key === key)?.label ?? { en: key, bn: key };

/** Student profile curriculum -> NCTB textbook medium. "other" curricula have no NCTB books. */
export function mediumForCurriculum(curriculum: string | null | undefined): "bangla" | "english" | null {
  return curriculum === "nctb-bangla" ? "bangla" : curriculum === "nctb-english" ? "english" : null;
}

export const EXCERPT_MAX = 420;
export const MAX_EXCERPTS = 3;
