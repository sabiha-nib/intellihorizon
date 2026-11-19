// End-to-end: Phase 4 tutor features (explanation language, cross-language retrieval, hybrid retrieval, working
// checker, doubt detection, read-aloud honesty) and the study-tool modules (MemoryCards, SmartNotes, FormulaVault,
// ConceptConnect, IntelliSummary, Reflection, teacher/parent sharing, ExamArena, Learning Twin, admin QuestionGen).
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";

const BASE = "http://127.0.0.1:8787";
const MOCK = "http://127.0.0.1:8790";
const PW = "monsoon river kite 7";
const results = [];
const check = (n, ok, x = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : x); };
const WR = "/home/user/tools/node_modules/.bin/wrangler";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const mode = (m) => fetch(`${MOCK}/__mode`, { method: "POST", body: JSON.stringify({ mode: m }) });
const lastReq = async () => (await fetch(`${MOCK}/__last`)).json();
const CH2 = "f9c3f216-a09e-5c02-979e-497b60f8333a";
const T_CONT = "a1d7c7a0-0b1e-4c2e-9d41-2a1f00000002";

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
const userId = (email) => sql(`SELECT id FROM users WHERE email = '${email}'`)[0].id;
const lastPayload = (uid) => JSON.parse(sql(`SELECT m.payload FROM tutor_messages m JOIN tutor_threads t ON t.id = m.thread_id WHERE m.role = 'tutor' AND t.user_id = '${uid}' ORDER BY m.id DESC LIMIT 1`)[0].payload);
const tutorCount = (uid) => sql(`SELECT COUNT(*) AS n FROM tutor_messages m JOIN tutor_threads t ON t.id = m.thread_id WHERE m.role = 'tutor' AND t.user_id = '${uid}'`)[0].n;

await mode("ok");
const browser = await chromium.launch();
const A = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pa = await A.newPage();
const errors = [];
pa.on("pageerror", (e) => { errors.push(e.message); console.log("PAGEERROR", e.message); });
await register(pa, { name: "Rafi Hasan", username: "rafi_p4", email: "rafi.p4@example.com" });
const UA = userId("rafi.p4@example.com");

async function askNew(q, { lang } = {}) {
  await pa.goto(`${BASE}/tutor`);
  if (lang) await pa.getByRole("radio", { name: lang, exact: true }).click();
  const n = tutorCount(UA);
  await pa.locator("#ask").fill(q);
  await pa.getByRole("button", { name: "Send" }).click();
  for (let i = 0; i < 60 && tutorCount(UA) === n; i++) await pa.waitForTimeout(400);
  await pa.waitForURL(/\/tutor\/[0-9a-f-]{36}/, { timeout: 15000 }).catch(() => undefined);
  await pa.waitForTimeout(600);
  return lastPayload(UA);
}
async function askHere(q) {
  const n = tutorCount(UA);
  await pa.locator("#ask").fill(q);
  await pa.getByRole("button", { name: "Send" }).click();
  for (let i = 0; i < 60 && tutorCount(UA) === n; i++) await pa.waitForTimeout(400);
  await pa.waitForTimeout(600);
  return lastPayload(UA);
}

