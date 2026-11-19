// Bilingual language engine (pure). The question language, the source language, the explanation language and the
// curriculum medium are separate attributes; this module only decides the first and the third.
export type Lang = "bn" | "en";
export type LangMode = "auto" | "bn" | "en" | "mixed";
export const LANG_MODES: LangMode[] = ["auto", "bn", "en", "mixed"];

/** Share of Bangla letters among all letters, and whether the text mixes the two scripts meaningfully. */
export function detectLanguage(text: string): { primary: Lang; mixed: boolean; banglaShare: number } {
  const bn = (text.match(/[ঀ-৿]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  const total = bn + en;
  if (!total) return { primary: "bn", mixed: false, banglaShare: 0 };
  const share = bn / total;
  // Code-switching: at least two Latin words inside mostly-Bangla text, or Bangla words inside mostly-English text.
  const latinWords = (text.match(/[A-Za-z]{2,}/g) ?? []).length;
  const bnWords = (text.match(/[ঀ-৿]{2,}/g) ?? []).length;
  const mixed = (share >= 0.5 && latinWords >= 2) || (share < 0.5 && bnWords >= 2);
  return { primary: share >= 0.5 ? "bn" : "en", mixed, banglaShare: share };
}

/**
 * Explanation language: an explicit one-off request ("Explain in English") wins, then the student's chosen mode,
 * then the language of the question ("auto"); code-switched questions get a mixed explanation in auto mode.
 */
export function explanationLanguage(question: string, mode: LangMode, oneOff: Lang | null): Lang | "mixed" {
  if (oneOff) return oneOff;
  if (mode !== "auto") return mode;
  const d = detectLanguage(question);
  return d.mixed ? "mixed" : d.primary;
}
