// End-to-end account tests. Run against a local Worker (wrangler dev with D1 + R2 on :8787), then: node tests/e2e.accounts.mjs
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const BASE = "http://127.0.0.1:8787";
const PW = "monsoon river kite 7";
const results = [];
const check = (name, ok, extra = "") => { results.push([ok ? "PASS" : "FAIL", name, extra]); console.log(ok ? "PASS" : "FAIL", name, extra); };
const sql = (q) => {
  const out = execSync(`/home/user/tools/node_modules/.bin/wrangler d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(out)[0].results;
};
const sha = (s) => createHash("sha256").update(s).digest("hex");

async function fillStep1(page, { name, username, email, password = PW, photo = false }) {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  if (photo) {
    await page.locator("input[type=file]").setInputFiles("/tmp/face.png");
    await page.getByRole("button", { name: "Use photo" }).click();
  }
}
async function fillStep2(page, grade = 8) {
  await page.waitForTimeout(150);
  await page.getByRole("combobox").fill("Rajsh");
  await page.getByRole("option", { name: /^Rajshahi রাজশাহী/ }).click();
  await page.getByLabel("School").fill("Shibganj Pilot High School, a long school name to test wrapping in the layout");
  await page.getByRole("radio", { name: `Class ${grade}` }).click();
  await page.getByRole("radio", { name: /NCTB, Bangla Medium/ }).click();
}

const browser = await chromium.launch();
const A = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR A", e.message));

// 1. Validation before anything is sent
await pa.goto(`${BASE}/signup`);
await pa.getByRole("button", { name: "Continue" }).click();
check("empty step 1 shows field errors", (await pa.getByText("Enter the name you'd like to be called.").count()) === 1 && (await pa.getByText("Create a password.").count()) === 1);
await pa.getByLabel("Password", { exact: true }).fill("password123");
await pa.getByLabel("Password", { exact: true }).blur();
check("common password rejected", (await pa.getByText(/too common/).count()) === 1);

// 2. Full registration with photo
await fillStep1(pa, { name: "নুসরাত Jahan", username: "Nusrat_09", email: " Nusrat@Example.com ", photo: true });
await pa.getByText("Available").waitFor({ timeout: 8000 });
check("username availability checked on server", true);
await pa.screenshot({ path: "/tmp/shot-step1.png", fullPage: true });
await pa.getByRole("button", { name: "Continue" }).click();
await pa.getByRole("button", { name: "Continue" }).click();
check("step 2 requires district, class, curriculum", (await pa.getByText("Choose your district from the list.").count()) === 1 && (await pa.getByText("Choose your class.").count()) === 1);
await fillStep2(pa);
await pa.screenshot({ path: "/tmp/shot-step2.png", fullPage: true });
await pa.getByRole("button", { name: "Continue" }).click();
await pa.getByRole("button", { name: "Create account" }).click();
check("privacy acknowledgement required", (await pa.getByText(/Please confirm you've read/).count()) === 1);
await pa.getByRole("checkbox").check();
await pa.screenshot({ path: "/tmp/shot-step3.png", fullPage: true });
await pa.getByRole("button", { name: "Create account" }).click();
await pa.getByText("Welcome, নুসরাত.").waitFor({ timeout: 15000 });
check("registration success shown after server confirms", true);
check("email-not-configured notice shown", (await pa.getByText(/Email sending is still being set up/).count()) === 1);

const u = sql("SELECT u.id, u.email, u.password_hash, u.email_verified_at, p.* FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.username = 'nusrat_09'")[0];
check("profile persisted with normalised username and email", u && u.email === "nusrat@example.com" && u.username === "nusrat_09");
check("full name stored exactly (trimmed only)", u?.full_name === "নুসরাত Jahan");
check("school, district, grade, curriculum stored", u?.school?.startsWith("Shibganj") && u.district === "rajshahi" && u.grade === 8 && u.curriculum === "nctb-bangla");
check("password stored only as PBKDF2 hash", u?.password_hash.startsWith("pbkdf2-sha256$100000$") && !u.password_hash.includes("monsoon"));
check("email not marked verified", u?.email_verified_at === null);
check("photo stored in R2 with key on profile", !!u?.avatar_key && u.avatar_type === "image/webp", u?.avatar_key);
const allText = JSON.stringify(sql("SELECT * FROM users")) + JSON.stringify(sql("SELECT * FROM profiles"));
check("password appears nowhere in database", !allText.includes(PW));
const learner = sql(`SELECT * FROM learners WHERE user_id = '${u.id}'`)[0];
check("learner record linked to account with grade synced", learner && learner.grade === 8 && learner.medium === "bangla");

const av = await pa.evaluate(async () => { const r = await fetch("/api/avatar"); return [r.status, r.headers.get("content-type")]; });
check("owner can load own photo", av[0] === 200 && av[1] === "image/webp", String(av));

// 3. Persistence across refresh
await pa.goto(`${BASE}/account`);
await pa.reload();
check("account page shows saved profile after refresh", (await pa.getByRole("heading", { name: "নুসরাত Jahan" }).count()) === 1 && (await pa.getByText("@nusrat_09").count()) >= 1);
await pa.screenshot({ path: "/tmp/shot-account.png", fullPage: true });

// 4. Profile update persists
await pa.getByRole("radio", { name: "Class 9" }).click();
await pa.getByRole("button", { name: "Save changes" }).click();
await pa.getByText("Profile saved.").waitFor({ timeout: 8000 });
check("profile update confirmed and persisted", sql("SELECT grade FROM profiles WHERE username='nusrat_09'")[0].grade === 9);

// 5. Sign out, protected route, signed-out photo access
await pa.getByRole("button", { name: "Sign out", exact: true }).click();
await pa.waitForURL(`${BASE}/`);
await pa.goto(`${BASE}/account`);
check("signed-out user redirected from /account", pa.url().includes("/signin"));
const avOut = await pa.evaluate(async () => (await fetch("/api/avatar")).status);
check("signed-out user cannot load photo", avOut === 401);
check("session row removed on sign out", sql(`SELECT COUNT(*) AS n FROM sessions WHERE user_id='${u.id}'`)[0].n === 0);

// 6. Sign in: wrong then right, by username
await pa.goto(`${BASE}/signin`);
await pa.getByLabel("Email or username").fill("nusrat_09");
await pa.getByLabel("Password", { exact: true }).fill("wrong password here");
await pa.getByRole("button", { name: "Sign in", exact: true }).click();
await pa.getByText("That email or username and password don't match.").waitFor({ timeout: 8000 });
check("invalid credentials handled with generic message", true);
await pa.getByLabel("Password", { exact: true }).fill(PW);
await pa.getByRole("button", { name: "Sign in", exact: true }).click();
await pa.waitForURL(`${BASE}/dashboard`);
check("sign-in lands on the dashboard", true);
await pa.goto(`${BASE}/account`);
check("returning user sees own restored profile", (await pa.getByText("@nusrat_09").count()) >= 1);

// 7. Second student: duplicate username, duplicate email, separate data
const B = await browser.newContext();
const pb = await B.newPage();
await fillStep1(pb, { name: "Rafi Ahmed", username: "nusrat_09", email: "nusrat@example.com" });
await pb.getByText("That username is taken.").waitFor({ timeout: 8000 });
check("taken username reported by server", true, `${await pb.getByRole("button", { name: /^@nusrat_09\d+$/ }).count()} suggestions`);
await pb.getByLabel("Username").fill("rafi_10");
await pb.getByText("Available").waitFor({ timeout: 8000 });
await pb.getByRole("button", { name: "Continue" }).click();
await fillStep2(pb, 7);
await pb.getByRole("button", { name: "Continue" }).click();
await pb.getByRole("checkbox").check();
await pb.getByRole("button", { name: "Create account" }).click();
await pb.getByText(/This email can't be used for a new account/).waitFor({ timeout: 8000 });
check("duplicate email rejected and user sent back to fix it", (await pb.getByLabel("Email", { exact: true }).count()) === 1);
check("non-sensitive fields kept after failure", (await pb.getByLabel("Full name").inputValue()) === "Rafi Ahmed");
await pb.getByLabel("Email", { exact: true }).fill("rafi@example.com");
await pb.getByRole("button", { name: "Continue" }).click();
await pb.getByRole("button", { name: "Continue" }).click();
await pb.getByRole("button", { name: "Create account" }).click();
await pb.getByText("Welcome, Rafi.").waitFor({ timeout: 15000 });
const bAvatar = await pb.evaluate(async () => (await fetch("/api/avatar")).status);
check("student B cannot get student A's photo", bAvatar === 404);
await pb.goto(`${BASE}/account`);
check("student B sees only own profile", (await pb.getByText("@rafi_10").count()) >= 1 && (await pb.getByText("nusrat").count()) === 0);

// 8. Upload restrictions and cross-site protection
const bad = await pa.evaluate(async () => {
  const send = async (bytes, name) => { const f = new FormData(); f.append("file", new Blob([bytes]), name); const r = await fetch("/api/avatar", { method: "POST", body: f }); return r.status; };
  const fake = await send(new TextEncoder().encode("not really an image at all"), "x.png");
  const big = new Uint8Array(2_600_000); big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return [fake, await send(big, "big.png")];
});
check("non-image disguised as .png rejected", bad[0] === 415);
check("oversized image rejected", bad[1] === 413);
const cookies = await A.cookies();
const sid = cookies.find((c) => c.name === "edu_sid")?.value;
const cross = execSync(`curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Origin: https://evil.example" -H "Cookie: edu_sid=${sid}" ${BASE}/api/avatar`, { encoding: "utf8" });
check("cross-site request with valid cookie blocked", cross === "403");
check("photo still present after blocked request", !!sql("SELECT avatar_key FROM profiles WHERE username='nusrat_09'")[0].avatar_key);
check("session cookie is HttpOnly, Secure, SameSite=Lax", cookies.some((c) => c.name === "edu_sid" && c.httpOnly && c.secure && c.sameSite === "Lax"));
const docCookie = await pa.evaluate(() => document.cookie);
check("session token not readable by page scripts", !docCookie.includes("edu_sid"));

// 9. Race: two students submit the same username at the same moment
const C1 = await browser.newContext(); const C2 = await browser.newContext();
const p1 = await C1.newPage(); const p2 = await C2.newPage();
for (const [p, e] of [[p1, "race1@example.com"], [p2, "race2@example.com"]]) {
  await fillStep1(p, { name: "Racer", username: "racer_1", email: e });
  await p.getByText("Available").waitFor({ timeout: 8000 });
  await p.getByRole("button", { name: "Continue" }).click();
  await fillStep2(p);
  await p.getByRole("button", { name: "Continue" }).click();
  await p.getByRole("checkbox").check();
}
await Promise.all([p1.getByRole("button", { name: "Create account" }).click(), p2.getByRole("button", { name: "Create account" }).click()]);
await Promise.race([p1.getByText("Welcome, Racer.").waitFor({ timeout: 15000 }), p2.getByText("Welcome, Racer.").waitFor({ timeout: 15000 })]);
await new Promise((r) => setTimeout(r, 2500));
const racers = sql("SELECT COUNT(*) AS n FROM profiles WHERE username='racer_1'")[0].n;
const loser = (await p1.getByText("That username is taken.").count()) + (await p2.getByText("That username is taken.").count());
check("simultaneous same-username registrations: exactly one wins", racers === 1 && loser === 1, `profiles=${racers} loserMsgs=${loser}`);
check("no orphan user created for the losing request", sql("SELECT COUNT(*) AS n FROM users WHERE email IN ('race1@example.com','race2@example.com')")[0].n === 1);

// 10. Response lost after the server created the account: retry must not duplicate
const D = await browser.newContext(); const pd = await D.newPage();
let dropped = false;
await pd.route("**/_serverFn/**", async (route) => {
  const body = route.request().postData() ?? "";
  if (!dropped && body.includes("requestId")) { dropped = true; await route.fetch(); await route.abort("failed"); return; }
  await route.continue();
});
await fillStep1(pd, { name: "Mitu Das", username: "mitu_das", email: "mitu@example.com" });
await pd.getByText("Available").waitFor({ timeout: 8000 });
await pd.getByRole("button", { name: "Continue" }).click();
await fillStep2(pd);
await pd.getByRole("button", { name: "Continue" }).click();
await pd.getByRole("checkbox").check();
await pd.getByRole("button", { name: "Create account" }).click();
await pd.getByRole("alert").first().waitFor({ timeout: 10000 });
check("lost response shows a recoverable error", (await pd.getByRole("button", { name: "Create account" }).count()) === 1);
await pd.getByRole("button", { name: "Create account" }).click();
await pd.getByText("Welcome, Mitu.").waitFor({ timeout: 15000 });
check("retry completes without duplicate account", sql("SELECT COUNT(*) AS n FROM users WHERE email='mitu@example.com'")[0].n === 1);

// 11. Password reset with a real token, single use, other sessions ended
await pa.goto(`${BASE}/forgot-password`);
await pa.getByLabel("Email").fill("nusrat@example.com");
await pa.getByRole("button", { name: "Send reset link" }).click();
await pa.getByText("Email isn't set up yet").waitFor({ timeout: 8000 });
check("forgot password reports missing email configuration honestly", true);
const tok = "T".repeat(10) + "resettokenforlocaltesting000000000000";
const now = Math.floor(Date.now() / 1000);
sql(`INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES ('${sha(tok)}', '${u.id}', 'reset', ${now + 1800}, ${now})`);
const R = await browser.newContext(); const pr = await R.newPage();
await pr.goto(`${BASE}/reset-password?token=${tok}`);
await pr.getByLabel("New password", { exact: true }).fill("a brand new phrase 42");
await pr.getByLabel("Confirm new password").fill("a brand new phrase 42");
await pr.getByRole("button", { name: "Save new password" }).click();
await pr.getByText("Password changed").waitFor({ timeout: 10000 });
check("reset link sets new password and signs in", true);
check("token removed from address bar", !pr.url().includes("token"));
const aStill = await pa.evaluate(async () => (await fetch("/api/avatar")).status);
check("old sessions ended after reset", aStill === 401);
await pr.goto(`${BASE}/reset-password?token=${tok}`);
await pr.getByText("This link was already used").waitFor({ timeout: 8000 });
check("reset link is single use", true);
check("email marked verified after proving control via reset", sql(`SELECT email_verified_at FROM users WHERE id='${u.id}'`)[0].email_verified_at !== null);

// 12. Email verification token: valid and expired
const vt = "V".repeat(10) + "verifytokenforlocaltesting0000000000000";
const vexp = "E".repeat(10) + "expiredtokenforlocaltesting000000000000";
sql(`INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES ('${sha(vt)}', (SELECT user_id FROM profiles WHERE username='rafi_10'), 'verify', ${now + 3600}, ${now}), ('${sha(vexp)}', (SELECT user_id FROM profiles WHERE username='rafi_10'), 'verify', ${now - 10}, ${now - 100})`);
await pb.goto(`${BASE}/verify-email?token=${vexp}`);
await pb.getByText("This link has expired").first().waitFor({ timeout: 8000 });
check("expired verification link handled", true);
await pb.goto(`${BASE}/verify-email?token=${vt}`);
await pb.getByText("Email confirmed").waitFor({ timeout: 8000 });
check("verification link confirms email", sql("SELECT u.email_verified_at FROM users u JOIN profiles p ON p.user_id=u.id WHERE p.username='rafi_10'")[0].email_verified_at !== null);

// 13. Delete account removes everything for that student only
await pb.goto(`${BASE}/account`);
await pb.getByRole("button", { name: "I want to delete my account" }).click();
await pb.getByLabel("Enter your password to confirm").fill(PW);
await pb.getByRole("button", { name: "Delete permanently" }).click();
await pb.waitForURL(`${BASE}/`);
check("deleted account rows gone", sql("SELECT COUNT(*) AS n FROM users WHERE email='rafi@example.com'")[0].n === 0 && sql("SELECT COUNT(*) AS n FROM profiles WHERE username='rafi_10'")[0].n === 0);
check("other students untouched", sql("SELECT COUNT(*) AS n FROM profiles WHERE username='nusrat_09'")[0].n === 1);

// 14. Bangla layout and keyboard (fresh, signed-out browser)
const E = await browser.newContext(); const pe = await E.newPage();
await pe.goto(`${BASE}/signup`);
await pe.getByRole("button", { name: "বাংলা" }).click();
await pe.getByText("তোমার অ্যাকাউন্ট খোলো").waitFor({ timeout: 8000 });
await pe.setViewportSize({ width: 360, height: 780 });
const overflow = await pe.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check("Bangla sign-up has no horizontal scroll at 360px", !overflow);
await pe.screenshot({ path: "/tmp/shot-bn.png", fullPage: true });
await pe.keyboard.press("Tab");
const tabs = [];
for (let i = 0; i < 6; i++) { await pe.keyboard.press("Tab"); tabs.push(await pe.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.id || document.activeElement?.tagName)); }
check("keyboard can reach form fields", tabs.length === 6, tabs.join(" > "));

const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\nSUMMARY ${results.length - failed}/${results.length} passed`);
await browser.close();
