import { conceptById, PLAYABLE_IDS } from "../content/concepts";
import { findMisconception } from "../content/packs";
import type { L } from "../content/types";
import { emptyConcept, type ConceptModel } from "./model";

export type Phase = "wonder" | "explore" | "sense" | "teach" | "trials" | "then";

export type NextStep = { concept: string; phase: Phase; title: L; reason: L; to: string };

export function nextStep(model: Record<string, ConceptModel>): NextStep {
  const ids = [...PLAYABLE_IDS];
  const m = (id: string) => model[id] ?? emptyConcept(id);
  const route = (id: string) => conceptById(id)?.route ?? "/";

  for (const id of ids) {
    const c = m(id);
    if (c.activeMisconceptions.length > 0) {
      const mis = findMisconception(id, c.activeMisconceptions[0]);
      return {
        concept: id,
        phase: "sense",
        title: conceptById(id)!.title,
        reason: {
          en: `Last time, "${mis?.name.en ?? "an idea"}" showed up in your answers. Let's look at it from a different angle.`,
          bn: `গতবার তোমার উত্তরে "${mis?.name.bn ?? "একটি ধারণা"}" দেখা গেছে। চলো অন্যভাবে দেখি।`,
        },
        to: route(id),
      };
    }
  }
  for (const id of ids) {
    const c = m(id);
    if (c.glow === "fragile") {
      return {
        concept: id,
        phase: "trials",
        title: conceptById(id)!.title,
        reason: c.unsureRight > 0
          ? { en: "You answered correctly while unsure. A disguise test will show whether the idea really holds.", bn: "তুমি অনিশ্চিত থেকেও সঠিক উত্তর দিয়েছ। ছদ্মবেশ পরীক্ষায় দেখা যাবে ধারণাটা সত্যিই টেকে কিনা।" }
          : { en: "Right answer, not yet tested in a new form. Let's put it in disguise.", bn: "সঠিক উত্তর, কিন্তু নতুন রূপে এখনো যাচাই হয়নি। চলো ছদ্মবেশ পরাই।" },
        to: route(id),
      };
    }
  }
  for (const id of ids) {
    const c = m(id);
    if (c.glow === "holding" || c.glow === "glimpsed") {
      return {
        concept: id,
        phase: c.glow === "holding" ? "trials" : "explore",
        title: conceptById(id)!.title,
        reason: c.glow === "holding"
          ? { en: `Your idea has survived ${c.disguises.length} of 4 disguises. Try the next one.`, bn: `তোমার ধারণা ৪টির মধ্যে ${c.disguises.length}টি ছদ্মবেশে টিকেছে। পরেরটা চেষ্টা করো।` }
          : { en: "You started this one. Pick up where you left off and explore it hands-on.", bn: "এটা তুমি শুরু করেছিলে। যেখানে থেমেছিলে সেখান থেকে হাতে-কলমে দেখো।" },
        to: route(id),
      };
    }
  }
  for (const id of ids) {
    const c = m(id);
    if (c.glow === "shapeshifter" && c.lastAt && Date.now() - Date.parse(c.lastAt) > 20 * 3600 * 1000) {
      return { concept: id, phase: "trials", title: conceptById(id)!.title, reason: { en: "A day has passed. Is this idea still there? One quick disguise will tell.", bn: "একদিন কেটে গেছে। ধারণাটা কি এখনো আছে? একটি ছদ্মবেশেই বোঝা যাবে।" }, to: route(id) };
    }
  }
  for (const id of ids) {
    if (m(id).glow === "unexplored") {
      return { concept: id, phase: "wonder", title: conceptById(id)!.title, reason: conceptById(id)!.hook!, to: route(id) };
    }
  }
  return { concept: "fall", phase: "trials", title: conceptById("fall")!.title, reason: { en: "All three open stars are lit. Revisit one tomorrow to make it durable.", bn: "তিনটি খোলা তারাই জ্বলছে। কাল একটিতে ফিরে এসে স্থায়ী করো।" }, to: "/learn/fall" };
}
