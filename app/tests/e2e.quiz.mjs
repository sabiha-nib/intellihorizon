// End-to-end: IntelliQuiz (modes, navigation, feedback, duplicate prevention, results, timing, isolation), TopicWise
// (topics, separate coverage dimensions, states, admin review) and the connected student journey from the
// definition of done: dashboard -> subject -> topic -> tutor -> practice -> misconception -> remediation ->
// evidence -> Knowledge Map -> revision -> Horizon Path -> progress kept after signing in again.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";

const BASE = "http://127.0.0.1:8787";
const MOCK = "http://127.0.0.1:8790";
const PW = "monsoon river kite 7";
const results = [];
const check = (n, ok, x = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : x); };
const WR = "/home/user/tools/node_modules/.bin/wrangler";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const CH2 = "f9c3f216-a09e-5c02-979e-497b60f8333a";
const T_CONT = "a1d7c7a0-0b1e-4c2e-9d41-2a1f00000002";
const T_PL = "a1d7c7a0-0b1e-4c2e-9d41-2a1f00000004";

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
const qinfo = (id) => sql(`SELECT id, type, answer, answer_kind, options, skill FROM questions WHERE id = '${id}'`)[0];
const answerOf = (q, wrong = false) => {
  if (q.type === "mcq") { const o = JSON.parse(q.options); return (wrong ? o.find((x) => x.id !== q.answer) : o.find((x) => x.id === q.answer)); }
  if (!wrong) return { text: q.answer_kind === "ratio" ? q.answer.split(":").join(" : ") : q.answer };
  // A wrong answer the grader can still read, in the question's own answer format.
  if (q.answer_kind === "ratio") { const n = q.answer.split(":").length; return { text: Array.from({ length: n }, (_, i) => String(97 + i)).join(" : ") }; }
  return { text: q.type === "numeric" ? "999999" : "একটি ভুল উত্তর" };
};
async function answer(page, q, wrong = false) {
  const a = answerOf(q, wrong);
  if (q.type === "mcq") await page.getByRole("radio").nth(JSON.parse(q.options).findIndex((o) => o.id === a.id)).click();
  else { const box = page.getByLabel("Your answer"); await box.fill(a.text); await box.blur(); }
  await page.waitForTimeout(400);
}
const userId = (email) => sql(`SELECT id FROM users WHERE email = '${email}'`)[0].id;

await fetch(`${MOCK}/__mode`, { method: "POST", body: JSON.stringify({ mode: "ok" }) });
const browser = await chromium.launch();
const A = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const calls = [];
pa.on("request", (r) => { if (r.method() === "POST" && r.url().includes("_serverFn")) calls.push({ url: r.url(), body: r.postData() ?? "", headers: Object.fromEntries(Object.entries(r.headers()).filter(([k]) => !["host", "content-length", "cookie"].includes(k))) }); });
await register(pa, { name: "Quiz Student", username: "quiz_s", email: "quiz.s@example.com" });
const UA = userId("quiz.s@example.com");

