// Server-side subject enforcement. Every request that names a subject, book or chapter goes through here:
// ids are checked against the canonical registry and the student's own class and version, never trusted from the client.
import type { D1Database } from "@cloudflare/workers-types";

import { ACTIVE_VERSION } from "./config";
import { detectBook, detectSubject, detectUnsupportedSubject, isSubjectId, offeringFor, type SubjectId } from "./registry";
import type { StudentContext } from "./student.server";
import type { L } from "../../content/types";

export type SubjectContext = { subjectId: SubjectId | null; textbookId: string | null; chapterId: string | null };
export type ContextCheck = { ok: true; ctx: SubjectContext } | { ok: false; code: "context_invalid" | "subject_mismatch" | "context_outside_profile" | "subject_invalid" };

/** Validate a requested subject / book / chapter against the database, the registry and the student's profile. */
export async function validateSubjectContext(DB: D1Database, student: Pick<StudentContext, "grade" | "medium">, input: { subjectId: string | null; textbookId: string | null; chapterId: string | null }): Promise<ContextCheck> {
  if (input.subjectId !== null && !isSubjectId(input.subjectId)) return { ok: false, code: "subject_invalid" };
  let subjectId = input.subjectId as SubjectId | null;
  let textbookId = input.textbookId;
  let chapterId: string | null = null;
  if (input.chapterId) {
    const c = await DB.prepare("SELECT c.id, c.textbook_id FROM chapters c JOIN textbooks t ON t.id = c.textbook_id WHERE c.id = ? AND t.status != 'retired'").bind(input.chapterId).first<{ id: string; textbook_id: string }>();
    if (!c || (textbookId && c.textbook_id !== textbookId)) return { ok: false, code: "context_invalid" };
    textbookId = c.textbook_id;
    chapterId = c.id;
  }
  if (textbookId) {
    const b = await DB.prepare("SELECT id, subject_key, grade, medium FROM textbooks WHERE id = ? AND version_id = ? AND status != 'retired'").bind(textbookId, ACTIVE_VERSION)
      .first<{ id: string; subject_key: string; grade: number; medium: "bangla" | "english" }>();
    if (!b || !isSubjectId(b.subject_key)) return { ok: false, code: "context_invalid" };
    if ((student.grade !== null && b.grade !== student.grade) || (student.medium !== null && b.medium !== student.medium)) return { ok: false, code: "context_outside_profile" };
    if (subjectId && b.subject_key !== subjectId) return { ok: false, code: "subject_mismatch" };
    subjectId = b.subject_key;
  }
  return { ok: true, ctx: { subjectId, textbookId, chapterId } };
}

export type Resolution =
  | { kind: "scope"; ctx: SubjectContext; from: "selected" | "book" | "question" | null; book: { id: string; title: string; key: string } | null; mentioned: SubjectId | null }
  | { kind: "unsupported"; label: L }
  | { kind: "conflict"; selected: SubjectId; named: SubjectId; bookId: string | null };

/** Decide which subject and book a question is about. A selected subject is never widened; a named book narrows it. */
export function resolveQuestionScope(question: string, student: Pick<StudentContext, "grade" | "medium">, selected: SubjectContext): Resolution {
  const unsupported = detectUnsupportedSubject(question);
  if (unsupported) return { kind: "unsupported", label: unsupported };
  const grade = student.grade ?? 7;
  const medium = student.medium ?? "bangla";
  const book = offeringFor(grade, medium) ? detectBook(question, grade, medium) : null;
  let ctx = { ...selected };
  let from: "selected" | "book" | "question" | null = selected.subjectId ? "selected" : null;
  let bookRef: { id: string; title: string; key: string } | null = null;
  if (book) {
    if (ctx.textbookId && ctx.textbookId !== book.id && ctx.subjectId) return { kind: "conflict", selected: ctx.subjectId, named: book.subjectId, bookId: book.id };
    if (ctx.subjectId && ctx.subjectId !== book.subjectId) return { kind: "conflict", selected: ctx.subjectId, named: book.subjectId, bookId: book.id };
    if (!ctx.textbookId) ctx = { subjectId: book.subjectId, textbookId: book.id, chapterId: null };
    from = from ?? "book";
    bookRef = { id: book.id, title: book.title, key: book.key };
    return { kind: "scope", ctx, from, book: bookRef, mentioned: null };
  }
  const named = detectSubject(question);
  if (named && !ctx.subjectId) return { kind: "scope", ctx: { ...ctx, subjectId: named }, from: "question", book: null, mentioned: null };
  return { kind: "scope", ctx, from, book: null, mentioned: named && named !== ctx.subjectId ? named : null };
}
