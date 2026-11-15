// Repeatable content import pipeline (pure). Turns one book of an OCR text pack into the rows to insert, with the same
// page classification, segmentation and quality checks as the in-app importer. Rendering those rows as SQL is
// idempotent: re-running never duplicates a book, page or passage and never touches anything a person reviewed.
import { checkPassage, type QualityFlag } from "./quality";
import type { RegistryBook } from "./registry";
import { chunkPage, classifyOcrPage, indexable, normalizeText } from "./text";

export type PackPage = { page: number; text: string; confidence: number | null };
export type PackBook = { bookId: string; key: string; sourceFile: string; sourceSha256: string; pdfPages: number; pages: PackPage[] };

export type PlannedPage = { page: number; text: string; chars: number; banglaRatio: number; quality: string; hash: string; confidence: number | null };
export type PlannedPassage = { page: number; seq: number; text: string; hash: string; flags: QualityFlag[]; blocked: boolean; confidence: number | null };
export type BookPlan = {
  bookId: string; key: string; sourceSha256: string; pages: PlannedPage[]; passages: PlannedPassage[];
  report: { pages: number; indexablePages: number; emptyPages: number; unreadablePages: number; lowConfidencePages: number; passages: number; blocked: number; skippedDuplicates: number; flags: Record<string, number> };
};

/** Validates a pack book against the canonical registry; returns problems (empty = importable). */
export function validatePackBook(b: PackBook, reg: RegistryBook | null): string[] {
  const p: string[] = [];
  if (!reg) return [`Unknown book id ${String(b.bookId).slice(0, 40)}`];
  if (b.key !== reg.key) p.push(`key "${b.key}" does not match the registry ("${reg.key}")`);
  if (b.pdfPages !== reg.pdfPages) p.push(`${b.pdfPages} pages in the pack, ${reg.pdfPages} in the registry`);
  if (!/^[0-9a-f]{64}$/.test(b.sourceSha256 ?? "")) p.push("missing source file fingerprint");
  if (!Array.isArray(b.pages) || b.pages.some((x) => !Number.isInteger(x.page) || x.page < 1 || x.page > reg.pdfPages || typeof x.text !== "string")) p.push("page list is malformed");
  if (new Set(b.pages.map((x) => x.page)).size !== b.pages.length) p.push("a page appears more than once");
  return p;
}

export function planBook(b: PackBook, reg: RegistryBook, sha256: (s: string) => string): BookPlan {
  const pages: PlannedPage[] = [];
  const passages: PlannedPassage[] = [];
  const seen = new Set<string>();
  const report: BookPlan["report"] = { pages: 0, indexablePages: 0, emptyPages: 0, unreadablePages: 0, lowConfidencePages: 0, passages: 0, blocked: 0, skippedDuplicates: 0, flags: {} };
  const inChapter = (page: number) => reg.chapters.some((c) => page >= c.printedStart + reg.pageOffset && page <= c.printedEnd + reg.pageOffset);
  for (const pg of [...b.pages].sort((x, y) => x.page - y.page)) {
    const text = normalizeText(pg.text);
    const cls = classifyOcrPage(text, pg.confidence);
    report.pages++;
    if (cls.quality === "empty") report.emptyPages++;
    if (cls.quality === "legacy_font" || cls.quality === "garbled") report.unreadablePages++;
    if (pg.confidence !== null && pg.confidence < 75) report.lowConfidencePages++;
    pages.push({ page: pg.page, text, chars: cls.chars, banglaRatio: cls.banglaRatio, quality: cls.quality, hash: sha256(text), confidence: pg.confidence });
    if (!indexable(cls.quality)) continue;
    report.indexablePages++;
    const chunks = chunkPage(text);
    const printed = pg.page - reg.pageOffset;
    chunks.forEach((chunk, seq) => {
      const hash = sha256(chunk);
      if (seen.has(hash)) { report.skippedDuplicates++; return; }
      seen.add(hash);
      const q = checkPassage({ text: chunk, confidence: pg.confidence, subjectKey: reg.subjectId, printedPage: printed >= 1 ? printed : null, inChapter: inChapter(pg.page), duplicate: false });
      for (const f of q.flags) report.flags[f] = (report.flags[f] ?? 0) + 1;
      if (q.blocked) report.blocked++;
      report.passages++;
      passages.push({ page: pg.page, seq, text: chunk, hash, flags: q.flags, blocked: q.blocked, confidence: pg.confidence });
    });
  }
  return { bookId: b.bookId, key: b.key, sourceSha256: b.sourceSha256, pages, passages, report };
}

const lit = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);

/** Idempotent SQL for one planned book. New text always arrives as 'draft'; nothing is published by an import. */
export function planToSql(plan: BookPlan, meta: { jobId: string; engine: string; createdAt: string }): string {
  const out: string[] = [
    `-- IntelliHorizon content import: ${plan.key} (${plan.bookId})`,
    `-- Source sha256 ${plan.sourceSha256}; engine: ${meta.engine.replace(/\n/g, " ")}`,
    `-- ${plan.report.pages} pages, ${plan.report.passages} draft passages (${plan.report.blocked} held back by quality warnings). Idempotent: safe to run again.`,
    `INSERT OR IGNORE INTO import_jobs (id, textbook_id, started_by, started_at, finished_at, status, file_sha256, pages_total, pages_received, pages_ok, pages_empty, pages_low, pages_legacy, pages_duplicate, passages, notes, method) VALUES (${[
      meta.jobId, plan.bookId, null, meta.createdAt, meta.createdAt, "completed_with_issues", plan.sourceSha256, plan.report.pages, plan.report.pages, plan.report.indexablePages, plan.report.emptyPages, 0, plan.report.unreadablePages, plan.report.skippedDuplicates, plan.report.passages,
      JSON.stringify({ pipeline: "scripts/content/import-pack.ts", report: plan.report }), "ocr",
    ].map(lit).join(", ")});`,
    `UPDATE textbooks SET status = 'needs_review', extraction_method = 'ocr', file_sha256 = COALESCE(file_sha256, ${lit(plan.sourceSha256)}), updated_at = ${lit(meta.createdAt)} WHERE id = ${lit(plan.bookId)} AND status IN ('discovered', 'failed');`,
  ];
  for (const p of plan.pages)
    out.push(`INSERT OR IGNORE INTO source_pages (textbook_id, page, text, char_count, bangla_ratio, quality, content_hash, confidence) VALUES (${[plan.bookId, p.page, p.text, p.chars, p.banglaRatio, p.quality, p.hash, p.confidence].map(lit).join(", ")});`);
  for (const p of plan.passages)
    out.push(
      `INSERT INTO passages (textbook_id, page, seq, text, content_hash, publish_status, flags, blocked, provenance, confidence) SELECT ${[plan.bookId, p.page, p.seq, p.text, p.hash].map(lit).join(", ")}, 'draft', ${lit(p.flags.length ? JSON.stringify(p.flags) : null)}, ${p.blocked ? 1 : 0}, 'ocr_pack', ${lit(p.confidence)} WHERE NOT EXISTS (SELECT 1 FROM passages WHERE textbook_id = ${lit(plan.bookId)} AND (content_hash = ${lit(p.hash)} OR (page = ${p.page} AND seq = ${p.seq})));`,
    );
  return out.join("\n") + "\n";
}
