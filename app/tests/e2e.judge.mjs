// Judge demo journey, end to end, from fresh browser sessions (no developer login state). Uses the multi-provider
// config with local provider doubles, so "AI response" here means the real orchestrator talking to test doubles.
// The real judge password is never in this file: the test sets its own credential hash in the local database.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const BASE = "http://127.0.0.1:8787";
const CFG = process.env.WR_CONFIG ?? "/tmp/wr/wrangler.multi.jsonc";
const WR = "/home/user/tools/node_modules/.bin/wrangler";
// No shell: the password hash contains "$".
const sql = (q) => JSON.parse(execFileSync(WR, ["d1", "execute", "DB", "--local", "--config", CFG, "--json", "--command", q], { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` [${String(detail).slice(0, 300)}]`}`); };
const b64 = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const TEST_PW = "Test-Judge-Pass-7Kq9";
const salt = randomBytes(16);
sql(`UPDATE demo_access SET password_hash = 'pbkdf2-sha256$100000$${b64(salt)}$${b64(pbkdf2Sync(TEST_PW, salt, 100000, 32, "sha256"))}' WHERE id = 'judge'`);
await fetch("http://127.0.0.1:8791/__reset", { method: "POST", body: "{}" });
check("judge credential is provisioned as a hash only (migration seed present)", sql("SELECT COUNT(*) AS n FROM demo_access WHERE id = 'judge' AND username = 'ih.judge' AND password_hash LIKE 'pbkdf2-sha256$%'")[0].n === 1);

const browser = await chromium.launch();
async function judgeLogin(ctx, pw = TEST_PW, via = "home") {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/`);
  if (via === "home") { await p.getByRole("link", { name: "Judge access" }).click(); await p.waitForURL(/\/judge$/); }
  else await p.goto(`${BASE}/signin`);
  await p.getByLabel(via === "home" ? "Judge username" : "Email or username").fill("ih.judge");
  await p.getByLabel("Password", { exact: true }).fill(pw);
  await p.getByRole("button", { name: via === "home" ? "Open the demo" : "Sign in" }).click();
  return p;
}
async function askHere(p) {
  await p.getByRole("button", { name: "Send" }).click();
  await p.waitForURL(/\/tutor\/[0-9a-f-]{36}/, { timeout: 40000 });
  await p.waitForLoadState("networkidle");
}

// 1–4. Fresh session: homepage -> judge login -> Class 7 Bangla Version dashboard.
const J1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await judgeLogin(J1);
await p.waitForURL(/\/dashboard/, { timeout: 20000 });
await p.getByTestId("judge-welcome").waitFor({ timeout: 15000 });
check("judge lands on the dashboard with a welcome", true);
const chips = await p.getByTestId("judge-curriculum").innerText();
check("active curriculum shown: Class 7 · NCTB · Bangla Version", /Class 7/.test(chips) && /NCTB/.test(chips) && /Bangla Version/.test(chips), chips);
const u1 = sql("SELECT u.id, u.role, u.is_demo, p.grade, p.curriculum FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.is_demo = 1 ORDER BY u.created_at DESC LIMIT 1")[0];
check("the workspace is a student, demo, Class 7, Bangla Version", u1.role === "student" && u1.is_demo === 1 && u1.grade === 7 && u1.curriculum === "nctb-bangla", JSON.stringify(u1));
check("no onboarding or setup is asked of the judge", !/Choose your class|Owner code|API key/i.test(await p.locator("#main").innerText()));
check("an obvious IntelliTutor entry point", await p.getByRole("link", { name: "Open IntelliTutor" }).isVisible());

// 5–7. IntelliTutor: the pre-filled Bangla question gets a grounded AI answer.
await p.locator('[data-step="1"]').click();
await p.waitForURL(/\/tutor\?/);
const box = p.getByPlaceholder(/Ask a question/);
check("guided step pre-fills a Bangla question", (await box.inputValue()) === "ধারাবাহিক অনুপাত কাকে বলে?", await box.inputValue());
await askHere(p);
let pay = JSON.parse(sql(`SELECT m.payload FROM tutor_messages m JOIN tutor_threads t ON t.id = m.thread_id WHERE t.user_id = '${u1.id}' AND m.role = 'tutor' ORDER BY m.id DESC LIMIT 1`)[0].payload);
check("Bangla question: grounded AI explanation in Bangla", pay.ai?.status === "ok" && pay.language?.explanation === "bn" && (pay.excerpts ?? []).length > 0, JSON.stringify({ ai: pay.ai?.status, lang: pay.language }));
check("the answer was produced by the orchestrator (not a canned demo)", Array.isArray(pay.ai?.orchestration?.calls) && pay.ai.orchestration.calls.some((c) => c.role === "author" && c.ok));
const scopeText = await p.getByTestId("tutor-scope").textContent();
check("the tutor shows the class and textbook version it is using", scopeText.startsWith("Class 7 · Bangla Version · "), scopeText);

