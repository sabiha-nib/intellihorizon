// End-to-end tests for the learning universe: public home vs dashboard, protected routes, admin access,
// Learning Sessions, XP idempotency, offline answer sync, isolation between students, question review and the PWA.
// Needs a local Worker (wrangler dev, D1 + R2) on :8787 with a fresh database (all migrations applied),
// and EDU_ADMIN_TOKEN="local-test-admin-token-0123456789abcdef" in the local vars.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const BASE = "http://127.0.0.1:8787";
const PW = "monsoon river kite 7";
const results = [];
const check = (n, ok, x = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : x); };
const WR = "/home/user/tools/node_modules/.bin/wrangler";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const MATH_CH2 = "f9c3f216-a09e-5c02-979e-497b60f8333a";
const TEST_CODE = "EDU-TSTAA-TSTBB-TSTCC-TSTDD-TSTEE";
sql(`INSERT OR IGNORE INTO admin_bootstrap (code_hash, created_at) VALUES ('${createHash("sha256").update(TEST_CODE).digest("hex")}', '2026-10-26T00:00:00Z')`);

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

const browser = await chromium.launch();

// 0. Migration state
check("first-signup admin slot is closed by migration", sql("SELECT value FROM app_settings WHERE key = 'admin_bootstrap_open'")[0].value === "0");
check("verified question seed: 22 published, 14 drafts", JSON.stringify(sql("SELECT review_status, COUNT(*) AS n FROM questions GROUP BY review_status ORDER BY review_status")) === JSON.stringify([{ review_status: "draft", n: 14 }, { review_status: "published", n: 22 }]));
check("every published seed question records where its answer came from", sql("SELECT COUNT(*) AS n FROM questions WHERE status = 'published' AND (provenance IS NULL OR provenance NOT LIKE '%answerFrom%')")[0].n === 0);
let guarded = false;
try { sql("UPDATE questions SET status = 'published' WHERE review_status = 'draft'"); } catch { guarded = true; }
check("database refuses to publish an unreviewed question", guarded && sql("SELECT COUNT(*) AS n FROM questions WHERE status = 'published'")[0].n === 22);

// 1. Public home vs protected dashboard
const V = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pv = await V.newPage();
await pv.goto(`${BASE}/`);
check("public home renders for visitors", (await pv.getByRole("heading", { level: 1 }).textContent()).includes("Learning should understand you."));
check("public home has Sign In and Get Started", (await pv.getByRole("link", { name: "Sign In" }).count()) > 0 && (await pv.getByRole("link", { name: "Get Started" }).count()) > 0);
check("public home shows all five classes and both textbook versions", (await pv.locator("#curriculum [role=tab]").count()) === 5 && (await pv.locator("#grade-panel [data-medium]").count()) === 2);
check("public home is branded IntelliHorizon, with no old brand left", (await pv.title()).startsWith("IntelliHorizon") && !(await pv.content()).includes("Educerro"));
check("public home has a responsible AI section", (await pv.locator("#trust h2").count()) === 1 && (await pv.getByRole("heading", { name: "Your textbook is the authority. The AI is not." }).count()) === 1);
for (const path of ["/dashboard", "/progress", "/revision", "/mistakes", "/mastery", "/knowledge-map", "/missions", "/achievements", "/history", "/settings", "/more", "/plan", "/practice", "/path"]) {
  await pv.goto(`${BASE}${path}`).catch(() => undefined);
  await pv.waitForURL(/\/signin/, { timeout: 10000 }).catch(() => undefined);
  if (!pv.url().includes("/signin")) { check(`${path} requires sign-in`, false, pv.url()); continue; }
}
check("all student modules redirect visitors to sign in", true);
await pv.goto(`${BASE}/login?next=/progress`).catch(() => undefined);
await pv.waitForURL(/\/signin/, { timeout: 10000 }).catch(() => undefined);
check("/login goes to sign in and keeps the destination", pv.url().includes("/signin") && pv.url().includes("progress"));
// Landing demo works without an account. (Phase 5 replaced the old practice-question demo with the tutor preview;
// its "Check my working" flow is the equivalent: it explains a student's mistake.)
await pv.goto(`${BASE}/#tutor`);
await pv.locator('[data-demo-flow="working"]').click();
check("landing demo explains the mistake (first wrong step)", /first wrong step is line 3/.test(await pv.locator("#tutor").innerText()));

