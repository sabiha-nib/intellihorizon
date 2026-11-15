import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { D1PreparedStatement } from "@cloudflare/workers-types";

import { sha256Hex, timingSafeEqual } from "../auth/crypto.server";
import { currentUser, rateLimit, sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { requireAdmin } from "../curriculum/admin.server";
import { audit, rebrand } from "../learning/engine.server";
import { mathOcrTier } from "../learning/ocr";
import { grade, kindOf } from "../learning/rules";
import { ACTIVE_VERSION, EXCLUDED_SUBJECT_PATTERN, SUBJECT_KEYS } from "../curriculum/config";
import { bookById, isSubjectId, offeringFor } from "../curriculum/registry";
import { PROTECTED_SQL, checkPassage } from "../curriculum/quality";
import { OCR_REVIEW_CONFIDENCE, chunkPage, classifyOcrPage, classifyPage, indexable, normalizeText, repairBanglaOrder } from "../curriculum/text";

type Fail = { ok: false; code: string; detail?: string };
const fail = (code: string, detail?: string): Fail => ({ ok: false, code, detail });
const now = () => new Date().toISOString();
const enc = new TextEncoder();
export type Row = Record<string, string | number | null>;

async function guard() {
  const { DB } = bindings();
  if (!DB) return { error: fail("unavailable_now") } as const;
  if (!sameOrigin()) return { error: fail("bad_origin") } as const;
  const admin = await requireAdmin();
  if (!admin) return { error: fail("not_admin") } as const;
  return { DB, admin, error: null } as const;
}

/* ─────────── Admin role claim ─────────── */

export const claimAdmin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().max(200) }))
  .handler(async ({ data }) => {
    const { DB, EDU_ADMIN_TOKEN } = bindings();
    if (!DB || !sameOrigin()) return fail("unavailable_now");
    const me = await currentUser();
    if (!me) return fail("signed_out");
    if (!(await rateLimit(`admin-claim:${me.id}`, 5, 3600))) return fail("rate_limited");
    const code = data.token.trim().toUpperCase();
    // 1. The one-time owner code: only its hash is stored, and the UPDATE claims it atomically, so it works exactly once.
    if (/^EDU(-[A-Z0-9]{5}){5}$/.test(code)) {
      const claim = await DB.prepare("UPDATE admin_bootstrap SET used_by = ?, used_at = ? WHERE code_hash = ? AND used_at IS NULL").bind(me.id, now(), await sha256Hex(code)).run();
      if ((claim.meta?.changes ?? 0) !== 1) { await audit(DB, me.id, "admin_claim_failed", me.id, { method: "owner_code" }); return fail("wrong_token"); }
      await DB.prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?").bind(now(), me.id).run();
      await audit(DB, me.id, "admin_claimed", me.id, { method: "owner_code" });
      return { ok: true as const };
    }
    // 2. The EDU_ADMIN_TOKEN secret set by the owner in the website settings.
    if (!EDU_ADMIN_TOKEN || EDU_ADMIN_TOKEN.length < 32) { await audit(DB, me.id, "admin_claim_failed", me.id, { method: "token_not_configured" }); return fail("wrong_token"); }
    const ok = timingSafeEqual(enc.encode(await sha256Hex(data.token)), enc.encode(await sha256Hex(EDU_ADMIN_TOKEN)));
    if (!ok) { await audit(DB, me.id, "admin_claim_failed", me.id, { method: "secret_token" }); return fail("wrong_token"); }
    await DB.prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?").bind(now(), me.id).run();
    await audit(DB, me.id, "admin_claimed", me.id, { method: "secret_token" });
    return { ok: true as const };
  });

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const me = await currentUser();
  let codeAvailable = false;
  try {
    const r = await bindings().DB?.prepare("SELECT COUNT(*) AS n FROM admin_bootstrap WHERE used_at IS NULL").first<{ n: number }>();
    codeAvailable = (r?.n ?? 0) > 0;
  } catch {
    codeAvailable = false;
  }
  return { signedIn: !!me, admin: me?.role === "admin", configured: !!bindings().EDU_ADMIN_TOKEN, codeAvailable };
});

/* ─────────── Textbooks ─────────── */

export type AdminBook = {
  id: string; grade: number; medium: string; subject_key: string; subject_name: string; paper: string; title: string; language: string;
  edition: string | null; official_url: string | null; license_status: string; license_note: string | null; page_count: number | null;
  page_offset: number | null; status: string; updated_at: string; passages: number; chapters: number; questions: number;
};