// 8–9. Switch to English and ask a follow-up.
await p.getByRole("radio", { name: "English", exact: true }).click();
await p.getByPlaceholder(/Ask a question/).fill("Can you explain it again with the book's example?");
await p.getByRole("button", { name: "Send" }).click();
await p.waitForFunction((n) => document.querySelectorAll("[data-ai-status]").length > n, 0, { timeout: 40000 }).catch(() => undefined);
await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500);
pay = JSON.parse(sql(`SELECT m.payload FROM tutor_messages m JOIN tutor_threads t ON t.id = m.thread_id WHERE t.user_id = '${u1.id}' AND m.role = 'tutor' ORDER BY m.id DESC LIMIT 1`)[0].payload);
check("follow-up after switching to English is explained in English", pay.language?.explanation === "en", JSON.stringify(pay.language));

// 10. Complete a practice question.
await p.goto(`${BASE}/quiz`);
await p.getByRole("button", { name: "Start" }).click();
await p.waitForURL(/\/quiz\/[0-9a-f-]{36}$/, { timeout: 15000 });
await p.getByText(/Question 1 of/).waitFor({ timeout: 15000 });
if (await p.getByLabel("Your answer").count()) { await p.getByLabel("Your answer").fill("1"); await p.getByLabel("Your answer").blur(); }
else await p.getByRole("radio").first().click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Check my answer" }).click();
await p.waitForTimeout(1500);
check("a practice answer is graded and recorded for this workspace", sql(`SELECT COUNT(*) AS n FROM attempts WHERE user_id = '${u1.id}'`)[0].n >= 1);

// 11. Progress reflects it.
await p.goto(`${BASE}/progress`);
await p.waitForLoadState("networkidle");
check("learning progress opens for the judge", (await p.getByRole("heading", { level: 1 }).count()) >= 1);

// 12. No admin.
await p.goto(`${BASE}/admin`);
await p.getByLabel("Owner code or admin token").fill("local-test-admin-token-0123456789abcdef");
await p.getByRole("button", { name: "Unlock admin for this account" }).click();
await p.waitForTimeout(1500);
check("a judge workspace cannot become admin, even with a valid token", sql(`SELECT role FROM users WHERE id = '${u1.id}'`)[0].role === "student" && (await p.getByRole("tab", { name: "AI providers" }).count()) === 0);
check("the refusal is explained", await p.getByText(/judge demo workspace/i).first().isVisible().catch(() => false));

// Isolation: a second judge gets a separate, empty workspace.
const J2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await judgeLogin(J2, TEST_PW, "signin");
await p2.waitForURL(/\/dashboard/, { timeout: 20000 });
const u2 = sql("SELECT id FROM users WHERE is_demo = 1 ORDER BY created_at DESC LIMIT 1")[0];
check("each judge sign-in (also via the normal sign-in page) opens its own workspace", u2.id !== u1.id);
await p2.goto(`${BASE}/tutor`);
await p2.waitForLoadState("networkidle");
check("judges never see each other's tutor conversations", sql(`SELECT COUNT(*) AS n FROM tutor_threads WHERE user_id = '${u2.id}'`)[0].n === 0 && !(await p2.content()).includes("ধারাবাহিক অনুপাত কাকে বলে?"));

// Judge AI limit (JUDGE_AI_DAILY_LIMIT=4 in the test config).
for (let i = 0; i < 5; i++) {
  sql("DELETE FROM ai_cache");
  await p2.goto(`${BASE}/tutor?subject=mathematics`);
  await p2.getByPlaceholder(/Ask a question/).fill(i % 2 ? "সমানুপাত কাকে বলে?" : "ধারাবাহিক অনুপাত কাকে বলে?");
  await askHere(p2);
}
const last = JSON.parse(sql(`SELECT m.payload FROM tutor_messages m JOIN tutor_threads t ON t.id = m.thread_id WHERE t.user_id = '${u2.id}' AND m.role = 'tutor' ORDER BY m.id DESC LIMIT 1`)[0].payload);
check("judge AI use is limited per workspace (5th request refused, textbook still shown)", last.ai?.status === "limit" && (last.excerpts ?? []).length > 0, last.ai?.status);

