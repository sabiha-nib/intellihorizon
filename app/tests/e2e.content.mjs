// End-to-end tests for content trust: the repeatable import pipeline (idempotency, metadata validation, quality flags),
// the passage review workspace (correct, check, teacher review, approve, publish, withdraw, reject) with audit history,
// optimistic concurrency, server-side admin enforcement, and that only published or approved-book text reaches students.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8787";
const PW = "monsoon river kite 7";
const APP = "/home/user/website-17609620527ef5f4f428f302/app";
const results = [];
const check = (n, ok, x = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : x); };
const WR = "/home/user/tools/node_modules/.bin/wrangler";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const applyFile = (f) => execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --file ${f}`, { cwd: "/tmp/wr", stdio: "ignore" });
const SCI = "41f978e8-eeda-5506-b1ea-dc96ca7fec47";
const MATH = "95402820-a31b-54ab-83e6-55a0dabe844b";

async function register(page, { name, username, email }) {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PW);
  await page.getByLabel("Confirm password").fill(PW);
  await page.getByText("Available").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("combobox").fill("Dhak");
  await page.getByRole("option", { name: /^Dhaka ঢাকা/ }).click();
  await page.getByRole("radio", { name: "Class 7" }).click();
  await page.getByRole("radio", { name: /NCTB, Bangla Medium/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText(/^Welcome, /).waitFor({ timeout: 15000 });
}

// 0. The 16 checked passages keep their real history
check("the 16 checked passages are published, still 'checked' (not upgraded), each with its seed history", sql("SELECT COUNT(*) AS n FROM passages WHERE review_status = 'checked' AND publish_status = 'published' AND provenance = 'checked_seed'")[0].n === 16 && sql("SELECT COUNT(*) AS n FROM passage_reviews WHERE action = 'seed_checked'")[0].n === 16 && sql("SELECT COUNT(*) AS n FROM passages WHERE review_status = 'teacher_reviewed'")[0].n === 0);

// 1. Pipeline: idempotent import with quality flags
const lumen = "Lumenvex is a made-up science word used by the automated content test. It describes nothing real at all.";
const pack = { format: "educerro-text-pack", version: 1, createdAt: "2026-11-15T00:00:00Z", engine: "test", books: [
  { bookId: SCI, key: "science", sourceFile: "x.pdf", sourceSha256: "b".repeat(64), pdfPages: 166, pages: [
    { page: 16, text: `${lumen}\n\n${lumen.replace("science", "biology")}`, confidence: 91 },
    { page: 17, text: lumen, confidence: 91 },
    { page: 2, text: "Front matter of the book without a printed page number, long enough to be a passage of text here.", confidence: 90 },
  ] },
  { bookId: MATH, key: "math", sourceFile: "y.pdf", sourceSha256: "c".repeat(64), pdfPages: 181, pages: [
    { page: 30, text: "অনুপাত ৩ : ৫ = ৬ : ১০ হলে সমানুপাতের রাশিগুলো নির্ণয় করো এবং প্রতিটি ধাপ ব্যাখ্যা করো। এই উদাহরণটি পরীক্ষার জন্য।", confidence: 61 },
  ] },
  { bookId: SCI, key: "science", sourceFile: "z.pdf", sourceSha256: "d".repeat(64), pdfPages: 12, pages: [] },
] };
writeFileSync("/tmp/fx-pack.json", JSON.stringify(pack));
const run = spawnSync(`${process.env.HOME}/.bun/bin/bun`, ["scripts/content/import-pack.ts", "/tmp/fx-pack.json", "/tmp/fx-out"], { cwd: APP, encoding: "utf8" });
check("a book whose page count doesn't match the registry is refused, with the reason", run.status === 1 && run.stderr.includes("166 in the registry"), run.stderr);
applyFile("/tmp/fx-out/science.sql"); applyFile("/tmp/fx-out/math.sql");
const count = () => sql(`SELECT (SELECT COUNT(*) FROM passages WHERE provenance = 'ocr_pack') AS p, (SELECT COUNT(*) FROM source_pages WHERE textbook_id IN ('${SCI}', '${MATH}')) AS s, (SELECT COUNT(*) FROM import_jobs) AS j`)[0];
const first = count();
applyFile("/tmp/fx-out/science.sql"); applyFile("/tmp/fx-out/math.sql");
const second = count();
check("running the same import twice creates no duplicate pages, passages or jobs", JSON.stringify(first) === JSON.stringify(second) && first.p >= 3, JSON.stringify([first, second]));
check("repeated text on another page is skipped, not duplicated", sql(`SELECT COUNT(*) AS n FROM passages WHERE textbook_id = '${SCI}' AND text = '${lumen}'`)[0].n === 1);
check("imported text arrives as drafts; nothing is published by an import", sql("SELECT COUNT(*) AS n FROM passages WHERE provenance = 'ocr_pack' AND publish_status != 'draft'")[0].n === 0);
const front = sql(`SELECT flags, blocked FROM passages WHERE textbook_id = '${SCI}' AND page = 2`)[0];
check("text with no printed page and no chapter is flagged for reviewers", front.flags.includes("no_printed_page") && front.flags.includes("no_chapter"), JSON.stringify(front));
const m = sql(`SELECT id, flags, blocked FROM passages WHERE textbook_id = '${MATH}' AND page = 30`)[0];
check("low-confidence mathematics is flagged and not approved automatically", m.blocked === 1 && m.flags.includes("low_confidence") && m.flags.includes("math_unverified"), JSON.stringify(m));
check("the import is recorded with its report", sql(`SELECT COUNT(*) AS n FROM import_jobs WHERE textbook_id = '${SCI}' AND notes LIKE '%import-pack%'`)[0].n === 1);

// 2. Students can't see draft text, even in an approved book, while it is held back
const browser = await chromium.launch();
const S = await browser.newContext({ viewport: { width: 390, height: 844 } });
const ps = await S.newPage();
await register(ps, { name: "Student Tester", username: "stud_c", email: "stud.c@example.com" });
const askSci = async (q) => {
  await ps.goto(`${BASE}/tutor?subject=science`);
  await ps.getByPlaceholder(/Ask a question/).fill(q);
  await ps.getByRole("button", { name: "Send" }).click();
  await ps.waitForTimeout(3500);
  return JSON.parse(sql("SELECT m.payload FROM tutor_messages m JOIN tutor_threads t ON t.id = m.thread_id JOIN users u ON u.id = t.user_id WHERE u.email = 'stud.c@example.com' AND m.role = 'tutor' ORDER BY m.id DESC LIMIT 1")[0].payload);
};
let p = await askSci("What is lumenvex?");
check("draft text is not searchable by students", p.excerpts.length === 0, p.status);

// 3. Review workspace, driven through the admin UI
const A = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const calls = [];
pa.on("request", (r) => { if (r.method() === "POST" && (r.postData() ?? "").includes("expectedHash")) calls.push({ url: r.url(), body: r.postData(), headers: Object.fromEntries(Object.entries(r.headers()).filter(([k]) => !["host", "content-length", "cookie"].includes(k))) }); });
await register(pa, { name: "Admin Tester", username: "admin_c", email: "admin.c@example.com" });
await pa.goto(`${BASE}/admin`);
await pa.getByLabel("Owner code or admin token").fill("local-test-admin-token-0123456789abcdef");
await pa.getByRole("button", { name: "Unlock admin for this account" }).click();
await pa.getByRole("tab", { name: "Coverage" }).waitFor({ timeout: 15000 });
await pa.getByRole("tab", { name: "Coverage" }).click();
await pa.getByText("Passages students can see").waitFor({ timeout: 15000 });
const tile = async (label) => Number(await pa.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd").first().innerText());
check("coverage shows real counts from the database", (await tile("Books")) === 9 && (await tile("Published passages")) === 16 && (await tile("Passages checked against images")) === 16 && (await tile("Pages imported")) === Number(sql("SELECT COUNT(*) AS n FROM source_pages")[0].n));
check("coverage reports unchecked mathematics", (await tile("Unchecked mathematics")) >= 1);
check("coverage tells the admin whether AI and email are configured", (await pa.getByText(/AI explanations:/).count()) === 1 && (await pa.getByText(/Account email:/).count()) === 1);
await pa.getByRole("tab", { name: "Passage review" }).click();
await pa.getByLabel("Book", { exact: true }).selectOption(SCI);
await pa.locator("li button", { hasText: "PDF p. 17" }).first().click();
await pa.getByLabel("Passage text").waitFor();
const pid = Number(sql(`SELECT id FROM passages WHERE textbook_id = '${SCI}' AND text = '${lumen}'`)[0].id);
await pa.getByRole("button", { name: "Approve for students", exact: true }).isDisabled();
// Correct the text
await pa.getByLabel("Passage text").fill(`${lumen} Corrected.`);
await pa.getByRole("button", { name: "Save correction", exact: true }).click();
await pa.getByText("Saved and recorded in the audit log.").waitFor({ timeout: 10000 }).catch(async (e) => { console.log("ALERTS", await pa.locator("[role=alert]").allInnerTexts()); await pa.screenshot({ path: "/tmp/ct-fail.png" }); throw e; });
let row = sql(`SELECT review_status, publish_status, original_text, text FROM passages WHERE id = ${pid}`)[0];
check("a correction keeps the original extraction and marks the text 'OCR corrected'", row.review_status === "ocr_corrected" && row.original_text === lumen && row.text.endsWith("Corrected."), JSON.stringify(row));
// Checking requires confirming the comparison
await pa.getByRole("button", { name: "Mark checked against page", exact: true }).click();
await pa.getByText(/compared the text word by word/).first().waitFor({ timeout: 10000 });
check("marking checked requires confirming a word-by-word comparison with the page", sql(`SELECT review_status FROM passages WHERE id = ${pid}`)[0].review_status === "ocr_corrected");
await pa.getByLabel("I compared this text word by word with the page image.").check();
await pa.getByRole("button", { name: "Mark checked against page", exact: true }).click();
await pa.getByText("Saved and recorded in the audit log.").waitFor({ timeout: 10000 });
// Teacher review requires a name
await pa.getByRole("button", { name: "Record teacher review", exact: true }).click();
await pa.getByText(/name of the teacher/).waitFor({ timeout: 10000 });
check("a teacher review needs the teacher's name", sql(`SELECT review_status FROM passages WHERE id = ${pid}`)[0].review_status === "checked");
// Approve, then publish
await pa.getByRole("button", { name: "Approve for students", exact: true }).click();
await pa.getByText("Saved and recorded in the audit log.").waitFor({ timeout: 10000 });
check("approved is not yet published", sql(`SELECT publish_status FROM passages WHERE id = ${pid}`)[0].publish_status === "approved");
p = await askSci("What is lumenvex?");
check("approved-but-unpublished text is still not shown to students", p.excerpts.length === 0);
await pa.getByRole("button", { name: "Publish", exact: true }).click();
await pa.getByText("Saved and recorded in the audit log.").waitFor({ timeout: 10000 });
p = await askSci("What is lumenvex?");
check("published text is found by the tutor, labelled as checked", p.status === "grounded" && p.excerpts.some((e) => e.source.passageId === pid && e.source.extraction === "checked" && e.source.printedPage === 12), JSON.stringify(p.excerpts.map((e) => e.source)));
const hist = sql(`SELECT action, actor_id FROM passage_reviews WHERE passage_id = ${pid} ORDER BY id`);
check("every step is in the passage history with who did it", JSON.stringify(hist.map((h) => h.action)) === JSON.stringify(["save_correction", "mark_checked", "approve", "publish"]) && hist.every((h) => h.actor_id), JSON.stringify(hist));
check("every step is in the audit log", sql(`SELECT COUNT(*) AS n FROM audit_log WHERE target = 'passage:${pid}'`)[0].n === 4);
// Concurrency: a stale view can't overwrite newer work
const stale = calls.find((c) => c.body.includes("approve"));
const replay = await pa.evaluate(async ({ url, body, headers }) => (await fetch(url, { method: "POST", body, headers })).text(), stale);
check("a review action based on an out-of-date copy is refused", replay.includes("changed_meanwhile") || replay.includes("bad_transition"), replay.slice(0, 200));
// A student can't perform the same action
const asStudent = await ps.evaluate(async ({ url, body, headers }) => (await fetch(url, { method: "POST", body, headers })).text(), stale);
check("a student calling the review endpoint is refused on the server", asStudent.includes("not_admin"), asStudent.slice(0, 200));
// Re-running the import never touches reviewed text
applyFile("/tmp/fx-out/science.sql");
check("re-importing leaves the reviewed, published passage unchanged", sql(`SELECT text, publish_status FROM passages WHERE id = ${pid}`)[0].publish_status === "published" && sql(`SELECT text FROM passages WHERE id = ${pid}`)[0].text.endsWith("Corrected."));
// Withdraw needs a reason, then hides it
await pa.getByRole("button", { name: "Withdraw", exact: true }).click();
await pa.getByText(/Say why it is withdrawn|Add a note/).first().waitFor({ timeout: 10000 });
await pa.getByLabel("Note").fill("Test withdrawal");
await pa.getByRole("button", { name: "Withdraw", exact: true }).click();
await pa.getByText("Saved and recorded in the audit log.").waitFor({ timeout: 10000 });
p = await askSci("What is lumenvex?");
check("withdrawn text disappears from the tutor", !p.excerpts.some((e) => e.source.passageId === pid));
// Maths: can't be checked without confirming every expression
await pa.getByLabel("Book", { exact: true }).selectOption(MATH);
await pa.locator("li button", { hasText: "PDF p. 30" }).first().click();
await pa.getByLabel("Passage text").waitFor();
await pa.getByLabel("I compared this text word by word with the page image.").check();
await pa.getByRole("button", { name: "Mark checked against page", exact: true }).click();
await pa.getByText(/contains mathematics/).first().waitFor({ timeout: 10000 });
check("mathematics can't be marked checked without confirming each expression", sql(`SELECT review_status FROM passages WHERE id = ${m.id}`)[0].review_status === null);
await pa.getByLabel("Note").fill("Expression unreadable on the scan");
await pa.getByRole("button", { name: "Reject", exact: true }).click();
await pa.getByText("Saved and recorded in the audit log.").waitFor({ timeout: 10000 });
check("an unreadable passage can be rejected with a reason", sql(`SELECT review_status FROM passages WHERE id = ${m.id}`)[0].review_status === "rejected");

// 4. Students and signed-out visitors can't reach the workspace
await ps.goto(`${BASE}/admin`);
await ps.getByText("Administrator access is never given by signing up.").waitFor({ timeout: 10000 });
check("a student sees the claim screen, not the review workspace", (await ps.getByRole("tab", { name: "Passage review" }).count()) === 0);

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`SUMMARY ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