export const listBooks = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard();
  if (g.error) return g.error;
  const res = await g.DB.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM passages p WHERE p.textbook_id = t.id) AS passages,
            (SELECT COUNT(*) FROM chapters c WHERE c.textbook_id = t.id) AS chapters,
            (SELECT COUNT(*) FROM questions q JOIN chapters c ON c.id = q.chapter_id WHERE c.textbook_id = t.id) AS questions
       FROM textbooks t ORDER BY t.grade, t.medium, t.subject_key, t.paper`,
  ).all<AdminBook>();
  return { ok: true as const, books: res.results ?? [] };
});

const bookShape = z.object({
  grade: z.number().int().min(1).max(12),
  medium: z.enum(["bangla", "english"]),
  subjectKey: z.string().max(60),
  subjectName: z.string().min(1).max(160),
  paper: z.string().max(60).default(""),
  title: z.string().min(1).max(240),
  language: z.enum(["bn", "en"]),
  edition: z.string().max(120).nullable().default(null),
  officialUrl: z.string().max(500).nullable().default(null),
  licenseStatus: z.enum(["permission_pending", "permitted", "restricted"]).default("permission_pending"),
  licenseNote: z.string().max(600).nullable().default(null),
  pageOffset: z.number().int().min(-50).max(500).nullable().default(null),
});

function checkBook(b: z.infer<typeof bookShape>): string | null {
  if (!isSubjectId(b.subjectKey) || !SUBJECT_KEYS.some((s) => s.key === b.subjectKey)) return "subject_key_invalid";
  if (!offeringFor(b.grade, b.medium)) return "class_not_offered";
  if (EXCLUDED_SUBJECT_PATTERN.test(`${b.subjectName} ${b.title}`)) return "religion_excluded";
  if (b.officialUrl && !/^https:\/\/([a-z0-9-]+\.)*(nctb\.gov\.bd|nctb\.portal\.gov\.bd)(\/|$)/i.test(b.officialUrl)) return "official_url_not_nctb";
  return null;
}

export const saveBook = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid().nullable(), book: bookShape }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const problem = checkBook(data.book);
    if (problem) return fail(problem);
    const b = data.book;
    const ts = now();
    try {
      if (data.id) {
        await g.DB.prepare(
          `UPDATE textbooks SET grade=?, medium=?, subject_key=?, subject_name=?, paper=?, title=?, language=?, edition=?, official_url=?,
             license_status=?, license_note=?, page_offset=?, updated_at=? WHERE id=?`,
        ).bind(b.grade, b.medium, b.subjectKey, b.subjectName.trim(), b.paper.trim(), b.title.trim(), b.language, b.edition, b.officialUrl, b.licenseStatus, b.licenseNote, b.pageOffset, ts, data.id).run();
        return { ok: true as const, id: data.id };
      }
      const id = crypto.randomUUID();
      await g.DB.prepare(
        `INSERT INTO textbooks (id, version_id, grade, medium, subject_key, subject_name, paper, title, language, edition, official_url, license_status, license_note, page_offset, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, ACTIVE_VERSION, b.grade, b.medium, b.subjectKey, b.subjectName.trim(), b.paper.trim(), b.title.trim(), b.language, b.edition, b.officialUrl, b.licenseStatus, b.licenseNote, b.pageOffset, g.admin.id, ts, ts).run();
      return { ok: true as const, id };
    } catch (err) {
      if (String((err as Error).message).includes("UNIQUE")) return fail("duplicate_book");
      if (String((err as Error).message).includes("subject_not_in_registry")) return fail("subject_key_invalid");
      return fail("save_failed");
    }
  });

export const setBookStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["indexed", "needs_review", "retired"]) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    if (data.status === "indexed") {
      const n = await g.DB.prepare("SELECT COUNT(*) AS n FROM passages WHERE textbook_id = ?").bind(data.id).first<{ n: number }>();
      if (!n?.n) return fail("nothing_indexed");
    }
    await g.DB.prepare("UPDATE textbooks SET status = ?, approved_by = CASE WHEN ? = 'indexed' THEN ? ELSE approved_by END, updated_at = ? WHERE id = ?")
      .bind(data.status, data.status, g.admin.id, now(), data.id).run();
    await audit(g.DB, g.admin.id, "book_status", data.id, { status: data.status });
    return { ok: true as const };
  });

/* ─────────── Import pipeline: start, send pages in batches, finish ─────────── */