// Expiry: the workspace ends at its fixed time.
sql(`UPDATE users SET demo_expires_at = '2020-01-01T00:00:00Z' WHERE id = '${u1.id}'`);
await p.goto(`${BASE}/dashboard`);
await p.waitForURL(/\/signin/, { timeout: 15000 }).catch(() => undefined);
check("an expired judge workspace is signed out", /\/signin/.test(p.url()), p.url());

// Wrong password and rotation by the admin.
const J3 = await browser.newContext();
const p3 = await judgeLogin(J3, "wrong-password-123", "home");
await p3.getByRole("alert").first().waitFor({ timeout: 10000 }).catch(() => undefined);
check("a wrong judge password is refused", /\/judge$/.test(p3.url()) && sql("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1")[0].n === 2);
const A = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pa = await A.newPage();
await pa.goto(`${BASE}/signup`);
await pa.getByLabel("Full name").fill("Judge Admin"); await pa.getByLabel("Username").fill("ih.judge"); await pa.getByLabel("Email", { exact: true }).fill("judge.admin@example.com");
await pa.getByLabel("Password", { exact: true }).fill("monsoon river kite 7"); await pa.getByLabel("Confirm password").fill("monsoon river kite 7");
const unameMsg = await pa.getByText(/Available|reserved|taken/i).first().textContent({ timeout: 10000 }).catch(() => "");
check("the judge username can't be registered by anyone", /reserved|not available|can't|isn't available/i.test(unameMsg ?? ""), unameMsg);
await pa.getByLabel("Username").fill("rotation_admin");
await pa.getByText("Available").waitFor({ timeout: 10000 }); await pa.getByRole("button", { name: "Continue" }).click(); await pa.waitForTimeout(200);
await pa.getByRole("combobox").fill("Dhak"); await pa.getByRole("option", { name: /^Dhaka ঢাকা/ }).click();
await pa.getByRole("radio", { name: "Class 7" }).click(); await pa.getByRole("radio", { name: /NCTB, Bangla Medium/ }).click();
await pa.getByRole("button", { name: "Continue" }).click(); await pa.getByRole("checkbox").check(); await pa.getByRole("button", { name: "Create account" }).click();
await pa.getByText(/^Welcome, /).waitFor({ timeout: 15000 });
await pa.goto(`${BASE}/admin`);
await pa.getByLabel("Owner code or admin token").fill("local-test-admin-token-0123456789abcdef");
await pa.getByRole("button", { name: "Unlock admin for this account" }).click();
await pa.getByRole("tab", { name: "Judge demo" }).click();
await pa.getByTestId("judge-admin").waitFor({ timeout: 15000 });
await pa.getByRole("button", { name: "Rotate password" }).click();
const shown = await pa.getByText(/Password: /).first().textContent({ timeout: 10000 });
const NEW_PW = shown.split("Password: ")[1].trim();
check("rotation shows a new password once (four groups)", /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/.test(NEW_PW), NEW_PW);
check("rotation ends the live judge sessions", sql(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = '${u2.id}'`)[0].n === 0);
const J4 = await browser.newContext();
const p4 = await judgeLogin(J4, TEST_PW, "home");
await p4.waitForTimeout(2500);
check("the old password stops working after rotation", /\/judge$/.test(p4.url()), p4.url());
const J5 = await browser.newContext();
const p5 = await judgeLogin(J5, NEW_PW, "home");
await p5.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => undefined);
check("the new password works", /\/dashboard/.test(p5.url()), p5.url());
check("the plaintext password is not stored anywhere in the database", sql(`SELECT COUNT(*) AS n FROM audit_log WHERE detail LIKE '%${NEW_PW}%'`)[0].n === 0 && sql(`SELECT COUNT(*) AS n FROM demo_access WHERE password_hash LIKE '%${NEW_PW}%'`)[0].n === 0);

// Rate limit: repeated wrong passwords from one address are blocked.
const J6 = await browser.newContext();
const p6 = await J6.newPage();
let limited = false;
for (let i = 0; i < 14 && !limited; i++) {
  await p6.goto(`${BASE}/judge`);
  await p6.getByLabel("Judge username").fill("ih.judge"); await p6.getByLabel("Password", { exact: true }).fill(`wrong-${i}-xxxxxxxx`);
  await p6.getByRole("button", { name: "Open the demo" }).click();
  await p6.getByRole("alert").first().waitFor({ timeout: 10000 }).catch(() => undefined);
  limited = /Too many attempts/.test(await p6.content());
}
check("judge login attempts are rate limited", limited);

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`SUMMARY ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
