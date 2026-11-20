// Content review workspace: coverage, the passage queue, and the review lifecycle. Admin only, checked on the server for
// every call. Every change is written together with a passage_reviews row and an audit_log row in one D1 batch.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sha256Hex } from "../auth/crypto.server";
import { sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { requireAdmin } from "../curriculum/admin.server";
import { BLOCKING, type QualityFlag, checkPassage } from "../curriculum/quality";
import { normalizeText } from "../curriculum/text";
import { SUBJECT_IDS } from "../curriculum/registry";

type Fail = { ok: false; code: string; detail?: string };
const fail = (code: string, detail?: string): Fail => ({ ok: false, code, detail });
const now = () => new Date().toISOString();

async function guard() {
  const { DB } = bindings();
  if (!DB) return { error: fail("unavailable_now") } as const;
  if (!sameOrigin()) return { error: fail("bad_origin") } as const;
  const admin = await requireAdmin();
  if (!admin) return { error: fail("not_admin") } as const;
  return { DB, admin, error: null } as const;
}

const REVIEW = ["none", "ocr_corrected", "checked", "teacher_reviewed", "rejected"] as const;
const PUBLISH = ["draft", "approved", "published", "withdrawn"] as const;

/* ─────────── Coverage ─────────── */

export type CoverageBook = {
  id: string; title: string; subject_key: string; subject_name: string; grade: number; medium: string; status: string; license_status: string; page_count: number | null;
  chapters: number; pages_imported: number; pages_low_conf: number; pages_awaiting: number; passages: number;
  extracted: number; corrected: number; checked: number; teacher: number; rejected: number;
  draft: number; approved: number; published: number; withdrawn: number; blocked: number; math_unverified: number; failed_imports: number; student_visible: number;
};

export const contentCoverage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ grade: z.number().int().min(1).max(12).nullable().default(null), subjectId: z.enum(SUBJECT_IDS).nullable().default(null), bookId: z.string().uuid().nullable().default(null) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const where = ["t.status != 'retired'"];
    const args: (string | number)[] = [];
    if (data.grade !== null) { where.push("t.grade = ?"); args.push(data.grade); }
    if (data.subjectId) { where.push("t.subject_key = ?"); args.push(data.subjectId); }
    if (data.bookId) { where.push("t.id = ?"); args.push(data.bookId); }
    const r = await g.DB.prepare(
      `SELECT t.id, t.title, t.subject_key, t.subject_name, t.grade, t.medium, t.status, t.license_status, t.page_count,
        (SELECT COUNT(*) FROM chapters c WHERE c.textbook_id = t.id) AS chapters,
        (SELECT COUNT(*) FROM source_pages s WHERE s.textbook_id = t.id) AS pages_imported,
        (SELECT COUNT(*) FROM source_pages s WHERE s.textbook_id = t.id AND s.confidence IS NOT NULL AND s.confidence < 75) AS pages_low_conf,
        (SELECT COUNT(DISTINCT p.page) FROM passages p WHERE p.textbook_id = t.id AND p.review_status IS NULL AND COALESCE(p.publish_status, 'draft') = 'draft') AS pages_awaiting,
        COUNT(p.id) AS passages,
        SUM(p.review_status IS NULL) AS extracted, SUM(p.review_status = 'ocr_corrected') AS corrected, SUM(p.review_status = 'checked') AS checked,
        SUM(p.review_status = 'teacher_reviewed') AS teacher, SUM(p.review_status = 'rejected') AS rejected,
        SUM(COALESCE(p.publish_status, 'draft') = 'draft') AS draft, SUM(p.publish_status = 'approved') AS approved, SUM(p.publish_status = 'published') AS published,
        SUM(p.publish_status = 'withdrawn') AS withdrawn, SUM(p.blocked = 1) AS blocked, SUM(p.flags LIKE '%math_unverified%') AS math_unverified,
        SUM(CASE WHEN p.id IS NULL THEN 0 WHEN (p.publish_status = 'published' OR (t.status = 'indexed' AND COALESCE(p.publish_status, 'draft') = 'draft' AND p.blocked = 0)) AND COALESCE(p.review_status, '') != 'rejected' THEN 1 ELSE 0 END) AS student_visible,
        (SELECT COUNT(*) FROM import_jobs j WHERE j.textbook_id = t.id AND j.status = 'failed') AS failed_imports
       FROM textbooks t LEFT JOIN passages p ON p.textbook_id = t.id
      WHERE ${where.join(" AND ")} GROUP BY t.id ORDER BY t.subject_key, t.title`,
    ).bind(...args).all<CoverageBook>();
    const books = (r.results ?? []).map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v === null && k !== "page_count" ? 0 : v])) as CoverageBook);
    const sum = (k: keyof CoverageBook) => books.reduce((n, b) => n + (Number(b[k]) || 0), 0);
    const keys: (keyof CoverageBook)[] = ["chapters", "pages_imported", "pages_low_conf", "pages_awaiting", "passages", "extracted", "corrected", "checked", "teacher", "rejected", "draft", "approved", "published", "withdrawn", "blocked", "math_unverified", "failed_imports", "student_visible"];
    const totals = Object.fromEntries(keys.map((k) => [k, sum(k)])) as Record<string, number>;
    const subjects = [...new Set(books.map((b) => b.subject_key))].map((s) => {
      const bs = books.filter((b) => b.subject_key === s);
      return { subject_key: s, subject_name: bs[0].subject_name, books: bs.length, ...Object.fromEntries(keys.map((k) => [k, bs.reduce((n, b) => n + (Number(b[k]) || 0), 0)])) } as Record<string, string | number>;
    });
    return { ok: true as const, books, totals: { books: books.length, ...totals }, subjects };
  });