export const startImport = createServerFn({ method: "POST" })
  .inputValidator(z.object({ textbookId: z.string().uuid(), fileSha256: z.string().regex(/^[0-9a-f]{64}$/), pageCount: z.number().int().min(1).max(2000), method: z.enum(["pdf_text", "ocr"]).default("pdf_text") }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const book = await g.DB.prepare("SELECT id, status FROM textbooks WHERE id = ?").bind(data.textbookId).first<{ id: string; status: string }>();
    if (!book) return fail("not_found");
    // A registry book's page count is known from the supplied PDF; text for a different page count belongs to a different file.
    const reg = bookById(data.textbookId);
    if (reg && reg.pdfPages !== data.pageCount) return fail("page_count_mismatch", `${reg.titleLatin} has ${reg.pdfPages} pages; this text has ${data.pageCount}.`);
    const dup = await g.DB.prepare("SELECT id, title FROM textbooks WHERE file_sha256 = ? AND id != ?").bind(data.fileSha256, data.textbookId).first<{ id: string; title: string }>();
    const jobId = crypto.randomUUID();
    // Re-importing replaces this book's unreviewed extracted text only. Chapters, objectives, questions and every passage a
    // person reviewed, approved, published or withdrew are kept, together with the source pages they came from.
    await g.DB.batch([
      g.DB.prepare(`DELETE FROM passages WHERE textbook_id = ? AND NOT ${PROTECTED_SQL}`).bind(data.textbookId),
      g.DB.prepare(`DELETE FROM source_pages WHERE textbook_id = ? AND page NOT IN (SELECT page FROM passages WHERE textbook_id = ? AND ${PROTECTED_SQL})`).bind(data.textbookId, data.textbookId),
      g.DB.prepare("UPDATE textbooks SET status = 'processing', file_sha256 = ?, page_count = ?, extraction_method = ?, updated_at = ? WHERE id = ?").bind(data.fileSha256, data.pageCount, data.method, now(), data.textbookId),
      g.DB.prepare("INSERT INTO import_jobs (id, textbook_id, started_by, started_at, status, file_sha256, pages_total, notes, method) VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)")
        .bind(jobId, data.textbookId, g.admin.id, now(), data.fileSha256, data.pageCount, dup ? JSON.stringify({ duplicateOf: dup.title }) : null, data.method),
    ]);
    return { ok: true as const, jobId, duplicateOf: dup?.title ?? null };
  });

