// Pure text utilities for ingestion and retrieval. Shared by server, client and tests.
import { EXCERPT_MAX } from "./config";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

export function normalizeText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\u00AD/g, "")
    .replace(/[\t\f\v\u00A0\u2000-\u200B\u3000]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function letterCounts(text: string) {
  let bangla = 0, latin = 0, replacement = 0, privateUse = 0, unmapped = 0, bijoy = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x0980 && c <= 0x09ff) bangla++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin++;
    else if (c === 0xfffd) replacement++;
    else if (c >= 0xe000 && c <= 0xf8ff) privateUse++;
    else if (c < 0x20 && c !== 0x0a && c !== 0x09) unmapped++;
    // Characters that legacy Bijoy/SutonnyMJ fonts use for Bangla glyphs but that are rare in real English text.
    if ("‡†¨©ÖØª¯ÍÿµÕ„ÿÒÓ¸«»Ô¶Ž".includes(ch)) bijoy++;
  }
  return { bangla, latin, replacement, privateUse, unmapped, bijoy };
}

const PRE_BASE = "\u09BF\u09C7\u09C8";
const CONS = "[\u0995-\u09B9\u09CE\u09DC-\u09DF]\u09BC?";
const CLUSTER = new RegExp(`([${PRE_BASE}])(${CONS}(?:\u09CD${CONS})*)`, "gu");
const ORPHAN = new RegExp(`(?:^|[^\u0995-\u09B9\u09CE\u09DC-\u09DF\u09BC\u09CD])[${PRE_BASE}]`, "gmu");

/**
 * Some PDFs store Bangla in visual order: pre-base vowel signs (ি ে ৈ) come before their consonant.
 * In logical Unicode a pre-base sign never starts a word, so many word-initial signs reveal visual order.
 * Only then are the signs moved after their consonant cluster, so correct text is never altered.
 */
export function repairBanglaOrder(text: string): { text: string; repaired: boolean } {
  const preBase = (text.match(new RegExp(`[${PRE_BASE}]`, "gu")) ?? []).length;
  const orphans = (text.match(ORPHAN) ?? []).length;
  if (preBase < 3 || orphans / preBase < 0.3) return { text, repaired: false };
  return { text: text.replace(CLUSTER, "$2$1").normalize("NFC"), repaired: true };
}

/** Join pdf.js text items, adding a space only where the PDF really has a gap. */
export function joinPdfItems(items: { str: string; x: number; w: number; eol: boolean }[]): string {
  let out = "";
  let prevEnd: number | null = null;
  for (const it of items) {
    if (prevEnd !== null && it.str && !out.endsWith(" ") && !out.endsWith("\n") && !it.str.startsWith(" ")) {
      if (it.x - prevEnd > 1.5) out += " ";
    }
    out += it.str;
    prevEnd = it.str ? it.x + it.w : prevEnd;
    if (it.eol) {
      out += "\n";
      prevEnd = null;
    }
  }
  return out;
}

export type PageQuality = "ok" | "empty" | "low_text" | "legacy_font" | "garbled";

/**
 * Classify an extracted page. Bangla textbooks set in legacy (non-Unicode) fonts extract as Latin
 * gibberish; scanned pages extract as nothing. Neither may be indexed as if it were real text.
 */
export function classifyPage(text: string, bookLanguage: "bn" | "en"): { quality: PageQuality; banglaRatio: number; chars: number } {
  const t = text.trim();
  const chars = [...t].length;
  const { bangla, latin, replacement, privateUse, unmapped, bijoy } = letterCounts(t);
  const banglaRatio = bangla + latin === 0 ? 0 : bangla / (bangla + latin);
  if (chars - unmapped < 15) return { quality: "empty", banglaRatio, chars };
  // Glyphs without a text mapping (often Bangla conjuncts) corrupt the words they belong to.
  if ((replacement + privateUse + unmapped) / chars > 0.005) return { quality: "garbled", banglaRatio, chars };
  if (latin > 40 && banglaRatio < 0.25 && (bookLanguage === "bn" || bijoy / Math.max(1, latin) > 0.03)) return { quality: "legacy_font", banglaRatio, chars };
  if (bangla > 20) {
    const left = (t.match(ORPHAN) ?? []).length;
    if (left > 3) return { quality: "garbled", banglaRatio, chars };
  }
  if (chars < 120) return { quality: "low_text", banglaRatio, chars };
  return { quality: "ok", banglaRatio, chars };
}

