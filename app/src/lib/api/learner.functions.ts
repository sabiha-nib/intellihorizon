import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bindings } from "../bindings.server";
import { sameOrigin } from "../auth/session.server";
import { ensureLearner, forgetLearner, loadState } from "../learner.server";

export const getLearnerState = createServerFn({ method: "GET" }).handler(async () => {
  return loadState();
});

const evidenceInput = z.object({
  concept: z.string().regex(/^[a-z0-9.-]{1,40}$/),
  kind: z.enum(["probe", "trial", "explain", "revise", "challenge", "exam", "lab"]),
  item: z.string().regex(/^[a-z0-9.-]{1,60}$/),
  correct: z.boolean(),
  confidence: z.number().int().min(1).max(3),
  misconception: z.string().regex(/^[a-z0-9-]{1,40}$/).nullable().optional(),
  // Only short machine tags are stored (idea ids, disguise names). Never free text.
  detail: z.string().regex(/^[a-z0-9,.-]{0,200}$/).nullable().optional(),
});

export const recordEvidence = createServerFn({ method: "POST" })
  .inputValidator(evidenceInput)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!sameOrigin()) return { ok: false as const, id: 0, created_at: new Date().toISOString() };
    const id = await ensureLearner();
    if (!DB || !id) return { ok: false as const, id: 0, created_at: new Date().toISOString() };
    const created = new Date().toISOString();
    const res = await DB.prepare(
      "INSERT INTO evidence (learner_id, concept, kind, item, correct, confidence, misconception, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        data.concept,
        data.kind,
        data.item,
        data.correct ? 1 : 0,
        data.confidence,
        data.misconception ?? null,
        data.detail ?? null,
        created,
      )
      .run();
    return { ok: true as const, id: Number(res.meta?.last_row_id ?? 0), created_at: created };
  });

const prefsInput = z.object({
  lang: z.enum(["en", "bn"]).optional(),
  grade: z.number().int().min(6).max(10).nullable().optional(),
  medium: z.enum(["bangla", "english"]).nullable().optional(),
  style: z.enum(["visual", "story", "steps", "analogy"]).optional(),
  share_teacher: z.boolean().optional(),
  share_family: z.boolean().optional(),
  onboarded: z.boolean().optional(),
});

export const savePrefs = createServerFn({ method: "POST" })
  .inputValidator(prefsInput)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!sameOrigin()) return { ok: false };
    const id = await ensureLearner();
    if (!DB || !id) return { ok: false };
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    const push = (col: string, v: string | number | null) => {
      sets.push(`${col} = ?`);
      vals.push(v);
    };
    if (data.lang !== undefined) push("lang", data.lang);
    if (data.grade !== undefined) push("grade", data.grade);
    if (data.medium !== undefined) push("medium", data.medium);
    if (data.style !== undefined) push("style", data.style);
    if (data.share_teacher !== undefined) push("share_teacher", data.share_teacher ? 1 : 0);
    if (data.share_family !== undefined) push("share_family", data.share_family ? 1 : 0);
    if (data.onboarded !== undefined) push("onboarded", data.onboarded ? 1 : 0);
    if (sets.length === 0) return { ok: true };
    await DB.prepare(`UPDATE learners SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...vals, id)
      .run();
    return { ok: true };
  });

export const forgetMe = createServerFn({ method: "POST" }).handler(async () => {
  if (!sameOrigin()) return { ok: false };
  await forgetLearner();
  return { ok: true };
});
