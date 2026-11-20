// IntelliCore cross-checking rules (pure, deterministic, unit-tested). The orchestrator calls models; this module decides
// what to do with their output. Models are reasoning engines, not sources of curriculum truth: nothing here promotes a
// claim because models agree. A claim survives only if the textbook evidence or an exact calculation supports it.
import { checkWorking } from "../tutor/working";
import type { AiBlock } from "./grounding";
import { SUPPORT_TEXTBOOK, supportRatio, type GroundSource } from "./grounding";
import type { ProviderId } from "./providers";

/* ─────────── Tasks and routing ─────────── */

export const TASKS = ["tutoring", "conceptual", "math", "image_homework", "translation", "socratic", "mcq_generation", "high_impact", "explain_back"] as const;
export type Task = (typeof TASKS)[number];
export type Strategy = "primary" | "verify" | "collaborate";
export type Route = { task: Task; strategy: Strategy; order: ProviderId[]; verifiers: ProviderId[]; independent: ProviderId | null; vision: boolean; reason: string };

/**
 * Default routing, taken from the product brief's task table. It is a starting point, not a measured result: the owner
 * can override any task with the AI_ROUTING secret (JSON) once the real-provider evaluation has been run.
 */
export const DEFAULT_ROUTES: Record<Task, { strategy: Strategy; order: ProviderId[]; verifiers?: ProviderId[]; independent?: ProviderId; vision?: boolean }> = {
  tutoring: { strategy: "primary", order: ["anthropic", "openai", "gemini"] },
  conceptual: { strategy: "verify", order: ["anthropic", "openai", "gemini"], verifiers: ["openai", "gemini"] },
  math: { strategy: "verify", order: ["anthropic", "openai", "gemini"], verifiers: ["gemini", "openai"] },
  image_homework: { strategy: "primary", order: ["gemini", "openai", "anthropic"], vision: true },
  translation: { strategy: "verify", order: ["anthropic", "gemini", "openai"], verifiers: ["gemini", "openai"] },
  socratic: { strategy: "primary", order: ["anthropic", "openai", "gemini"] },
  mcq_generation: { strategy: "primary", order: ["openai", "anthropic", "gemini"] },
  high_impact: { strategy: "collaborate", order: ["anthropic", "openai", "gemini"], independent: "gemini", verifiers: ["openai", "gemini"] },
  explain_back: { strategy: "primary", order: ["anthropic", "openai", "gemini"] },
};

export type RoutingPolicy = { verify: "off" | "auto" | "always"; collaborate: "off" | "auto"; overrides: Partial<Record<Task, { strategy?: Strategy; order?: ProviderId[]; verifiers?: ProviderId[]; independent?: ProviderId }>> };

const PIDS: ProviderId[] = ["anthropic", "gemini", "openai", "groq", "openrouter"];
const isPid = (x: unknown): x is ProviderId => typeof x === "string" && (PIDS as string[]).includes(x);

export function routingPolicy(env: Record<string, string | undefined>): RoutingPolicy {
  const v = (env.AI_VERIFY ?? "auto").trim().toLowerCase();
  const c = (env.AI_COLLABORATE ?? "auto").trim().toLowerCase();
  let overrides: RoutingPolicy["overrides"] = {};
  try {
    const j = env.AI_ROUTING ? JSON.parse(env.AI_ROUTING) : null;
    if (j && typeof j === "object") {
      for (const [k, val] of Object.entries(j as Record<string, Record<string, unknown>>)) {
        if (!(TASKS as readonly string[]).includes(k) || !val || typeof val !== "object") continue;
        const o: { strategy?: Strategy; order?: ProviderId[]; verifiers?: ProviderId[]; independent?: ProviderId } = {};
        if (val.strategy === "primary" || val.strategy === "verify" || val.strategy === "collaborate") o.strategy = val.strategy;
        if (Array.isArray(val.order)) o.order = val.order.filter(isPid);
        if (Array.isArray(val.verifiers)) o.verifiers = val.verifiers.filter(isPid);
        if (isPid(val.independent)) o.independent = val.independent;
        overrides[k as Task] = o;
      }
    }
  } catch {
    overrides = {};
  }
  return { verify: v === "off" || v === "always" ? v : "auto", collaborate: c === "off" ? "off" : "auto", overrides };
}