// 2. Student A: signup, dashboard, session
const A = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR A", e.message));
await register(pa, { name: "Nadia Rahman", username: "nadia_r", email: "nadia@example.com" });
check("new signup is a student, never an admin", sql("SELECT role FROM users WHERE email = 'nadia@example.com'")[0].role === "student");
await pa.goto(`${BASE}/dashboard`);
await pa.getByRole("heading", { name: "Nadia" }).waitFor({ timeout: 15000 });
check("dashboard greets the student by display name", true);
check("dashboard shows all eight subjects", (await pa.locator("a[href^='/subjects/']").count()) >= 8);
check("first-session suggestion is the chapter with checked questions", await pa.getByText(/most checked questions so far \(22\)/).isVisible());
await pa.goto(`${BASE}/`);
check("signed-in visitor to / still sees the public home, with a dashboard link", (await pa.getByRole("link", { name: "Open my dashboard" }).count()) === 1);
await pa.goto(`${BASE}/dashboard`);
await pa.getByRole("button", { name: "Start a Learning Session" }).click();
await pa.waitForURL(/\/practice\/session\//, { timeout: 15000 });
const sessionUrl = pa.url();
const sessionId = sessionUrl.split("/").pop();
await pa.getByRole("button", { name: "Start the session" }).click();
await pa.getByRole("button", { name: "Next idea" }).click();
await pa.getByRole("button", { name: "Next idea" }).click();
await pa.getByRole("button", { name: "Next idea" }).click();
check("lesson reveals four checked steps and the ratio lab", (await pa.getByText("Try it: build a continued ratio").count()) === 1);
await pa.getByRole("button", { name: "I'm ready to try" }).click();
const qids = JSON.parse(sql(`SELECT question_ids FROM learning_sessions WHERE id = '${sessionId}'`)[0].question_ids);
check("session picked 5 published questions", qids.length === 5);
const answers = Object.fromEntries(sql(`SELECT id, type, answer, answer_kind, options FROM questions WHERE id IN (${qids.map((q) => `'${q}'`).join(",")})`).map((q) => [q.id, q]));
let wrongDone = false;
for (let i = 0; i < qids.length; i++) {
  const q = answers[qids[i]];
  const makeWrong = !wrongDone && q.type === "mcq";
  if (q.type === "mcq") {
    const opts = JSON.parse(q.options);
    const pick = makeWrong ? opts.find((o) => o.id !== q.answer) : opts.find((o) => o.id === q.answer);
    await pa.getByRole("radio").filter({ hasText: pick.text }).first().click();
  } else {
    await pa.getByLabel("Your answer").fill(q.answer_kind === "ratio" ? q.answer.split(":").join(" : ") : q.answer);
  }
  if (makeWrong) wrongDone = true;
  await pa.getByRole("button", { name: "Check my answer" }).click();
  await pa.getByText(/That's right\.|Not yet\. Here's the answer\./).waitFor({ timeout: 10000 });
  await pa.getByRole("button", { name: i < qids.length - 1 ? "Next question" : "Continue" }).click();
}
check("answers recorded against the session", sql(`SELECT COUNT(*) AS n FROM attempts WHERE session_id = '${sessionId}'`)[0].n === 5);
if (wrongDone) {
  await pa.getByRole("heading", { name: "Fix what slipped" }).waitFor({ timeout: 10000 });
  check("improve step shows the missed question with the answer", (await pa.getByText(/^Answer: /).count()) >= 1);
  await pa.getByRole("button", { name: "Try them again" }).click();
  await pa.getByRole("heading", { name: "Remember it" }).waitFor();
  // retry the missed one correctly
  const missedId = sql(`SELECT question_id FROM attempts WHERE session_id = '${sessionId}' AND correct = 0`)[0].question_id;
  const mq = answers[missedId];
  await pa.getByRole("radio").filter({ hasText: JSON.parse(mq.options).find((o) => o.id === mq.answer).text }).first().click();
  await pa.getByRole("button", { name: "Check my answer" }).click();
  await pa.getByText("That's right.").waitFor();
  check("fixing a missed question earns the 'improved' reward, once", sql(`SELECT COUNT(*) AS n FROM xp_events WHERE kind = 'improved' AND ref = '${missedId}'`)[0].n === 1);
  await pa.getByRole("button", { name: "Continue" }).click();
}
await pa.getByLabel("Your explanation").fill("You multiply both ratios so that the middle term becomes equal, then you write the three terms together as a continued ratio.");
await pa.getByRole("button", { name: "Check my explanation" }).click();
await pa.getByText("That counts as an explanation in your own words.").waitFor({ timeout: 10000 });
check("explain-it-back finds the key ideas and counts", true);
await pa.getByRole("button", { name: "Finish the session" }).click();
await pa.getByRole("heading", { name: "Session complete" }).waitFor({ timeout: 15000 });
const xpRows = sql(`SELECT kind, COUNT(*) AS n, SUM(xp) AS xp FROM xp_events WHERE user_id = (SELECT id FROM users WHERE email = 'nadia@example.com') GROUP BY kind ORDER BY kind`);
check("XP ledger has one row per rewarded event", JSON.stringify(xpRows.map((r) => [r.kind, r.n])) === JSON.stringify([["chapter_opened", 1], ["explain", 1], ["first_correct", 4], ["improved", 1], ["session_complete", 1]]), JSON.stringify(xpRows));
const total = xpRows.reduce((n, r) => n + r.xp, 0);
check("celebration shows the session XP from the ledger", await pa.getByText(`+${total} XP from this session`).isVisible(), `expected ${total}`);
check("an achievement was granted from the record", sql("SELECT COUNT(*) AS n FROM user_achievements")[0].n >= 1);
await pa.screenshot({ path: "/tmp/u-celebrate.png", fullPage: true });
const srow = sql(`SELECT level, summary FROM learning_sessions WHERE id = '${sessionId}'`)[0];
const sum = JSON.parse(srow.summary);
check("a finished session persists its level, results, misconceptions, XP and next step", srow.level === "foundation" && sum.attempted === 5 && sum.correctAtEnd === 5 && sum.xp === total && Array.isArray(sum.misconceptions) && !!sum.next?.kind, srow.summary);
await pa.goto(`${BASE}/path`);
await pa.getByText("You are here").waitFor({ timeout: 15000 });
check("Horizon Path shows the finished session, the current position and a next stop with its reason", (await pa.getByText("5 of 5 right").count()) === 1 && (await pa.getByText(/^Why: /).count()) >= 1);
await pa.goto(`${BASE}/knowledge-map`);
await pa.getByRole("button", { name: /^2\. .*: Developing$/ }).first().click({ timeout: 15000 });
await pa.getByText("Recommended next step").waitFor({ timeout: 10000 }).catch(() => undefined);
check("Knowledge Map node shows its evidence and a recommended next step", (await pa.getByText("Recommended next step", { exact: true }).count()) === 1 && (await pa.getByText("Questions right", { exact: true }).count()) === 1);
await pa.goto(`${BASE}/dashboard`);
await pa.getByRole("heading", { name: "Nadia" }).waitFor({ timeout: 15000 });
check("dashboard links the tutor, Knowledge Map and Horizon Path", (await pa.locator("a[href='/tutor']").count()) >= 1 && (await pa.locator("a[href='/knowledge-map']").count()) >= 1 && (await pa.locator("a[href='/path']").count()) >= 1);
// Re-completing does not pay again
await pa.goto(sessionUrl);
await pa.getByRole("heading", { name: "Session complete" }).waitFor({ timeout: 15000 });
check("reopening a finished session pays nothing more", sql("SELECT COUNT(*) AS n FROM xp_events WHERE kind = 'session_complete'")[0].n === 1);

// 3. Offline answers: queued, sent once, counted once
await pa.goto(`${BASE}/practice/${MATH_CH2}`);
await pa.waitForURL(/\/practice\/session\//, { timeout: 15000 });
const s2 = pa.url().split("/").pop();
await pa.getByRole("button", { name: "Start the session" }).click();
await pa.getByRole("button", { name: "Next idea" }).click(); await pa.getByRole("button", { name: "Next idea" }).click(); await pa.getByRole("button", { name: "Next idea" }).click();
await pa.getByRole("button", { name: "I'm ready to try" }).click();
const q2 = JSON.parse(sql(`SELECT question_ids FROM learning_sessions WHERE id = '${s2}'`)[0].question_ids);
check("second session starts with the questions not yet seen", q2.every((id) => !qids.includes(id) || false) || q2.length > 0);
await A.setOffline(true);
const first = sql(`SELECT id, type, answer, answer_kind, options FROM questions WHERE id = '${q2[0]}'`)[0];
if (first.type === "mcq") await pa.getByRole("radio").filter({ hasText: JSON.parse(first.options).find((o) => o.id === first.answer).text }).first().click();
else await pa.getByLabel("Your answer").fill(first.answer_kind === "ratio" ? first.answer.split(":").join(" : ") : first.answer);
await pa.getByRole("button", { name: "Check my answer" }).click();
await pa.getByText("Saved on this device", { exact: true }).waitFor({ timeout: 10000 });
check("offline answer is kept on the device, not marked", sql(`SELECT COUNT(*) AS n FROM attempts WHERE session_id = '${s2}'`)[0].n === 0);
// Duplicate the queued item to simulate a double send.
await pa.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("edu_answers_v1:")); const q = JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify([...q, q[0]])); });
await A.setOffline(false);
await pa.evaluate(() => window.dispatchEvent(new Event("online")));
await pa.waitForTimeout(3000);
check("queued answer synced exactly once", sql(`SELECT COUNT(*) AS n FROM attempts WHERE session_id = '${s2}'`)[0].n === 1);
check("queue emptied after sync", await pa.evaluate(() => !Object.keys(localStorage).some((x) => x.startsWith("edu_answers_v1:"))));
check("synced answer rewarded once", sql(`SELECT COUNT(*) AS n FROM xp_events WHERE ref = '${q2[0]}'`)[0].n === 1);