export const indexable = (q: PageQuality) => q === "ok" || q === "low_text";

/** OCR'd pages are already in reading order. Their quality comes from the OCR engine's mean word confidence (0-100). */
export const OCR_MIN_CONFIDENCE = 55;
export const OCR_REVIEW_CONFIDENCE = 75;
export function classifyOcrPage(text: string, confidence: number | null): { quality: PageQuality; banglaRatio: number; chars: number } {
  const t = text.trim();
  const chars = [...t].length;
  const { bangla, latin } = letterCounts(t);
  const banglaRatio = bangla + latin === 0 ? 0 : bangla / (bangla + latin);
  if (chars < 15) return { quality: "empty", banglaRatio, chars };
  if (confidence !== null && confidence < OCR_MIN_CONFIDENCE) return { quality: "garbled", banglaRatio, chars };
  if (chars < 120) return { quality: "low_text", banglaRatio, chars };
  return { quality: "ok", banglaRatio, chars };
}

const SENTENCE_SPLIT = /(?<=[.!?।])\s+|\n+/u;

export function sentences(text: string): string[] {
  return text.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
}

/** Chunk a page into retrieval passages of about 650 characters, at sentence boundaries, with one sentence of overlap. */
export function chunkPage(text: string, target = 650): string[] {
  const sents = sentences(normalizeText(text));
  const chunks: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const s of sents) {
    const pieces = s.length > target ? s.match(new RegExp(`.{1,${target}}(\\s|$)`, "gsu")) ?? [s] : [s];
    for (const p of pieces) {
      if (len + p.length > target && cur.length) {
        chunks.push(cur.join(" "));
        const last = cur[cur.length - 1];
        cur = last.length <= 160 ? [last] : [];
        len = cur.reduce((a, x) => a + x.length + 1, 0);
      }
      cur.push(p.trim());
      len += p.length + 1;
    }
  }
  if (cur.length) chunks.push(cur.join(" "));
  // Merge tiny trailing chunks into their neighbour.
  const out: string[] = [];
  for (const c of chunks) {
    if (out.length && c.length < 60) out[out.length - 1] += " " + c;
    else out.push(c);
  }
  return out.filter((c) => c.trim().length >= 20);
}

const STOP = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "of", "in", "on", "at", "to", "for", "and", "or", "what", "which",
  "who", "whom", "why", "how", "when", "where", "does", "do", "did", "explain", "define", "describe", "tell", "me", "about",
  "please", "can", "could", "you", "this", "that", "these", "those", "with", "from", "by", "it", "its", "as", "give", "example",
  "examples", "meaning", "mean", "means", "difference", "between", "i", "my", "we", "our", "your", "into", "than", "then", "there",
  "কী", "কি", "কেন", "কীভাবে", "কিভাবে", "কাকে", "বলে", "বলতে", "বোঝায়", "এর", "ও", "এবং", "বা", "হয়", "হলো", "হল", "করে", "করো",
  "একটি", "এই", "সেই", "যে", "থেকে", "জন্য", "দিয়ে", "নিয়ে", "আমি", "আমাকে", "বুঝিয়ে", "দাও", "বলো", "সম্পর্কে", "মধ্যে",
  "পার্থক্য", "উদাহরণ", "লেখ", "লেখো", "ব্যাখ্যা", "কর", "কোন", "কোনটি", "কত", "কয়টি", "তার", "তাদের", "আর",
  // Question words and "in the book / chapter" phrasing: they name where to look, not what to find.
  "কে", "কার", "কারা", "কাদের", "কোথায়", "কখন", "কবে", "কেমন", "বই", "বইয়ে", "বইয়ের", "বইটিতে", "বইটির", "অধ্যায়ে", "অধ্যায়ের", "পাঠে",
  "book", "chapter", "unit", "lesson", "paper", "subject", "textbook",
]);

const BN_SUFFIXES = ["গুলোর", "গুলো", "দের", "ের", "টির", "টি", "কে", "তে", "েরা", "রা", "য়ের", "য়", "র", "ে"];

