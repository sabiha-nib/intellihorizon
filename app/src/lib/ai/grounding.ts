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
  checks?: { droppedCites: number; droppedQuotes: number; unverifiedBlocks: number; pageMentions: number };
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
  const checks = { droppedCites: 0, droppedQuotes: 0, unverifiedBlocks: 0, pageMentions: 0 };
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