export const ingestPages = createServerFn({ method: "POST" })
  .inputValidator(z.object({ jobId: z.string().uuid(), pages: z.array(z.object({ page: z.number().int().min(1).max(2000), text: z.string().max(40000), confidence: z.number().min(0).max(100).nullable().default(null) })).min(1).max(12) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const job = await g.DB.prepare("SELECT j.id, j.textbook_id, j.status, j.method, j.pages_total, t.language, t.subject_key, t.page_offset FROM import_jobs j JOIN textbooks t ON t.id = j.textbook_id WHERE j.id = ?").bind(data.jobId)
      .first<{ id: string; textbook_id: string; status: string; method: string; pages_total: number; language: "bn" | "en"; subject_key: string; page_offset: number | null }>();
    if (!job || job.status !== "running") return fail("job_not_running");
    if (data.pages.some((p) => p.page > job.pages_total)) return fail("page_out_of_range");
    const ocr = job.method === "ocr";
    const existing = await g.DB.prepare("SELECT content_hash FROM source_pages WHERE textbook_id = ?").bind(job.textbook_id).all<{ content_hash: string }>();
    const seen = new Set((existing.results ?? []).map((r) => r.content_hash));
    const chapters = (await g.DB.prepare("SELECT start_page, end_page FROM chapters WHERE textbook_id = ?").bind(job.textbook_id).all<{ start_page: number | null; end_page: number | null }>()).results ?? [];
    const inChapter = (page: number) => chapters.some((c) => c.start_page !== null && c.end_page !== null && page >= c.start_page && page <= c.end_page);
    const passageHashes = new Set(((await g.DB.prepare("SELECT content_hash FROM passages WHERE textbook_id = ?").bind(job.textbook_id).all<{ content_hash: string }>()).results ?? []).map((r) => r.content_hash));
    const kept = new Set(((await g.DB.prepare(`SELECT DISTINCT page FROM passages WHERE textbook_id = ? AND ${PROTECTED_SQL}`).bind(job.textbook_id).all<{ page: number }>()).results ?? []).map((r) => r.page));
    const stmts: D1PreparedStatement[] = [];
    const tally = { pagesOk: 0, empty: 0, low: 0, legacy: 0, duplicate: 0, passages: 0, received: 0, lowConf: 0, keptReviewed: 0, flagged: 0 };
    for (const p of data.pages) {
      tally.received++;
      const text = ocr ? normalizeText(p.text) : repairBanglaOrder(normalizeText(p.text)).text;
      const cls = ocr ? classifyOcrPage(text, p.confidence) : classifyPage(text, job.language);
      if (ocr && p.confidence !== null && cls.quality === "ok" && p.confidence < OCR_REVIEW_CONFIDENCE) tally.lowConf++;
      const hash = await sha256Hex(text);
      const duplicate = cls.quality !== "empty" && seen.has(hash);
      seen.add(hash);
      if (cls.quality === "ok") tally.pagesOk++;
      else if (cls.quality === "low_text") tally.low++;
      else if (cls.quality === "empty") tally.empty++;
      else tally.legacy++;
      stmts.push(g.DB.prepare("INSERT OR REPLACE INTO source_pages (textbook_id, page, text, char_count, bangla_ratio, quality, content_hash, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(job.textbook_id, p.page, text, cls.chars, cls.banglaRatio, cls.quality, hash, ocr ? p.confidence : null));
      if (duplicate) { tally.duplicate++; continue; }
      if (!indexable(cls.quality)) continue;
      // Reviewed, approved, published or withdrawn passages on this page are kept as they are; only unreviewed
      // extraction is replaced. The new draft passages sit beside them, labelled as extracted text.
      if (kept.has(p.page)) tally.keptReviewed++;
      stmts.push(g.DB.prepare(`DELETE FROM passages WHERE textbook_id = ? AND page = ? AND NOT ${PROTECTED_SQL}`).bind(job.textbook_id, p.page));
      const chunks = chunkPage(text);
      const printed = job.page_offset !== null ? p.page - job.page_offset : null;
      for (let k = 0; k < chunks.length; k++) {
        const hash = await sha256Hex(chunks[k]);
        const q = checkPassage({ text: chunks[k], confidence: ocr ? p.confidence : null, subjectKey: job.subject_key, printedPage: printed, inChapter: inChapter(p.page), duplicate: passageHashes.has(hash) });
        passageHashes.add(hash);
        tally.passages++;
        if (q.blocked) tally.flagged++;
        stmts.push(g.DB.prepare("INSERT INTO passages (textbook_id, page, seq, text, content_hash, publish_status, flags, blocked, provenance, confidence) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, 'admin_import', ?)")
          .bind(job.textbook_id, p.page, k, chunks[k], hash, q.flags.length ? JSON.stringify(q.flags) : null, q.blocked ? 1 : 0, ocr ? p.confidence : null));
      }
    }
    stmts.push(g.DB.prepare(
      `UPDATE import_jobs SET pages_received = pages_received + ?, pages_ok = pages_ok + ?, pages_empty = pages_empty + ?, pages_low = pages_low + ?,
        pages_legacy = pages_legacy + ?, pages_duplicate = pages_duplicate + ?, passages = passages + ?, pages_low_conf = pages_low_conf + ? WHERE id = ?`,
    ).bind(tally.received, tally.pagesOk, tally.empty, tally.low, tally.legacy, tally.duplicate, tally.passages, tally.lowConf, data.jobId));
    await g.DB.batch(stmts);
    return { ok: true as const, ...tally };
  });

export const finishImport = createServerFn({ method: "POST" })
  .inputValidator(z.object({ jobId: z.string().uuid(), aborted: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const j = await g.DB.prepare("SELECT * FROM import_jobs WHERE id = ?").bind(data.jobId).first<{
      textbook_id: string; status: string; pages_total: number; pages_received: number; pages_ok: number; pages_empty: number; pages_low: number; pages_legacy: number; pages_duplicate: number; passages: number;
      method: string; pages_low_conf: number;
    }>();
    if (!j) return fail("not_found");
    const usable = j.pages_ok + j.pages_low;
    const complete = j.pages_received >= j.pages_total;
    const issues: string[] = [];
    if (!complete) issues.push(`Only ${j.pages_received} of ${j.pages_total} pages were received.`);
    if (j.method === "ocr") issues.push("This text came from OCR (machine reading of page images), not from a text layer. OCR can misread letters, especially Bangla conjuncts. Students see a note saying so next to every excerpt.");
    if (j.method === "ocr" && j.pages_low_conf) issues.push(`${j.pages_low_conf} pages were read with below-${OCR_REVIEW_CONFIDENCE}% confidence. They are indexed but flagged; check a few in "Flagged pages".`);
    if (j.method === "ocr" && j.pages_legacy) issues.push(`${j.pages_legacy} pages were read with very low confidence and were not indexed.`);
    if (j.method !== "ocr" && j.pages_legacy) issues.push(`${j.pages_legacy} pages had unreadable text (Bangla in a legacy non-Unicode font, or letters the PDF does not map to text, often conjuncts or vowel signs). They were not indexed; open "Flagged pages" to see each one. OCR is the fix for these pages and is not available yet.`);
    if (j.pages_empty) issues.push(`${j.pages_empty} pages had no text layer (scanned or image-only); OCR is not available, so they were not indexed.`);
    if (j.pages_duplicate) issues.push(`${j.pages_duplicate} pages repeated text already imported and were skipped.`);
    const jobStatus = data.aborted || usable === 0 ? "failed" : issues.length ? "completed_with_issues" : "completed";
    // A book is offered to students only when it is complete and mostly readable; otherwise an admin must review it.
    // Extracted text never goes live automatically: an admin reviews the report and sample pages, then approves.
    const bookStatus = usable === 0 ? "failed" : "needs_review";
    await g.DB.batch([
      g.DB.prepare("UPDATE import_jobs SET status = ?, finished_at = ?, notes = ? WHERE id = ?").bind(jobStatus, now(), JSON.stringify({ issues }), data.jobId),
      g.DB.prepare("UPDATE textbooks SET status = ?, updated_at = ? WHERE id = ?").bind(bookStatus, now(), j.textbook_id),
    ]);
    await audit(g.DB, g.admin.id, "import_finished", j.textbook_id, { jobId: data.jobId, jobStatus, bookStatus, passages: j.passages, pagesReceived: j.pages_received });
    return { ok: true as const, jobStatus, bookStatus, issues, usable, passages: j.passages };
  });

export const importHistory = createServerFn({ method: "POST" })
  .inputValidator(z.object({ textbookId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const jobs = await g.DB.prepare("SELECT * FROM import_jobs WHERE textbook_id = ? ORDER BY started_at DESC LIMIT 10").bind(data.textbookId).all<Row>();
    const quality = await g.DB.prepare("SELECT quality, COUNT(*) AS n FROM source_pages WHERE textbook_id = ? GROUP BY quality").bind(data.textbookId).all<{ quality: string; n: number }>();
    const flagged = await g.DB.prepare(`SELECT page, quality, char_count, confidence FROM source_pages WHERE textbook_id = ? AND (quality != 'ok' OR (confidence IS NOT NULL AND confidence < ${OCR_REVIEW_CONFIDENCE})) ORDER BY page LIMIT 200`).bind(data.textbookId).all<Row>();
    return { ok: true as const, jobs: jobs.results ?? [], quality: quality.results ?? [], flagged: flagged.results ?? [] };
  });

/** Admin-only preview of extracted text, to judge extraction quality. Never exposed to students. */
export const previewPage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ textbookId: z.string().uuid(), page: z.number().int().min(1).max(2000) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const row = await g.DB.prepare("SELECT page, text, quality, bangla_ratio FROM source_pages WHERE textbook_id = ? AND page = ?").bind(data.textbookId, data.page).first<Row>();
    return row ? { ok: true as const, page: row } : fail("not_found");
  });

/* ─────────── Chapters, objectives, questions ─────────── */

export const getBookStructure = createServerFn({ method: "POST" })
  .inputValidator(z.object({ textbookId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const chapters = await g.DB.prepare("SELECT * FROM chapters WHERE textbook_id = ? ORDER BY position").bind(data.textbookId).all<Row>();
    const objectives = await g.DB.prepare("SELECT o.* FROM objectives o JOIN chapters c ON c.id = o.chapter_id WHERE c.textbook_id = ? ORDER BY o.position").bind(data.textbookId).all<Row>();
    const questions = await g.DB.prepare("SELECT q.* FROM questions q JOIN chapters c ON c.id = q.chapter_id WHERE c.textbook_id = ? ORDER BY q.created_at").bind(data.textbookId).all<Row>();
    return { ok: true as const, chapters: chapters.results ?? [], objectives: objectives.results ?? [], questions: questions.results ?? [] };
  });

export const saveChapters = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    textbookId: z.string().uuid(),
    chapters: z.array(z.object({ id: z.string().uuid().nullable(), position: z.number().int().min(1).max(200), label: z.string().max(40).nullable(), title: z.string().min(1).max(240), startPage: z.number().int().min(1).max(2000), endPage: z.number().int().min(1).max(2000) })).max(200),
  }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const book = await g.DB.prepare("SELECT page_count FROM textbooks WHERE id = ?").bind(data.textbookId).first<{ page_count: number | null }>();
    if (!book) return fail("not_found");
    const sorted = [...data.chapters].sort((a, b) => a.position - b.position);
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      if (c.endPage < c.startPage) return fail("page_range_invalid", `Chapter ${c.position}`);
      if (book.page_count && c.endPage > book.page_count) return fail("page_range_beyond_book", `Chapter ${c.position}`);
      if (i > 0 && c.startPage <= sorted[i - 1].endPage) return fail("page_ranges_overlap", `Chapters ${sorted[i - 1].position} and ${c.position}`);
      if (i > 0 && c.position === sorted[i - 1].position) return fail("duplicate_position", `Chapter ${c.position}`);
    }
    const ts = now();
    const keep = sorted.filter((c) => c.id).map((c) => c.id as string);
    const stmts: D1PreparedStatement[] = [
      keep.length
        ? g.DB.prepare(`DELETE FROM chapters WHERE textbook_id = ? AND id NOT IN (${keep.map(() => "?").join(",")})`).bind(data.textbookId, ...keep)
        : g.DB.prepare("DELETE FROM chapters WHERE textbook_id = ?").bind(data.textbookId),
      // Temporarily move positions out of the way so reordering cannot hit the unique constraint.
      g.DB.prepare("UPDATE chapters SET position = position + 10000 WHERE textbook_id = ?").bind(data.textbookId),
    ];
    for (const c of sorted) {
      if (c.id) stmts.push(g.DB.prepare("UPDATE chapters SET position=?, label=?, title=?, start_page=?, end_page=?, updated_at=? WHERE id=? AND textbook_id=?").bind(c.position, c.label, c.title.trim(), c.startPage, c.endPage, ts, c.id, data.textbookId));
      else stmts.push(g.DB.prepare("INSERT INTO chapters (id, textbook_id, position, label, title, start_page, end_page, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), data.textbookId, c.position, c.label, c.title.trim(), c.startPage, c.endPage, ts, ts));
    }
    await g.DB.batch(stmts);
    return { ok: true as const };
  });

export const saveObjectives = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid(), objectives: z.array(z.object({ text: z.string().min(1).max(500), sourcePage: z.number().int().min(1).max(2000).nullable(), bloom: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]).nullable() })).max(60) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const ts = now();
    await g.DB.batch([
      g.DB.prepare("DELETE FROM objectives WHERE chapter_id = ?").bind(data.chapterId),
      ...data.objectives.map((o, i) => g.DB.prepare("INSERT INTO objectives (id, chapter_id, position, text, source_page, bloom, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), data.chapterId, i + 1, o.text.trim(), o.sourcePage, o.bloom, ts)),
    ]);
    return { ok: true as const };
  });

