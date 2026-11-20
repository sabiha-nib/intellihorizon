// Production smoke test, run by the deploy workflow after every deploy (and by hand: node scripts/smoke.mjs <url>).
// Checks what a judge or visitor needs, from a clean client with no cookies: public pages, deep links, assets, the
// API and the database, and that nothing secret is served. Exits non-zero on the first failure.
const base = (process.argv[2] || process.env.PRODUCTION_URL || "").replace(/\/+$/, "");
if (!/^https:\/\//.test(base)) { console.error("usage: node scripts/smoke.mjs https://<production-url>"); process.exit(2); }
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` [${detail}]`}`); if (!ok) failed++; };
const get = async (path, opts = {}) => {
  for (let i = 0; i < 4; i++) {
    try { return await fetch(base + path, { redirect: "manual", ...opts }); } catch (e) { if (i === 3) throw e; await new Promise((r) => setTimeout(r, 3000)); }
  }
};

const home = await get("/");
const html = await home.text();
check("homepage answers 200 over HTTPS", home.status === 200, home.status);
check("homepage is the redesigned IntelliHorizon page", html.includes("Learning should understand you") && html.includes("Classes 6–10"), "hero text missing");
check("no hosting login wall", !/"error":"unauthenticated"/.test(html));
for (const p of ["/judge", "/signin", "/signup", "/start", "/help", "/privacy"]) {
  const r = await get(p);
  check(`${p} loads`, r.status === 200, r.status);
}
const deep = await get("/dashboard");
check("deep link to a signed-in page redirects to sign-in instead of failing", [200, 302, 303, 307].includes(deep.status), deep.status);
const health = await get("/api/health");
const h = await health.json().catch(() => ({}));
check("API reaches the database", health.status === 200 && h.db === true, JSON.stringify(h));
check("all migrations applied", typeof h.migrations === "number" && h.migrations >= 6, h.migrations);
console.log(`INFO storage bound: ${h.storage}; AI providers: ${JSON.stringify(h.providers)}`);
const sw = await get("/sw.js");
check("service worker is served and versioned per build", sw.status === 200 && /ih-[0-9a-f]{12}/.test(await sw.text()));
const asset = html.match(/\/assets\/[^"']+\.js/)?.[0];
if (asset) {
  const a = await get(asset);
  const js = await a.text();
  check("a hashed script asset loads", a.status === 200 && js.length > 100, a.status);
  check("no API key pattern in the served script", !/sk-ant-[A-Za-z0-9_-]{20}|AIza[0-9A-Za-z_-]{30}|sk-proj-/.test(js));
} else check("homepage references hashed assets", false, "none found");
console.log(failed ? `SMOKE FAILED: ${failed}` : "SMOKE PASSED");
process.exit(failed ? 1 : 0);