const MATHY = /[0-9০-৯]\s*[+\-−×÷*/:=^]\s*[0-9০-৯(]|\\frac|\$[^$]*[0-9]/;

export function classifyTask(input: { purpose: "explain" | "explain_back" | "question_gen" | "image_read"; question?: string; subjectKey?: string | null; persona?: string; style?: string | null; socratic?: boolean; evidence?: "sufficient" | "partial"; explanationLang?: "bn" | "en" | "mixed"; sourceLangs?: ("bn" | "en")[]; followUp?: boolean }): { task: Task; reason: string } {
  if (input.purpose === "image_read") return { task: "image_homework", reason: "a photo of homework needs a vision-capable model" };
  if (input.purpose === "question_gen") return { task: "mcq_generation", reason: "practice-question drafting, checked for answer and source afterwards" };
  if (input.purpose === "explain_back") return { task: "explain_back", reason: "checking a student's own explanation against key ideas" };
  const q = input.question ?? "";
  if (input.persona === "exam" || input.style === "exam" || input.evidence === "partial") return { task: "high_impact", reason: input.evidence === "partial" ? "the textbook only partly covers this, so the answer is checked independently" : "an exam-style answer is high impact" };
  if (MATHY.test(q) && (input.subjectKey === "mathematics" || input.subjectKey === null || input.subjectKey === undefined)) return { task: "math", reason: "mathematics: one model reasons, another checks, and the arithmetic is recalculated exactly" };
  if (input.socratic || input.persona === "socratic") return { task: "socratic", reason: "guided Socratic questioning" };
  const src = input.sourceLangs ?? [];
  if (input.explanationLang && input.explanationLang !== "mixed" && src.length && src.some((l) => l !== input.explanationLang)) return { task: "translation", reason: "the explanation is in a different language from the textbook, so meaning is checked" };
  if (input.explanationLang === "mixed" && src.length) return { task: "translation", reason: "mixed-language explanation of the textbook, so meaning is checked" };
  if (input.followUp) return { task: "tutoring", reason: "a follow-up in an ongoing conversation" };
  return { task: "conceptual", reason: "a curriculum explanation" };
}

/** Chooses the providers for a task from those actually configured. Vision tasks never fall back to a text-only model. */
export function route(task: Task, configured: { id: ProviderId; vision: boolean }[], policy: RoutingPolicy, reason = ""): Route | null {
  const base = DEFAULT_ROUTES[task];
  const ov = policy.overrides[task] ?? {};
  const vision = !!base.vision;
  const usable = configured.filter((c) => !vision || c.vision).map((c) => c.id);
  const pref = (ov.order?.length ? ov.order : base.order).filter((p, i, a) => a.indexOf(p) === i);
  const order = [...pref.filter((p) => usable.includes(p)), ...usable.filter((p) => !pref.includes(p))];
  if (!order.length) return null;
  let strategy: Strategy = ov.strategy ?? base.strategy;
  if (policy.verify === "always" && strategy === "primary" && !vision && task !== "mcq_generation") strategy = "verify";
  if (policy.verify === "off" && strategy === "verify") strategy = "primary";
  if (strategy === "collaborate" && policy.collaborate === "off") strategy = policy.verify === "off" ? "primary" : "verify";
  const others = (list: ProviderId[] | undefined) => (list ?? []).filter((p) => usable.includes(p) && p !== order[0]);
  let verifiers = others(ov.verifiers ?? base.verifiers);
  if (!verifiers.length) verifiers = usable.filter((p) => p !== order[0]);
  let independent: ProviderId | null = null;
  if (strategy === "collaborate") {
    const want = ov.independent ?? base.independent;
    independent = want && usable.includes(want) && want !== order[0] ? want : usable.find((p) => p !== order[0]) ?? null;
    verifiers = verifiers.filter((p) => p !== independent);
    // Three different providers are needed to collaborate; with two, it becomes independent verification.
    if (!independent || !verifiers.length) { strategy = "verify"; verifiers = usable.filter((p) => p !== order[0]); independent = null; }
  }
  if (strategy === "verify" && !verifiers.length) strategy = "primary";
  if (strategy === "primary") verifiers = [];
  return { task, strategy, order, verifiers, independent, vision, reason };
}

/* ─────────── Exact arithmetic checks ─────────── */

const LATEX: [RegExp, string][] = [
  [/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)"],
  [/\\times/g, "×"], [/\\cdot/g, "×"], [/\\div/g, "÷"], [/\\left|\\right/g, ""], [/\$/g, " "],
];
const EQ = /[0-9০-৯(][0-9০-৯\s.+\-−×÷*/:()]*=[0-9০-৯\s.+\-−×÷*/:()=]*[0-9০-৯)]/g;

/** Every arithmetic statement in a text ("৫ : ৩ = ১০ : ৬", "3/4 × 8 = 6") that an exact recalculation shows is false. */
export function arithmeticErrors(text: string): string[] {
  let t = text.normalize("NFC");
  for (const [re, to] of LATEX) t = t.replace(re, to);
  t = t.replace(/−/g, "-");
  const bad: string[] = [];
  for (const m of t.matchAll(EQ)) {
    const stmt = m[0].trim();
    if (!/[+\-×÷*/:]/.test(stmt)) continue; // "= 5" alone says nothing checkable
    const r = checkWorking(stmt);
    if (r.steps.some((s) => s.status === "wrong")) bad.push(stmt);
  }
  return bad;
}

/* ─────────── Verdicts and the coordinator ─────────── */

export type Verdict = "supported" | "unsupported" | "contradicted" | "math_error" | "not_applicable";
export type BlockVerdict = { block: number; verdict: Verdict; note: string; by: ProviderId };
export type Conflict = { block: number; description: string; evidence: "supports_draft" | "supports_other" | "unclear"; by: ProviderId };

export function parseVerdicts(raw: Record<string, unknown> | null, blockCount: number, by: ProviderId): { verdicts: BlockVerdict[]; conflicts: Conflict[]; meaningPreserved: boolean | null } | null {
  if (!raw || !Array.isArray(raw.verdicts)) return null;
  const V: Verdict[] = ["supported", "unsupported", "contradicted", "math_error", "not_applicable"];
  const verdicts: BlockVerdict[] = [];
  for (const v of raw.verdicts.slice(0, 20)) {
    const o = (v ?? {}) as Record<string, unknown>;
    const block = Number(o.block);
    if (!Number.isInteger(block) || block < 0 || block >= blockCount) continue;
    const verdict = V.includes(o.verdict as Verdict) ? (o.verdict as Verdict) : null;
    if (!verdict) continue;
    verdicts.push({ block, verdict, note: typeof o.note === "string" ? o.note.slice(0, 300) : "", by });
  }
  const conflicts: Conflict[] = [];
  for (const c of Array.isArray(raw.conflicts) ? raw.conflicts.slice(0, 10) : []) {
    const o = (c ?? {}) as Record<string, unknown>;
    const block = Number(o.block);
    if (!Number.isInteger(block) || block < 0 || block >= blockCount) continue;
    const ev = o.evidence === "supports_draft" || o.evidence === "supports_other" ? o.evidence : "unclear";
    conflicts.push({ block, description: typeof o.description === "string" ? o.description.slice(0, 300) : "", evidence: ev, by });
  }
  const mp = raw.meaning_preserved;
  return { verdicts, conflicts, meaningPreserved: mp === true ? true : mp === false ? false : null };
}

export type Resolution = {
  blocks: AiBlock[];
  withheld: boolean;
  removed: { block: number; reason: "arithmetic" | "contradicted" | "math_error" | "conflict" | "meaning" }[];
  downgraded: number[];
  disagreements: number;
  issues: string[];
};

/**
 * The coordinator. Inputs: the validated draft, reviewer verdicts, conflicts between the draft and an independent answer,
 * and the textbook sources. Rules, in order:
 *  1. An exact recalculation that fails removes the block. No model can overrule arithmetic.
 *  2. A block a reviewer calls contradicted or a maths error, or that conflicts with the independent answer without the
 *     reviewer finding that the evidence supports the draft, is removed unless the cited textbook text itself supports it
 *     (word-level support at the "from the textbook" threshold). Agreement between models never keeps a block.
 *  3. A block a reviewer calls unsupported keeps its words but loses its textbook label unless the evidence supports it.
 *  4. If the direct answer is removed, the whole AI explanation is withheld: the student sees the textbook excerpts
 *     and the disagreement goes to human review. Majority vote is never used.
 */
export function coordinate(draft: AiBlock[], sources: GroundSource[], verdicts: BlockVerdict[], conflicts: Conflict[], meaningPreserved: boolean | null = null): Resolution {
  const byId = new Map(sources.map((s) => [s.id, s.text]));
  const evidenceSupports = (b: AiBlock) => {
    if (b.basis !== "textbook" || !b.cites.length) return false;
    const r = supportRatio(b.text, b.cites.map((c) => byId.get(c) ?? ""));
    return r !== null && r >= SUPPORT_TEXTBOOK;
  };
  const removed: Resolution["removed"] = [];
  const downgraded: number[] = [];
  const issues: string[] = [];
  const out: AiBlock[] = [];
  let disagreements = 0;
  draft.forEach((b, i) => {
    const arith = b.role === "check" ? [] : arithmeticErrors(b.text);
    if (arith.length) { removed.push({ block: i, reason: "arithmetic" }); issues.push(`Recalculation failed: ${arith[0]}`); return; }
    const mine = verdicts.filter((v) => v.block === i);
    const hard = mine.find((v) => v.verdict === "contradicted" || v.verdict === "math_error");
    const conflict = conflicts.find((c) => c.block === i && c.evidence !== "supports_draft");
    if (hard || conflict) disagreements++;
    if ((hard || conflict) && !evidenceSupports(b)) {
      removed.push({ block: i, reason: hard ? (hard.verdict === "math_error" ? "math_error" : "contradicted") : "conflict" });
      issues.push(hard ? `${hard.by}: ${hard.note || hard.verdict}` : `${conflict!.by}: ${conflict!.description || "independent answer disagrees"}`);
      return;
    }
    if (mine.some((v) => v.verdict === "unsupported") && (b.basis === "textbook" || b.basis === "derived") && !evidenceSupports(b)) {
      downgraded.push(i);
      out.push({ ...b, basis: "unverified" });
      return;
    }
    out.push(b);
  });
  // A translated explanation whose meaning a reviewer says changed is not shown.
  if (meaningPreserved === false) {
    disagreements++;
    issues.push("A reviewer found the explanation changes the textbook's meaning.");
    return { blocks: [], withheld: true, removed: draft.map((_, i) => ({ block: i, reason: "meaning" as const })), downgraded, disagreements, issues };
  }
  const directKept = out.some((b) => b.role === "direct");
  return { blocks: directKept ? out : [], withheld: !directKept, removed, downgraded, disagreements, issues };
}

/* ─────────── How sure the app is (calibrated from checks, never from model confidence) ─────────── */

export type Assurance = { level: "checked_twice" | "checked" | "limited"; reasons: string[] };

export function assurance(input: { evidence: "sufficient" | "partial"; corrections: number; strategy: Strategy; verified: boolean; verifyFailed: boolean; downgraded: number; removed: number; arithmeticChecked: boolean }): Assurance {
  const reasons: string[] = [];
  if (input.evidence === "partial") reasons.push("partial_evidence");
  if (input.corrections > 0) reasons.push("corrected");
  if (input.removed > 0) reasons.push("removed_parts");
  if (input.downgraded > 0) reasons.push("downgraded_parts");
  if (input.verifyFailed) reasons.push("second_check_unavailable");
  if (input.arithmeticChecked) reasons.push("arithmetic_recalculated");
  const clean = input.evidence === "sufficient" && input.corrections === 0 && input.removed === 0 && input.downgraded === 0;
  if (input.verified && clean) return { level: "checked_twice", reasons: [...reasons, "independent_check_passed"] };
  if (clean && !input.verifyFailed) return { level: "checked", reasons };
  return { level: "limited", reasons };
}
