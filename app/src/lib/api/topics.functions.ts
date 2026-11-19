// TopicWise: topics inside chapters, with five separate coverage dimensions per topic (never one blended percentage):
// curriculum coverage (does checked material exist?), learning coverage (has the student opened it?), assessment
// coverage (has the student answered its questions?), mastery evidence (the mastery rule), revision status (due items).
// Students see only topics an admin checked or a teacher reviewed. Admins create and review topics here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { currentUser, sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { requireAdmin } from "../curriculum/admin.server";
import { STUDENT_VISIBLE } from "../curriculum/retrieval.server";
import { audit } from "../learning/engine.server";
import { topicState } from "../learning/quiz";
import { masteryStatus } from "../learning/rules";

type Fail = { ok: false; code: string; detail?: string };
const fail = (code: string, detail?: string): Fail => ({ ok: false, code, detail });
const now = () => new Date().toISOString();
type D1 = NonNullable<ReturnType<typeof bindings>["DB"]>;

type TopicRow = { id: string; chapter_id: string; position: number; title: string; title_en: string | null; skill: string | null; source_passage_id: number | null; printed_page: number | null; provenance: string; review_status: string; review_note: string | null; chapter_title: string; chapter_position: number; book_title: string; subject_key: string; textbook_id: string };
const TOPIC_SELECT = `SELECT tp.*, c.title AS chapter_title, c.position AS chapter_position, t.title AS book_title, t.subject_key, t.id AS textbook_id
  FROM topics tp JOIN chapters c ON c.id = tp.chapter_id JOIN textbooks t ON t.id = c.textbook_id`;

async function evidence(DB: D1, userId: string, topics: TopicRow[]) {
  if (!topics.length) return [];
  const chapterIds = [...new Set(topics.map((t) => t.chapter_id))];
  const marks = chapterIds.map(() => "?").join(",");
  const [qs, att, due, opened, material] = await Promise.all([
    DB.prepare(`SELECT id, chapter_id, skill FROM questions WHERE status = 'published' AND chapter_id IN (${marks})`).bind(...chapterIds).all<{ id: string; chapter_id: string; skill: string | null }>(),
    DB.prepare(`SELECT question_id, correct, created_at, mode FROM attempts WHERE user_id = ? AND chapter_id IN (${marks})`).bind(userId, ...chapterIds).all<{ question_id: string; correct: number; created_at: string; mode: string }>(),
    DB.prepare(`SELECT question_id FROM review_state WHERE user_id = ? AND due_at <= ?`).bind(userId, now()).all<{ question_id: string }>(),
    DB.prepare(`SELECT chapter_id FROM chapter_activity WHERE user_id = ? AND chapter_id IN (${marks})`).bind(userId, ...chapterIds).all<{ chapter_id: string }>(),
    DB.prepare(`SELECT p.id FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE p.id IN (${topics.map(() => "?").join(",")}) AND ${STUDENT_VISIBLE}`).bind(...topics.map((t) => t.source_passage_id ?? -1)).all<{ id: number }>(),
  ]);
  const dueSet = new Set((due.results ?? []).map((r) => r.question_id));
  const openedSet = new Set((opened.results ?? []).map((r) => r.chapter_id));
  const visible = new Set((material.results ?? []).map((r) => r.id));
  return topics.map((t) => {
    const qids = new Set((qs.results ?? []).filter((q) => q.chapter_id === t.chapter_id && t.skill && q.skill === t.skill).map((q) => q.id));
    const a = (att.results ?? []).filter((x) => qids.has(x.question_id));
    const dueN = [...qids].filter((q) => dueSet.has(q)).length;
    const hasMaterial = t.source_passage_id !== null && visible.has(t.source_passage_id);
    const m = masteryStatus(a);
    return {
      id: t.id, title: t.title, titleEn: t.title_en, chapterId: t.chapter_id, chapterTitle: t.chapter_title, chapterPosition: t.chapter_position, bookTitle: t.book_title, subjectKey: t.subject_key,
      reviewStatus: t.review_status, provenance: t.provenance, printedPage: t.printed_page, sourcePassageId: t.source_passage_id, skill: t.skill,
      coverage: {
        material: hasMaterial,            // 1. curriculum coverage: checked textbook text students may see
        questions: qids.size,             // practice available
        opened: openedSet.has(t.chapter_id), // 2. learning coverage
        answered: a.length,               // 3. assessment coverage
        distinctQuestions: m.distinct,
        distinctCorrect: m.distinctCorrect,
        recentRate: a.length ? m.recentRate : null,
        due: dueN,                        // 5. revision status
      },
      state: topicState({ hasMaterial, hasQuestions: qids.size > 0, opened: openedSet.has(t.chapter_id), attempts: a, due: dueN }), // 4. mastery evidence
    };
  });
}

