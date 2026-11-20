import type { D1Database } from "@cloudflare/workers-types";

import { ACTIVE_VERSION, MAX_EXCERPTS } from "./config";
import { excerpt, termCoverage } from "./text";
import type { Excerpt, SourceRef } from "../tutor/types";

/** Retrieval scope. Every field narrows; subjectKey is always one of the eight registry subjects (validated by callers). */
export type Scope = { grade: number | null; medium: "bangla" | "english" | null; subjectKey: string | null; textbookId: string | null; chapterId: string | null };

type HitRow = {
  id: number; page: number; text: string; book_id: string; title: string; publisher: string; subject_key: string; subject_name: string; paper: string;
  grade: number; medium: "bangla" | "english"; language: "bn" | "en"; edition: string | null; official_url: string | null; license_status: SourceRef["license"];
  page_offset: number | null; extraction_method: string | null; review_status: string | null; confidence: number | null; score: number;
};
type ChapterRow = { id: string; textbook_id: string; position: number; label: string | null; title: string; start_page: number | null; end_page: number | null };

/**
 * The one rule for what students may see (used by retrieval and by chapter counts):
 * - a passage published individually after review; or
 * - an unreviewed passage of a book an admin approved as a whole, unless a quality warning blocks it
 *   (low OCR confidence, unchecked mathematics, duplicate, too short, missing page or chapter);
 * and never a rejected or withdrawn passage.
 */
export const STUDENT_VISIBLE = `(p.publish_status = 'published' OR (t.status = 'indexed' AND COALESCE(p.publish_status, 'draft') = 'draft' AND p.blocked = 0)) AND COALESCE(p.review_status, '') != 'rejected'`;

export type Retrieval = { excerpts: Excerpt[]; bestCoverage: number; booksInScope: number; topChapter: SourceRef["chapter"] };

export function scopeSql(scope: Scope): { sql: string; args: (string | number)[] } {
  const parts = [STUDENT_VISIBLE, "t.version_id = ?"];
  const args: (string | number)[] = [ACTIVE_VERSION];
  if (scope.textbookId) {
    parts.push("t.id = ?");
    args.push(scope.textbookId);
  }
  // Grade, medium and subject always apply, even with a textbook, so a book id from another scope finds nothing.
  if (scope.grade !== null) { parts.push("t.grade = ?"); args.push(scope.grade); }
  if (scope.medium !== null) { parts.push("t.medium = ?"); args.push(scope.medium); }
  if (scope.subjectKey !== null) { parts.push("t.subject_key = ?"); args.push(scope.subjectKey); }
  parts.push("t.subject_key IN (SELECT subject_id FROM subject_offerings)");
  if (scope.chapterId) {
    parts.push("EXISTS (SELECT 1 FROM chapters c WHERE c.id = ? AND c.textbook_id = t.id AND p.page BETWEEN c.start_page AND c.end_page)");
    args.push(scope.chapterId);
  }
  return { sql: parts.join(" AND "), args };
}

const SELECT = `SELECT p.id, p.page, p.text, t.id AS book_id, t.title, t.publisher, t.subject_key, t.subject_name, t.paper, t.grade, t.medium, t.language,
  t.edition, t.official_url, t.license_status, t.page_offset, t.extraction_method, p.review_status,
  (SELECT sp.confidence FROM source_pages sp WHERE sp.textbook_id = t.id AND sp.page = p.page) AS confidence`;

export async function countBooksInScope(DB: D1Database, scope: Scope): Promise<number> {
  const parts = ["(status = 'indexed' OR EXISTS (SELECT 1 FROM passages cp WHERE cp.textbook_id = textbooks.id AND cp.publish_status = 'published'))", "version_id = ?", "subject_key IN (SELECT subject_id FROM subject_offerings)"];
  const args: (string | number)[] = [ACTIVE_VERSION];
  if (scope.textbookId) { parts.push("id = ?"); args.push(scope.textbookId); }
  if (scope.grade !== null) { parts.push("grade = ?"); args.push(scope.grade); }
  if (scope.medium !== null) { parts.push("medium = ?"); args.push(scope.medium); }
  if (scope.subjectKey !== null) { parts.push("subject_key = ?"); args.push(scope.subjectKey); }
  const r = await DB.prepare(`SELECT COUNT(*) AS n FROM textbooks WHERE ${parts.join(" AND ")}`).bind(...args).first<{ n: number }>();
  return r?.n ?? 0;
}

/** to_tsquery text: each term reduced to letters/digits (any script) and OR-ed as a prefix match. */
export function tsQuery(terms: string[]): string | null {
  const parts = [...new Set(terms.map((t) => t.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "")).filter((t) => [...t].length >= 2))];
  return parts.length ? parts.slice(0, 16).map((t) => `${t}:*`).join(" | ") : null;
}