const questionShape = z.object({
  id: z.string().uuid().nullable(),
  chapterId: z.string().uuid(),
  type: z.enum(["mcq", "numeric", "short"]),
  prompt: z.string().min(1).max(2000),
  options: z.array(z.object({ id: z.string().regex(/^[a-z]$/), text: z.string().min(1).max(400) })).max(6).nullable(),
  answer: z.string().min(1).max(600),
  tolerance: z.number().min(0).max(1000).nullable(),
  explanation: z.string().max(2000).nullable(),
  source: z.enum(["textbook_exercise", "educerro_authored"]),
  sourcePage: z.number().int().min(1).max(2000).nullable(),
  bloom: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]).nullable(),
  difficulty: z.number().int().min(1).max(3).nullable(),
  language: z.enum(["bn", "en"]),
});

export const saveQuestion = createServerFn({ method: "POST" })
  .inputValidator(questionShape)
  .handler(async ({ data: q }) => {
    const g = await guard();
    if (g.error) return g.error;
    if (q.type === "mcq" && (!q.options || q.options.length < 2 || !q.options.some((o) => o.id === q.answer))) return fail("mcq_answer_invalid");
    if (q.type === "numeric" && !/^-?[0-9০-৯]+([./][0-9০-৯]+)?$/.test(q.answer.trim())) return fail("numeric_answer_invalid");
    if (q.type === "short") {
      try { const a = JSON.parse(q.answer); if (!Array.isArray(a) || !a.length) return fail("short_answer_invalid"); } catch { return fail("short_answer_invalid"); }
    }
    if (q.source === "textbook_exercise" && !q.sourcePage) return fail("source_page_required");
    const vals = [q.chapterId, q.type, q.prompt.trim(), q.options ? JSON.stringify(q.options) : null, q.answer.trim(), q.tolerance, q.explanation, q.source, q.sourcePage, q.bloom, q.difficulty, q.language] as const;
    // Any new or edited question goes back to draft. It reaches students only after review and publishing.
    if (q.id) {
      await g.DB.prepare("UPDATE questions SET chapter_id=?, type=?, prompt=?, options=?, answer=?, tolerance=?, explanation=?, source=?, source_page=?, bloom=?, difficulty=?, language=?, status='draft', review_status='draft', reviewed_by=NULL, reviewed_at=NULL, updated_at=? WHERE id=?").bind(...vals, now(), q.id).run();
      await audit(g.DB, g.admin.id, "question_edited", q.id, { returnedTo: "draft" });
      return { ok: true as const, id: q.id };
    }
    const id = crypto.randomUUID();
    const prov = JSON.stringify({ origin: q.source === "textbook_exercise" ? "textbook-entered" : "admin-authored", answerFrom: "Entered by an admin", enteredBy: g.admin.id });
    await g.DB.prepare("INSERT INTO questions (chapter_id, type, prompt, options, answer, tolerance, explanation, source, source_page, bloom, difficulty, language, id, created_by, created_at, status, review_status, provenance, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'draft', ?, ?)").bind(...vals, id, g.admin.id, now(), prov, now()).run();
    await audit(g.DB, g.admin.id, "question_created", id, { chapterId: q.chapterId });
    return { ok: true as const, id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    // A question students have answered is withdrawn, not deleted, so their attempts and history are kept.
    const used = await g.DB.prepare("SELECT COUNT(*) AS n FROM attempts WHERE question_id = ?").bind(data.id).first<{ n: number }>();
    if ((used?.n ?? 0) > 0) {
      await g.DB.prepare("UPDATE questions SET status = 'draft', review_status = 'draft', updated_at = ? WHERE id = ?").bind(now(), data.id).run();
      await audit(g.DB, g.admin.id, "question_withdrawn", data.id, { attempts: used!.n });
      return { ok: true as const, withdrawn: true };
    }
    await g.DB.prepare("DELETE FROM questions WHERE id = ?").bind(data.id).run();
    await audit(g.DB, g.admin.id, "question_deleted", data.id, null);
    return { ok: true as const, withdrawn: false };
  });

/** Coverage report across the whole catalogue, for honest reporting. */
export const coverageReport = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard();
  if (g.error) return g.error;
  const rows = await g.DB.prepare("SELECT grade, medium, status, COUNT(*) AS n FROM textbooks GROUP BY grade, medium, status ORDER BY grade, medium").all<Row>();
  return { ok: true as const, rows: rows.results ?? [] };
});

