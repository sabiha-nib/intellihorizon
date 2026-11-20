// Real-provider evaluation page (Admin -> AI providers), run here against the LOCAL provider doubles
// (tests/mock-providers.mjs). This tests the evaluation machinery: configurations, forced routing, recording, the
// "test double" label and human scoring. It is not, and is never reported as, a real-model evaluation.
// Thresholds fixed before running: every check must pass.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";

const BASE = "http://127.0.0.1:8787";
const MOCK = "http://127.0.0.1:8791";
const PW = "monsoon river kite 7";
const CFG = process.env.WR_CONFIG ?? "/tmp/wr/wrangler.multi.jsonc";
const WR = "/home/user/tools/node_modules/.bin/wrangler";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config ${CFG} --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` [${String(detail).slice(0, 300)}]`}`); };
await fetch(`${MOCK}/__pmode`, { method: "POST", body: JSON.stringify({ anthropic: "ok", gemini: "ok", openai: "ok" }) });
await fetch(`${MOCK}/__reset`, { method: "POST", body: "{}" });

async function register(page, { name, username, email }) {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Full name").fill(name); await page.getByLabel("Username").fill(username); await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PW); await page.getByLabel("Confirm password").fill(PW);
  await page.getByText("Available").waitFor({ timeout: 10000 }); await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(200);
  await page.getByRole("combobox").fill("Dhak"); await page.getByRole("option", { name: /^Dhaka ঢাকা/ }).click();
  await page.getByRole("radio", { name: "Class 7" }).click(); await page.getByRole("radio", { name: /NCTB, Bangla Medium/ }).click();
  await page.getByRole("button", { name: "Continue" }).click(); await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText(/^Welcome, /).waitFor({ timeout: 15000 });
}

const browser = await chromium.launch();

// 1. A student can't reach the evaluation functions.
const S = await browser.newContext();
const ps = await S.newPage();
await register(ps, { name: "Plain Student", username: "plain_student", email: "plain@example.com" });
await ps.goto(`${BASE}/admin`);
await ps.waitForTimeout(1500);
check("a student sees no evaluation panel", (await ps.getByTestId("provider-eval").count()) === 0);

// 2. Admin runs a subset (Claude alone, Claude + OpenAI, all three) so the run stays short.
const A = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await register(pa, { name: "Eval Admin", username: "eval_admin", email: "eval.admin@example.com" });
await pa.goto(`${BASE}/admin`);
await pa.getByLabel("Owner code or admin token").fill("local-test-admin-token-0123456789abcdef");
await pa.getByRole("button", { name: "Unlock admin for this account" }).click();
await pa.getByRole("tab", { name: "AI providers" }).click();
await pa.getByTestId("provider-eval").waitFor({ timeout: 15000 });
const labels = await pa.getByTestId("provider-eval").locator("fieldset label").allTextContents();
check("eight configurations offered with three providers configured", labels.length === 8, labels.join(" | "));
check("every configuration is labelled as a local test double", labels.every((l) => l.includes("local test double")), labels.join(" | "));
const keep = ["Claude alone", "Claude writes, OpenAI verifies", "Three-model collaboration"];
for (const l of await pa.getByTestId("provider-eval").locator("fieldset label").all()) {
  const t = await l.textContent();
  if (!keep.some((k) => t.startsWith(k))) await l.locator("input").uncheck();
}
const btn = pa.getByRole("button", { name: /Run evaluation \(27 answers\)/ });
check("the run size is shown before starting (3 configurations × 9 cases)", (await btn.count()) === 1);
await btn.click();
await pa.getByTestId("eval-report").waitFor({ timeout: 240000 });

const runs = sql("SELECT id, real, configs FROM ai_eval_runs");
check("one run recorded, marked as not real", runs.length === 1 && runs[0].real === 0, JSON.stringify(runs));
check("the report says these are not real-model results", (await pa.getByTestId("eval-report").getAttribute("data-real")) === "false" && (await pa.getByText(/not real-model results/).count()) === 1);
const rows = sql("SELECT config, case_id, status, calls, checks, answer FROM ai_eval_results");
check("27 results recorded (3 × 9)", rows.length === 27, rows.length);
const by = (cfg) => rows.filter((r) => r.config === cfg);
check("Claude alone: one call per answered case, no reviewer", by("anthropic").filter((r) => r.status === "ok").every((r) => r.calls === 1), JSON.stringify(by("anthropic").map((r) => [r.case_id, r.calls])));
check("Claude + OpenAI: author and reviewer on answered cases", by("anthropic+openai").filter((r) => r.status === "ok").every((r) => r.calls === 2), JSON.stringify(by("anthropic+openai").map((r) => [r.case_id, r.calls])));
check("trio: three calls (author, independent, reviewer) on answered cases", by("trio").filter((r) => r.status === "ok").every((r) => r.calls === 3), JSON.stringify(by("trio").map((r) => [r.case_id, r.calls])));
const g = sql("SELECT provider, role, strategy FROM ai_requests WHERE strategy = 'collaborate'");
check("trio really used all three providers", new Set(g.map((x) => x.provider)).size === 3 && g.some((x) => x.role === "independent") && g.some((x) => x.role === "verifier"), JSON.stringify(g.slice(0, 6)));
check("automatic checks recorded for every result", rows.every((r) => JSON.parse(r.checks).length > 0));
check("answers kept for human review", rows.filter((r) => r.status === "ok").every((r) => JSON.parse(r.answer).blocks.length > 0));
const cache = sql("SELECT COUNT(*) AS n FROM ai_cache")[0].n;
check("evaluation answers are never served from or written to the cache", cache === 0, cache);
check("summary table has one row per configuration", (await pa.locator("[data-summary]").count()) === 3);

// 3. Human scoring.
const card = pa.locator('[data-result="anthropic:bn-definition"]');
await card.getByLabel("Correct meaning").selectOption("4");
await card.getByLabel("Language fluency").selectOption("5");
await card.getByLabel("Teaching quality").selectOption("3");
await card.getByLabel("Note").fill("Test double text; scoring flow only.");
await card.getByRole("button", { name: "Save score" }).click();
await pa.waitForTimeout(1500);
const scored = sql("SELECT human_correct, human_fluency, human_pedagogy, human_note, reviewed_by FROM ai_eval_results WHERE config = 'anthropic' AND case_id = 'bn-definition'")[0];
check("a person's scores are saved with who scored it", scored.human_correct === 4 && scored.human_fluency === 5 && scored.human_pedagogy === 3 && !!scored.reviewed_by, JSON.stringify(scored));
check("the summary shows the scored average", (await pa.locator('[data-summary="anthropic"]').textContent()).includes("1 / 9"));

await browser.close();
const passedN = results.filter(Boolean).length;
console.log(`SUMMARY ${passedN}/${results.length}`);
process.exit(passedN === results.length ? 0 : 1);
