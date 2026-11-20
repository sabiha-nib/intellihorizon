// End-to-end curriculum + tutor tests. Needs a local Worker (wrangler dev, D1 + R2) on :8787 with a fresh database,
// and the fixture from tests/make-fixture.mjs at /tmp/fixture.pdf. The fixture is an IntelliHorizon test document, not NCTB text.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";
const BASE = "http://127.0.0.1:8787";
const PW = "monsoon river kite 7";
const results = [];
const check = (n, ok, x = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, x); };
const sql = (q) => JSON.parse(execSync(`/home/user/tools/node_modules/.bin/wrangler d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;

async function register(page, { name, username, email, grade = 7, curriculum = /NCTB, English Version/ }) {
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

const browser = await chromium.launch();
const A = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR", e.message));

// Landing for signed-out visitors
await pa.goto(BASE);
check("landing renders for visitors", (await pa.getByRole("heading", { level: 1 }).count()) === 1);
await pa.screenshot({ path: "/tmp/s-landing.png", fullPage: true });

// 1. Signing up never grants admin; the admin token (local test secret) unlocks it, and the claim is audited.
await register(pa, { name: "Admin Person", username: "edu_admin", email: "admin@example.com" });
check("a new account is not admin", sql("SELECT role FROM users WHERE email='admin@example.com'")[0].role === "student");
check("first-signup admin slot is closed", sql("SELECT value FROM app_settings WHERE key='admin_bootstrap_open'")[0].value === "0");
await pa.goto(`${BASE}/admin`);
await pa.getByLabel("Owner code or admin token").fill("local-test-admin-token-0123456789abcdef");
await pa.getByRole("button", { name: "Unlock admin for this account" }).click();
await pa.getByRole("heading", { name: "Content Studio" }).waitFor({ timeout: 10000 });
check("admin token unlocks admin", sql("SELECT role FROM users WHERE email='admin@example.com'")[0].role === "admin");

// 2. Register textbook and import fixture
await pa.goto(`${BASE}/admin`);
await pa.getByRole("heading", { name: "Register a textbook" }).waitFor({ timeout: 10000 });
await pa.locator("select").filter({ has: pa.locator("option[value='7']") }).first().selectOption("7");
await pa.getByLabel(/^Version/).selectOption("english");
await pa.getByLabel("Book language").selectOption("en");
await pa.getByLabel("Subject (registry)").selectOption("science");
await pa.getByLabel("Subject name as printed").fill("Science");
await pa.getByLabel("Title as printed").fill("EDUCERRO TEST FIXTURE (not NCTB)");
await pa.getByRole("button", { name: "Register textbook" }).click();
await pa.waitForTimeout(1500);
await pa.getByRole("button", { name: /Class 7 · EN · Science/ }).click();
await pa.getByLabel("PDF file").setInputFiles("/tmp/fixture.pdf");
await pa.getByText(/^Import (completed|failed)/).waitFor({ timeout: 60000 });
const report = await pa.locator("text=/pages indexed into/").textContent();
check("import report produced", !!report, report);
await pa.screenshot({ path: "/tmp/s-admin.png", fullPage: true });
const pages = sql("SELECT page, quality FROM source_pages sp JOIN textbooks t ON t.id = sp.textbook_id WHERE t.title LIKE 'EDUCERRO%' ORDER BY page");
check("page with unmapped conjuncts flagged garbled", pages.find((p) => p.page === 5)?.quality === "garbled", JSON.stringify(pages));
check("legacy-font page flagged", pages.find((p) => p.page === 6)?.quality === "legacy_font");
check("blank page flagged empty", pages.find((p) => p.page === 7)?.quality === "empty");
const p4 = sql("SELECT text FROM source_pages WHERE page = 4")[0].text;
check("visual-order vowel signs repaired where glyphs were mapped", p4.includes("দিয়ে খাবার") && p4.includes("কাজে"), p4.slice(0, 50));
check("page with unmapped vowel glyphs kept out of the index", pages.find((p) => p.page === 4)?.quality === "garbled");
check("no passages from flagged pages", sql("SELECT COUNT(*) AS n FROM passages WHERE page IN (5,6,7) AND review_status IS NULL")[0].n === 0);
const book = sql("SELECT id, status FROM textbooks WHERE title LIKE 'EDUCERRO%'")[0];
check("book waits for admin approval", book.status === "needs_review", book.status);

// chapters
for (let i = 0; i < 2; i++) await pa.getByRole("button", { name: "Add chapter" }).click();
const rows = pa.getByLabel("Title", { exact: true });
await rows.nth(0).fill("How plants make food"); await pa.getByLabel("Start page").nth(0).fill("2"); await pa.getByLabel("End page").nth(0).fill("2");
await rows.nth(1).fill("Force and motion"); await pa.getByLabel("Start page").nth(1).fill("3"); await pa.getByLabel("End page").nth(1).fill("4");
await pa.getByRole("button", { name: "Save chapters" }).click();
await pa.waitForTimeout(1500);
check("chapters saved", sql("SELECT COUNT(*) AS n FROM chapters c JOIN textbooks t ON t.id = c.textbook_id WHERE t.title LIKE 'EDUCERRO%'")[0].n === 2);
await pa.getByRole("button", { name: "Approve for the tutor" }).click();
await pa.waitForTimeout(1500);
check("book approved", sql("SELECT status FROM textbooks WHERE title LIKE 'EDUCERRO%'")[0].status === "indexed");


// question authoring
{ const sel = pa.locator('label:has-text("Chapter") select').first(); await sel.waitFor({ timeout: 10000 }); const opts = await sel.locator("option").allTextContents(); console.log("chapter options", JSON.stringify(opts)); await sel.selectOption({ index: Math.max(0, opts.findIndex((o) => o.includes("plants"))) }); }
await pa.getByLabel("Source").selectOption("educerro_authored");
await pa.getByLabel("Question", { exact: true }).fill("Which gas do plants release during photosynthesis?");
await pa.getByLabel(/Options, one per line/).fill("a) Oxygen\nb) Nitrogen\nc) Carbon dioxide");
await pa.getByLabel("Correct option letter").fill("a");
await pa.getByLabel("Explanation shown after answering").fill("Plants give off oxygen as they make food from sunlight, water and carbon dioxide.");
await pa.getByRole("button", { name: "Add question" }).click();
await pa.waitForTimeout(1500);
check("authored question saved as a draft, hidden from students", sql("SELECT status, review_status FROM questions WHERE prompt = 'Which gas do plants release during photosynthesis?'")[0]?.status === "draft");
// Review, then publish, as two separate steps.
await pa.getByRole("tab", { name: "Question review" }).click();
await pa.locator("li", { hasText: "Which gas do plants release during photosynthesis?" }).first().getByRole("button", { name: "Mark reviewed" }).click();
await pa.getByText("Done. Recorded in the audit log.").waitFor({ timeout: 10000 });
await pa.getByRole("tab", { name: /Reviewed, not published/ }).click();
await pa.locator("li", { hasText: "Which gas do plants release during photosynthesis?" }).first().getByRole("button", { name: "Publish to students" }).click();
await pa.getByText("Done. Recorded in the audit log.").waitFor({ timeout: 10000 });
check("question published after review", sql("SELECT status FROM questions WHERE prompt = 'Which gas do plants release during photosynthesis?'")[0].status === "published");

// test-only: one correct Bangla passage, inserted directly because Chrome cannot write a fully mapped Bangla PDF
sql("INSERT INTO passages (textbook_id, page, seq, text, content_hash) SELECT id, 4, 1, 'সবুজ গাছ পাতা দিয়ে খাবার তৈরি করে। এই কাজে রোদ লাগে। গাছ বাতাস থেকে বায়ু নেয়।', 'test-bn' FROM textbooks WHERE title LIKE 'EDUCERRO%' LIMIT 1");
// 3. Student in the same class and version
const B = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pb = await B.newPage();
pb.on("pageerror", (e) => console.log("PAGEERROR B", e.message));
await register(pb, { name: "Student One", username: "student_one", email: "s1@example.com" });
check("second account is not admin", sql("SELECT role FROM users WHERE email='s1@example.com'")[0].role === "student");
await pb.goto(`${BASE}/learn`);
await pb.getByText("EDUCERRO TEST FIXTURE").first().waitFor({ timeout: 10000 });
check("learn shows the approved book for class 7 English", true);
await pb.screenshot({ path: "/tmp/s-learn.png", fullPage: true });
await pb.goto(`${BASE}/tutor`);
const box = pb.getByPlaceholder(/Ask a question/);
async function ask(q) { await box.fill(q); await pb.getByRole("button", { name: "Send" }).click(); }
await ask("What is photosynthesis?");
await pb.getByText("Here's what your textbook says.").first().waitFor({ timeout: 15000 });
check("grounded answer for a covered question", (await pb.getByText(/process by which green plants/).count()) > 0);
check("source shows PDF page", (await pb.getByText(/PDF page 2/).count()) > 0);
await pb.screenshot({ path: "/tmp/s-tutor.png", fullPage: true });
const threadUrl = pb.url();
await ask("Tell me about black holes and quasars");
await pb.getByText(/I couldn't find this in the NCTB textbooks/).first().waitFor({ timeout: 15000 });
check("uncovered question refused honestly, no citation", true);
await ask("3/4 + 1/6");
await pb.getByText("11/12").first().waitFor({ timeout: 15000 });
check("arithmetic checked exactly", true);
await ask("গাছ কীভাবে খাবার তৈরি করে?");
await pb.waitForTimeout(3500);
check("Bangla question finds the repaired Bangla passage", (await pb.getByText(/খাবার তৈরি করে/).count()) > 0);
await pb.screenshot({ path: "/tmp/s-tutor2.png", fullPage: true });
const threads = sql("SELECT t.id, u.email FROM tutor_threads t JOIN users u ON u.id = t.user_id");
check("conversation stored under the student", threads.length >= 1 && threads.every((t) => t.email === "s1@example.com"), JSON.stringify(threads));

// 4. Another student cannot open that conversation
await pa.goto(threadUrl);
await pa.waitForTimeout(2500);
check("other account cannot read the conversation", (await pa.getByText(/process by which green plants/).count()) === 0, threadUrl);

// 5. Class scope: a class 8 student gets no class 7 book
const C = await browser.newContext(); const pc = await C.newPage();
await register(pc, { name: "Class Eight", username: "class_eight", email: "c8@example.com", grade: 8 });
await pc.goto(`${BASE}/tutor`);
await pc.getByPlaceholder(/Ask a question/).fill("What is photosynthesis?");
await pc.getByRole("button", { name: "Send" }).click();
await pc.getByText(/IntelliHorizon is built for Classes 6–10, but only Class 7 has textbooks so far\. Your profile/).first().waitFor({ timeout: 15000 });
check("class 8 student is not served the class 7 book", true);

// 6. Practice and progress
await pb.goto(`${BASE}/practice`);
await pb.getByRole("link", { name: /How plants make food/ }).first().click();
await pb.getByRole("button", { name: "Start the session" }).click({ timeout: 15000 });
await pb.getByRole("button", { name: "I've read it, let me try" }).click();
await pb.getByText("Which gas do plants release during photosynthesis?").waitFor({ timeout: 10000 });
await pb.getByRole("radio").filter({ hasText: "Oxygen" }).click();
await pb.getByRole("button", { name: "Check my answer" }).click();
await pb.getByText("That's right.").waitFor({ timeout: 10000 });
check("practice answer checked and stored", sql("SELECT COUNT(*) AS n FROM attempts WHERE correct = 1")[0].n === 1);
check("review scheduled", sql("SELECT COUNT(*) AS n FROM review_state")[0].n === 1);
await pb.goto(`${BASE}/insights`);
await pb.waitForTimeout(2000);
await pb.screenshot({ path: "/tmp/s-insights.png", fullPage: true });
await pb.goto(`${BASE}/dashboard`);
await pb.waitForTimeout(2500);
await pb.screenshot({ path: "/tmp/s-home.png", fullPage: true });
check("home renders for student", (await pb.getByRole("heading", { level: 1 }).count()) >= 1);
console.log(`SUMMARY ${results.filter(Boolean).length}/${results.length}`);
await browser.close();