/* ─────────── Question review: draft -> reviewed -> published ─────────── */

export type ReviewQuestion = {
  id: string; chapter_id: string; chapter_title: string; book_title: string; subject_key: string; type: string; answer_kind: string | null; prompt: string; options: string | null; answer: string;
  explanation: string | null; hint: string | null; source: string; source_page: number | null; language: string; status: string; review_status: string; provenance: string | null;
  reviewed_by: string | null; reviewed_at: string | null; published_by: string | null; published_at: string | null; attempts: number; checks: string[];
};

/** Problems that block publishing. Each one is a concrete, checkable rule. */
function questionChecks(q: Pick<ReviewQuestion, "type" | "answer_kind" | "answer" | "options" | "explanation" | "source" | "source_page" | "provenance" | "prompt">): string[] {
  const out: string[] = [];
  if (!q.prompt.trim()) out.push("prompt_missing");
  if (!q.explanation?.trim()) out.push("explanation_missing");
  if (q.source === "textbook_exercise" && !q.source_page) out.push("source_page_missing");
  let prov: Record<string, unknown> = {};
  try { prov = q.provenance ? JSON.parse(q.provenance) : {}; } catch { out.push("provenance_unreadable"); }
  if (!prov.answerFrom) out.push("answer_source_missing");
  if (prov.origin === "ai-draft" && !prov.evidenceQuote) out.push("evidence_missing");
  if (q.type === "mcq") {
    try { const o = JSON.parse(q.options ?? "[]") as { id: string }[]; if (o.length < 2 || !o.some((x) => x.id === q.answer)) out.push("mcq_answer_not_an_option"); } catch { out.push("options_unreadable"); }
  } else {
    // The stored answer must pass its own checker, so a student typing it would be marked right.
    const self = kindOf(q as never) === "text" ? (() => { try { return (JSON.parse(q.answer) as string[])[0] ?? ""; } catch { return q.answer; } })() : q.answer;
    if (!grade(q as never, self).correct) out.push("answer_fails_own_check");
  }
  return out;
}