/** Lexical retrieval (Postgres full-text search with prefix matching, plus a substring fallback for very short Bangla words), filtered by the student's curriculum scope. */
export async function retrieve(DB: D1Database, scope: Scope, terms: string[]): Promise<Retrieval> {
  const booksInScope = await countBooksInScope(DB, scope);
  const empty: Retrieval = { excerpts: [], bestCoverage: 0, booksInScope, topChapter: null };
  if (!terms.length || !booksInScope) return empty;
  const { sql, args } = scopeSql(scope);
  let rows: HitRow[] = [];
  // Postgres full-text search on the generated passages.search column. Prefix matching (term:*) keeps Bangla
  // inflections matching their stem ("অনুপাত" finds "অনুপাতের"), as the old trigram index did. The score is the
  // negated rank so that, like BM25 before, lower is better and the ranking below is unchanged.
  const match = tsQuery(terms);
  if (match) {
    const r = await DB.prepare(`${SELECT}, -ts_rank(p.search, to_tsquery('simple', ?)) AS score FROM passages p JOIN textbooks t ON t.id = p.textbook_id
      WHERE p.search @@ to_tsquery('simple', ?) AND ${sql} ORDER BY score LIMIT 40`).bind(match, match, ...args).all<HitRow>();
    rows = r.results ?? [];
  }
  const short = terms.filter((t) => [...t].length < 3);
  if (rows.length < 3 && short.length) {
    const likes = short.map(() => "p.text LIKE ?").join(" OR ");
    const r = await DB.prepare(`${SELECT}, 0 AS score FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE (${likes}) AND ${sql} LIMIT 40`)
      .bind(...short.map((t) => `%${t.replace(/[%_]/g, "")}%`), ...args).all<HitRow>();
    const seen = new Set(rows.map((x) => x.id));
    rows = rows.concat((r.results ?? []).filter((x) => !seen.has(x.id)));
  }
  if (!rows.length) return empty;

  const minScore = Math.min(...rows.map((r) => r.score));
  const ranked = rows
    .map((r) => {
      const coverage = termCoverage(r.text, terms);
      const bm = minScore < 0 ? r.score / minScore : 0; // 0..1, higher is better
      return { r, coverage, rank: coverage * 2 + bm };
    })
    .filter((x) => x.coverage > 0)
    .sort((a, b) => b.rank - a.rank);

  const picked: typeof ranked = [];
  for (const x of ranked) {
    if (picked.some((p) => p.r.book_id === x.r.book_id && Math.abs(p.r.page - x.r.page) < 1)) continue;
    picked.push(x);
    if (picked.length >= MAX_EXCERPTS) break;
  }
  const excerpts = await buildExcerpts(DB, picked.map((x) => x.r), terms);
  return { excerpts, bestCoverage: picked[0]?.coverage ?? 0, booksInScope, topChapter: excerpts[0]?.source.chapter ?? null };
}

/** Turns passage rows into student-facing excerpts with their full source records (book, chapter, pages, trust). */
export async function buildExcerpts(DB: D1Database, rows: HitRow[], terms: string[]): Promise<Excerpt[]> {
  if (!rows.length) return [];
  const bookIds = [...new Set(rows.map((r) => r.book_id))];
  const ch = await DB.prepare(`SELECT id, textbook_id, position, label, title, start_page, end_page FROM chapters WHERE textbook_id IN (${bookIds.map(() => "?").join(",")})`)
    .bind(...bookIds).all<ChapterRow>();
  const chapters = ch.results ?? [];
  const chapterFor = (bookId: string, page: number) => {
    const c = chapters.find((x) => x.textbook_id === bookId && x.start_page !== null && x.end_page !== null && page >= x.start_page && page <= x.end_page);
    return c ? { id: c.id, position: c.position, label: c.label, title: c.title } : null;
  };
  return rows.map((r) => ({
    text: excerpt(r.text, terms),
    source: {
      passageId: r.id, textbookId: r.book_id, title: r.title, publisher: r.publisher, subjectKey: r.subject_key, subjectName: r.subject_name, paper: r.paper,
      grade: r.grade, medium: r.medium, language: r.language, edition: r.edition, chapter: chapterFor(r.book_id, r.page), pdfPage: r.page,
      printedPage: r.page_offset !== null ? r.page - r.page_offset : null, officialUrl: r.official_url, license: r.license_status,
      extraction: r.review_status === "teacher_reviewed" ? "teacher_reviewed" : r.review_status === "checked" ? "checked" : r.extraction_method === "ocr" ? "ocr" : "text",
      ocrConfidence: r.review_status !== "checked" && r.review_status !== "teacher_reviewed" && r.extraction_method === "ocr" ? r.confidence : null,
    },
  }));
}

/** Student-visible passages in scope, by id (used to add semantic matches). Ids outside the scope or not visible are dropped. */
export async function visibleById(DB: D1Database, scope: Scope, ids: number[]): Promise<HitRow[]> {
  if (!ids.length) return [];
  const { sql, args } = scopeSql(scope);
  const r = await DB.prepare(`${SELECT}, 0 AS score FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE p.id IN (${ids.map(() => "?").join(",")}) AND ${sql}`)
    .bind(...ids, ...args).all<HitRow>();
  return r.results ?? [];
}
export type { HitRow };