export const listTopics = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  const me = await currentUser();
  if (!DB || !me) return fail("signed_out");
  const rows = (await DB.prepare(`${TOPIC_SELECT} WHERE tp.review_status IN ('checked', 'teacher_reviewed') ORDER BY t.subject_key, c.position, tp.position`).all<TopicRow>()).results ?? [];
  // Chapters that have published questions but no reviewed topic: shown honestly as "topics not yet defined".
  const gaps = (await DB.prepare(`SELECT c.id, c.title, c.position, t.subject_key, COUNT(q.id) AS n,
      SUM(CASE WHEN q.skill IS NULL OR q.skill NOT IN (SELECT skill FROM topics WHERE chapter_id = c.id AND skill IS NOT NULL AND review_status IN ('checked', 'teacher_reviewed')) THEN 1 ELSE 0 END) AS unlinked
    FROM questions q JOIN chapters c ON c.id = q.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE q.status = 'published' GROUP BY c.id`).all<{ id: string; title: string; position: number; subject_key: string; n: number; unlinked: number }>()).results ?? [];
  const chapters = (await DB.prepare("SELECT COUNT(*) AS n FROM chapters").first<{ n: number }>())?.n ?? 0;
  const withTopics = new Set(rows.map((r) => r.chapter_id)).size;
  return { ok: true as const, topics: await evidence(DB, me.id, rows), unlinked: gaps.filter((g) => g.unlinked > 0), chapters, chaptersWithTopics: withTopics };
});

export const getTopic = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    const me = await currentUser();
    if (!DB || !me) return fail("signed_out");
    const t = await DB.prepare(`${TOPIC_SELECT} WHERE tp.id = ? AND tp.review_status IN ('checked', 'teacher_reviewed')`).bind(data.id).first<TopicRow>();
    if (!t) return fail("not_found");
    const [ev] = await evidence(DB, me.id, [t]);
    const [objectives, passage, history] = await Promise.all([
      DB.prepare("SELECT text, source_page FROM objectives WHERE chapter_id = ? ORDER BY position").bind(t.chapter_id).all<{ text: string; source_page: number | null }>(),
      t.source_passage_id ? DB.prepare(`SELECT p.id, p.text, p.page, p.review_status, t.page_offset, t.title, t.language, t.license_status FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE p.id = ? AND ${STUDENT_VISIBLE}`).bind(t.source_passage_id).first<{ id: number; text: string; page: number; review_status: string | null; page_offset: number | null; title: string; language: string; license_status: string }>() : Promise.resolve(null),
      t.skill ? DB.prepare("SELECT a.correct, a.created_at, a.mode, a.misconception FROM attempts a JOIN questions q ON q.id = a.question_id WHERE a.user_id = ? AND q.chapter_id = ? AND q.skill = ? ORDER BY a.id DESC LIMIT 20").bind(me.id, t.chapter_id, t.skill).all<{ correct: number; created_at: string; mode: string; misconception: string | null }>() : Promise.resolve({ results: [] }),
    ]);
    const offset = (await DB.prepare("SELECT page_offset FROM textbooks WHERE id = ?").bind(t.textbook_id).first<{ page_offset: number | null }>())?.page_offset ?? null;
    return {
      ok: true as const,
      topic: ev,
      objectives: (objectives.results ?? []).map((o) => ({ text: o.text, printedPage: o.source_page !== null && offset !== null ? o.source_page - offset : null })),
      passage: passage ? { id: passage.id, text: passage.text, pdfPage: passage.page, printedPage: passage.page_offset !== null ? passage.page - passage.page_offset : null, reviewStatus: passage.review_status, book: passage.title, language: passage.language, license: passage.license_status } : null,
      history: history.results ?? [],
    };
  });

/* ─────────── Admin: create and review topics ─────────── */

async function adminGuard() {
  const { DB } = bindings();
  if (!DB) return { error: fail("unavailable_now") } as const;
  if (!sameOrigin()) return { error: fail("bad_origin") } as const;
  const admin = await requireAdmin();
  if (!admin) return { error: fail("not_admin") } as const;
  return { DB, admin, error: null } as const;
}

