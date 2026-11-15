// End-to-end tests for the Grade 7 curriculum core: registry, Bangla 1st Paper (two books), OCR text-pack import,
// server-side subject enforcement in the tutor, search, saved notes, dashboard, and isolation between students.
// Needs a local Worker (wrangler dev, D1 + R2) on :8787 with a fresh database (all migrations applied).
// The text pack below is written by the IntelliHorizon team for testing; it is not NCTB text.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BASE = "http://127.0.0.1:8787";
const PW = "monsoon river kite 7";
const results = [];
const check = (n, ok, x = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : x); };
const sql = (q) => JSON.parse(execSync(`/home/user/tools/node_modules/.bin/wrangler d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;

const ID = { soptoborna: "dc63304a-e153-5105-af5a-6a2ffff229a5", anandapath: "bfbd8358-41b3-5dda-b2c5-af3e9c96813d", science: "41f978e8-eeda-5506-b1ea-dc96ca7fec47" };
const T = "পরীক্ষার লেখা, ইন্টেলিহরাইজনের লেখা, এনসিটিবির নয়। ";
const pack = (over = {}) => ({
  format: "educerro-text-pack", version: 1, createdAt: "2026-10-18T00:00:00Z", engine: "test fixture",
  books: [
    { bookId: ID.soptoborna, key: "soptoborna", sourceFile: "test.pdf", sourceSha256: "a".repeat(64), pdfPages: 102, pages: [
      { page: 6, confidence: 92, text: T + "কাবুলিওয়ালা রহমত ছোট্ট মিনিকে কিশমিশ আর বাদাম দিত। মিনি তাকে খুব পছন্দ করত। রহমত প্রতিদিন বিকেলে মিনির সঙ্গে গল্প করত। তার নিজের দেশে মিনির বয়সী একটি মেয়ে ছিল।" },
      { page: 7, confidence: 40, text: T + "এই পাতাটি খুব কম নিশ্চয়তায় পড়া হয়েছে বলে ধরা হলো, তাই এটি সূচিতে যাবে না। কাবুলিওয়ালা ঝাপসা অস্পষ্ট লেখা।" },
      { page: 8, confidence: 68, text: T + "এই পাতাটি মাঝারি নিশ্চয়তায় পড়া হয়েছে। এটি সূচিতে যাবে কিন্তু অ্যাডমিনের তালিকায় চিহ্নিত থাকবে। রহমত দেশে ফিরে গেল।" },
    ] },
    { bookId: ID.anandapath, key: "anandapath", sourceFile: "test.pdf", sourceSha256: "b".repeat(64), pdfPages: over.anandapathPages ?? 70, pages: [
      { page: 11, confidence: 90, text: T + "জিদ গল্পে ছেলেটি জেদ করে নদী পার হতে চাইল। এই গল্পে মিনি একটি বিড়ালের নাম, মিনি রোজ দুধ খায়। শেষে ছেলেটি বুঝল জেদ ভালো নয়।" },
    ] },
    { bookId: ID.science, key: "science", sourceFile: "test.pdf", sourceSha256: "c".repeat(64), pdfPages: 166, pages: [
      { page: 20, confidence: 95, text: T + "কোষ জীবের গঠন ও কাজের একক। উদ্ভিদকোষে কোষপ্রাচীর থাকে, প্রাণিকোষে থাকে না। কোষের ভেতরে নিউক্লিয়াস থাকে।" },
    ] },
  ],
});
writeFileSync("/tmp/testpack.json.gz", gzipSync(JSON.stringify(pack())));
writeFileSync("/tmp/badpack.json.gz", gzipSync(JSON.stringify(pack({ anandapathPages: 71 }))));

async function register(page, { name, username, email, grade = 7, curriculum = /NCTB, Bangla Medium/ }) {
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
  await page.getByRole("radio", { name: `Class ${grade}` }).click();
  await page.getByRole("radio", { name: curriculum }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText(/^Welcome, /).waitFor({ timeout: 15000 });
}
const lastPayload = () => JSON.parse(sql("SELECT payload FROM tutor_messages WHERE role = 'tutor' ORDER BY id DESC LIMIT 1")[0].payload);

// 0. Registry seeded by migration
const counts = sql("SELECT (SELECT COUNT(*) FROM subjects) s, (SELECT COUNT(*) FROM subject_offerings) o, (SELECT COUNT(*) FROM textbooks) b, (SELECT COUNT(*) FROM chapters) c")[0];
check("migration seeds 8 subjects, 16 offerings, 9 books, 110 chapters", counts.s === 8 && counts.o === 16 && counts.b === 9 && counts.c === 110, JSON.stringify(counts));
check("Bangla 1st Paper holds Soptoborna and Anandapath", JSON.stringify(sql("SELECT book_key FROM textbooks WHERE subject_key = 'bangla-1st' ORDER BY book_key").map((r) => r.book_key)) === '["anandapath","soptoborna"]');
let blocked = false;
try { sql("INSERT INTO textbooks (id, version_id, grade, medium, subject_key, subject_name, title, language, created_at, updated_at) VALUES ('x', 'nctb-2026', 7, 'bangla', 'religion', 'R', 'R', 'bn', 't', 't')"); } catch { blocked = true; }
check("database refuses a textbook under a subject outside the registry", blocked && sql("SELECT COUNT(*) AS n FROM textbooks")[0].n === 9);

const browser = await chromium.launch();
const A = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR A", e.message));
pa.on("dialog", (d) => void d.dismiss());

// 1. Admin imports the OCR text pack
await register(pa, { name: "Admin Person", username: "edu_admin", email: "admin@example.com" });
await pa.goto(`${BASE}/admin`);
// Signing up never grants admin; the local test secret EDU_ADMIN_TOKEN unlocks it.
await pa.getByLabel("Owner code or admin token").fill("local-test-admin-token-0123456789abcdef");
await pa.getByRole("button", { name: "Unlock admin for this account" }).click();
await pa.getByRole("heading", { name: "Import the Class 7 OCR text pack" }).waitFor({ timeout: 10000 });
await pa.getByLabel("Text pack file").setInputFiles("/tmp/badpack.json.gz");
await pa.getByText(/70 in the registry/).waitFor({ timeout: 10000 });
check("pack with a wrong page count is rejected before import", (await pa.getByRole("button", { name: "Import selected books" }).count()) === 0);
await pa.getByLabel("Text pack file").setInputFiles("/tmp/testpack.json.gz");
await pa.getByRole("button", { name: "Import selected books" }).click();
await pa.getByText(/^Bigyan: import/).waitFor({ timeout: 60000 });
await pa.screenshot({ path: "/tmp/g7-admin.png", fullPage: true });
const sp = sql(`SELECT page, quality, confidence FROM source_pages WHERE textbook_id = '${ID.soptoborna}' ORDER BY page`);
check("OCR page below the minimum confidence is held back", sp.find((p) => p.page === 7)?.quality === "garbled" && sql(`SELECT COUNT(*) AS n FROM passages WHERE textbook_id = '${ID.soptoborna}' AND page = 7 AND review_status IS NULL`)[0].n === 0, JSON.stringify(sp));
check("OCR confidence stored per page", sp.find((p) => p.page === 6)?.confidence === 92);
const job = sql(`SELECT method, pages_low_conf, status FROM import_jobs WHERE textbook_id = '${ID.soptoborna}'`)[0];
check("import job records OCR method and low-confidence count", job.method === "ocr" && job.pages_low_conf === 1, JSON.stringify(job));
check("imported books wait for approval", sql("SELECT COUNT(*) AS n FROM textbooks WHERE status = 'needs_review'")[0].n === 3);
for (const label of [/Bangla 1st Paper \(soptoborna\)/, /Bangla 1st Paper \(anandapath\)/, /BN · Science \(science\)/]) {
  await pa.getByRole("button", { name: label }).click();
  await pa.getByRole("button", { name: "Approve for the tutor" }).click();
  await pa.waitForTimeout(1200);
}
check("admin approved three books", sql("SELECT COUNT(*) AS n FROM textbooks WHERE status = 'indexed'")[0].n === 3);

// 2. Student: eight subjects, Bangla 1st with two books
const B = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pb = await B.newPage();
pb.on("pageerror", (e) => console.log("PAGEERROR B", e.message));
await register(pb, { name: "Student One", username: "student_one", email: "s1@example.com" });
await pb.goto(`${BASE}/learn`);
await pb.getByText("Bangla 1st Paper").first().waitFor({ timeout: 10000 });
const cards = await pb.locator("main ul > li a[href^='/subjects/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href").split("?")[0]))]);
check("learn shows exactly the eight subjects", cards.length === 8, JSON.stringify(cards));
const b1card = pb.locator("li", { has: pb.locator("a[href^='/subjects/bangla-1st']") }).first();
check("Bangla 1st Paper card lists Soptoborna and Anandapath", (await b1card.getByText("সপ্তবর্ণা").count()) === 1 && (await b1card.getByText("আনন্দপাঠ").count()) === 1);
check("no separate Soptoborna or Anandapath subject", cards.every((h) => !/sopto|ananda/.test(h)));
await pb.screenshot({ path: "/tmp/g7-learn.png", fullPage: true });
await pb.getByRole("radio", { name: "English version" }).click();
await pb.getByText("English-version book not added yet.").first().waitFor({ timeout: 10000 });
check("English version shows the same eight subjects with no invented books", (await pb.getByText("English-version book not added yet.").count()) === 8);
await pb.goto(`${BASE}/subjects/bangla-1st`);
await pb.getByRole("heading", { name: "আনন্দপাঠ" }).waitFor({ timeout: 10000 });
check("subject page shows both books with their own chapters", (await pb.getByRole("heading", { name: "সপ্তবর্ণা" }).count()) === 1 && (await pb.locator("a[href^='/chapters/']").count()) === 27);
await pb.screenshot({ path: "/tmp/g7-subject.png", fullPage: true });
await pb.goto(`${BASE}/subjects/religion`);
await pb.getByText("Not one of the eight subjects").waitFor({ timeout: 10000 });
check("unknown subject id is refused", true);

// 3. Tutor: subject enforcement
await pb.goto(`${BASE}/tutor?subject=bangla-1st`);
const box = pb.getByPlaceholder(/Ask a question/);
await box.waitFor({ timeout: 10000 });
async function ask(q) { const n = sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n; await box.fill(q); await pb.getByRole("button", { name: "Send" }).click(); for (let i = 0; i < 40; i++) { await pb.waitForTimeout(400); if (sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n >= n + 2) break; } await pb.waitForTimeout(800); }
await ask("কাবুলিওয়ালা মিনিকে কী দিত?");
let p = lastPayload();
check("grounded answer led by Soptoborna, all excerpts inside Bangla 1st Paper", p.status === "grounded" && p.excerpts[0]?.source.textbookId === ID.soptoborna && p.excerpts.every((e) => e.source.subjectKey === "bangla-1st") && p.scope.subjectKey === "bangla-1st", JSON.stringify({ s: p.status, n: p.excerpts.length }));
check("excerpt is marked as OCR text with its confidence", p.excerpts[0]?.source.extraction === "ocr" && p.excerpts[0]?.source.ocrConfidence === 92);
await pb.getByText("Searched:").first().waitFor({ timeout: 5000 });
await pb.getByRole("button", { name: "Source" }).first().click();
check("source card says the text was read by OCR", (await pb.getByText(/Read from the page image by OCR/).count()) > 0);
await pb.getByRole("button", { name: "Save to my notes" }).first().click();
await pb.waitForTimeout(1200);
check("saved note is filed under its subject and book", sql("SELECT subject_key, textbook_id FROM saved_items")[0]?.subject_key === "bangla-1st");

// 3b. Teaching approaches change presentation, never the facts
const firstSources = p.excerpts.map((e) => e.source.passageId).sort().join(",");
const n1 = sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n;
await pb.getByRole("button", { name: "Ask me questions instead" }).last().click();
for (let i = 0; i < 40; i++) { await pb.waitForTimeout(400); if (sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n >= n1 + 2) break; }
await pb.getByText("Think first").last().waitFor({ timeout: 10000 });
p = lastPayload();
check("'Ask me questions instead' returns guiding questions over the same verified passages", p.teach?.style === "questions" && p.teach.guide?.length >= 2 && p.status === "grounded" && p.excerpts.map((e) => e.source.passageId).sort().join(",") === firstSources, JSON.stringify(p.teach));
const bubble = pb.locator("ol[aria-live] > li").last();
check("the passage stays folded until the student has tried", (await bubble.locator("blockquote").count()) === 0);
await bubble.getByRole("button", { name: /Show the passage/ }).click();
check("the passage opens on request", (await bubble.locator("blockquote").count()) > 0);
const n2 = sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n;
await bubble.getByRole("button", { name: "Explain in Bangla" }).click();
for (let i = 0; i < 40; i++) { await pb.waitForTimeout(400); if (sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n >= n2 + 2) break; }
p = lastPayload();
check("'Explain in Bangla' changes the framing language only", p.teach?.lang === "bn" && p.status === "grounded");
await pb.getByRole("button", { name: "Change" }).click();
await pb.getByRole("radio", { name: "The Exam Coach" }).click();
await ask("কাবুলিওয়ালা মিনিকে কী দিত?");
p = lastPayload();
check("Exam Coach attaches the chapter's own outcomes and exercise count, inventing nothing", p.teach?.persona === "exam" && p.teach.exam && Array.isArray(p.teach.exam.objectives) && p.teach.exam.exercises === 0 && p.status === "grounded", JSON.stringify(p.teach));
check("Exam Coach says plainly when no exercises are checked", (await pb.getByText(/No textbook exercise questions have been checked/).count()) > 0);
await pb.screenshot({ path: "/tmp/g7-tutor.png", fullPage: true });

await pb.goto(`${BASE}/tutor`);
await box.waitFor({ timeout: 10000 });
await ask("আনন্দপাঠ বইয়ে মিনি কে?");
p = lastPayload();
check("a named book is searched alone (Anandapath, not Soptoborna)", p.subject?.book?.key === "anandapath" && p.status === "grounded" && p.excerpts.length > 0 && p.excerpts.every((e) => e.source.textbookId === ID.anandapath), JSON.stringify([p.status, p.terms, p.excerpts.map((e) => e.source.title)]));
await pb.goto(`${BASE}/tutor?subject=science`);
await box.waitFor({ timeout: 10000 });
await ask("আনন্দপাঠ বইয়ে মিনি কে?");
check("a book outside the selected subject is a conflict, not a silent switch", lastPayload().status === "subject_conflict");
await ask("মিনি কে?");
p = lastPayload();
check("science scope does not return Bangla 1st Paper text", p.status === "not_found" && p.excerpts.length === 0, p.status);
await ask("উদ্ভিদকোষে কী থাকে?");
p = lastPayload();
check("science question answered from the science book only", p.status === "grounded" && p.excerpts.every((e) => e.source.subjectKey === "science"));
await ask("ইসলাম ও নৈতিক শিক্ষা বইয়ের প্রথম অধ্যায় কী?");
check("unsupported subject answered politely without textbook text", lastPayload().status === "unsupported_subject" && lastPayload().excerpts.length === 0);
await pb.getByText("IntelliHorizon covers exactly these eight Class 7 subjects:").first().waitFor({ timeout: 5000 });

// 4. Request manipulation is rejected on the server
const before = sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n;
let tampered = 0;
await pb.route("**/_serverFn/**", async (route) => {
  const body = route.request().postData() ?? "";
  if (body.includes("scopeExplicit") && body.includes("science")) { tampered++; await route.continue({ postData: body.replace(/science/g, "religion") }); return; }
  await route.continue();
});
await box.fill("কোষ কী?"); await pb.getByRole("button", { name: "Send" }).click(); await pb.waitForTimeout(3000);
check("a subject id outside the registry is rejected by the server", tampered === 1 && sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n === before, `tampered=${tampered}`);
await pb.unroute("**/_serverFn/**");
// A hand-edited link that pairs the Science subject with a Bangla 1st Paper book id
await pb.goto(`${BASE}/tutor?subject=science&book=${ID.soptoborna}`);
await box.waitFor({ timeout: 10000 });
await box.fill("মিনি কে?"); await pb.getByRole("button", { name: "Send" }).click(); await pb.waitForTimeout(3000);
check("a Bangla 1st book id sent with the Science subject is rejected", sql("SELECT COUNT(*) AS n FROM tutor_messages")[0].n === before && (await pb.getByText(/That book belongs to a different subject/).count()) === 1);

// 5. Saved notes, search and dashboard
await pb.goto(`${BASE}/saved`);
await pb.getByRole("radio", { name: /Science/ }).first().click();
await pb.getByText("Nothing saved for this subject").waitFor({ timeout: 10000 });
check("saved notes filter by subject", true);
await pb.getByRole("radio", { name: /Bangla 1st/ }).first().click();
await pb.getByText(/কাবুলিওয়ালা রহমত/).first().waitFor({ timeout: 10000 });
check("saved note appears under Bangla 1st Paper", true);
await pb.goto(`${BASE}/search?q=${encodeURIComponent("কাবুলিওয়ালা")}`);
await pb.getByRole("heading", { name: "Chapters" }).waitFor({ timeout: 10000 });
check("search finds the chapter and the textbook passage", (await pb.getByText(/কাবুলিওয়ালা \(রবীন্দ্রনাথ ঠাকুর\)/).count()) > 0 && (await pb.getByRole("heading", { name: "In your textbooks" }).count()) === 1);
check("search finds the student's own conversation", (await pb.getByRole("heading", { name: "Your tutor conversations" }).count()) === 1);
await pb.screenshot({ path: "/tmp/g7-search.png", fullPage: true });
await pb.goto(`${BASE}/search?q=${encodeURIComponent("কাবুলিওয়ালা")}&subject=science`);
await pb.waitForTimeout(2500);
check("search respects the subject filter", (await pb.getByRole("heading", { name: "Chapters" }).count()) === 0 && (await pb.getByRole("heading", { name: "In your textbooks" }).count()) === 0);
await pb.goto(`${BASE}/home`);
await pb.getByRole("heading", { name: "Your eight subjects" }).waitFor({ timeout: 10000 });
check("home dashboard lists the eight subjects", (await pb.locator("section[aria-labelledby='subj-h'] a[href^='/subjects/']").count()) === 8);
await pb.screenshot({ path: "/tmp/g7-home.png", fullPage: true });
await pb.goto(`${BASE}/insights`);
await pb.waitForTimeout(2000);
await pb.screenshot({ path: "/tmp/g7-insights.png", fullPage: true });

// 6. Isolation between students
const threadId = sql("SELECT t.id FROM tutor_threads t JOIN users u ON u.id = t.user_id WHERE u.email = 's1@example.com' LIMIT 1")[0].id;
await pa.goto(`${BASE}/tutor/${threadId}`);
await pa.getByText("Conversation not found").waitFor({ timeout: 10000 });
check("another account cannot open the student's conversation", (await pa.getByText(/কাবুলিওয়ালা মিনিকে/).count()) === 0);
await pa.goto(`${BASE}/saved`);
await pa.getByText("Nothing saved yet").waitFor({ timeout: 10000 });
check("another account does not see the student's saved notes", true);
await pa.goto(`${BASE}/search?q=${encodeURIComponent("মিনি")}`);
await pa.waitForTimeout(2500);
check("another account's search does not return the student's conversations", (await pa.getByRole("heading", { name: "Your tutor conversations" }).count()) === 0);
const C = await browser.newContext(); const pc = await C.newPage();
await pc.goto(`${BASE}/search?q=${encodeURIComponent("কাবুলিওয়ালা")}`);
await pc.getByText(/Sign in to search inside the textbooks/).waitFor({ timeout: 10000 });
check("signed-out search shows the catalogue only, no textbook text", (await pc.getByRole("heading", { name: "In your textbooks" }).count()) === 0 && (await pc.getByRole("heading", { name: "Chapters" }).count()) === 1);

// 7. Students outside the supported offering
await register(pc, { name: "Class Eight", username: "class_eight", email: "c8@example.com", grade: 8 });
await pc.goto(`${BASE}/tutor`);
await pc.getByPlaceholder(/Ask a question/).fill("কাবুলিওয়ালা মিনিকে কী দিত?");
await pc.getByRole("button", { name: "Send" }).click();
await pc.getByText(/IntelliHorizon supports Class 7 only for now\. Your profile/).first().waitFor({ timeout: 15000 });
check("class 8 student is told honestly, with no Class 7 text served", lastPayload().excerpts.length === 0 && lastPayload().status === "no_books");
const D = await browser.newContext(); const pd = await D.newPage();
await register(pd, { name: "English Version", username: "eng_version", email: "ev@example.com", curriculum: /NCTB, English Version/ });
await pd.goto(`${BASE}/tutor`);
await pd.getByPlaceholder(/Ask a question/).fill("What is a cell?");
await pd.getByRole("button", { name: "Send" }).click();
await pd.getByText(/English-version textbooks haven't been added yet\. Nothing has been made up/).first().waitFor({ timeout: 15000 });
check("English-version student gets an honest gap, not Bangla-medium text", lastPayload().excerpts.length === 0);

console.log(`SUMMARY ${results.filter(Boolean).length}/${results.length}`);
await browser.close();