// ── T1. Explanation language: English chosen for a Bangla question; the book quotation stays in Bangla
let p = await askNew("ধারাবাহিক অনুপাত কাকে বলে?", { lang: "English" });
let req = await lastReq();
check("T1 explanation language set to English is applied and stored on the profile", p.language?.explanation === "en" && sql(`SELECT tutor_lang FROM profiles WHERE user_id = '${UA}'`)[0].tutor_lang === "en", JSON.stringify(p.language));
check("T1 the provider is told to explain in English and never translate quotations", JSON.stringify(req.body).includes("English") && /never translate/i.test(JSON.stringify(req.body)));
check("T1 the textbook excerpt is shown in Bangla as printed", p.excerpts.length > 0 && p.excerpts[0].source.language === "bn" && /অনুপাত/.test(p.excerpts[0].text));
check("T1 the trust line says the explanation is English and the textbook stays as printed", (await pa.getByTestId("trust-line").first().innerText()).includes("textbook text and quotations stay"));
// ── T2. Cross-language retrieval: an English question about Bangla text, rewritten with the glossary and reported
p = await askNew("What is a continued ratio?", { lang: "Same as my question" });
check("T2 English question finds the Bangla definition through the glossary", p.status === "grounded" && p.rewrite?.searched?.includes("ধারাবাহিক অনুপাত"), JSON.stringify({ s: p.status, r: p.rewrite }));
check("T2 the rewrite is shown to the student", (await pa.getByTestId("rewrite").count()) >= 1);
check("T2 auto mode explains an English question in English", p.language?.explanation === "en");
// ── T3. English question with no glossary match still abstains
p = await askNew("Explain the causes of the French Revolution");
check("T3 an English question outside the books abstains, no rewrite invented", p.status !== "grounded" && !p.ai && !p.rewrite, p.status);
// ── T4. Mixed Bangla-English question gets a mixed explanation
p = await askNew("continued ratio আর proportion কাকে বলে");
check("T4 a code-switched question is detected and gets a mixed explanation", p.language?.explanation === "mixed", JSON.stringify(p.language));
// ── T5. Working checker: first wrong step located, nothing sent to the AI
const aiBefore = sql("SELECT COUNT(*) AS n FROM ai_requests")[0].n;
p = await askNew("৭ × ৮ = ৫৬\n৫৬ + ৪ = ৬১\n৬১ - ১ = ৬০");
check("T5 working is checked line by line and the first wrong step is line 2", p.status === "working_check" && p.working?.firstWrong === 1 && p.working.steps[0].status === "ok", JSON.stringify(p.working));
check("T5 the working check is exact arithmetic, not an AI call", sql("SELECT COUNT(*) AS n FROM ai_requests")[0].n === aiBefore);
check("T5 the screen names the first step that doesn't hold", (await pa.getByText(/first step that doesn't hold is line 2/).count()) === 1);
// ── T6. Doubt detection after repeated confusion in one thread
await askNew("ধারাবাহিক অনুপাত কাকে বলে?");
await askHere("বুঝিনি, আবার বলো");
p = await askHere("এখনো বুঝতে পারছি না");
check("T6 repeated confusion in a thread offers a different way to learn", (p.doubt?.signals ?? 0) >= 2 && (await pa.getByText(/Would a different way help/).count()) >= 1, JSON.stringify(p.doubt));
check("T6 follow-up context is recorded for the AI (previous turn), bounded", JSON.stringify((await lastReq()).body).includes("Earlier in this conversation"));
// ── T7. Read aloud is honest when the device has no voice
await pa.getByRole("button", { name: "Listen" }).first().click();
await pa.waitForTimeout(300);
check("T7 read-aloud says plainly when there is no voice for the language (headless browser has none)", (await pa.getByText(/has no (Bangla|English) voice|can't read text aloud/).count()) >= 1);
// ── T8. Retrieval is keyword-only until an index exists, and says so
p = await askNew("ধারাবাহিক অনুপাত কাকে বলে?");
check("T8 without a semantic index the tutor reports keyword-only retrieval", p.retrieval?.mode === "lexical" && p.retrieval.reason === "no_index", JSON.stringify(p.retrieval));

// ── Admin: semantic index, QuestionGen, formula and link review
const C = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pc = await C.newPage();
await register(pc, { name: "Studio Admin", username: "studio_a", email: "studio.a@example.com" });
await pc.goto(`${BASE}/admin`);
await pc.getByLabel("Owner code or admin token").fill("local-test-admin-token-0123456789abcdef");
await pc.getByRole("button", { name: "Unlock admin for this account" }).click();
await pc.getByRole("tab", { name: "Formulas, links and AI drafts" }).click();
await pc.getByRole("button", { name: "Build index" }).waitFor({ timeout: 15000 });
await pc.waitForTimeout(800);
for (let i = 0; i < 5; i++) { await pc.getByRole("button", { name: "Build index" }).click(); await pc.getByText(/Indexed \d+ passages|Failed/).waitFor({ timeout: 15000 }); if (await pc.getByText(/all done/).count()) break; }
const visible = sql("SELECT COUNT(*) AS n FROM passages p JOIN textbooks t ON t.id = p.textbook_id WHERE (p.publish_status = 'published' OR (t.status = 'indexed' AND COALESCE(p.publish_status, 'draft') = 'draft' AND p.blocked = 0)) AND COALESCE(p.review_status, '') != 'rejected'")[0].n;
const indexed = sql("SELECT COUNT(*) AS n FROM passage_embeddings")[0].n;
check("A1 admin builds the meaning index over exactly the student-visible passages", indexed === visible && indexed > 0, `${indexed}/${visible}`);
p = await askNew("ধারাবাহিক অনুপাত কাকে বলে?");
check("T9 with an index, retrieval is hybrid (keyword + meaning) and still grounded", p.retrieval?.mode === "hybrid" && p.status === "grounded", JSON.stringify(p.retrieval));
check("T9 hybrid results are only student-visible checked passages", p.excerpts.every((e) => ["checked", "teacher_reviewed"].includes(e.source.extraction)));
p = await askNew("Explain the causes of the French Revolution");
check("T10 a weak meaning-only match does not turn an out-of-book question into an answer", p.status !== "grounded" && !p.ai, JSON.stringify({ s: p.status, r: p.retrieval }));
await mode("fail");
p = await askNew("ধারাবাহিক অনুপাত কাকে বলে?");
check("T11 if the embedding provider fails, keyword retrieval still answers", p.status === "grounded" && p.retrieval?.mode === "lexical", JSON.stringify(p.retrieval));
await mode("ok");

// QuestionGen
await pc.getByRole("combobox", { name: "Chapter" }).first().selectOption(CH2);
await pc.getByRole("combobox", { name: "Passage" }).waitFor({ timeout: 10000 });
const firstPassage = await pc.getByRole("combobox", { name: "Passage" }).locator("option").nth(1).getAttribute("value");
await pc.getByRole("combobox", { name: "Passage" }).selectOption(firstPassage);
const qBefore = sql("SELECT COUNT(*) AS n FROM questions")[0].n;
const pubBefore = sql("SELECT COUNT(*) AS n FROM questions WHERE status = 'published'")[0].n;
await pc.getByRole("button", { name: "Generate drafts" }).click();
await pc.getByText(/Saved \d+ draft/).waitFor({ timeout: 15000 });
const gen = sql("SELECT status, review_status, source, provenance FROM questions WHERE prompt LIKE 'MOCK-GEN%'");
check("A2 QuestionGen saves valid questions as drafts marked AI-generated", gen.length === 2 && gen.every((q) => q.status === "draft" && q.review_status === "draft" && q.source === "educerro_authored" && JSON.parse(q.provenance).origin === "ai_generated"), JSON.stringify(gen));
check("A2 a malformed generated question is rejected, not saved", (await pc.getByText(/Rejected 1: answer_not_in_options/).count()) === 1 && sql("SELECT COUNT(*) AS n FROM questions")[0].n === qBefore + 2);
check("A2 nothing generated is published to students", sql("SELECT COUNT(*) AS n FROM questions WHERE status = 'published'")[0].n === pubBefore);

// ConceptConnect admin: a draft link is invisible until checked
await pc.getByLabel("From topic").selectOption({ index: 1 });
await pc.getByLabel("To topic").selectOption({ index: 3 });
await pc.getByLabel("Justification").fill("Test link: both appear in chapter 2 of the Mathematics book.");
await pc.getByRole("button", { name: "Save draft link" }).click();
await pc.getByText("Draft link saved.").waitFor({ timeout: 10000 });

// ── Student modules
await pa.goto(`${BASE}/concepts`);
await pa.getByTestId("concept-link").first().waitFor({ timeout: 15000 });
check("M1 ConceptConnect shows only checked links, each with its reason", (await pa.getByTestId("concept-link").count()) === 1 && (await pa.getByText(/printed page 18/).count()) === 1);
await pa.goto(`${BASE}/formulas`);
await pa.getByTestId("formula").first().waitFor({ timeout: 15000 });
check("M2 FormulaVault shows the two checked formulas with page and review status", (await pa.getByTestId("formula").count()) === 2 && (await pa.getByText(/checked, not yet reviewed by a teacher/).count()) === 2);
await pa.goto(`${BASE}/summary`);
await pa.getByLabel("Chapter").selectOption(CH2);
await pa.getByTestId("summary").waitFor({ timeout: 15000 });
const lines = await pa.getByTestId("summary").locator("ol li span[lang]").allInnerTexts();
const chText = sql(`SELECT group_concat(p.text, ' ') AS t FROM passages p JOIN chapters c ON c.textbook_id = p.textbook_id AND p.page BETWEEN c.start_page AND c.end_page WHERE c.id = '${CH2}'`)[0].t.replace(/\s+/g, " ");
check("M3 IntelliSummary lines are copied word for word from the chapter's checked text", lines.length > 0 && lines.every((l) => chText.includes(l.trim())), lines.join(" | "));

// MemoryCards
await pa.goto(`${BASE}/cards`);
await pa.getByRole("tab", { name: "Make cards" }).click();
await pa.getByLabel("Front (question)").fill("৭ : ৫ ও ৮ : ৯ এর ধারাবাহিক অনুপাত?");
await pa.getByLabel("Back (answer)").fill("৫৬ : ৪০ : ৪৫");
await pa.getByRole("button", { name: "Add card" }).click();
await pa.getByText("Card added.").waitFor({ timeout: 10000 });
await pa.getByLabel("Chapter").selectOption(CH2);
await pa.getByRole("button", { name: "Add this card" }).first().waitFor({ timeout: 15000 });
await pa.getByRole("button", { name: "Add this card" }).first().click();
await pa.waitForTimeout(800);
const defCard = sql(`SELECT c.back, p.text FROM cards c JOIN passages p ON p.id = c.source_passage_id WHERE c.user_id = '${UA}' AND c.kind = 'definition'`);
check("M4 a definition card's answer is the book's sentence, unchanged", defCard.length === 1 && defCard[0].text.includes(defCard[0].back), JSON.stringify(defCard));
await pa.getByRole("tab", { name: /Review/ }).click();
await pa.getByRole("button", { name: "Show answer" }).click();
await pa.getByRole("button", { name: "Good" }).click();
await pa.waitForTimeout(800);
const cid = sql(`SELECT id, due_at FROM cards WHERE user_id = '${UA}' AND reps = 1`)[0];
check("M4 grading a card schedules it later", !!cid && cid.due_at > new Date().toISOString());
const dup = await pa.evaluate(async () => document.cookie.length);
void dup;
const reviewsBefore = sql(`SELECT COUNT(*) AS n FROM card_reviews WHERE user_id = '${UA}'`)[0].n;
check("M4 card reviews are not counted as practice attempts or mastery", sql(`SELECT COUNT(*) AS n FROM attempts WHERE user_id = '${UA}'`)[0].n === 0 && reviewsBefore >= 1);

// SmartNotes + isolation
await pa.goto(`${BASE}/notes`);
await pa.getByRole("button", { name: "New note" }).click();
await pa.getByLabel("Title").fill("অনুপাত মনে রাখার কৌশল");
await pa.getByLabel("Note", { exact: true }).fill("মাঝের রাশি সমান করতে হয়। private-note-marker");
await pa.getByRole("button", { name: "Save note" }).click();
await pa.getByText("private-note-marker", { exact: false }).waitFor({ timeout: 10000 });
await pa.getByLabel("Search your notes").fill("কৌশল");
await pa.getByRole("button", { name: "Search", exact: true }).click();
await pa.waitForTimeout(800);
check("M5 SmartNotes saves and finds a note", (await pa.getByText("অনুপাত মনে রাখার কৌশল").count()) === 1);

// Reflection: never counted as evidence
await pa.goto(`${BASE}/reflect`);
await pa.getByLabel("What did I learn?").fill("ধারাবাহিক অনুপাত বানাতে শিখেছি");
await pa.getByRole("button", { name: "Save reflection" }).click();
await pa.getByText("Saved.").waitFor({ timeout: 10000 });
check("M6 a reflection is saved and does not create attempts or XP", sql(`SELECT COUNT(*) AS n FROM reflections WHERE user_id = '${UA}'`)[0].n === 1 && sql(`SELECT COUNT(*) AS n FROM attempts WHERE user_id = '${UA}'`)[0].n === 0);

// Learning Twin: correction offers a check; evidence untouched
await pa.goto(`${BASE}/twin`);
await pa.getByTestId("twin-topic").first().waitFor({ timeout: 15000 });
check("M7 Learning Twin lists only reviewed topics with their evidence", (await pa.getByTestId("twin-topic").count()) === 4 && (await pa.getByText(/Evidence: 0 answers/).count()) === 4);
check("M7 improvement is not shown without enough answers", (await pa.getByText(/Not enough answers yet to compare/).count()) === 1);
await pa.getByTestId("twin-topic").filter({ hasText: "ধারাবাহিক অনুপাত" }).getByRole("button", { name: "I know this better than this says" }).click();
await pa.waitForURL(/\/quiz\/[0-9a-f-]{36}/, { timeout: 15000 }).catch(() => undefined);
check("M7 'I know this' records the claim and starts a check instead of editing evidence", /\/quiz\//.test(pa.url()) && sql(`SELECT COUNT(*) AS n FROM twin_feedback WHERE user_id = '${UA}' AND claim = 'know_it'`)[0].n === 1 && sql(`SELECT COUNT(*) AS n FROM attempts WHERE user_id = '${UA}'`)[0].n === 0);

// ExamArena
await pa.goto(`${BASE}/exam-arena`);
await pa.getByTestId("arena-chapter").first().waitFor({ timeout: 15000 });
{ const nb = await pa.getByText("Not enough evidence yet").count(); const pct = await pa.getByText(/\d+\s*%\s*(ready|readiness)|readiness:?\s*\d+\s*%/i).count(); check("M8 ExamArena shows readiness as factors, with no evidence stated as such and no percentage score", nb >= 1 && pct === 0 && (await pa.getByText("Questions tried").count()) >= 1, `${nb}/${pct}`); }
await pa.getByTestId("arena-chapter").first().getByRole("button", { name: "Start timed exam" }).click();
await pa.waitForURL(/\/quiz\/[0-9a-f-]{36}/, { timeout: 15000 }).catch(() => undefined);
const set = sql(`SELECT mode, time_limit_sec FROM quiz_sets WHERE user_id = '${UA}' ORDER BY started_at DESC LIMIT 1`)[0];
check("M8 starting from ExamArena opens a timed exam", set?.mode === "exam" && set.time_limit_sec > 0, JSON.stringify(set));

// Sharing: code shown once, stored hashed, summary only, revocable
await pa.goto(`${BASE}/share`);
await pa.getByRole("button", { name: "Make a code" }).click();
const code = (await pa.getByTestId("share-code").locator("p.font-mono").innerText()).trim();
const stored = sql(`SELECT code_hash FROM share_grants WHERE student_id = '${UA}'`)[0].code_hash;
check("S1 the share code is stored only as a hash", /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) && stored !== code && !stored.includes(code.replace(/-/g, "")));
const P = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pp = await P.newPage();
await pp.goto(`${BASE}/family`);
await pp.getByLabel("Access code").fill(code.toLowerCase());
await pp.getByRole("button", { name: "View" }).click();
await pp.getByTestId("family-summary").waitFor({ timeout: 15000 });
const famText = await pp.locator("body").innerText();
check("S2 a parent with the code sees a progress summary", famText.includes("ধারাবাহিক অনুপাত") && famText.includes("answers recorded"));
check("S2 the summary has no name, email, notes, reflections or tutor conversations", !famText.includes("Rafi") && !famText.includes("rafi.p4") && !famText.includes("private-note-marker") && !famText.includes("শিখেছি") && !famText.includes("বুঝিনি"));
await pa.getByRole("button", { name: "Withdraw" }).click();
await pa.waitForTimeout(800);
await pp.getByRole("button", { name: "View" }).click();
await pp.getByText(/isn't valid/).waitFor({ timeout: 10000 }).catch(() => undefined);
check("S3 a withdrawn code stops working at once", (await pp.getByText(/isn't valid/).count()) === 1 && (await pp.getByTestId("family-summary").count()) === 0);
await pp.getByLabel("Access code").fill("AAAA-BBBB-CCCC");
await pp.getByRole("button", { name: "View" }).click();
await pp.waitForTimeout(800);
check("S3 a made-up code gets the same answer as a withdrawn one", (await pp.getByText(/isn't valid/).count()) === 1);

// Isolation: another student sees none of A's cards, notes or reflections
const B = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pb = await B.newPage();
await register(pb, { name: "Nila Das", username: "nila_p4", email: "nila.p4@example.com" });
await pb.goto(`${BASE}/notes`);
await pb.getByText(/No notes yet/).waitFor({ timeout: 15000 });
await pb.goto(`${BASE}/cards`);
await pb.getByRole("tab", { name: /All cards \(0\)/ }).waitFor({ timeout: 15000 });
await pb.goto(`${BASE}/reflect`);
await pb.waitForTimeout(1200);
check("I1 another student sees none of the first student's notes, cards or reflections", (await pb.getByText("private-note-marker").count()) === 0 && (await pb.getByText("Earlier reflections").count()) === 0);
const asStudent = await pb.evaluate(async () => (await fetch("/admin")).status);
await pb.goto(`${BASE}/admin`);
await pb.waitForTimeout(1500);
check("I2 students can't open the admin studio tools", asStudent === 200 && (await pb.getByRole("tab", { name: "Formulas, links and AI drafts" }).count()) === 0);

// Navigation: every new module is reachable from More
await pa.goto(`${BASE}/more`);
await pa.waitForTimeout(1200);
let found = 0;
for (const h of ["/twin", "/exam-arena", "/cards", "/notes", "/formulas", "/concepts", "/summary", "/reflect", "/share"]) found += (await pa.locator(`a[href='${h}']`).count()) > 0 ? 1 : 0;
check("N1 all nine new modules are linked from More", found === 9, String(found));
check("N2 no page errors on any page", errors.length === 0, errors.join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`SUMMARY ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