export const adminTopics = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await adminGuard();
    if (g.error) return g.error;
    const [topics, skills] = await Promise.all([
      g.DB.prepare(`${TOPIC_SELECT} WHERE tp.chapter_id = ? ORDER BY tp.position`).bind(data.chapterId).all<TopicRow>(),
      g.DB.prepare("SELECT skill, COUNT(*) AS n FROM questions WHERE chapter_id = ? AND status = 'published' AND skill IS NOT NULL GROUP BY skill").bind(data.chapterId).all<{ skill: string; n: number }>(),
    ]);
    return { ok: true as const, topics: topics.results ?? [], skills: skills.results ?? [] };
  });

export const saveTopic = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid().nullable(),
    chapterId: z.string().uuid(),
    title: z.string().min(2).max(120),
    titleEn: z.string().max(120).nullable(),
    skill: z.string().max(40).nullable(),
    sourcePassageId: z.number().int().positive().nullable(),
    provenance: z.string().min(5).max(300),
  }))
  .handler(async ({ data }) => {
    const g = await adminGuard();
    if (g.error) return g.error;
    if (data.sourcePassageId) {
      const p = await g.DB.prepare("SELECT p.id FROM passages p JOIN chapters c ON c.textbook_id = p.textbook_id AND p.page BETWEEN c.start_page AND c.end_page WHERE p.id = ? AND c.id = ?").bind(data.sourcePassageId, data.chapterId).first();
      if (!p) return fail("passage_not_in_chapter", "That passage isn't inside this chapter's pages.");
    }
    const ts = now();
    const title = data.title.normalize("NFC").trim();
    try {
      if (data.id) {
        // Any edit returns the topic to draft: it has to be reviewed again before students see it.
        await g.DB.prepare("UPDATE topics SET title = ?, title_en = ?, skill = ?, source_passage_id = ?, provenance = ?, review_status = 'draft', reviewed_by = NULL, reviewed_at = NULL WHERE id = ? AND chapter_id = ?")
          .bind(title, data.titleEn, data.skill, data.sourcePassageId, data.provenance, data.id, data.chapterId).run();
      } else {
        const pos = (await g.DB.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS n FROM topics WHERE chapter_id = ?").bind(data.chapterId).first<{ n: number }>())?.n ?? 1;
        await g.DB.prepare("INSERT INTO topics (id, chapter_id, position, title, title_en, skill, source_passage_id, provenance, review_status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)")
          .bind(crypto.randomUUID(), data.chapterId, pos, title, data.titleEn, data.skill, data.sourcePassageId, data.provenance, g.admin.id, ts).run();
      }
    } catch {
      return fail("duplicate_topic", "This chapter already has a topic with that title.");
    }
    await audit(g.DB, g.admin.id, data.id ? "topic_edited" : "topic_created", data.chapterId, { title });
    return { ok: true as const };
  });

export const reviewTopic = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["checked", "teacher_reviewed", "rejected", "draft"]), confirmed: z.boolean().default(false), teacherName: z.string().max(80).nullable().default(null), note: z.string().max(300).nullable().default(null) }))
  .handler(async ({ data }) => {
    const g = await adminGuard();
    if (g.error) return g.error;
    const t = await g.DB.prepare("SELECT review_status FROM topics WHERE id = ?").bind(data.id).first<{ review_status: string }>();
    if (!t) return fail("not_found");
    if (data.status === "checked" && !data.confirmed) return fail("confirm_required", "Confirm the topic title appears in the book (heading, contents page or checked passage).");
    if (data.status === "teacher_reviewed" && (data.teacherName?.trim().length ?? 0) < 2) return fail("teacher_name_required", "Record the name of the teacher who reviewed it.");
    if (data.status === "teacher_reviewed" && t.review_status !== "checked") return fail("must_be_checked_first");
    if (data.status === "rejected" && !data.note?.trim()) return fail("note_required", "Say why it is rejected.");
    const note = data.status === "teacher_reviewed" ? `Teacher: ${data.teacherName!.trim()}${data.note ? ` — ${data.note}` : ""}` : data.note;
    await g.DB.prepare("UPDATE topics SET review_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?").bind(data.status, note, g.admin.id, now(), data.id).run();
    await audit(g.DB, g.admin.id, `topic_${data.status}`, `topic:${data.id}`, { from: t.review_status });
    return { ok: true as const };
  });
