// End-to-end tests for the grounded AI tutor: retrieval -> validated AI explanation -> citations, with a local
// OpenAI-compatible test double (tests/mock-ai.mjs on :8790) standing in for the provider.
// Covers: grounded answer with real citations, dropped fabrications, out-of-scope refusal, ambiguous context,
// provider outage, timeout, fabricated reply, insufficient evidence, request logging without content, and that the
// provider key never reaches the browser bundle.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://127.0.0.1:8787";
const MOCK = "http://127.0.0.1:8790";
const PW = "monsoon river kite 7";
const results = [];
const check = (n, ok, x = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : x); };
const WR = "/home/user/tools/node_modules/.bin/wrangler";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const mode = (m) => fetch(`${MOCK}/__mode`, { method: "POST", body: JSON.stringify({ mode: m }) });
const lastReq = async () => (await fetch(`${MOCK}/__last`)).json();
const lastPayload = () => JSON.parse(sql("SELECT payload FROM tutor_messages WHERE role = 'tutor' ORDER BY id DESC LIMIT 1")[0].payload);
const MATH = "95402820-a31b-54ab-83e6-55a0dabe844b";
const SCI = "41f978e8-eeda-5506-b1ea-dc96ca7fec47";

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

// Two published test passages sharing a made-up word, in two subjects, to exercise the ambiguity check.
const fixture = "Zentrofol is a made-up word that exists only in the automated test fixture for this tutor check.";
sql(`INSERT INTO passages (textbook_id, page, seq, text, content_hash, review_status, publish_status, provenance) VALUES ('${MATH}', 23, 990, '${fixture} Mathematics copy.', 'testfx1', 'checked', 'published', 'test_fixture'), ('${SCI}', 15, 990, '${fixture} Science copy.', 'testfx2', 'checked', 'published', 'test_fixture')`);

const browser = await chromium.launch();
const A = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await register(pa, { name: "Mitu Akter", username: "mitu_ai", email: "mitu.ai@example.com" });
await mode("ok");

const ask = async (q, waitFor) => {
  await pa.goto(`${BASE}/tutor`);
  await pa.getByPlaceholder(/Ask a question/).fill(q);
  await pa.getByRole("button", { name: "Send" }).click();
  if (waitFor) await pa.getByText(waitFor).first().waitFor({ timeout: 20000 });
  else await pa.waitForTimeout(3000);
  await pa.waitForTimeout(300);
  return lastPayload();
};

// 1. Covered question: grounded, explained, cited
let p = await ask("ধারাবাহিক অনুপাত কাকে বলে?", /MOCK-DIRECT/);
const ids = new Set(p.excerpts.map((e) => e.source.passageId));
check("covered question is grounded in checked Mathematics text", p.status === "grounded" && p.excerpts.length > 0 && p.excerpts.every((e) => e.source.extraction === "checked" && e.source.subjectKey === "mathematics"), p.status);
check("AI explanation is shown, built from the retrieved passages", p.ai?.status === "ok" && p.ai.blocks.length >= 3);
check("every AI citation points at a retrieved database record", p.ai.blocks.every((b) => b.cites.every((c) => ids.has(c))));
check("a citation to a record that wasn't retrieved was removed", !JSON.stringify(p.ai.blocks).includes("31337") && p.ai.checks.droppedCites >= 1);
check("a fabricated quotation was dropped; the kept quotation is word for word in its source", p.ai.quotes.length === 1 && !JSON.stringify(p.ai).includes("MOCK fabricated quotation") && sql(`SELECT text FROM passages WHERE id = ${p.ai.quotes[0].passageId}`)[0].text.includes(p.ai.quotes[0].text));
check("a block naming a page that isn't the cited printed page is marked unverified", p.ai.blocks.find((b) => b.text.startsWith("MOCK-EXAMPLE")).basis === "unverified");
check("the check question is labelled as AI-made practice", p.ai.blocks.find((b) => b.role === "check").basis === "practice");
check("the definition's source keeps its printed page (18), separate from the PDF page", p.excerpts.some((e) => e.source.printedPage === 18 && e.source.pdfPage === 23));
check("labels distinguish textbook, derived, general and AI practice on screen", (await pa.getByText("From your textbook").count()) >= 1 && (await pa.getByText("Practice question written by AI").count()) === 1 && (await pa.getByText("Couldn't be checked against your book").count()) === 1);
check("structured maths markup renders as a fraction", (await pa.locator("[role=math]").count()) >= 1);
const req = await lastReq();
const sent = JSON.stringify(req.body);
check("the provider receives the question and retrieved sources, not the student's name, username or email", sent.includes("ধারাবাহিক অনুপাত") && !sent.includes("Mitu") && !sent.includes("mitu_ai") && !sent.includes("mitu.ai@example.com") && req.auth);
const log = sql("SELECT * FROM ai_requests ORDER BY id DESC LIMIT 1")[0];
check("the request is logged as metadata only", log.status === "ok" && log.model === "mock-model-1" && log.sources >= 1 && !Object.values(log).some((v) => String(v).includes("অনুপাত")), JSON.stringify(log));

