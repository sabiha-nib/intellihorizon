export type L = { en: string; bn: string };
export type Lang = "en" | "bn";
export type SubjectId = "math" | "physics" | "chemistry" | "biology" | "english" | "bangla" | "ict" | "social";
export type Style = "visual" | "story" | "steps" | "analogy";
export type Disguise = "context" | "representation" | "language" | "reverse";

export type Option = {
  id: string;
  text: L;
  correct?: boolean;
  misconception?: string;
  /** optional mini-graph: polylines in a 0..100 box (x right, y up) */
  graph?: { pts: [number, number][]; label?: string }[];
  /** optional number line marker position in 0..2 */
  mark?: number;
};

export type Question = {
  id: string;
  concept: string;
  kind: "probe" | "trial" | "exam";
  disguise?: Disguise;
  prompt: L;
  options: Option[];
  explain: L;
  source?: "verified" | "historical" | "generated";
};

export type Misconception = { id: string; name: L; looksLike: L; repair: Record<Style, L> };
export type Idea = { id: string; label: L; keys: string[]; rumiAsks: L };
export type Bridge = { to: string; text: L };

export type ConceptDef = {
  id: string;
  subject: SubjectId;
  title: L;
  nctb: L;
  route?: "/learn/fall" | "/learn/share" | "/learn/tree";
  hook?: L;
  preview?: L;
  prereqs: string[];
  bridges: Bridge[];
  at: [number, number];
};

export type LessonPack = {
  concept: string;
  ideas: Idea[];
  misconceptions: Misconception[];
  probe: Question[];
  trials: Question[];
  exam: Question[];
  rumiOpening: L;
};
