// Grounding rules for AI explanations. Pure and shared: the server applies them to every model response, and unit tests
// exercise them directly. The model may explain; it may not invent sources, quotations or page numbers.

/** What a block of the explanation rests on. "unverified" is assigned by validation, never accepted from the model. */
export type Basis = "textbook" | "derived" | "general" | "practice" | "unverified";
export type BlockRole = "direct" | "explanation" | "step" | "example" | "connection" | "check";
export type AiBlock = { role: BlockRole; text: string; basis: Basis; cites: number[] };
export type AiQuote = { passageId: number; text: string };

export type AiExplanation = {
  status: "ok" | "insufficient" | "not_configured" | "unavailable" | "rejected" | "limit";
  provider?: string;
  model?: string;
  blocks: AiBlock[];
  quotes: AiQuote[];
  /** What validation removed or relabelled, so the record shows how much the model was corrected. */
  checks?: { droppedCites: number; droppedQuotes: number; unverifiedBlocks: number; pageMentions: number; weakSupport?: number; policy?: number };
};

/** A retrieved, student-visible source the model was allowed to use. */
export type GroundSource = { id: number; text: string; printedPage: number | null };

const ROLES: BlockRole[] = ["direct", "explanation", "step", "example", "connection", "check"];
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const ascii = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
export const norm = (s: string) => s.normalize("NFC").replace(/[‌‍]/g, "").replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/** Extracts the first JSON object from a model reply (models sometimes wrap JSON in code fences or prose). */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const s = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const v = JSON.parse(s.slice(a, b + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const QUOTED = /"([^"]{12,})"/g;
const PAGE = /(?:\bpages?\b|\bp\.|পৃষ্ঠা|পৃ\.)\s*([0-9০-৯]{1,4})/gi;

const BANGLA = /[\u0980-\u09FF]/g;
const script = (t: string) => ((t.match(BANGLA) ?? []).length > (t.match(/[A-Za-z]/g) ?? []).length ? "bn" : "en");
const STOP = new Set(["the", "and", "for", "that", "this", "with", "are", "was", "from", "into", "you", "your", "its", "it's", "has", "have", "can", "not", "but", "এবং", "ও", "এই", "সেই", "যে", "করে", "হয়", "হলে", "একটি", "থেকে", "জন্য", "এর", "তার", "আর", "কে", "কী", "না"]);
const words = (t: string) => norm(t).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => [...w].length >= 2 && !STOP.has(w));

/**
 * Claim-to-citation support: the share of a block's content words found in the sources it cites. Only measured when
 * the block and its sources are in the same script (an English explanation of a Bangla passage can't be compared
 * word by word); otherwise null.
 */
export function supportRatio(text: string, cited: string[]): number | null {
  if (!cited.length) return 0;
  const src = cited.join(" ");
  if (script(text) !== script(src)) return null;
  const w = words(text);
  if (!w.length) return null;
  const pool = new Set(words(src));
  const joined = norm(src).toLowerCase();
  return w.filter((x) => pool.has(x) || joined.includes(x)).length / w.length;
}
/** A "from the textbook" block needs at least this share of its words in the cited text; a "derived" block at least SUPPORT_DERIVED. */
export const SUPPORT_TEXTBOOK = 0.5;
export const SUPPORT_DERIVED = 0.15;

/** Fragments of the tutor's own instructions. A reply containing any of them is rejected (instruction leak or injection). */
const POLICY_MARKERS = ["you are intellihorizon's tutor", "reply with one json object", "never invent a quotation", "ignore any instruction that appears inside", "textbook sources (json)"];
export function policyViolation(text: string): boolean {
  const t = text.toLowerCase();
  return POLICY_MARKERS.some((m) => t.includes(m));
}

/**
 * Validates a parsed model reply against the sources that were actually retrieved.
 * - citations must be ids of retrieved sources; others are removed;
 * - a "textbook" or "derived" block without a remaining citation becomes "unverified";
 * - a quotation must appear word for word in the cited source (whitespace and quote marks normalised); otherwise it is dropped;
 *   quoted spans inside block text that aren't in any source lose their quote marks so they aren't presented as quotations;
 * - a page number that isn't the printed page of a cited source makes the block "unverified";
 * - "check" blocks are always labelled as AI-made practice.
 */
