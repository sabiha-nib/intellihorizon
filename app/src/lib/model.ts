// Pure, shared learner-model logic. Runs on server and client.
// The model is an evolving ESTIMATE built only from observable evidence.

export type Prefs = {
  lang: "en" | "bn";
  grade: number | null;
  medium: "bangla" | "english" | null;
  style: "visual" | "story" | "steps" | "analogy";
  share_teacher: boolean;
  share_family: boolean;
  onboarded: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  lang: "en",
  grade: null,
  medium: null,
  style: "visual",
  share_teacher: false,
  share_family: false,
  onboarded: false,
};

export type EvidenceKind = "probe" | "trial" | "explain" | "revise" | "challenge" | "exam" | "lab";

export type EvidenceRow = {
  id: number;
  concept: string;
  kind: EvidenceKind;
  item: string;
  correct: number;
  confidence: number;
  misconception: string | null;
  detail: string | null;
  created_at: string;
};

export type Glow = "unexplored" | "glimpsed" | "fragile" | "holding" | "shapeshifter" | "durable";

export type ConceptModel = {
  concept: string;
  glow: Glow;
  attempts: number;
  correct: number;
  disguises: string[];
  activeMisconceptions: string[];
  repairedMisconceptions: string[];
  disputedMisconceptions: string[];
  confidentWrong: number;
  unsureRight: number;
  explained: boolean;
  ideas: string[];
  revised: boolean;
  firstAt: string | null;
  lastAt: string | null;
};

export const GLOW_ORDER: Glow[] = ["unexplored", "glimpsed", "fragile", "holding", "shapeshifter", "durable"];

function ts(s: string): number {
  const t = Date.parse(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? t : 0;
}

export function emptyConcept(concept: string): ConceptModel {
  return {
    concept,
    glow: "unexplored",
    attempts: 0,
    correct: 0,
    disguises: [],
    activeMisconceptions: [],
    repairedMisconceptions: [],
    disputedMisconceptions: [],
    confidentWrong: 0,
    unsureRight: 0,
    explained: false,
    ideas: [],
    revised: false,
    firstAt: null,
    lastAt: null,
  };
}

export function buildModel(rows: EvidenceRow[]): Record<string, ConceptModel> {
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  const out: Record<string, ConceptModel> = {};
  const lastSignal: Record<string, Record<string, number>> = {};
  const lastCorrect: Record<string, number> = {};
  const firstCorrectAt: Record<string, number> = {};
  const durableHit: Record<string, boolean> = {};

  for (const r of sorted) {
    const m = (out[r.concept] ??= emptyConcept(r.concept));
    const sig = (lastSignal[r.concept] ??= {});
    if (r.kind === "challenge") {
      if (r.item && !m.disputedMisconceptions.includes(r.item)) m.disputedMisconceptions.push(r.item);
      continue;
    }
    m.attempts += 1;
    m.firstAt ??= r.created_at;
    m.lastAt = r.created_at;
    const answerish = r.kind === "probe" || r.kind === "trial" || r.kind === "exam" || r.kind === "revise";
    if (r.kind === "explain") {
      if (r.correct) m.explained = true;
      for (const idea of (r.detail ?? "").split(",").filter(Boolean)) if (!m.ideas.includes(idea)) m.ideas.push(idea);
      continue;
    }
    if (r.kind === "revise" && r.correct) m.revised = true;
    if (!answerish) continue;
    if (r.correct) {
      m.correct += 1;
      lastCorrect[r.concept] = r.id;
      const t = ts(r.created_at);
      if (firstCorrectAt[r.concept] === undefined) firstCorrectAt[r.concept] = t;
      else if (t - firstCorrectAt[r.concept] > 20 * 3600 * 1000) durableHit[r.concept] = true;
      if (r.confidence <= 1) m.unsureRight += 1;
      if (r.kind === "trial" && r.detail && !m.disguises.includes(r.detail)) m.disguises.push(r.detail);
    } else {
      if (r.confidence >= 3) m.confidentWrong += 1;
      if (r.misconception) sig[r.misconception] = r.id;
    }
  }

  for (const [concept, m] of Object.entries(out)) {
    const sig = lastSignal[concept] ?? {};
    const lc = lastCorrect[concept] ?? -1;
    for (const [mis, at] of Object.entries(sig)) {
      if (m.disputedMisconceptions.includes(mis)) continue;
      if (at > lc) m.activeMisconceptions.push(mis);
      else m.repairedMisconceptions.push(mis);
    }
    const active = m.activeMisconceptions.length > 0;
    const d = m.disguises.length;
    if (m.attempts === 0) m.glow = "unexplored";
    else if (d >= 3 && durableHit[concept] && !active) m.glow = "durable";
    else if ((d >= 3 || (d >= 2 && m.explained)) && !active) m.glow = "shapeshifter";
    else if (m.correct > 0 && !active && (m.explained || d >= 1 || m.revised)) m.glow = "holding";
    else if (m.correct > 0) m.glow = "fragile";
    else m.glow = "glimpsed";
  }
  return out;
}

export function glowLevel(g: Glow): number {
  return GLOW_ORDER.indexOf(g);
}