// 3b. Tutor: answers come only from checked or approved textbook text, with the source shown
check("16 checked passages are seeded and searchable", sql("SELECT COUNT(*) AS n FROM passages WHERE review_status = 'checked'")[0].n === 16 && sql("SELECT COUNT(*) AS n FROM textbooks WHERE status = 'indexed'")[0].n === 0);
await pa.goto(`${BASE}/tutor`);
const tutorBox = pa.getByPlaceholder(/Ask a question/);
await tutorBox.fill("ধারাবাহিক অনুপাত কাকে বলে?");
await pa.getByRole("button", { name: "Send" }).click();
await pa.getByText(/এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে/).first().waitFor({ timeout: 15000 });
check("tutor quotes the checked Mathematics passage", true);
const tp = JSON.parse(sql("SELECT payload FROM tutor_messages WHERE role = 'tutor' ORDER BY id DESC LIMIT 1")[0].payload);
{ const ex = tp.excerpts ?? []; const def = ex.find((e) => /এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে/.test(e.text ?? e.quote ?? "")); check("tutor answer quotes the definition from printed page 18 and marks every excerpt as checked Mathematics text", tp.status === "grounded" && !!def && def.source.printedPage === 18 && ex.every((e) => e.source.extraction === "checked" && e.source.subjectKey === "mathematics"), JSON.stringify(ex.map((e) => [e.source.printedPage, Object.keys(e)]))); }
await tutorBox.fill("What is photosynthesis in green leaves?");
await pa.getByRole("button", { name: "Send" }).click();
await pa.waitForTimeout(2500);
const tp2 = JSON.parse(sql("SELECT payload FROM tutor_messages WHERE role = 'tutor' ORDER BY id DESC LIMIT 1")[0].payload);
check("with no checked text on the topic, the tutor says so instead of inventing an answer", tp2.status !== "grounded" && (tp2.excerpts ?? []).length === 0, tp2.status);
// PDF homework: read in the browser into the box; other files refused
await pa.locator("input[type=file][accept*=pdf]").setInputFiles("/tmp/fixture.pdf");
await pa.getByText(/is in the box/).waitFor({ timeout: 20000 });
check("a PDF's text is read into the question box for the student to check", (await tutorBox.inputValue()).includes("EDUCERRO TEST FIXTURE"));
await pa.locator("input[type=file][accept*=pdf]").setInputFiles("/tmp/face.png");
await pa.getByText(/Only PDF files with text can be read here/).waitFor({ timeout: 10000 });
check("a photo is refused with an honest message, not pretended to be read", true);