/* ─────────── Queue ─────────── */

export type QueueRow = { id: number; page: number; seq: number; printed_page: number | null; snippet: string; review_status: string | null; publish_status: string | null; flags: string | null; blocked: number; confidence: number | null; chapter: string | null; updated: string | null };

export const passageQueue = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    bookId: z.string().uuid(),
    chapterId: z.string().uuid().nullable().default(null),
    review: z.enum(REVIEW).nullable().default(null),
    publish: z.enum(PUBLISH).nullable().default(null),
    flag: z.string().max(40).nullable().default(null),
    offset: z.number().int().min(0).max(100000).default(0),
  }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const book = await g.DB.prepare("SELECT id, title, subject_key, page_offset, page_count FROM textbooks WHERE id = ?").bind(data.bookId).first<{ id: string; title: string; subject_key: string; page_offset: number | null; page_count: number | null }>();
    if (!book) return fail("not_found");
    const where = ["p.textbook_id = ?"];
    const args: (string | number)[] = [data.bookId];
    if (data.chapterId) { where.push("EXISTS (SELECT 1 FROM chapters c WHERE c.id = ? AND c.textbook_id = p.textbook_id AND p.page BETWEEN c.start_page AND c.end_page)"); args.push(data.chapterId); }
    if (data.review === "none") where.push("p.review_status IS NULL");
    else if (data.review) { where.push("p.review_status = ?"); args.push(data.review); }
    if (data.publish === "draft") where.push("COALESCE(p.publish_status, 'draft') = 'draft'");
    else if (data.publish) { where.push("p.publish_status = ?"); args.push(data.publish); }
    if (data.flag) { where.push("p.flags LIKE ?"); args.push(`%"${data.flag.replace(/[^a-z_]/g, "")}"%`); }
    const [rows, count, chapters] = await Promise.all([
      g.DB.prepare(`SELECT p.id, p.page, p.seq, substr(p.text, 1, 160) AS snippet, p.review_status, p.publish_status, p.flags, p.blocked, COALESCE(p.confidence, (SELECT s.confidence FROM source_pages s WHERE s.textbook_id = p.textbook_id AND s.page = p.page)) AS confidence,
          (SELECT c.title FROM chapters c WHERE c.textbook_id = p.textbook_id AND p.page BETWEEN c.start_page AND c.end_page LIMIT 1) AS chapter, p.reviewed_at AS updated
          FROM passages p WHERE ${where.join(" AND ")} ORDER BY p.page, p.seq LIMIT 50 OFFSET ?`).bind(...args, data.offset).all<Omit<QueueRow, "printed_page">>(),
      g.DB.prepare(`SELECT COUNT(*) AS n FROM passages p WHERE ${where.join(" AND ")}`).bind(...args).first<{ n: number }>(),
      g.DB.prepare("SELECT id, position, title, start_page, end_page FROM chapters WHERE textbook_id = ? ORDER BY position").bind(data.bookId).all<{ id: string; position: number; title: string; start_page: number | null; end_page: number | null }>(),
    ]);
    const items: QueueRow[] = (rows.results ?? []).map((r) => ({ ...r, printed_page: book.page_offset !== null && r.page - book.page_offset >= 1 ? r.page - book.page_offset : null }));
    return { ok: true as const, book, items, total: count?.n ?? 0, chapters: chapters.results ?? [] };
  });

/* ─────────── One passage ─────────── */

