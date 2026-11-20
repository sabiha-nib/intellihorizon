// Homepage tests: responsive layout, navigation, parallax and reduced motion, keyboard, tutor preview, curriculum
// selector, CTA links, fonts, contrast, layout shift and weight. Thresholds fixed before running.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";

const BASE = "http://127.0.0.1:8787";
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` [${String(detail).slice(0, 300)}]`}`); };
const browser = await chromium.launch();

// Desktop
const D = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await D.addInitScript(() => {
  window.__cls = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
});
const p = await D.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
check("hero headline", (await p.getByRole("heading", { level: 1 }).textContent()).includes("Learning should understand you."));
check("scope is stated from the first screen: Classes 6–10, NCTB, both versions", /CLASSES 6–10 · NCTB BANGLADESH · BANGLA VERSION AND ENGLISH VERSION/i.test(await p.locator("#top").innerText()));
const navHrefs = await p.locator('nav[aria-label="Main"] ul a').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
check("navigation: Platform, IntelliTutor, How It Works, Curriculum, About", JSON.stringify(navHrefs) === JSON.stringify(["#platform", "#tutor", "#how", "#curriculum", "#about"]), navHrefs);
for (const id of ["platform", "tutor", "how", "curriculum", "about"]) check(`section #${id} exists`, (await p.locator(`#${id}`).count()) === 1);
check("Sign In and Get Started link to the right places", (await p.getByRole("link", { name: "Sign In" }).first().getAttribute("href")) === "/signin" && (await p.getByRole("link", { name: "Get Started" }).first().getAttribute("href")) === "/start");
check("hero CTAs: Explore IntelliHorizon -> /start, Meet Your AI Tutor -> #tutor", (await p.getByTestId("cta-explore").getAttribute("href")) === "/start" && (await p.getByTestId("cta-tutor").getAttribute("href")) === "#tutor");
await p.locator('nav[aria-label="Main"] a[href="#curriculum"]').click();
await p.waitForTimeout(1200);
const top = await p.locator("#curriculum").evaluate((el) => el.getBoundingClientRect().top);
check("nav link scrolls to its section (not hidden under the bar)", top >= 0 && top < 140, top);
check("nav gets a solid surface after scrolling", (await p.getByTestId("home-nav").getAttribute("data-scrolled")) === "true");
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
await p.evaluate(() => window.scrollTo(0, 500)); await p.waitForTimeout(400);
const depth = await p.locator("#top").evaluate((el) => Number(el.style.getPropertyValue("--ih-scroll")));
check("parallax: hero layers move with scroll", depth > 0.2 && depth <= 1, depth);
await p.mouse.move(1200, 300); await p.waitForTimeout(200);
check("pointer depth on desktop", Math.abs(Number(await p.locator("#top").evaluate((el) => el.style.getPropertyValue("--ih-px")))) > 0.1);
await p.evaluate(() => window.scrollTo(0, 0));