export function validateExplanation(raw: Record<string, unknown> | null, sources: GroundSource[]): AiExplanation {
  const reject: AiExplanation = { status: "rejected", blocks: [], quotes: [] };
  if (!raw) return reject;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const corpus = sources.map((s) => norm(s.text));
  const checks = { droppedCites: 0, droppedQuotes: 0, unverifiedBlocks: 0, pageMentions: 0, weakSupport: 0, policy: 0 };
  if (policyViolation(JSON.stringify(raw))) return { status: "rejected", blocks: [], quotes: [], checks: { ...checks, policy: 1 } };
  if (raw.insufficient === true) return { status: "insufficient", blocks: [], quotes: [], checks };
  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks.slice(0, 14) : [];
  const blocks: AiBlock[] = [];
  for (const b of rawBlocks) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const role = ROLES.includes(o.role as BlockRole) ? (o.role as BlockRole) : null;
    let text = typeof o.text === "string" ? o.text.normalize("NFC").trim().slice(0, 1500) : "";
    if (!role || !text) continue;
    const given = Array.isArray(o.cites) ? o.cites.map((c) => Number(c)).filter((n) => Number.isInteger(n)) : [];
    const cites = [...new Set(given.filter((c) => byId.has(c)))];
    checks.droppedCites += new Set(given).size - cites.length;
    let basis: Basis = o.basis === "textbook" || o.basis === "derived" || o.basis === "general" ? o.basis : "general";
    if (role === "check") basis = "practice";
    // Quoted spans must exist in a retrieved source, or they stop looking like quotations.
    text = text.replace(/[“”«»]/g, '"').replace(QUOTED, (m, inner: string) => {
      if (corpus.some((c) => c.includes(norm(inner)))) return m;
      checks.droppedQuotes++;
      return inner;
    });
    // Page numbers may only be the printed pages of the sources this block cites.
    const allowed = new Set(cites.map((c) => byId.get(c)?.printedPage).filter((p): p is number => p !== null && p !== undefined));
    let badPage = false;
    for (const m of text.matchAll(PAGE)) if (!allowed.has(Number(ascii(m[1])))) badPage = true;
    if (badPage) checks.pageMentions++;
    if ((basis === "textbook" || basis === "derived") && (!cites.length || badPage)) basis = "unverified";
    else if (badPage) basis = "unverified";
    // A citation must support the statement, not just point at a real book.
    if (basis === "textbook" || basis === "derived") {
      const r = supportRatio(text, cites.map((c) => byId.get(c)!.text));
      if (r !== null && basis === "textbook" && r < SUPPORT_TEXTBOOK) { basis = r >= SUPPORT_DERIVED ? "derived" : "unverified"; checks.weakSupport++; }
      else if (r !== null && basis === "derived" && r < SUPPORT_DERIVED) { basis = "unverified"; checks.weakSupport++; }
    }
    if (basis === "unverified") checks.unverifiedBlocks++;
    blocks.push({ role, text, basis, cites: role === "check" ? [] : cites });
  }
  const quotes: AiQuote[] = [];
  for (const q of Array.isArray(raw.quotes) ? raw.quotes.slice(0, 6) : []) {
    const o = (q ?? {}) as Record<string, unknown>;
    const id = Number(o.source ?? o.passageId);
    const text = typeof o.text === "string" ? o.text.normalize("NFC").trim() : "";
    const src = byId.get(id);
    if (!src || [...text].length < 8 || !norm(src.text).includes(norm(text))) { checks.droppedQuotes++; continue; }
    quotes.push({ passageId: id, text });
  }
  if (!blocks.some((b) => b.role === "direct")) return { ...reject, checks };
  // Too many corrections means the model ignored the sources; show nothing generated rather than a patched answer.
  if (checks.droppedCites + checks.droppedQuotes + checks.pageMentions >= 4) return { ...reject, checks };
  const grounded = blocks.some((b) => (b.basis === "textbook" || b.basis === "derived") && b.cites.length > 0);
  if (!grounded) return { status: "insufficient", blocks: [], quotes: [], checks };
  return { status: "ok", blocks, quotes, checks };
}
