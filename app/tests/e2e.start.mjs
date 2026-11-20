// Curriculum selection (/start): Classes 6–10 × Bangla Version / English Version, persistence, honest availability,
// interface language kept separate, and no cross-class or cross-version textbook use in the tutor.
// Thresholds fixed before running: every check must pass.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";

const BASE = "http://127.0.0.1:8787";
const PW = "monsoon river kite 7";
const CFG = process.env.WR_CONFIG ?? "/tmp/wr/wrangler.jsonc";
const WR = "/home/user/website-17609620527ef5f4f428f302/app/tests/support/d1-cli.sh";
const sql = (q) => JSON.parse(execFileSync(WR, ["d1", "execute", "DB", "--local", "--config", CFG, "--json", "--command", q], { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` [${String(detail).slice(0, 300)}]`}`); };
const browser = await chromium.launch();

// 1. Visitor: every class and both versions, with honest availability.
const V = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pv = await V.newPage();
pv.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await pv.goto(`${BASE}/start`);
check("five classes offered (6–10)", (await pv.locator("[data-grade]").count()) === 5 && JSON.stringify(await pv.locator("[data-grade]").evaluateAll((els) => els.map((e) => e.getAttribute("data-grade")))) === '["6","7","8","9","10"]');
for (const g of [6, 7, 8, 9, 10]) {
  await pv.locator(`[data-grade="${g}"]`).click();
  const media = await pv.locator("[data-medium]").evaluateAll((els) => els.map((e) => e.getAttribute("data-medium")));
  const avail = await pv.locator("[data-medium] [data-availability]").evaluateAll((els) => els.map((e) => e.getAttribute("data-availability")));
  const expect = g === 7 ? ["partial", "coming_soon"] : ["coming_soon", "coming_soon"];
  check(`Class ${g}: Bangla Version and English Version, availability ${expect.join("/")}`, JSON.stringify(media) === '["bangla","english"]' && JSON.stringify(avail) === JSON.stringify(expect), `${media} ${avail}`);
}
await pv.locator('[data-grade="9"]').click();
await pv.locator('[data-medium="english"]').click();
check("an unavailable choice says plainly that no textbooks are imported", /haven't been imported yet/.test(await pv.getByTestId("no-books").textContent()));
await pv.getByRole("button", { name: "Enter IntelliHorizon" }).click();
await pv.waitForURL(/\/learn/, { timeout: 15000 });
await pv.goto(`${BASE}/start`);
check("a visitor's choice is remembered on this device", (await pv.locator('[data-grade="9"]').getAttribute("aria-checked")) === "true" && (await pv.locator('[data-medium="english"]').getAttribute("aria-checked")) === "true");

// 2. Signed-in student: saving changes the profile; the interface language stays as chosen.
const S = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await S.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await p.goto(`${BASE}/signup`);
await p.getByLabel("Full name").fill("Rafi Hasan"); await p.getByLabel("Username").fill("rafi_start"); await p.getByLabel("Email", { exact: true }).fill("rafi.start@example.com");
await p.getByLabel("Password", { exact: true }).fill(PW); await p.getByLabel("Confirm password").fill(PW);
await p.getByText("Available").waitFor({ timeout: 10000 }); await p.getByRole("button", { name: "Continue" }).click(); await p.waitForTimeout(200);
await p.getByRole("combobox").fill("Dhak"); await p.getByRole("option", { name: /^Dhaka ঢাকা/ }).click();
await p.getByRole("radio", { name: "Class 7" }).click(); await p.getByRole("radio", { name: /NCTB, Bangla Medium/ }).click();
await p.getByRole("button", { name: "Continue" }).click(); await p.getByRole("checkbox").check(); await p.getByRole("button", { name: "Create account" }).click();
await p.getByText(/^Welcome, /).waitFor({ timeout: 15000 });
const me = sql("SELECT id FROM users WHERE email = 'rafi.start@example.com'")[0].id;
const profile = () => sql(`SELECT grade, curriculum FROM profiles WHERE user_id = '${me}'`)[0];

async function choose(g, m, uiBangla = false) {
  await p.goto(`${BASE}/start`);
  await p.locator(`[data-grade="${g}"]`).click();
  await p.locator(`[data-medium="${m}"]`).click();
  await p.getByRole("button", { name: uiBangla ? "সংরক্ষণ করে প্রবেশ করো" : "Save and enter" }).click();
  await p.waitForURL(/\/dashboard/, { timeout: 15000 });
  await p.waitForTimeout(500);
}
async function ask(q) {
  sql("DELETE FROM ai_cache");
  await p.goto(`${BASE}/tutor?subject=mathematics`);
  await p.locator("textarea#ask").fill(q);
  await p.getByRole("button", { name: /^(Send|পাঠাও)$/ }).click();
  await p.waitForURL(/\/tutor\/[0-9a-f-]{36}/, { timeout: 30000 });
  await p.waitForLoadState("networkidle");
  return JSON.parse(sql(`SELECT m.payload FROM tutor_messages m JOIN tutor_threads t ON t.id = m.thread_id WHERE t.user_id = '${me}' AND m.role = 'tutor' ORDER BY m.id DESC LIMIT 1`)[0].payload);
}
const Q = "ধারাবাহিক অনুপাত কাকে বলে?";

let pay = await ask(Q);
check("Class 7 Bangla Version: the tutor finds checked Class 7 Bangla text", ["grounded", "partial"].includes(pay.status) && pay.excerpts.length > 0 && pay.excerpts.every((e) => e.source.grade === 7 && e.source.language === "bn"), JSON.stringify({ s: pay.status, n: pay.excerpts?.length }));

await choose(8, "bangla");
check("saving Class 8 Bangla Version updates the profile", JSON.stringify(profile()) === '{"grade":8,"curriculum":"nctb-bangla"}', JSON.stringify(profile()));
pay = await ask(Q);
check("Class 8: no Class 7 text is served (no cross-class retrieval)", pay.excerpts.length === 0 && pay.status === "no_books", JSON.stringify({ s: pay.status, n: pay.excerpts.length }));

await choose(7, "english");
check("saving Class 7 English Version updates the profile", JSON.stringify(profile()) === '{"grade":7,"curriculum":"nctb-english"}', JSON.stringify(profile()));
pay = await ask(Q);
check("English Version: Bangla Version text is never served (no cross-version mix)", pay.excerpts.length === 0, JSON.stringify({ s: pay.status, n: pay.excerpts.length }));

// Interface language is independent of the textbook version.
await p.goto(`${BASE}/dashboard`);
await p.getByRole("button", { name: "বাংলা" }).first().click();
await p.waitForTimeout(500);
await choose(7, "bangla", true);
check("choosing Bangla Version doesn't change the interface language, and vice versa", (await p.getByRole("link", { name: /হোম/ }).count()) > 0);
await choose(7, "english", true);
check("English Version with a Bangla interface stays Bangla", (await p.getByRole("link", { name: /হোম/ }).count()) > 0 && profile().curriculum === "nctb-english");
await choose(7, "bangla", true);
pay = await ask(Q);
const scope = await p.getByTestId("tutor-scope").textContent();
check("back on Class 7 Bangla Version, the tutor shows the class and version it uses", pay.excerpts.length > 0 && /৭ম শ্রেণি · বাংলা ভার্সন/.test(scope), scope);

await browser.close();
const n = results.filter(Boolean).length;
console.log(`SUMMARY ${n}/${results.length}`);
process.exit(n === results.length ? 0 : 1);