/** Light, conservative stemming so that inflected query words still match the textbook by substring. */
export function stem(term: string): string {
  if (/[\u0980-\u09ff]/.test(term)) {
    for (const s of BN_SUFFIXES) if ([...term].length > [...s].length + 3 && term.endsWith(s)) return term.slice(0, term.length - s.length);
    return term;
  }
  if (term.length > 6 && term.endsWith("ing")) return term.slice(0, -3);
  if (term.length > 5 && term.endsWith("ies")) return term.slice(0, -3) + "y";
  if (term.length > 5 && term.endsWith("es")) return term.slice(0, -2);
  if (term.length > 4 && term.endsWith("s") && !term.endsWith("ss")) return term.slice(0, -1);
  return term;
}

/** Search terms: lowercase words, minus stop words, stemmed, unique. */
export function queryTerms(q: string): string[] {
  const words = toAsciiDigits(normalizeText(q).toLowerCase())
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (STOP.has(w) || [...w].length < 2) continue;
    const s = stem(w);
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, 12);
}

export function ftsQuery(terms: string[]): string | null {
  const usable = terms.filter((t) => [...t].length >= 3);
  if (!usable.length) return null;
  return usable.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
}

export function termCoverage(text: string, terms: string[]): number {
  if (!terms.length) return 0;
  const low = toAsciiDigits(text.toLowerCase());
  return terms.filter((t) => low.includes(t)).length / terms.length;
}

/** Choose the 1 to 3 consecutive sentences that best match the terms, capped at EXCERPT_MAX characters. */
export function excerpt(text: string, terms: string[], max = EXCERPT_MAX): string {
  const sents = sentences(text);
  if (!sents.length) return "";
  const hits = (s: string) => {
    const low = toAsciiDigits(s.toLowerCase());
    return terms.filter((t) => low.includes(t)).length;
  };
  let best = { i: 0, j: 0, score: -1 };
  for (let i = 0; i < sents.length; i++) {
    let len = 0, score = 0;
    for (let j = i; j < Math.min(i + 3, sents.length); j++) {
      len += sents[j].length + 1;
      if (len > max && j > i) break;
      score += hits(sents[j]);
      if (score > best.score || (score === best.score && j - i < best.j - best.i)) best = { i, j, score };
    }
  }
  let out = sents.slice(best.i, best.j + 1).join(" ");
  if (out.length > max) {
    const low = out.toLowerCase();
    const first = Math.max(0, Math.min(...terms.map((t) => low.indexOf(t)).filter((x) => x >= 0), 0));
    const start = Math.max(0, first - 120);
    out = (start > 0 ? "… " : "") + out.slice(start, start + max - 4).trim() + " …";
  } else {
    if (best.i > 0) out = "… " + out;
    if (best.j < sents.length - 1) out = out + " …";
  }
  return out;
}

