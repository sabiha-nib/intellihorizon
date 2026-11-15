import { FALL } from "./fall";
import { SHARE } from "./share";
import { TREE } from "./tree";
import type { LessonPack, Misconception } from "./types";

export const PACKS: Record<string, LessonPack> = { fall: FALL, share: SHARE, tree: TREE };

export function findMisconception(concept: string, id: string | null | undefined): Misconception | undefined {
  if (!id) return undefined;
  return PACKS[concept]?.misconceptions.find((m) => m.id === id);
}
