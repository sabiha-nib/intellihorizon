// Usage: bun scripts/content/import-pack.ts <pack.json|pack.json.gz> <out-dir> [book-key,...]
// Writes one idempotent SQL file per book plus report.json. Apply with:
//   wrangler d1 execute DB --local  --file <out-dir>/<key>.sql   (or --remote, by the site owner)
// Running the same pack twice changes nothing the second time; reviewed or published passages are never touched.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { type PackBook, planBook, planToSql, validatePackBook } from "../../src/lib/curriculum/pipeline";
import { bookById } from "../../src/lib/curriculum/registry";

const [packPath, outDir, only] = process.argv.slice(2);
if (!packPath || !outDir) { console.error("usage: bun scripts/content/import-pack.ts <pack> <out-dir> [keys]"); process.exit(2); }
const raw = readFileSync(packPath);
const pack = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8")) as { format: string; version: number; createdAt: string; engine: string; books: PackBook[] };
if (pack.format !== "educerro-text-pack" || pack.version !== 1) { console.error("Not an IntelliHorizon text pack (format educerro-text-pack, version 1)."); process.exit(1); }
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const keys = only ? new Set(only.split(",")) : null;
mkdirSync(outDir, { recursive: true });
const report: Record<string, unknown> = {};
let failed = 0;
for (const b of pack.books) {
  if (keys && !keys.has(b.key)) continue;
  const reg = bookById(b.bookId);
  const problems = validatePackBook(b, reg);
  if (problems.length || !reg) { failed++; report[b.key] = { failed: problems }; console.error(`${b.key}: NOT imported: ${problems.join("; ")}`); continue; }
  const plan = planBook(b, reg, sha);
  const h = sha(`${b.sourceSha256}:${b.bookId}:${pack.createdAt}`);
  const jobId = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  writeFileSync(`${outDir}/${b.key}.sql`, planToSql(plan, { jobId, engine: pack.engine, createdAt: pack.createdAt }));
  report[b.key] = plan.report;
  console.log(`${b.key}: ${plan.report.pages} pages, ${plan.report.passages} passages, ${plan.report.blocked} held back, ${plan.report.skippedDuplicates} duplicates skipped`);
}
writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