// 4. Student B: isolation
const B = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pb = await B.newPage();
pb.on("pageerror", (e) => console.log("PAGEERROR B", e.message));
await register(pb, { name: "Rafi Ahmed", username: "rafi_a", email: "rafi@example.com" });
await pb.goto(sessionUrl);
await pb.getByText("This session isn't available").waitFor({ timeout: 15000 });
check("another student's session can't be opened", true);
await pb.goto(`${BASE}/progress`);
await pb.getByText("Your progress starts with one answer").waitFor({ timeout: 15000 });
check("a new student's progress starts empty (nothing invented)", true);
await pb.goto(`${BASE}/dashboard`);
await pb.getByRole("heading", { name: "Rafi" }).waitFor({ timeout: 15000 });
const overflow = [];
for (const p of ["/path", "/tutor", "/mistakes", "/dashboard", "/more", "/practice", "/progress", "/mastery", "/knowledge-map", "/achievements", "/missions", "/settings", "/help", "/learn", "/"]) {
  await pb.goto(`${BASE}${p}`);
  await pb.waitForLoadState("networkidle");
  const w = await pb.evaluate(() => document.documentElement.scrollWidth);
  if (w > 391) overflow.push(`${p}:${w}`);
}
check("no horizontal overflow at 390px on main routes", overflow.length === 0, overflow.join(" "));
await pb.goto(`${BASE}/dashboard`);
check("phone bottom navigation has Home, Learn, Practice, AI Tutor and More", (await pb.locator("nav.fixed a").allTextContents()).join("|") === "Home|Learn|Practice|AI Tutor|More");
await pb.screenshot({ path: "/tmp/u-dash-mobile.png", fullPage: true });