/** Salient words of a passage that a student's own explanation might reasonably use. */
export function keyTerms(text: string, questionTerms: string[], n = 6): string[] {
  const counts = new Map<string, number>();
  for (const w of queryTerms(text.slice(0, 2000)).concat(
    toAsciiDigits(text.toLowerCase()).replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => [...w].length >= 4 && !STOP.has(w)).map(stem),
  )) counts.set(w, (counts.get(w) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
  const fromQuestion = questionTerms.filter((t) => counts.has(t));
  return [...new Set([...fromQuestion, ...ranked])].slice(0, n);
}

export type Intent = "define" | "why" | "how" | "compare" | "example" | "general";
export function detectIntent(q: string): Intent {
  const s = q.toLowerCase();
  if (/(difference|compare|vs\.?|versus|পার্থক্য|তুলনা)/.test(s)) return "compare";
  if (/(why|কেন)/.test(s)) return "why";
  if (/(how|কীভাবে|কিভাবে)/.test(s)) return "how";
  if (/(example|উদাহরণ)/.test(s)) return "example";
  if (/(what is|what are|define|meaning|কাকে বলে|বলতে কী|কী\b|কি\b)/.test(s)) return "define";
  return "general";
}

/* ─────────── Exact arithmetic (for "check my calculation") ─────────── */

type Rat = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const mk = (n: bigint, d: bigint): Rat => {
  if (d === 0n) throw new Error("division_by_zero");
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
function parseDecimal(s: string): Rat {
  const [i, f = ""] = s.split(".");
  return mk(BigInt((i || "0") + f), 10n ** BigInt(f.length));
}

export function isArithmetic(q: string): boolean {
  const s = toAsciiDigits(q).replace(/[=?\s]/g, "").replace(/,/g, "");
  return s.length > 0 && s.length <= 120 && /^[0-9.+\-*/×÷^()%]+$/.test(s) && /[0-9]/.test(s) && /[+\-*/×÷^%]/.test(s.replace(/^-/, ""));
}

export function evalArithmetic(q: string): { value: Rat; decimal: string; fraction: string | null } {
  const src = toAsciiDigits(q).replace(/[=?\s,]/g, "").replace(/×/g, "*").replace(/÷/g, "/");
  let i = 0;
  const peek = () => src[i];
  const expr = (): Rat => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = term();
      v = op === "+" ? mk(v.n * r.d + r.n * v.d, v.d * r.d) : mk(v.n * r.d - r.n * v.d, v.d * r.d);
    }
    return v;
  };
  const term = (): Rat => {
    let v = power();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = src[i++];
      if (op === "%") { v = mk(v.n, v.d * 100n); continue; }
      const r = power();
      v = op === "*" ? mk(v.n * r.n, v.d * r.d) : mk(v.n * r.d, v.d * r.n);
    }
    return v;
  };
  const power = (): Rat => {
    const b = unary();
    if (peek() === "^") {
      i++;
      const e = unary();
      if (e.d !== 1n || e.n < 0n || e.n > 64n) throw new Error("unsupported_power");
      let r: Rat = { n: 1n, d: 1n };
      for (let k = 0n; k < e.n; k++) r = mk(r.n * b.n, r.d * b.d);
      return r;
    }
    return b;
  };
  const unary = (): Rat => {
    if (peek() === "-") { i++; const v = unary(); return { n: -v.n, d: v.d }; }
    if (peek() === "+") { i++; return unary(); }
    if (peek() === "(") {
      i++;
      const v = expr();
      if (src[i++] !== ")") throw new Error("parse_error");
      return v;
    }
    const m = /^[0-9]+(\.[0-9]+)?|^\.[0-9]+/.exec(src.slice(i));
    if (!m) throw new Error("parse_error");
    i += m[0].length;
    return parseDecimal(m[0].startsWith(".") ? "0" + m[0] : m[0]);
  };
  const value = expr();
  if (i !== src.length) throw new Error("parse_error");
  const neg = value.n < 0n;
  const absN = neg ? -value.n : value.n;
  const whole = absN / value.d;
  let rem = absN % value.d;
  let digits = "";
  for (let k = 0; k < 10 && rem !== 0n; k++) { rem *= 10n; digits += String(rem / value.d); rem %= value.d; }
  const decimal = (neg ? "-" : "") + whole.toString() + (digits ? "." + digits + (rem !== 0n ? "…" : "") : "");
  return { value, decimal, fraction: value.d === 1n ? null : `${value.n}/${value.d}` };
}

/* ─────────── Answer grading ─────────── */

export function parseNumber(raw: string): number | null {
  const s = toAsciiDigits(raw).replace(/,/g, "").replace(/\s+/g, "").trim();
  if (!s) return null;
  const frac = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  if (!/^-?\d*(\.\d+)?$/.test(s) || s === "-" || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeShort(s: string): string {
  return toAsciiDigits(s.normalize("NFC").toLowerCase()).replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function gradeAnswer(
  q: { type: "mcq" | "numeric" | "short"; answer: string; tolerance: number | null },
  response: string,
): boolean {
  if (q.type === "mcq") return response === q.answer;
  if (q.type === "numeric") {
    const got = parseNumber(response);
    const want = parseNumber(q.answer);
    if (got === null || want === null) return false;
    const tol = q.tolerance ?? 1e-9;
    return Math.abs(got - want) <= Math.max(tol, 1e-9 * Math.abs(want));
  }
  let accepted: string[] = [];
  try { accepted = JSON.parse(q.answer) as string[]; } catch { accepted = [q.answer]; }
  const r = normalizeShort(response);
  return r.length > 0 && accepted.some((a) => normalizeShort(a) === r);
}

/* ─────────── Revision scheduling (Leitner boxes) ─────────── */

export const BOX_DAYS = [1, 3, 7, 14, 30];
export function nextReview(prevBox: number | null, correct: boolean, now: Date): { box: number; dueAt: string } {
  const box = correct ? Math.min((prevBox ?? 0) + 1, BOX_DAYS.length) : 1;
  const due = new Date(now.getTime() + BOX_DAYS[box - 1] * 86400000);
  return { box, dueAt: due.toISOString() };
}