export const listReviewQuestions = createServerFn({ method: "POST" })
  .inputValidator(z.object({ status: z.enum(["draft", "reviewed", "published"]) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const r = await g.DB.prepare(
      `SELECT q.id, q.chapter_id, c.title AS chapter_title, t.title AS book_title, t.subject_key, q.type, q.answer_kind, q.prompt, q.options, q.answer, q.explanation, q.hint, q.source, q.source_page,
              q.language, q.status, q.review_status, q.provenance, q.reviewed_by, q.reviewed_at, q.published_by, q.published_at, (SELECT COUNT(*) FROM attempts a WHERE a.question_id = q.id) AS attempts
         FROM questions q JOIN chapters c ON c.id = q.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE q.review_status = ? ORDER BY t.subject_key, c.position, q.created_at LIMIT 300`,
    ).bind(data.status).all<Omit<ReviewQuestion, "checks">>();
    const counts = await g.DB.prepare("SELECT review_status, COUNT(*) AS n FROM questions GROUP BY review_status").all<{ review_status: string; n: number }>();
    return { ok: true as const, questions: (r.results ?? []).map((q) => ({ ...q, provenance: q.provenance ? rebrand(q.provenance) : null, checks: questionChecks(q) })), counts: counts.results ?? [] };
  });

export const reviewQuestion = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), action: z.enum(["mark_reviewed", "publish", "unpublish", "return_to_draft"]), note: z.string().max(500).nullable().default(null) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const q = await g.DB.prepare("SELECT id, type, answer_kind, answer, options, explanation, source, source_page, provenance, prompt, review_status, status FROM questions WHERE id = ?").bind(data.id)
      .first<{ id: string; type: string; answer_kind: string | null; answer: string; options: string | null; explanation: string | null; source: string; source_page: number | null; provenance: string | null; prompt: string; review_status: string; status: string }>();
    if (!q) return fail("not_found");
    const ts = now();
    if (data.action === "mark_reviewed") {
      if (q.review_status !== "draft") return fail("not_a_draft");
      const checks = questionChecks(q);
      if (checks.length) return fail("checks_failed", checks.join(","));
      await g.DB.prepare("UPDATE questions SET review_status = 'reviewed', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND review_status = 'draft'").bind(g.admin.id, ts, ts, q.id).run();
    } else if (data.action === "publish") {
      if (q.review_status !== "reviewed") return fail("review_first");
      const checks = questionChecks(q);
      if (checks.length) return fail("checks_failed", checks.join(","));
      await g.DB.prepare("UPDATE questions SET review_status = 'published', status = 'published', published_by = ?, published_at = ?, updated_at = ? WHERE id = ? AND review_status = 'reviewed'").bind(g.admin.id, ts, ts, q.id).run();
    } else if (data.action === "unpublish") {
      if (q.review_status !== "published") return fail("not_published");
      await g.DB.prepare("UPDATE questions SET status = 'draft', review_status = 'reviewed', updated_at = ? WHERE id = ?").bind(ts, q.id).run();
    } else {
      await g.DB.prepare("UPDATE questions SET status = 'draft', review_status = 'draft', reviewed_by = NULL, reviewed_at = NULL, updated_at = ? WHERE id = ?").bind(ts, q.id).run();
    }
    await audit(g.DB, g.admin.id, `question_${data.action}`, q.id, data.note ? { note: data.note } : null);
    return { ok: true as const };
  });

