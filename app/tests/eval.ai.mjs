// IntelliCore evaluation runner. Runs data/ai-eval/cases.json through the real app (retrieval, policy, validation)
// and writes tests/eval-report.json. With the local mock provider this measures the PIPELINE (retrieval, abstention,
// citation and quotation validation, policy checks), not the language quality of any real model.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8787";
const MOCK = "http://127.0.0.1:8790";
const PW = "monsoon river kite 7";
const WR = "/home/user/tools/node_modules/.bin/wrangler";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const esc = (s) => s.replace(/'/g, "''");
const data = JSON.parse(readFileSync(new URL("../data/ai-eval/cases.json", import.meta.url), "utf8"));
const fxIds = {};
for (const f of data.fixtures) {
  sql(`INSERT INTO passages (textbook_id, page, seq, text, content_hash, review_status, publish_status, provenance) VALUES ('${f.book}', ${f.page}, 980 + ${Object.keys(fxIds).length}, '${esc(f.text)}', '${createHash("sha256").update(f.text).digest("hex")}', 'checked', 'published', 'eval_fixture')`);
  fxIds[f.id] = sql(`SELECT id FROM passages WHERE provenance = 'eval_fixture' AND text = '${esc(f.text)}'`)[0].id;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/signup`);
await p.getByLabel("Full name").fill("Eval Runner"); await p.getByLabel("Username").fill("eval_runner"); await p.getByLabel("Email", { exact: true }).fill("eval@example.com");
await p.getByLabel("Password", { exact: true }).fill(PW); await p.getByLabel("Confirm password").fill(PW);
await p.getByText("Available").waitFor({ timeout: 10000 }); await p.getByRole("button", { name: "Continue" }).click(); await p.waitForTimeout(200);
await p.getByRole("combobox").fill("Dhak"); await p.getByRole("option", { name: /^Dhaka ঢাকা/ }).click();
await p.getByRole("radio", { name: "Class 7" }).click(); await p.getByRole("radio", { name: /NCTB, Bangla Medium/ }).click();
await p.getByRole("button", { name: "Continue" }).click(); await p.getByRole("checkbox").check(); await p.getByRole("button", { name: "Create account" }).click();
await p.getByText(/^Welcome, /).waitFor({ timeout: 15000 });

const passageText = (id) => sql(`SELECT text FROM passages WHERE id = ${Number(id)}`)[0]?.text ?? "";
const results = [];
for (const c of data.cases) {
  await fetch(`${MOCK}/__mode`, { method: "POST", body: JSON.stringify({ mode: c.mock }) });
  // Validated answers are cached per student and question (Phase 5); every case needs a fresh provider call.
  sql("DELETE FROM ai_cache");
  const aiBefore = sql("SELECT COUNT(*) AS n FROM ai_requests")[0].n;
  await p.goto(`${BASE}/tutor${c.subject ? `?subject=${c.subject}` : ""}`);
  await p.getByPlaceholder(/Ask a question/).fill(c.question);
  await p.getByRole("button", { name: "Send" }).click();
  // A new question opens its conversation page once the answer is saved.
  await p.waitForURL(/\/tutor\/[0-9a-f-]{36}/, { timeout: 30000 });
  await p.waitForLoadState("networkidle");
  const pay = JSON.parse(sql("SELECT payload FROM tutor_messages WHERE role = 'tutor' ORDER BY id DESC LIMIT 1")[0].payload);
  const aiCalled = sql("SELECT COUNT(*) AS n FROM ai_requests")[0].n > aiBefore;
  const e = c.expect;
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail });
  const ids = new Set((pay.excerpts ?? []).map((x) => x.source.passageId));
  if (e.abstain) add("abstained: no excerpt and no AI call", (pay.excerpts ?? []).length === 0 && !aiCalled && pay.status !== "grounded", pay.status);
  if (e.status) add(`status in ${e.status.join("/")}`, e.status.includes(pay.status), pay.status);
  if (e.ai === "none") add("no AI call", !aiCalled && !pay.ai);
  else if (e.ai) add(`AI status ${e.ai}`, pay.ai?.status === e.ai, pay.ai?.status ?? "none");
  if (e.evidenceText) add("retrieval relevance: expected evidence among excerpts", (pay.excerpts ?? []).some((x) => passageText(x.source.passageId).includes(e.evidenceText)));
  if (e.printedPage) add(`printed page ${e.printedPage} kept`, (pay.excerpts ?? []).some((x) => x.source.printedPage === e.printedPage));
  if (pay.ai?.status === "ok") {
    add("citation correctness: every citation is a retrieved record", pay.ai.blocks.every((b) => b.cites.every((cid) => ids.has(cid))));
    add("quotation fidelity: every quote is in its passage", pay.ai.quotes.every((q) => passageText(q.passageId).replace(/\s+/g, " ").includes(q.text.replace(/\s+/g, " "))));
    add("no textbook/derived block without a citation", pay.ai.blocks.every((b) => !["textbook", "derived"].includes(b.basis) || b.cites.length > 0));
  }
  if (e.textbookBlockKept) add("faithful textbook block kept as textbook", pay.ai?.blocks?.some((b) => b.basis === "textbook"));
  if (e.unsupportedDowngraded) add("unsupported claim not shown as textbook", (pay.ai?.checks?.weakSupport ?? 0) >= 1 && !pay.ai.blocks.some((b) => b.basis === "textbook" && b.text.includes("জ্যামিতি")));
  if (e.mathMarkupKept) add("maths markup preserved", pay.ai?.blocks?.some((b) => b.text.includes(e.mathMarkupKept)));
  if (e.noText) add(`no "${e.noText}" shown`, !JSON.stringify(pay.ai ?? {}).includes(e.noText) && !(await p.content()).includes(e.noText));
  if (e.onlySubject) add(`only ${e.onlySubject} excerpts`, (pay.excerpts ?? []).length > 0 && pay.excerpts.every((x) => x.source.subjectKey === e.onlySubject));
  if (e.bothFixtures) add("conflicting records are both shown, not one picked silently", e.bothFixtures.every((f) => ids.has(fxIds[f])));
  if (e.noTranslatedQuote) add("translation fidelity: a translated quotation is not shown as a quotation", !(pay.ai?.quotes ?? []).some((q) => q.text.includes(e.noTranslatedQuote)), JSON.stringify(pay.ai?.quotes ?? null));
  if (e.rewrite) add("cross-language rewrite reported", pay.rewrite?.searched?.includes(e.rewrite), JSON.stringify(pay.rewrite ?? null));
  if (e.noRewrite) add("no rewrite invented", !pay.rewrite);
  if (e.explanationLang) add(`language routing: explanation in ${e.explanationLang}`, pay.language?.explanation === e.explanationLang, pay.language?.explanation);
  if ("firstWrong" in e) add(`working check: first wrong step ${e.firstWrong}`, pay.working?.firstWrong === e.firstWrong, JSON.stringify(pay.working?.firstWrong));
  if (e.aiIn) add(`AI status in ${e.aiIn.join("/")}`, e.aiIn.includes(pay.ai?.status), pay.ai?.status ?? "none");
  if (e.excerptsShown) add("textbook excerpts still shown", (pay.excerpts ?? []).length > 0);
  results.push({ id: c.id, category: c.category, lang: c.lang, status: pay.status, ai: pay.ai?.status ?? (aiCalled ? "called" : "none"), corrections: pay.ai?.checks ?? null, checks, pass: checks.every((x) => x.ok), note: e.note ?? null });
  console.log(checks.every((x) => x.ok) ? "PASS" : "FAIL", c.id, checks.filter((x) => !x.ok).map((x) => `${x.name} [${x.detail}]`).join("; "));
}
await browser.close();
sql("DELETE FROM passages WHERE provenance = 'eval_fixture'");

const rate = (f) => { const xs = results.flatMap((r) => r.checks.filter(f)); return xs.length ? { passed: xs.filter((x) => x.ok).length, of: xs.length } : null; };
const report = {
  run: new Date().toISOString(),
  provider: "local mock (tests/mock-ai.mjs): measures the pipeline, not a real model's language quality",
  cases: results.length,
  casesPassed: results.filter((r) => r.pass).length,
  metrics: {
    correctAbstention: rate((x) => x.name.startsWith("abstained")),
    retrievalRelevance: rate((x) => x.name.startsWith("retrieval relevance")),
    citationCorrectness: rate((x) => x.name.startsWith("citation correctness")),
    quotationFidelity: rate((x) => x.name.startsWith("quotation fidelity")),
    unsupportedClaimsShownAsTextbook: rate((x) => x.name.startsWith("no textbook/derived") || x.name.startsWith("unsupported claim")),
    redTeamBlocked: (() => { const r = results.filter((x) => x.category === "red-team"); return { passed: r.filter((x) => x.pass).length, of: r.length }; })(),
    mathFidelity: rate((x) => x.name.startsWith("maths markup")),
    languageRouting: rate((x) => x.name.startsWith("language routing") || x.name.startsWith("cross-language") || x.name.startsWith("no rewrite")),
    translationFidelity: rate((x) => x.name.startsWith("translation fidelity")),
    workingCheck: rate((x) => x.name.startsWith("working check")),
    correctionsMadeByValidation: results.reduce((a, r) => { for (const [k, v] of Object.entries(r.corrections ?? {})) a[k] = (a[k] ?? 0) + v; return a; }, {}),
  },
  thresholds: data.thresholds,
  scope: `${data.cases.length} reviewed cases over the 16 checked passages plus 4 temporary fixtures (Mathematics Chapter 2, Science, Bangla). Language quality and answer completeness need a real provider and human review; not measured here.`,
  results,
};
writeFileSync(new URL("./eval-report.json", import.meta.url), JSON.stringify(report, null, 2));
const below = Object.entries(data.thresholds).filter(([k, t]) => typeof t === "number").filter(([k, t]) => { const m = report.metrics[k]; return m && m.of > 0 && m.passed / m.of < t; }).map(([k]) => k);
report.belowThreshold = below;
writeFileSync(new URL("./eval-report.json", import.meta.url), JSON.stringify(report, null, 2));
console.log(`THRESHOLDS ${below.length ? "BELOW: " + below.join(", ") : "all met"}`);
console.log(`SUMMARY ${report.casesPassed}/${report.cases}`);
process.exit(report.casesPassed === report.cases && !below.length ? 0 : 1);