// 2. Outside the knowledge base: no AI call, honest refusal
const before = sql("SELECT COUNT(*) AS n FROM ai_requests")[0].n;
p = await ask("Explain the causes of the French Revolution", /won't guess|I couldn't find/);
check("an out-of-scope question is refused without calling the AI", p.status !== "grounded" && !p.ai && p.excerpts.length === 0 && sql("SELECT COUNT(*) AS n FROM ai_requests")[0].n === before, p.status);

// 3. Ambiguous curriculum context: asks which subject
p = await ask("What is zentrofol?", /more than one subject/);
check("a question matching two subjects asks which one, without answering yet", p.status === "ambiguous" && p.choices.length === 2 && p.excerpts.length === 0 && !p.ai, JSON.stringify(p.choices));
const nBefore = sql("SELECT COUNT(*) AS n FROM tutor_messages WHERE role = 'tutor'")[0].n;
await pa.getByRole("button", { name: "Science", exact: true }).click();
for (let i = 0; i < 40 && sql("SELECT COUNT(*) AS n FROM tutor_messages WHERE role = 'tutor'")[0].n === nBefore; i++) await pa.waitForTimeout(500);
p = lastPayload();
check("choosing a subject answers from that subject only", p.status === "grounded" && p.excerpts.every((e) => e.source.subjectKey === "science"));

// 4. Provider failure, timeout, fabrication, insufficient evidence: retrieval still works, nothing generated is shown
await mode("fail");
p = await ask("ধারাবাহিক অনুপাত কাকে বলে?", /couldn't be made just now/);
check("provider outage: textbook text still shown, no generated text, honest note", p.ai.status === "unavailable" && p.excerpts.length > 0 && (await pa.getByText(/MOCK-/).count()) === 0);
check("provider outage is logged", sql("SELECT status FROM ai_requests ORDER BY id DESC LIMIT 1")[0].status === "provider_error");
await mode("slow");
p = await ask("ধারাবাহিক অনুপাত কাকে বলে?", /couldn't be made just now/);
check("provider timeout falls back the same way", p.ai.status === "unavailable" && sql("SELECT status FROM ai_requests ORDER BY id DESC LIMIT 1")[0].status === "timeout");
await mode("fabricate");
p = await ask("ধারাবাহিক অনুপাত কাকে বলে?", /didn't match your textbook closely enough/);
check("a reply built on invented sources and quotations is rejected entirely", p.ai.status === "rejected" && p.ai.blocks.length === 0 && (await pa.getByText(/page 77/).count()) === 0);
await mode("insufficient");
p = await ask("ধারাবাহিক অনুপাত কাকে বলে?", /doesn't explain this fully/);
check("when the model says the sources are insufficient, the tutor says so", p.ai.status === "insufficient");
await mode("ok");

// 5. Keys stay on the server
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const x = join(d, f); if (statSync(x).isDirectory()) walk(x); else if (/\.(js|html|css|json)$/.test(f)) files.push(x); } };
walk("/home/user/website-17609620527ef5f4f428f302/app/dist/client");
check("the provider key never appears in the browser bundle", files.length > 0 && !files.some((f) => { const s = readFileSync(f, "utf8"); return s.includes("test-key-not-secret"); }));

await browser.close();
sql("DELETE FROM passages WHERE provenance = 'test_fixture'");
const passed = results.filter(Boolean).length;
console.log(`SUMMARY ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
