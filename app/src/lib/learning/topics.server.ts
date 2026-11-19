// Topic evidence shared by TopicWise, the Learning Twin, ExamArena and teacher/parent summaries (server only).
import { bindings } from "../bindings.server";
import { STUDENT_VISIBLE } from "../curriculum/retrieval.server";
import { topicState } from "./quiz";
import { masteryStatus } from "./rules";

const now = () => new Date().toISOString();
type D1 = NonNullable<ReturnType<typeof bindings>["DB"]>;

export type TopicRow = { id: string; chapter_id: string; position: number; title: string; title_en: string | null; skill: string | null; source_passage_id: number | null; printed_page: number | null; provenance: string; review_status: string; review_note: string | null; chapter_title: string; chapter_position: number; book_title: string; subject_key: string; textbook_id: string };
export const TOPIC_SELECT = `SELECT tp.*, c.title AS chapter_title, c.position AS chapter_position, t.title AS book_title, t.subject_key, t.id AS textbook_id
  FROM topics tp JOIN chapters c ON c.id = tp.chapter_id JOIN textbooks t ON t.id = c.textbook_id`;

export async function evidence(DB: D1, userId: string, topics: TopicRow[]) {
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