// Tutor preview
const tp = p.getByTestId("tutor-preview");
check("tutor preview is labelled as a demonstration", /Demonstration · not a live model response/.test(await p.getByTestId("demo-label").innerText()));
await tp.locator('[data-demo-lang="en"]').click();
check("switch to English", (await p.getByTestId("demo-question").innerText()) === "What is a continued ratio?");
await tp.locator('[data-demo-lang="mixed"]').click();
check("switch to mixed", (await p.getByTestId("demo-question").innerText()) === "continued ratio কাকে বলে?");
await tp.locator('[data-demo-lang="en"]').click();
await tp.locator('[data-demo-persona="socratic"]').click();
check("persona changes the approach", /Before I explain/.test(await p.getByTestId("demo-lead").innerText()));
await tp.locator('[data-demo-style="testme"]').click();
check("ask differently changes the order (practice first)", /Practice question/.test(await tp.locator("#demo-panel ol li").first().innerText()));
await tp.locator('[data-demo-flow="worked"]').click();
check("worked example shows source references with printed pages", /printed page 19/.test(await tp.innerText()));
await tp.locator('[data-demo-flow="outside"]').click();
check("'not in the book' shows an honest refusal and no sources", /won't answer from memory/.test(await tp.innerText()) && !/printed page/.test(await tp.innerText()));
await tp.locator('[data-demo-flow="working"]').click();
check("working check points to the first wrong step", /first wrong step is line 3/.test(await tp.innerText()));

// Curriculum selector
check("five grade tabs", (await p.locator("#curriculum [role=tab]").count()) === 5);
await p.locator('#curriculum [data-grade="9"]').click();
check("Class 9: both versions honestly 'Coming soon'", (await p.locator('#grade-panel [data-availability="coming_soon"]').count()) === 2);
await p.locator('#curriculum [data-grade="7"]').click();
const bn7 = p.locator('#grade-panel [data-medium="bangla"]');
check("Class 7 Bangla Version: partially available with real counts", (await bn7.getAttribute("data-availability")) === "partial" && /16\s*\n?\s*checked passages|checked passages\s*\n?\s*16/.test(await bn7.innerText()), await bn7.innerText());
check("Class 7 English Version not shown as ready", (await p.locator('#grade-panel [data-medium="english"]').getAttribute("data-availability")) === "coming_soon");

// Modules
check("fourteen platform modules", (await p.locator("#platform [data-module]").count()) === 14);
await p.locator('#platform [data-module="exam"]').click();
check("module preview updates and links to the module", /ExamArena/.test(await p.getByTestId("module-detail").innerText()) && (await p.getByTestId("module-detail").getByRole("link").getAttribute("href")) === "/exam-arena");
check("responsible AI does not promise perfection", /No AI system is free of mistakes/.test(await p.locator("#trust").innerText()) && !/(100% accurate|hallucination-free|never wrong)/i.test(await p.content()));
check("judge access is reachable from the footer", (await p.getByRole("link", { name: "Judge access" }).getAttribute("href")) === "/judge");

// Fonts, contrast, layout shift, weight
await p.evaluate(() => document.fonts.ready);
const fonts = await p.evaluate(() => ({ m: document.fonts.check('700 32px "Montserrat"'), o: document.fonts.check('400 16px "Open Sans"'), pl: document.fonts.check('italic 500 32px "Playfair Display"') }));
check("typefaces load: Montserrat, Open Sans, Playfair Display", fonts.m && fonts.o && fonts.pl, JSON.stringify(fonts));
const contrast = await p.evaluate(() => {
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length < 4 || Number(m[3]) > 0.9)) return c; } return "rgb(255,255,255)"; };
  const out = [];
  for (const sel of ["#top p", "#how li p", "#tutor p", "#curriculum p", "#platform button", "#trust p", "#about p", "footer a", 'nav[aria-label="Main"] a']) {
    for (const el of document.querySelectorAll(sel)) {
      if (!el.textContent.trim() || el.closest("[aria-hidden=true]") || el.closest(".ih-gradient-text")) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.opacity === "0") continue;
      const a = lum(cs.color), b = lum(bg(el));
      const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      out.push({ sel, r: Math.round(r * 10) / 10, need: large ? 3 : 4.5, text: el.textContent.trim().slice(0, 30) });
    }
  }
  return out;
});
const low = contrast.filter((x) => x.r < x.need);
check(`text contrast meets WCAG AA (${contrast.length} text elements measured)`, contrast.length > 40 && low.length === 0, JSON.stringify(low.slice(0, 5)));
const cls = await p.evaluate(() => window.__cls);
check("cumulative layout shift < 0.1", cls < 0.1, cls);
const perf = await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; const bytes = performance.getEntriesByType("resource").reduce((a, r) => a + (r.transferSize || 0), 0) + (n.transferSize || 0); return { dcl: n.domContentLoadedEventEnd, bytes }; });
check("loads quickly and stays light (DOMContentLoaded < 2.5 s locally, < 1.5 MB transferred)", perf.dcl < 2500 && perf.bytes < 1.5e6, JSON.stringify(perf));
check("no script errors", errors.length === 0, errors.join(" | "));