export const getPassage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const p = await g.DB.prepare(
      `SELECT p.*, t.title AS book_title, t.subject_key, t.subject_name, t.page_offset, t.page_count, t.license_status, t.status AS book_status, t.file_sha256,
        (SELECT c.title FROM chapters c WHERE c.textbook_id = p.textbook_id AND p.page BETWEEN c.start_page AND c.end_page LIMIT 1) AS chapter,
        (SELECT s.confidence FROM source_pages s WHERE s.textbook_id = p.textbook_id AND s.page = p.page) AS page_confidence,
        (SELECT COALESCE(s.corrected_text, s.text) FROM source_pages s WHERE s.textbook_id = p.textbook_id AND s.page = p.page) AS page_text
       FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE p.id = ?`,
    ).bind(data.id).first<Record<string, string | number | null>>();
    if (!p) return fail("not_found");
    const hist = await g.DB.prepare("SELECT r.id, r.action, r.from_review, r.to_review, r.from_publish, r.to_publish, r.note, r.created_at, pr.username FROM passage_reviews r LEFT JOIN profiles pr ON pr.user_id = r.actor_id WHERE r.passage_id = ? ORDER BY r.id DESC LIMIT 50")
      .bind(data.id).all<Record<string, string | number | null>>();
    const offset = p.page_offset as number | null;
    return { ok: true as const, passage: { ...p, printed_page: offset !== null && (p.page as number) - offset >= 1 ? (p.page as number) - offset : null }, history: hist.results ?? [] };
  });

/* ─────────── Review actions ─────────── */

const ACTIONS = ["save_correction", "mark_checked", "mark_teacher_reviewed", "approve", "publish", "reject", "withdraw", "return_to_draft"] as const;
/** Warnings that may remain on published text: everything that isn't BLOCKING (shown to reviewers, doesn't make the text wrong). */
const PUBLISHABLE_WITH: QualityFlag[] = ["short", "no_chapter", "no_printed_page"];
void BLOCKING;