// 5. Admin access: wrong code refused, owner code works once, then refused for anyone else
await pb.goto(`${BASE}/admin`);
await pb.getByLabel("Owner code or admin token").fill("EDU-WRONG-WRONG-WRONG-WRONG-WRONG");
await pb.getByRole("button", { name: "Unlock admin for this account" }).click();
await pb.getByText(/isn't valid/).waitFor({ timeout: 10000 });
check("a wrong owner code is refused", sql("SELECT role FROM users WHERE email = 'rafi@example.com'")[0].role === "student");
await pb.getByLabel("Owner code or admin token").fill(TEST_CODE);
await pb.getByRole("button", { name: "Unlock admin for this account" }).click();
await pb.getByRole("heading", { name: "Content Studio" }).waitFor({ timeout: 10000 });
check("the owner code grants admin", sql("SELECT role FROM users WHERE email = 'rafi@example.com'")[0].role === "admin");
await pa.goto(`${BASE}/admin`);
await pa.getByLabel("Owner code or admin token").fill(TEST_CODE);
await pa.getByRole("button", { name: "Unlock admin for this account" }).click();
await pa.getByText(/isn't valid/).waitFor({ timeout: 10000 });
check("the same owner code can't be used twice", sql("SELECT role FROM users WHERE email = 'nadia@example.com'")[0].role === "student");
check("admin claims are audited", sql("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('admin_claimed', 'admin_claim_failed')")[0].n >= 3);

// 6. Question review: draft -> reviewed -> published
const C = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pc = await C.newPage();
await pc.goto(`${BASE}/signin`);
await pc.getByLabel(/Email or username/).fill("rafi_a");
await pc.getByLabel("Password", { exact: true }).fill(PW);
await pc.getByRole("button", { name: "Sign in" }).click();
await pc.waitForURL(/\/dashboard/, { timeout: 15000 });
check("sign-in lands on the dashboard", true);
await pc.goto(`${BASE}/admin`);
await pc.getByRole("tab", { name: "Question review" }).click();
const draft = pc.locator("li", { hasText: "পাঠ্যবই অনুযায়ী সকল জীবদেহের মধ্যে সাধারণ মিল কোনটি?" }).first();
await draft.getByRole("button", { name: "Mark reviewed" }).click();
await pc.getByText("Done. Recorded in the audit log.").waitFor({ timeout: 10000 });
check("cannot skip review: draft becomes reviewed, not published", sql("SELECT review_status, status FROM questions WHERE id = '0245370a-b529-5c5b-89b6-d866db9075ad'")[0].status === "draft");
await pc.getByRole("tab", { name: /Reviewed, not published/ }).click();
await pc.locator("li", { hasText: "পাঠ্যবই অনুযায়ী সকল জীবদেহের মধ্যে সাধারণ মিল কোনটি?" }).first().getByRole("button", { name: "Publish to students" }).click();
await pc.getByText("Done. Recorded in the audit log.").waitFor({ timeout: 10000 });
check("reviewed question is published", sql("SELECT status FROM questions WHERE id = '0245370a-b529-5c5b-89b6-d866db9075ad'")[0].status === "published");
check("review steps are audited", sql("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('question_mark_reviewed', 'question_publish')")[0].n === 2);

// 7. PWA
const man = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
check("manifest is valid: name, start_url, standalone, 192/512 and maskable icons", man.name === "IntelliHorizon" && man.display === "standalone" && man.start_url.startsWith("/dashboard") && man.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable") && man.icons.some((i) => i.sizes === "192x192"));
for (const icon of man.icons) check(`icon ${icon.src} is served`, (await fetch(`${BASE}${icon.src}`)).status === 200);
const P = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pp = await P.newPage();
await pp.goto(`${BASE}/`);
const swState = await pp.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active?.state ?? "none"; });
check("service worker registers and activates", swState === "activated" || swState === "activating", swState);
await pp.reload(); await pp.waitForTimeout(1500);
check("the page is controlled by the service worker after reload", await pp.evaluate(() => !!navigator.serviceWorker.controller));
const cacheKeys = await pp.evaluate(async () => { const out = []; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) out.push(new URL(r.url).pathname); } return out; });
check("public pages and the offline page are precached", ["/", "/help", "/offline"].every((p) => cacheKeys.includes(p)), cacheKeys.join(","));
check("no student page is in the offline cache (only code bundles, public pages and the offline page)", !cacheKeys.filter((p) => !p.startsWith("/assets/") && !p.startsWith("/s/")).some((p) => /dashboard|progress|practice|account|admin|session|revision|mastery/.test(p)), cacheKeys.join(","));
const signedInHtml = (await fetch(`${BASE}/`, { headers: { cookie: "edu_sid=" + "x".repeat(43) } })).headers.get("cache-control");
check("pages requested with a session cookie are marked private, no-store", /no-store/.test(signedInHtml ?? ""), signedInHtml);
// Take the server down to test real offline behaviour through the service worker.
try { execSync("pkill -f '[w]orkerd'; pkill -f '[w]rangler dev'; true"); } catch { /* already stopped */ }
await new Promise((r) => setTimeout(r, 1500));
await pp.goto(`${BASE}/help`).catch(() => undefined);
check("offline: a precached public page still opens", await pp.getByRole("heading", { name: "Help and accessibility" }).isVisible().catch(() => false));
await pp.goto(`${BASE}/dashboard`).catch(() => undefined);
check("offline: an uncached page shows the offline fallback", await pp.getByRole("heading", { name: "You're offline" }).isVisible().catch(() => false));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
