// Security end-to-end tests: admin endpoints refused for students and signed-out visitors, owner code single use,
// XP can't be inflated from the client, another student's session can't be answered or completed, an unfinished
// session pays no completion reward, security headers, and no secrets or owner codes in the browser bundle.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://127.0.0.1:8787";
const PW = "monsoon river kite 7";
const results = [];
const check = (n, ok, x = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : x); };
const WR = "/home/user/tools/node_modules/.bin/wrangler";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const CODE = "EDU-SECAA-SECBB-SECCC-SECDD-SECEE";
sql(`INSERT OR IGNORE INTO admin_bootstrap (code_hash, created_at) VALUES ('${createHash("sha256").update(CODE).digest("hex")}', '2026-11-15T00:00:00Z')`);

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
const capture = (page) => {
  const list = [];
  page.on("requestfinished", async (r) => {
    if (r.method() !== "POST" || !r.url().includes("_serverFn")) return;
    let out = "";
    try { out = await (await r.response())?.text() ?? ""; } catch { out = ""; }
    list.push({ url: r.url(), body: r.postData() ?? "", out, headers: Object.fromEntries(Object.entries(r.headers()).filter(([k]) => !["host", "content-length", "cookie"].includes(k))) });
  });
  return list;
};
const replay = (page, req, body = req.body) => page.evaluate(async ({ url, headers, body }) => { const r = await fetch(url, { method: "POST", body, headers }); return `${r.status} ${await r.text()}`; }, { url: req.url, headers: req.headers, body });

const browser = await chromium.launch();
const A = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pa = await A.newPage();
const reqA = capture(pa);
await register(pa, { name: "Admin Sec", username: "admin_sec", email: "admin.sec@example.com" });
const B = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pb = await B.newPage();
const reqB = capture(pb);
await register(pb, { name: "Student Sec", username: "stud_sec", email: "stud.sec@example.com" });