export const reviewPassage = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.number().int().positive(),
    action: z.enum(ACTIONS),
    /** content_hash the reviewer was looking at; a different value means someone changed it meanwhile */
    expectedHash: z.string().regex(/^[0-9a-f]{64}$/),
    text: z.string().min(1).max(8000).nullable().default(null),
    note: z.string().max(1000).nullable().default(null),
    /** The reviewer confirms every mathematical expression matches the printed page. Required to check a maths passage. */
    mathConfirmed: z.boolean().default(false),
    /** The reviewer confirms they compared the text word by word with the page image. Required for mark_checked. */
    comparedWithPage: z.boolean().default(false),
    teacherName: z.string().max(80).nullable().default(null),
  }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const p = await g.DB.prepare("SELECT p.*, t.subject_key, t.page_offset, (SELECT COUNT(*) FROM chapters c WHERE c.textbook_id = p.textbook_id AND p.page BETWEEN c.start_page AND c.end_page) AS in_ch FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE p.id = ?")
      .bind(data.id).first<{ id: number; textbook_id: string; page: number; text: string; content_hash: string; review_status: string | null; publish_status: string | null; flags: string | null; blocked: number; original_text: string | null; confidence: number | null; subject_key: string; page_offset: number | null; in_ch: number }>();
    if (!p) return fail("not_found");
    if (p.content_hash !== data.expectedHash) return fail("changed_meanwhile", "Someone changed this passage after you opened it. Reload it.");
    const flags: QualityFlag[] = p.flags ? (JSON.parse(p.flags) as QualityFlag[]) : [];
    const pub = p.publish_status ?? "draft";
    const note = data.note?.trim() || null;
    let text = p.text;
    let hash = p.content_hash;
    let review = p.review_status;
    let publish: string = pub;
    let newFlags = flags;
    let action: string = data.action;

    const recheck = (t: string, opts: { confirmedMath: boolean; checked: boolean }) => {
      const q = checkPassage({ text: t, confidence: opts.checked ? null : p.confidence, subjectKey: p.subject_key, printedPage: p.page_offset !== null ? p.page - p.page_offset : null, inChapter: p.in_ch > 0, duplicate: flags.includes("duplicate"), mathConfirmed: opts.confirmedMath });
      return q.flags;
    };

    switch (data.action) {
      case "save_correction": {
        if (!data.text) return fail("text_required");
        if (review === "rejected") return fail("rejected_passage");
        text = normalizeText(data.text);
        if (text === p.text) return fail("no_change");
        hash = await sha256Hex(text);
        // A changed text must be checked again: any earlier verification no longer applies, and it leaves students until republished.
        review = "ocr_corrected";
        if (pub === "approved" || pub === "published") publish = "draft";
        newFlags = recheck(text, { confirmedMath: false, checked: false });
        break;
      }
      case "mark_checked": {
        if (!data.comparedWithPage) return fail("confirm_compared", "Confirm you compared the text word by word with the page image.");
        if (review === "rejected") return fail("rejected_passage");
        if (review === "checked" || review === "teacher_reviewed") return fail("already_checked");
        if (flags.includes("math_unverified") && !data.mathConfirmed) return fail("math_confirmation_required", "This passage contains mathematics. Confirm every expression matches the printed page, or correct it first.");
        review = "checked";
        newFlags = recheck(text, { confirmedMath: data.mathConfirmed || !flags.includes("math_unverified"), checked: true });
        break;
      }
      case "mark_teacher_reviewed": {
        const who = data.teacherName?.trim() ?? "";
        if (who.length < 2) return fail("teacher_name_required", "Record the name of the teacher who reviewed it.");
        if (review !== "checked") return fail("must_be_checked_first", "A teacher review is recorded after the text has been checked against the page.");
        review = "teacher_reviewed";
        action = "mark_teacher_reviewed";
        break;
      }
      case "approve": {
        if (review !== "checked" && review !== "teacher_reviewed") return fail("not_reviewed", "Only text checked against the page (or teacher reviewed) can be approved for students.");
        const open = flags.filter((f) => !PUBLISHABLE_WITH.includes(f));
        if (open.length) return fail("open_warnings", `Resolve these first: ${open.join(", ")}.`);
        if (pub !== "draft" && pub !== "withdrawn") return fail("bad_transition");
        publish = "approved";
        break;
      }
      case "publish": {
        if (pub !== "approved") return fail("approve_first", "Approve the passage before publishing it.");
        publish = "published";
        break;
      }
      case "reject": {
        if (!note) return fail("note_required", "Say why it is rejected.");
        review = "rejected";
        if (pub === "approved" || pub === "published") publish = "withdrawn";
        break;
      }
      case "withdraw": {
        if (!note) return fail("note_required", "Say why it is withdrawn.");
        if (pub !== "published" && pub !== "approved") return fail("bad_transition");
        publish = "withdrawn";
        break;
      }
      case "return_to_draft": {
        if (pub === "published") return fail("withdraw_first");
        publish = "draft";
        if (review === "rejected") review = p.original_text ? "ocr_corrected" : null;
        break;
      }
    }
    const blocked = newFlags.some((f) => !PUBLISHABLE_WITH.includes(f)) ? 1 : 0;
    const ts = now();
    const histNote = data.action === "mark_teacher_reviewed" ? `Teacher: ${data.teacherName?.trim()}${note ? ` — ${note}` : ""}` : data.action === "mark_checked" && data.mathConfirmed ? `Mathematics confirmed against the page${note ? ` — ${note}` : ""}` : note;
    const res = await g.DB.batch([
      g.DB.prepare(`UPDATE passages SET text = ?, content_hash = ?, review_status = ?, publish_status = ?, flags = ?, blocked = ?, original_text = COALESCE(original_text, CASE WHEN ? != text THEN text END),
                    provenance = CASE WHEN ? != text THEN 'review_edit' ELSE provenance END, reviewed_by = ?, reviewed_at = ?, review_note = COALESCE(?, review_note)
                    WHERE id = ? AND content_hash = ?`)
        .bind(text, hash, review, publish, newFlags.length ? JSON.stringify(newFlags) : null, blocked, text, text, g.admin.id, ts, histNote, p.id, data.expectedHash),
      g.DB.prepare("INSERT INTO passage_reviews (passage_id, actor_id, action, from_review, to_review, from_publish, to_publish, old_hash, new_hash, note, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1")
        .bind(p.id, g.admin.id, action, p.review_status, review, p.publish_status, publish, p.content_hash, hash, histNote, ts),
      g.DB.prepare("INSERT INTO audit_log (actor_id, action, target, detail, created_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM passages WHERE id = ? AND reviewed_at = ? AND reviewed_by = ? AND content_hash = ?)")
        .bind(g.admin.id, `passage_${action}`, `passage:${p.id}`, JSON.stringify({ from: [p.review_status, p.publish_status], to: [review, publish] }), ts, p.id, ts, g.admin.id, hash),
    ]);
    void res;
    // D1's meta.changes isn't a reliable affected-row count when triggers fire (the full-text index), so confirm by
    // reading the row back: the guarded UPDATE only applies if the hash still matched.
    const after = await g.DB.prepare("SELECT reviewed_at, reviewed_by, content_hash FROM passages WHERE id = ?").bind(p.id).first<{ reviewed_at: string | null; reviewed_by: string | null; content_hash: string }>();
    if (!after || after.reviewed_at !== ts || after.reviewed_by !== g.admin.id || after.content_hash !== hash) return fail("changed_meanwhile");
    return { ok: true as const, review, publish, flags: newFlags, blocked: !!blocked, hash };
  });