/* ─────────── OCR quality: mathematics tiers and human correction ─────────── */

export const ocrQuality = createServerFn({ method: "POST" })
  .inputValidator(z.object({ textbookId: z.string().uuid(), threshold: z.number().int().min(55).max(95).default(75) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const r = await g.DB.prepare("SELECT page, text, confidence, quality, corrected_text, corrected_at, review_state FROM source_pages WHERE textbook_id = ? ORDER BY page").bind(data.textbookId)
      .all<{ page: number; text: string; confidence: number | null; quality: string; corrected_text: string | null; corrected_at: string | null; review_state: string | null }>();
    const pages = (r.results ?? []).map((p) => ({ page: p.page, confidence: p.confidence, quality: p.quality, corrected: !!p.corrected_text, reviewState: p.review_state, ...mathOcrTier(p.corrected_text ?? p.text, p.corrected_text ? 100 : p.confidence, data.threshold) }));
    const tiers = { excluded: 0, high_risk: 0, check: 0, clean: 0 } as Record<string, number>;
    for (const p of pages) tiers[p.tier]++;
    return { ok: true as const, pages, tiers };
  });

export const ocrPage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ textbookId: z.string().uuid(), page: z.number().int().min(1).max(2000) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const row = await g.DB.prepare("SELECT page, text, confidence, quality, corrected_text, corrected_by, corrected_at, review_state FROM source_pages WHERE textbook_id = ? AND page = ?").bind(data.textbookId, data.page).first<Row>();
    return row ? { ok: true as const, page: row } : fail("not_found");
  });

/** Saves a human correction beside the original OCR text and re-indexes that page from the correction. */
export const correctOcrPage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ textbookId: z.string().uuid(), page: z.number().int().min(1).max(2000), text: z.string().min(1).max(40000).nullable(), state: z.enum(["corrected", "checked_ok", "needs_teacher"]) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const row = await g.DB.prepare("SELECT text, content_hash FROM source_pages WHERE textbook_id = ? AND page = ?").bind(data.textbookId, data.page).first<{ text: string; content_hash: string }>();
    if (!row) return fail("not_found");
    const ts = now();
    const stmts: D1PreparedStatement[] = [];
    if (data.state === "corrected") {
      if (!data.text) return fail("text_required");
      const text = normalizeText(data.text);
      stmts.push(g.DB.prepare("UPDATE source_pages SET corrected_text = ?, corrected_by = ?, corrected_at = ?, review_state = 'corrected' WHERE textbook_id = ? AND page = ?").bind(text, g.admin.id, ts, data.textbookId, data.page));
      // Reviewed or published passages on this page are kept; only unreviewed extraction is replaced by the correction.
      const meta = await g.DB.prepare("SELECT subject_key, page_offset, (SELECT COUNT(*) FROM chapters c WHERE c.textbook_id = t.id AND ? BETWEEN c.start_page AND c.end_page) AS in_ch FROM textbooks t WHERE t.id = ?").bind(data.page, data.textbookId)
        .first<{ subject_key: string; page_offset: number | null; in_ch: number }>();
      stmts.push(g.DB.prepare(`DELETE FROM passages WHERE textbook_id = ? AND page = ? AND NOT ${PROTECTED_SQL}`).bind(data.textbookId, data.page));
      const chunks = chunkPage(text);
      for (let k = 0; k < chunks.length; k++) {
        const q = checkPassage({ text: chunks[k], confidence: null, subjectKey: meta?.subject_key ?? "", printedPage: meta?.page_offset != null ? data.page - meta.page_offset : null, inChapter: (meta?.in_ch ?? 0) > 0, duplicate: false });
        stmts.push(g.DB.prepare("INSERT INTO passages (textbook_id, page, seq, text, content_hash, review_status, publish_status, flags, blocked, provenance, original_text, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, 'ocr_corrected', 'draft', ?, ?, 'review_edit', NULL, ?, ?)")
          .bind(data.textbookId, data.page, k, chunks[k], await sha256Hex(chunks[k]), q.flags.length ? JSON.stringify(q.flags) : null, q.blocked ? 1 : 0, g.admin.id, ts));
      }
    } else {
      stmts.push(g.DB.prepare("UPDATE source_pages SET review_state = ?, corrected_by = ?, corrected_at = ? WHERE textbook_id = ? AND page = ?").bind(data.state, g.admin.id, ts, data.textbookId, data.page));
    }
    await g.DB.batch(stmts);
    await audit(g.DB, g.admin.id, `ocr_${data.state}`, `${data.textbookId}:${data.page}`, { originalHash: row.content_hash });
    return { ok: true as const };
  });

export const auditTrail = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard();
  if (g.error) return g.error;
  const r = await g.DB.prepare("SELECT a.id, a.action, a.target, a.detail, a.created_at, p.username FROM audit_log a LEFT JOIN profiles p ON p.user_id = a.actor_id ORDER BY a.id DESC LIMIT 100").all<Row>();
  return { ok: true as const, entries: r.results ?? [] };
});