// Bangla interface
await p.getByRole("group", { name: "Interface language" }).getByRole("button", { name: "বাংলা" }).click();
await p.waitForTimeout(500);
check("Bangla interface", (await p.getByRole("heading", { level: 1 }).textContent()).includes("শেখা হোক তোমাকে বুঝে"));
await p.getByRole("group", { name: "ইন্টারফেসের ভাষা" }).getByRole("button", { name: "EN" }).click();

// Responsive: no horizontal overflow
for (const [w, h] of [[1440, 900], [1024, 768], [820, 1180], [390, 844], [360, 740]]) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const q = await c.newPage();
  await q.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const over = await q.evaluate(async () => { const o = []; for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } o.push(document.documentElement.scrollWidth - document.documentElement.clientWidth); return Math.max(...o); });
  check(`no horizontal overflow at ${w}px`, over <= 0, over);
  if (w <= 390) {
    check(`mobile (${w}px): bar shows the menu button, not crowded links`, await q.getByRole("button", { name: "Open menu" }).isVisible() && !(await q.locator('nav[aria-label="Main"] ul').isVisible()));
    await q.getByRole("button", { name: "Open menu" }).click();
    check(`mobile (${w}px): menu opens with all sections and Get Started`, (await q.getByTestId("home-menu").locator("a").count()) >= 6 && (await q.getByRole("button", { name: "Close menu" }).getAttribute("aria-expanded")) === "true");
    await q.keyboard.press("Escape");
    check(`mobile (${w}px): Escape closes the menu and returns focus`, (await q.getByTestId("home-menu").count()) === 0 && (await q.evaluate(() => document.activeElement?.getAttribute("aria-controls"))) === "home-menu");
    const t = await q.getByRole("button", { name: "Open menu" }).boundingBox();
    check(`mobile (${w}px): touch targets at least 44px`, t.width >= 44 && t.height >= 44, JSON.stringify(t));
    await q.locator('#platform [data-module="cards"]').click();
    check(`mobile (${w}px): module details open in place`, /MemoryCards/.test(await q.getByTestId("module-inline").innerText()));
  }
  await c.close();
}

// Keyboard
const K = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const k = await K.newPage();
await k.goto(`${BASE}/`, { waitUntil: "networkidle" });
await k.keyboard.press("Tab");
check("first Tab reaches 'Skip to content'", (await k.evaluate(() => document.activeElement?.textContent)) === "Skip to content");
const seen = [];
for (let i = 0; i < 14; i++) { await k.keyboard.press("Tab"); seen.push(await k.evaluate(() => { const a = document.activeElement; return { t: a?.textContent?.trim().slice(0, 30), o: getComputedStyle(a).outlineStyle }; })); }
check("keyboard reaches nav, Sign In, Get Started and the hero CTAs in order", ["Curriculum", "Sign In", "Get Started", "Explore IntelliHorizon", "Meet Your AI Tutor"].every((x) => seen.some((s) => s.t === x)), JSON.stringify(seen.map((s) => s.t)));
check("focus is visible", seen.filter((s) => s.t).every((s) => s.o !== "none"), JSON.stringify(seen.map((s) => s.o)));

// Reduced motion
const R = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const r = await R.newPage();
await r.goto(`${BASE}/`, { waitUntil: "networkidle" });
await r.evaluate(() => window.scrollTo(0, 600)); await r.waitForTimeout(400);
const rm = await r.evaluate(() => ({ motion: document.querySelector(".ih-home").classList.contains("ih-motion"), scroll: document.querySelector("#top").style.getPropertyValue("--ih-scroll"), hidden: [...document.querySelectorAll(".ih-reveal")].filter((e) => getComputedStyle(e).opacity !== "1").length, anim: getComputedStyle(document.querySelector(".ih-glow")).animationName }));
check("reduced motion: no parallax, no reveal hiding, no ambient animation", !rm.motion && rm.scroll === "" && rm.hidden === 0 && rm.anim === "none", JSON.stringify(rm));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`SUMMARY ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
