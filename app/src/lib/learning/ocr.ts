// Mathematics OCR quality tiers. OCR reads Bangla prose well but often breaks fractions, signs and symbols,
// so maths pages are sorted for human checking instead of being trusted. The thresholds are a heuristic, documented here.
import { OCR_MIN_CONFIDENCE, OCR_REVIEW_CONFIDENCE } from "../curriculum/text";

export type MathTier = "excluded" | "high_risk" | "check" | "clean";
const SUSPICIOUS = /[|{}~`^_¢©®°\\[\]<>@#$%&*=+]|[A-Za-z]{1,2}(?=[ঀ-৿])|(?<=[ঀ-৿])[A-Za-z]{1,2}/g;

export function mathOcrTier(
  text: string,
  confidence: number | null,
  threshold = OCR_REVIEW_CONFIDENCE,
): { tier: MathTier; density: number; brokenLines: number } {
  const t = text.trim();
  const chars = Math.max([...t].length, 1);
  const density = Math.round(((t.match(SUSPICIOUS) ?? []).length / chars) * 1000);
  const brokenLines = t
    .split("\n")
    .filter((l) => l.trim().length > 0 && l.trim().length <= 3).length;
  if (confidence !== null && confidence < OCR_MIN_CONFIDENCE)
    return { tier: "excluded", density, brokenLines };
  if ((confidence !== null && confidence < threshold) || density >= 40 || brokenLines >= 4)
    return { tier: "high_risk", density, brokenLines };
  if (density >= 8) return { tier: "check", density, brokenLines };
  return { tier: "clean", density, brokenLines };
}