/* ─────────── AI configuration status (no secrets) ─────────── */

export const aiAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const g = await guard();
  if (g.error) return g.error;
  const { providerStatus } = await import("../ai/providers");
  const env = bindings() as unknown as Record<string, string | undefined>;
  const providers = providerStatus(env);
  const first = providers.find((p) => p.configured) ?? null;
  const day = new Date().toISOString().slice(0, 10);
  const r = await g.DB.prepare("SELECT status, COUNT(*) AS n FROM ai_requests WHERE created_at >= ? GROUP BY status").bind(`${day}T00:00:00`).all<{ status: string; n: number }>();
  return {
    ok: true as const,
    ai: first ? { configured: true as const, provider: first.id, model: first.model, vision: providers.some((p) => p.configured && p.vision) } : { configured: false as const, provider: null, model: null, vision: false },
    providers,
    today: r.results ?? [],
    email: { configured: !!bindings().RESEND_API_KEY && !!bindings().EMAIL_FROM },
  };
});

/* ─────────── AI usage by provider (no prompts, no answers, no keys) ─────────── */

const ERROR_STATUSES = ["timeout", "rate_limited", "provider_error", "bad_response", "auth_failed", "truncated"];

export const aiUsage = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().int().min(1).max(90).default(30) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const errs = ERROR_STATUSES.map(() => "?").join(",");
    const rows = await g.DB.prepare(
      `SELECT provider,
              COUNT(*) AS calls,
              SUM(CASE WHEN COALESCE(role, 'primary') IN ('primary', 'fallback') THEN 1 ELSE 0 END) AS authored,
              SUM(CASE WHEN role = 'verifier' THEN 1 ELSE 0 END) AS verifications,
              SUM(CASE WHEN role = 'independent' THEN 1 ELSE 0 END) AS independent,
              SUM(CASE WHEN role = 'fallback' THEN 1 ELSE 0 END) AS fallbacks,
              SUM(CASE WHEN status IN (${errs}) THEN 1 ELSE 0 END) AS errors,
              AVG(CASE WHEN status NOT IN (${errs}) THEN latency_ms END) AS avg_ms,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              SUM(cost_usd) AS cost_usd,
              SUM(CASE WHEN role = 'verifier' AND COALESCE(disagreements, 0) > 0 THEN 1 ELSE 0 END) AS disagreeing
         FROM ai_requests WHERE created_at >= ? AND provider IS NOT NULL GROUP BY provider`,
    ).bind(...ERROR_STATUSES, ...ERROR_STATUSES, since).all<Record<string, number | string | null>>();
    const strategies = await g.DB.prepare("SELECT COALESCE(strategy, 'primary') AS strategy, COUNT(DISTINCT COALESCE(request_group, CAST(id AS TEXT))) AS n FROM ai_requests WHERE created_at >= ? GROUP BY 1").bind(since).all<{ strategy: string; n: number }>();
    const disputes = await g.DB.prepare("SELECT id, task, question, issues, status, created_at FROM ai_disputes ORDER BY created_at DESC LIMIT 20").all<{ id: string; task: string; question: string; issues: string; status: string; created_at: string }>();
    const env = bindings() as unknown as Record<string, string | undefined>;
    const { providerStatus } = await import("../ai/providers");
    const { spend } = await import("../ai/orchestrator.server");
    return {
      ok: true as const, days: data.days,
      providers: providerStatus(env),
      usage: rows.results ?? [],
      strategies: strategies.results ?? [],
      disputes: (disputes.results ?? []).map((d) => ({ ...d, issues: JSON.parse(d.issues || "[]") as string[] })),
      spend: await spend(g.DB),
      caps: { daily: Number(env.AI_DAILY_BUDGET_USD) || null, monthly: Number(env.AI_MONTHLY_BUDGET_USD) || null },
    };
  });

export const resolveDispute = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["resolved", "dismissed"]) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    await g.DB.prepare("UPDATE ai_disputes SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ?").bind(data.status, g.admin.id, new Date().toISOString(), data.id).run();
    return { ok: true as const };
  });
