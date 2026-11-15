import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { currentUser, rateLimit } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { ACTIVE_VERSION } from "../curriculum/config";
import { SUBJECTS, SUBJECT_IDS, SUPPORTED_GRADES, detectSubject, offeringFor, subjectById } from "../curriculum/registry";
import { retrieve } from "../curriculum/retrieval.server";
import { studentContext } from "../curriculum/student.server";
import { queryTerms } from "../curriculum/text";

const likeOf = (q: string) => `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;

/**
 * Global search. Catalogue results (subjects, books, chapters) are public. Textbook passages, conversations and saved
 * notes are returned only to a signed-in student and only their own; passages come from the student's own class and version.
 */
export const globalSearch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ q: z.string().min(1).max(100), subjectId: z.enum(SUBJECT_IDS).nullable().default(null) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return { ok: false as const, code: "unavailable_now" };
    const q = data.q.normalize("NFC").trim();
    if (!q) return { ok: false as const, code: "empty" };
    const me = await currentUser();
    if (me && !(await rateLimit(`search:${me.id}`, 120, 600))) return { ok: false as const, code: "rate_limited" };
    const ctx = me ? await studentContext(DB, me.id) : null;
    const grade = ctx?.grade && SUPPORTED_GRADES.includes(ctx.grade) ? ctx.grade : SUPPORTED_GRADES[0];
    const medium = ctx?.medium ?? "bangla";
    const low = q.toLowerCase();
    const like = likeOf(q);

    const named = detectSubject(q);
    const subjects = SUBJECTS.filter((s) => s.id === named || s.label.en.toLowerCase().includes(low) || s.label.bn.includes(q) || s.short.en.toLowerCase().includes(low) || s.short.bn.includes(q))
      .filter((s) => !data.subjectId || s.id === data.subjectId)
      .map((s) => ({ id: s.id, label: s.label, hue: s.hue }));

    const subjectFilter = data.subjectId ? "AND t.subject_key = ?" : "";
    const subjectArg = data.subjectId ? [data.subjectId] : [];
    const books = (await DB.prepare(`SELECT t.id, t.title, t.subject_key, t.status FROM textbooks t WHERE t.version_id = ? AND t.grade = ? AND t.medium = ? AND t.status != 'retired' AND (t.title LIKE ? ESCAPE '\\' OR t.book_key LIKE ? ESCAPE '\\') ${subjectFilter} LIMIT 10`)
      .bind(ACTIVE_VERSION, grade, medium, like, like, ...subjectArg).all<{ id: string; title: string; subject_key: string; status: string }>()).results ?? [];
    const chapters = (await DB.prepare(`SELECT c.id, c.label, c.title, c.position, t.id AS book_id, t.title AS book_title, t.subject_key FROM chapters c JOIN textbooks t ON t.id = c.textbook_id
         WHERE t.version_id = ? AND t.grade = ? AND t.medium = ? AND t.status != 'retired' AND (c.title LIKE ? ESCAPE '\\' OR c.label LIKE ? ESCAPE '\\') ${subjectFilter} ORDER BY t.subject_key, c.position LIMIT 20`)
      .bind(ACTIVE_VERSION, grade, medium, like, like, ...subjectArg).all<{ id: string; label: string | null; title: string; position: number; book_id: string; book_title: string; subject_key: string }>()).results ?? [];

    let passages: { text: string; title: string; subjectKey: string; chapterId: string | null; chapterTitle: string | null; printedPage: number | null; pdfPage: number; ocr: boolean }[] = [];
    let threads: { id: string; title: string; updated_at: string; subject_key: string | null }[] = [];
    let saved: { id: string; excerpt: string | null; subject_key: string | null; created_at: string }[] = [];
    if (me) {
      if (offeringFor(ctx?.grade ?? null, ctx?.medium ?? null)) {
        const r = await retrieve(DB, { grade: ctx!.grade, medium: ctx!.medium, subjectKey: data.subjectId, textbookId: null, chapterId: null }, queryTerms(q));
        passages = r.excerpts.map((e) => ({ text: e.text, title: e.source.title, subjectKey: e.source.subjectKey, chapterId: e.source.chapter?.id ?? null, chapterTitle: e.source.chapter?.title ?? null, printedPage: e.source.printedPage, pdfPage: e.source.pdfPage, ocr: e.source.extraction === "ocr" }));
      }
      threads = (await DB.prepare(`SELECT th.id, th.title, th.updated_at, COALESCE(th.subject_key, t.subject_key) AS subject_key FROM tutor_threads th LEFT JOIN textbooks t ON t.id = th.textbook_id
           WHERE th.user_id = ? AND (th.title LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM tutor_messages m WHERE m.thread_id = th.id AND m.role = 'student' AND m.text LIKE ? ESCAPE '\\'))
           ${data.subjectId ? "AND COALESCE(th.subject_key, t.subject_key) = ?" : ""} ORDER BY th.updated_at DESC LIMIT 10`)
        .bind(me.id, like, like, ...subjectArg).all<{ id: string; title: string; updated_at: string; subject_key: string | null }>()).results ?? [];
      saved = (await DB.prepare(`SELECT id, excerpt, subject_key, created_at FROM saved_items WHERE user_id = ? AND (excerpt LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\') ${data.subjectId ? "AND subject_key = ?" : ""} ORDER BY created_at DESC LIMIT 10`)
        .bind(me.id, like, like, ...subjectArg).all<{ id: string; excerpt: string | null; subject_key: string | null; created_at: string }>()).results ?? [];
    }
    return { ok: true as const, signedIn: !!me, subjects, books, chapters, passages, threads, saved, subjectFilter: data.subjectId ? subjectById(data.subjectId)?.id ?? null : null };
  });