// ── Journey: dashboard -> subject -> topic
await pa.goto(`${BASE}/dashboard`);
await pa.getByRole("heading", { name: "Quiz" }).waitFor({ timeout: 15000 }).catch(() => undefined);
await pa.goto(`${BASE}/subjects/mathematics`);
await pa.waitForTimeout(1500);
check("student can open the Mathematics subject", (await pa.locator("body").innerText()).length > 50);
await pa.goto(`${BASE}/topics`);
await pa.getByText("ধারাবাহিক অনুপাত").first().waitFor({ timeout: 15000 });
check("topic explorer lists the four checked topics, none invented", (await pa.locator("a[href^='/topics/']").count()) === 4);
check("an untouched topic with material is 'Available to learn', never mastered", (await pa.locator("a[href='/topics/" + T_CONT + "']").innerText()).includes("Available to learn"));
check("questions without a checked heading are reported as not linked to a topic", (await pa.getByText(/aren't linked to a reviewed topic yet/).count()) >= 1);
await pa.goto(`${BASE}/topics/${T_CONT}`);
await pa.getByText("From your textbook").waitFor({ timeout: 15000 });
check("topic page shows the checked passage with its printed page", (await pa.getByText(/এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে/).count()) >= 1 && (await pa.getByText(/printed page 18/).count()) >= 1);
{ let n = 0; for (const l of ["1. Checked material", "2. Learning", "3. Assessment", "4. Evidence", "5. Revision"]) n += (await pa.getByText(l, { exact: true }).count()) === 1 ? 1 : 0; check("topic page shows five separate coverage signals", n === 5, String(n)); }
await pa.goto(`${BASE}/topics/${T_PL}`);
await pa.getByText("5. Revision").waitFor({ timeout: 15000 });
check("a topic with no checked passage says so instead of showing text", (await pa.getByText("From your textbook").count()) === 0 && (await pa.getByText("Not yet").count()) >= 1);

// ── Tutor from the topic (grounded, cited)
await pa.goto(`${BASE}/tutor?chapter=${CH2}`);
await pa.getByPlaceholder(/Ask a question/).fill("ধারাবাহিক অনুপাত কাকে বলে?");
await pa.getByRole("button", { name: "Send" }).click();
await pa.getByText(/MOCK-DIRECT/).first().waitFor({ timeout: 20000 });
check("tutor answers with an AI explanation and real source cards", (await pa.getByRole("button", { name: /Source/ }).count()) >= 1);

// ── Opening the chapter alone is "learning", not mastery
await pa.goto(`${BASE}/chapters/${CH2}`);
await pa.waitForTimeout(2000);
await pa.goto(`${BASE}/topics`);
await pa.getByText("ধারাবাহিক অনুপাত").first().waitFor({ timeout: 15000 });
check("opening the chapter moves a topic to 'Learning', not to any mastery state", (await pa.locator("a[href='/topics/" + T_CONT + "']").innerText()).includes("Learning"));

// ── IntelliQuiz: quick practice with immediate feedback
await pa.goto(`${BASE}/quiz`);
await pa.getByText(/22 checked questions are available/).waitFor({ timeout: 15000 });
check("quiz home states how many checked questions exist and where from", true);
check("mistake replay is unavailable before any mistakes", await pa.getByRole("radio", { name: /Mistake replay/ }).isDisabled());
await pa.getByRole("radio", { name: /Topic practice/ }).click();
await pa.getByLabel("Topic").selectOption(T_CONT);
await pa.getByLabel("Number of questions").selectOption("5");
await pa.getByRole("button", { name: "Start" }).click();
await pa.waitForURL(/\/quiz\/[0-9a-f-]{36}$/, { timeout: 15000 });
const set1 = pa.url().split("/").pop();
const ids1 = JSON.parse(sql(`SELECT question_ids FROM quiz_sets WHERE id = '${set1}'`)[0].question_ids);
check("topic practice uses only that topic's questions", ids1.length === 5 && ids1.every((id) => qinfo(id).skill === "continued-ratio"));
await pa.getByText("Question 1 of 5").waitFor({ timeout: 15000 });
check("each question shows where it comes from", (await pa.getByText(/Textbook exercise/).count()) >= 1);
// Q1 right
let q = qinfo(ids1[0]);
await answer(pa, q);
await pa.getByRole("button", { name: "Check my answer" }).click();
await pa.getByText("That's right.").waitFor({ timeout: 10000 });
check("a right answer is confirmed with its explanation", true);
check("the graded answer is recorded once, server-side, with XP", sql(`SELECT COUNT(*) AS n FROM attempts WHERE client_event_id = 'quiz:${set1}:${ids1[0]}'`)[0].n === 1 && sql(`SELECT COUNT(*) AS n FROM xp_events WHERE user_id = '${UA}'`)[0].n >= 1);
// Duplicate check by replaying the request
const checkReq = calls.filter((c) => c.body.includes(ids1[0]) && c.body.includes("check")).at(-1);
const xp0 = sql(`SELECT COALESCE(SUM(xp), 0) AS n FROM xp_events WHERE user_id = '${UA}'`)[0].n;
await pa.evaluate(async ({ url, body, headers }) => { await fetch(url, { method: "POST", body, headers }); await fetch(url, { method: "POST", body, headers }); }, checkReq);
check("re-sending the same answer twice adds no attempt and no XP", sql(`SELECT COUNT(*) AS n FROM attempts WHERE client_event_id = 'quiz:${set1}:${ids1[0]}'`)[0].n === 1 && sql(`SELECT COALESCE(SUM(xp), 0) AS n FROM xp_events WHERE user_id = '${UA}'`)[0].n === xp0);
// Q2 wrong (two wrong answers with misconceptions make a pattern possible)
await pa.getByRole("button", { name: "Next" }).click();
q = qinfo(ids1[1]);
await answer(pa, q, true);
await pa.getByRole("button", { name: "Check my answer" }).click();
await pa.getByText(/Not yet\. The answer is/).waitFor({ timeout: 10000 }).catch(async (e) => { console.log("DEBUG", JSON.stringify(q), await pa.locator("[role=alert]").allInnerTexts(), (await pa.locator("article").innerText()).slice(0, 600)); throw e; });
check("a wrong answer shows the right answer", true);
// Q3 wrong as well, Q4 skipped and flagged, Q5 via keyboard where possible
await pa.getByRole("button", { name: "Next" }).click();
q = qinfo(ids1[2]);
await answer(pa, q, true);
await pa.getByRole("button", { name: "Check my answer" }).click();
await pa.getByText(/Not yet\. The answer is/).waitFor({ timeout: 10000 });
await pa.getByRole("button", { name: "Next" }).click();
await pa.getByRole("button", { name: "Mark for review" }).click();
await pa.waitForTimeout(500);
check("marking for review is saved", sql(`SELECT flagged FROM quiz_responses WHERE set_id = '${set1}' AND question_id = '${ids1[3]}'`)[0]?.flagged === 1);
await pa.getByRole("button", { name: "Skip" }).click();
await pa.getByText("Question 5 of 5").waitFor();
q = qinfo(ids1[4]);
if (q.type === "mcq") { await pa.keyboard.press("a"); await pa.waitForTimeout(500); check("keyboard: pressing A chooses option A", (await pa.getByRole("radio").first().getAttribute("aria-checked")) === "true"); }
else check("keyboard: (question 5 is typed, not multiple choice)", true);
await pa.getByRole("button", { name: "Previous" }).click();
check("previous goes back a question", await pa.getByText("Question 4 of 5").isVisible());
// Submit with confirmation
await pa.getByRole("button", { name: "Finish and submit" }).click();
await pa.getByText("Submit this set?").waitFor();
check("submit asks for confirmation and counts skipped and marked questions", (await pa.getByText(/will count as skipped/).count()) === 1 && (await pa.getByText(/marked for review/).count()) >= 1);
await pa.getByRole("button", { name: "Submit", exact: true }).click();
await pa.getByText("Recommended next").waitFor({ timeout: 15000 });
const r1 = JSON.parse(sql(`SELECT result FROM quiz_sets WHERE id = '${set1}'`)[0].result);
const ans5 = sql(`SELECT response FROM quiz_responses WHERE set_id = '${set1}' AND question_id = '${ids1[4]}'`)[0]?.response;
check("results count right, wrong and skipped exactly", r1.correct + r1.incorrect === r1.attempted && r1.attempted + r1.skipped === 5 && r1.incorrect >= 2 && r1.skipped >= 1, JSON.stringify(r1));
check("results break down by topic and difficulty and list questions to revisit", r1.bySkill.length >= 1 && r1.byDifficulty.length >= 1 && r1.revisit.includes(ids1[1]) && r1.revisit.includes(ids1[3]));
check("results say it's practice, not a grade or exam prediction", (await pa.getByText(/not a grade or a prediction of your exam/).count()) === 1);
const submitReq = calls.filter((c) => c.body.includes(set1)).at(-1);
const attemptsAfter = sql(`SELECT COUNT(*) AS n FROM attempts WHERE user_id = '${UA}'`)[0].n;
await pa.evaluate(async ({ url, body, headers }) => { await fetch(url, { method: "POST", body, headers }); }, submitReq);
check("submitting again changes nothing", sql(`SELECT COUNT(*) AS n FROM attempts WHERE user_id = '${UA}'`)[0].n === attemptsAfter && sql(`SELECT submitted_at FROM quiz_sets WHERE id = '${set1}'`)[0].submitted_at === sql(`SELECT submitted_at FROM quiz_sets WHERE id = '${set1}'`)[0].submitted_at);
void ans5;

// ── Misconception evidence and remediation
const mis = sql(`SELECT misconception, COUNT(DISTINCT question_id) AS n FROM attempts WHERE user_id = '${UA}' AND correct = 0 AND misconception IS NOT NULL GROUP BY misconception`);
await pa.goto(`${BASE}/mistakes`);
await pa.waitForTimeout(2500);
const radarText = await pa.locator("body").innerText();
if (mis.some((m) => m.n >= 2)) check("Misconception Radar shows the repeated pattern with a suggested fix", /Possible pattern|Likely pattern/.test(radarText) && /Suggested fix/.test(radarText));
else check("Misconception Radar doesn't call single mistakes a pattern", !/Likely pattern/.test(radarText), JSON.stringify(mis));

// ── Mistake replay offers exactly the wrong ones; remediation by answering them right
await pa.goto(`${BASE}/quiz`);
await pa.getByRole("radio", { name: /Mistake replay/ }).click();
await pa.getByRole("button", { name: "Start" }).click();
await pa.waitForURL(/\/quiz\/[0-9a-f-]{36}$/, { timeout: 15000 });
const set2 = pa.url().split("/").pop();
const ids2 = JSON.parse(sql(`SELECT question_ids FROM quiz_sets WHERE id = '${set2}'`)[0].question_ids);
const wrongNow = sql(`SELECT question_id FROM attempts a WHERE user_id = '${UA}' AND id = (SELECT MAX(id) FROM attempts b WHERE b.user_id = a.user_id AND b.question_id = a.question_id) AND correct = 0`).map((r) => r.question_id);
check("mistake replay contains only questions whose latest answer was wrong", ids2.length > 0 && ids2.every((id) => wrongNow.includes(id)), JSON.stringify([ids2, wrongNow]));
for (let k = 0; k < ids2.length; k++) {
  await pa.getByText(`Question ${k + 1} of ${ids2.length}`).waitFor({ timeout: 10000 });
  await answer(pa, qinfo(ids2[k]));
  await pa.getByRole("button", { name: "Check my answer" }).click();
  await pa.getByText("That's right.").waitFor({ timeout: 10000 });
  if (k < ids2.length - 1) await pa.getByRole("button", { name: "Next" }).click();
}
await pa.getByRole("button", { name: "Finish and submit" }).click();
await pa.getByRole("button", { name: "Submit", exact: true }).click();
await pa.getByText("Recommended next").waitFor({ timeout: 15000 });
check("remediation: replayed mistakes answered correctly are recorded", sql(`SELECT COUNT(*) AS n FROM attempts WHERE client_event_id LIKE 'quiz:${set2}:%' AND correct = 1`)[0].n === ids2.length);

// ── Evidence reaches topics, Knowledge Map, revision and Horizon Path
await pa.goto(`${BASE}/topics`);
await pa.getByText("ধারাবাহিক অনুপাত").first().waitFor({ timeout: 15000 });
const tcard = await pa.locator("a[href='/topics/" + T_CONT + "']").innerText();
check("topic state now reflects answers (not 'Available' or 'Learning'), and never 'Demonstrated' without revision evidence", !/Available to learn|Learning\n/.test(tcard) && !tcard.includes("Demonstrated"), tcard);
await pa.goto(`${BASE}/revision`);
await pa.waitForTimeout(2500);
check("Smart Revision has scheduled every answered question", sql(`SELECT COUNT(*) AS n FROM review_state WHERE user_id = '${UA}'`)[0].n === sql(`SELECT COUNT(DISTINCT question_id) AS n FROM attempts WHERE user_id = '${UA}'`)[0].n && sql(`SELECT COUNT(*) AS n FROM review_state WHERE user_id = '${UA}'`)[0].n >= 3);
await pa.goto(`${BASE}/path`);
await pa.getByText("Practice set").first().waitFor({ timeout: 15000 });
check("Horizon Path shows the finished practice sets", (await pa.getByText("Practice set").count()) >= 2);
await pa.goto(`${BASE}/knowledge-map`);
await pa.waitForTimeout(2500);
check("Knowledge Map no longer shows the chapter as unexplored", /Practising|Developing|Needs revision|Demonstrated/.test(await pa.locator("body").innerText()));

// ── Exam simulation: timed, deferred feedback, time limit enforced on the server
await pa.goto(`${BASE}/quiz`);
await pa.getByRole("radio", { name: /Exam simulation/ }).click();
await pa.getByRole("button", { name: "Start" }).click();
await pa.waitForURL(/\/quiz\/[0-9a-f-]{36}$/, { timeout: 15000 });
const set3 = pa.url().split("/").pop();
const s3 = sql(`SELECT question_ids, time_limit_sec, feedback FROM quiz_sets WHERE id = '${set3}'`)[0];
const ids3 = JSON.parse(s3.question_ids);
check("exam simulation is timed at 90 s per question with deferred feedback", s3.time_limit_sec === ids3.length * 90 && s3.feedback === "deferred" && (await pa.getByRole("timer").count()) === 1);
await pa.getByText(`Question 1 of ${ids3.length}`).waitFor();
await answer(pa, qinfo(ids3[0]));
check("no feedback is shown before submitting in exam mode", (await pa.getByText("That's right.").count()) === 0 && (await pa.getByRole("button", { name: "Check my answer" }).count()) === 0);
check("exam answers are saved but not graded until submit", sql(`SELECT COUNT(*) AS n FROM attempts WHERE client_event_id LIKE 'quiz:${set3}:%'`)[0].n === 0);
sql(`UPDATE quiz_sets SET started_at = '2020-01-01T00:00:00.000Z' WHERE id = '${set3}'`);
await pa.getByRole("button", { name: "Next" }).click();
await answer(pa, qinfo(ids3[1]));
await pa.getByText(/Time is up/).waitFor({ timeout: 10000 });
check("after the time limit the server refuses new answers", sql(`SELECT COUNT(*) AS n FROM quiz_responses WHERE set_id = '${set3}' AND question_id = '${ids3[1]}' AND response IS NOT NULL`)[0].n === 0);
await pa.getByRole("button", { name: "Finish and submit" }).click();
await pa.getByRole("button", { name: "Submit", exact: true }).click();
await pa.getByText("Recommended next").waitFor({ timeout: 15000 });
check("submitting a timed-out exam still grades what was saved", JSON.parse(sql(`SELECT result FROM quiz_sets WHERE id = '${set3}'`)[0].result).attempted === 1);

// ── Daily Five is one set per day
await pa.goto(`${BASE}/quiz`);
await pa.getByRole("radio", { name: /Daily Five/ }).click();
await pa.getByRole("button", { name: /Start|Open today/ }).click();
await pa.waitForURL(/\/quiz\/[0-9a-f-]{36}$/, { timeout: 15000 });
const d1 = pa.url().split("/").pop();
await pa.goto(`${BASE}/quiz`);
await pa.getByRole("radio", { name: /Daily Five/ }).click();
await pa.getByRole("button", { name: /Open today's Daily Five|Start/ }).click();
await pa.waitForURL(/\/quiz\/[0-9a-f-]{36}$/, { timeout: 15000 });
check("Daily Five opens the same set again the same day", pa.url().endsWith(d1) && sql(`SELECT COUNT(*) AS n FROM quiz_sets WHERE user_id = '${UA}' AND mode = 'daily'`)[0].n === 1);

// ── Isolation and invalid data
const B = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pb = await B.newPage();
await register(pb, { name: "Other Quizzer", username: "quiz_o", email: "quiz.o@example.com" });
await pb.goto(`${BASE}/quiz/${set1}`);
await pb.getByText(/doesn't exist or belongs to another account/).waitFor({ timeout: 15000 });
check("another student can't open someone's practice set", true);
const ansReq = calls.filter((c) => c.body.includes(d1)).at(-1) ?? calls.filter((c) => c.body.includes(set1)).at(0);
const forged = await pb.evaluate(async ({ url, body, headers }) => (await fetch(url, { method: "POST", body, headers })).text(), ansReq);
check("another student's request against the set is refused", forged.includes("not_found"), forged.slice(0, 160));
// Re-target the set-1 check request at a question that isn't in the set (set 1 is submitted, so use the open Daily Five).
const dailyReq = calls.filter((c) => c.body.includes(d1)).at(-1) ?? calls.filter((c) => c.body.includes(set1) && c.body.includes(ids1[0])).at(-1);
const outside = sql(`SELECT id FROM questions WHERE status = 'published' AND id NOT IN (${JSON.parse(sql(`SELECT question_ids FROM quiz_sets WHERE id = '${d1}'`)[0].question_ids).map((x) => `'${x}'`).join(",")}) LIMIT 1`)[0].id;
const notInBody = checkReq.body.split(set1).join(d1).split(ids1[0]).join(outside);
const notIn = await pa.evaluate(async ({ url, body, headers }) => (await fetch(url, { method: "POST", body, headers })).text(), { ...checkReq, body: notInBody });
check("an answer for a question outside the set is refused", notIn.includes("not_in_set"), notIn.slice(0, 200));
void dailyReq;

// ── Admin topic review: drafts are invisible until checked
const C = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pc = await C.newPage();
await register(pc, { name: "Topic Admin", username: "topic_a", email: "topic.a@example.com" });
await pc.goto(`${BASE}/admin`);
await pc.getByLabel("Owner code or admin token").fill("local-test-admin-token-0123456789abcdef");
await pc.getByRole("button", { name: "Unlock admin for this account" }).click();
await pc.getByRole("tab", { name: "Topics" }).click();
await pc.getByLabel("Topic book").selectOption("95402820-a31b-54ab-83e6-55a0dabe844b");
await pc.getByLabel("Topic chapter").selectOption(CH2);
await pc.getByLabel("Title as printed").fill("সময় ও কাজ");
await pc.getByLabel("Question skill").selectOption("time-work");
await pc.getByLabel("Where it comes from").fill("Test: heading assumed on printed page 30");
await pc.getByRole("button", { name: "Add as draft" }).click();
await pc.getByText(/Saved as a draft/).waitFor({ timeout: 10000 });
const draftId = sql("SELECT id FROM topics WHERE title = 'সময় ও কাজ'")[0].id;
await pa.goto(`${BASE}/topics`);
await pa.getByText("ধারাবাহিক অনুপাত").first().waitFor({ timeout: 15000 });
check("a draft topic is invisible to students", (await pa.locator(`a[href='/topics/${draftId}']`).count()) === 0);
const li = pc.locator("li", { hasText: "সময় ও কাজ" });
await li.getByRole("button", { name: "Mark checked" }).click();
await pc.getByText(/Confirm the topic title appears in the book/).waitFor({ timeout: 10000 });
check("marking a topic checked requires confirming it's in the book", sql(`SELECT review_status FROM topics WHERE id = '${draftId}'`)[0].review_status === "draft");
await li.getByRole("checkbox").check();
await li.getByRole("button", { name: "Mark checked" }).click();
await pc.getByText("Recorded in the audit log.").waitFor({ timeout: 10000 });
await li.getByRole("button", { name: "Record teacher review" }).click();
await pc.getByText(/name of the teacher/).waitFor({ timeout: 10000 });
check("a teacher review needs the teacher's name", sql(`SELECT review_status FROM topics WHERE id = '${draftId}'`)[0].review_status === "checked");
await pa.goto(`${BASE}/topics`);
await pa.getByText("সময় ও কাজ").first().waitFor({ timeout: 15000 });
check("once checked, the topic appears for students with its questions", /Practice questions\s*3/.test(await pa.locator(`a[href='/topics/${draftId}']`).innerText()), await pa.locator(`a[href='/topics/${draftId}']`).innerText());
check("topic actions are audited", sql("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('topic_created', 'topic_checked')")[0].n >= 2);
const asStudent = await pa.evaluate(async () => (await fetch("/admin")).status);
check("students still can't reach admin tools", asStudent === 200 && (await (async () => { await pa.goto(`${BASE}/admin`); return (await pa.getByRole("tab", { name: "Topics" }).count()) === 0; })()));

// ── Progress kept after signing in again
const D = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pd = await D.newPage();
await pd.goto(`${BASE}/signin`);
await pd.getByLabel(/Email or username/).fill("quiz.s@example.com");
await pd.getByLabel("Password", { exact: true }).fill(PW);
await pd.getByRole("button", { name: "Sign in", exact: true }).click();
await pd.waitForURL(/dashboard/, { timeout: 15000 });
await pd.goto(`${BASE}/quiz`);
await pd.getByText("Recent practice").waitFor({ timeout: 15000 });
check("after signing in again, practice history and progress are still there", (await pd.getByText(/right of/).count()) >= 2);

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`SUMMARY ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