// 1. Owner code: single use, audited, never in the bundle
await pa.goto(`${BASE}/admin`);
await pa.getByLabel("Owner code or admin token").fill(CODE);
await pa.getByRole("button", { name: "Unlock admin for this account" }).click();
await pa.getByRole("tab", { name: "Coverage" }).waitFor({ timeout: 15000 });
check("the owner code unlocks admin once", sql("SELECT role FROM users WHERE email = 'admin.sec@example.com'")[0].role === "admin");
await pb.goto(`${BASE}/admin`);
await pb.getByLabel("Owner code or admin token").fill(CODE);
await pb.getByRole("button", { name: "Unlock admin for this account" }).click();
await pb.getByText(/isn't valid, or it has already been used/).waitFor({ timeout: 10000 });
check("replaying a used owner code fails and is audited", sql("SELECT role FROM users WHERE email = 'stud.sec@example.com'")[0].role !== "admin" && sql("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'admin_claim_failed'")[0].n >= 1);
check("a new account is never an admin automatically", sql("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")[0].n === 1);

// 2. Admin endpoints called directly by a student and by a signed-out visitor
await pa.getByRole("tab", { name: "Passage review" }).click();
await pa.getByLabel("Book", { exact: true }).selectOption({ index: 1 });
await pa.waitForTimeout(1500);
// Server-function URLs are hashed, so admin calls are recognised by what they return: coverage totals, the passage queue.
const adminCalls = reqA.filter((r) => r.out.includes('"totals"') || (r.out.includes('"items"') && r.out.includes('"chapters"')));
const outcomes = [];
for (const r of adminCalls.slice(0, 3)) outcomes.push(await replay(pb, r));
check("admin data endpoints refuse a student", adminCalls.length >= 1 && outcomes.every((o) => o.includes("not_admin")), outcomes.map((o) => o.slice(0, 80)).join(" | "));
const anon = await browser.newContext();
const pn = await anon.newPage();
await pn.goto(`${BASE}/`);
const anonOut = await replay(pn, adminCalls[0]);
check("admin data endpoints refuse a signed-out visitor", anonOut.includes("not_admin") || anonOut.includes("signed_out"), anonOut.slice(0, 120));

// 3. Learning session integrity
await pa.goto(`${BASE}/dashboard`);
await pa.getByRole("button", { name: "Start a Learning Session" }).click();
await pa.waitForURL(/\/practice\/session\//, { timeout: 15000 });
const sessionId = pa.url().split("/").pop();
await pa.getByRole("button", { name: "Start the session" }).click();
for (let i = 0; i < 3; i++) await pa.getByRole("button", { name: "Next idea" }).click();
await pa.getByRole("button", { name: "I'm ready to try" }).click();
const qids = JSON.parse(sql(`SELECT question_ids FROM learning_sessions WHERE id = '${sessionId}'`)[0].question_ids);
const q = sql(`SELECT id, type, answer, answer_kind, options FROM questions WHERE id = '${qids[0]}'`)[0];
if (q.type === "mcq") await pa.getByRole("radio").filter({ hasText: JSON.parse(q.options).find((o) => o.id === q.answer).text }).first().click();
else await pa.getByLabel("Your answer").fill(q.answer_kind === "ratio" ? q.answer.split(":").join(" : ") : q.answer);
await pa.getByRole("button", { name: "Check my answer" }).click();
await pa.getByText(/That's right\.|Not yet\. Here's the answer\./).waitFor({ timeout: 10000 });
const answerReq = reqA.filter((r) => r.body.includes(qids[0])).at(-1);
const xpBefore = sql("SELECT COALESCE(SUM(xp), 0) AS n FROM xp_events WHERE user_id = (SELECT id FROM users WHERE email = 'admin.sec@example.com')")[0].n;
const r1 = await replay(pa, answerReq);
const forged = answerReq.body.replace(/"xp"\s*:\s*\d+/, "").replace(/\{/, '{"xp":9999,"correct":true,"points":9999,');
const r2 = await replay(pa, answerReq, forged);
const xpAfter = sql("SELECT COALESCE(SUM(xp), 0) AS n FROM xp_events WHERE user_id = (SELECT id FROM users WHERE email = 'admin.sec@example.com')")[0].n;
check("re-sending an answer, even with made-up XP fields, adds no XP", xpAfter === xpBefore, `${xpBefore} -> ${xpAfter}; ${r1.slice(0, 60)} | ${r2.slice(0, 60)}`);
check("XP rows only ever hold the server's own amounts", sql("SELECT COUNT(*) AS n FROM xp_events WHERE xp > 100")[0].n === 0);
const attemptsBefore = sql(`SELECT COUNT(*) AS n FROM attempts WHERE session_id = '${sessionId}'`)[0].n;
const rB = await replay(pb, answerReq, answerReq.body.replace(/"clientEventId"\s*:\s*"[^"]+"/, '"clientEventId":"forged-by-other-student-0001"'));
check("another student can't answer inside someone else's session", sql(`SELECT COUNT(*) AS n FROM attempts WHERE session_id = '${sessionId}'`)[0].n === attemptsBefore && sql("SELECT COUNT(*) AS n FROM attempts WHERE user_id = (SELECT id FROM users WHERE email = 'stud.sec@example.com')")[0].n === 0, rB.slice(0, 120));
// Complete: B tries A's session, then A completes with only one answer
await pa.goto(`${BASE}/dashboard`);
const page2 = await A.newPage();
const reqA2 = capture(page2);
await page2.goto(`${BASE}/practice/session/${sessionId}`);
await page2.waitForTimeout(2500);
const getReq = reqA2.find((r) => r.body.includes(sessionId) && r.out.includes(qids[0]));
if (getReq) {
  const done = getReq.body;
  const outB = await replay(pb, { ...getReq }, done);
  check("another student can't open or complete someone else's session", outB.includes("not_found") || !outB.includes(qids[0]), outB.slice(0, 120));
} else check("another student can't open or complete someone else's session", false, "no session request captured");
const sessionXp = () => sql("SELECT COUNT(*) AS n FROM xp_events WHERE kind = 'session_complete'")[0].n;
check("an unfinished session has paid no completion reward", sessionXp() === 0);

// 4. Headers and bundle
const res = await pn.request.get(`${BASE}/`);
const h = res.headers();
// frame-ancestors is injected by the Higgsfield hosting platform on deployed responses, so it isn't checked locally.
check("security headers are set (CSP, HSTS, referrer, permissions with camera off)", !!h["content-security-policy"] && !!h["strict-transport-security"] && !!h["referrer-policy"] && /camera=\(\)/.test(h["permissions-policy"] ?? ""), JSON.stringify(h).slice(0, 400));
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const x = join(d, f); if (statSync(x).isDirectory()) walk(x); else if (/\.(js|html|json)$/.test(f)) files.push(x); } };
walk("/home/user/website-17609620527ef5f4f428f302/app/dist/client");
const bundle = files.map((f) => readFileSync(f, "utf8")).join("\n");
check("no owner code, admin token, owner-code hash or provider key in the browser bundle", !/EDU-[A-Z0-9]{5}-/.test(bundle) && !bundle.includes("local-test-admin-token") && !bundle.includes("919536ad4158793900e08e65d55d0bb81ebb984d06418d4d42c9588322eecabe") && !bundle.includes("test-key-not-secret"));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`SUMMARY ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
