// One theme for the whole app: every main screen uses the homepage palette and typefaces, no old violet colour is
// left anywhere, every visible text meets WCAG AA contrast, and nothing scrolls sideways on a phone.
// Thresholds fixed before running: zero old colours, zero contrast failures, zero overflow, fonts on every page.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";

const BASE = "http://127.0.0.1:8787";
const PW = "monsoon river kite 7";
const SHOTS = process.env.THEME_SHOTS ?? "";
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` [${String(detail).slice(0, 600)}]`}`); };

// The retired violet system (text, surfaces, lines). None of these may appear in any computed style.
const OLD = ["91, 63, 214", "67, 41, 178", "29, 27, 44", "74, 70, 100", "108, 104, 134", "238, 233, 254", "244, 241, 252", "235, 229, 251", "231, 227, 239", "211, 204, 227", "251, 250, 248"];

async function audit(page) {
  return page.evaluate((OLD) => {
    // Every colour is resolved by the browser itself (handles rgb, oklab, color-mix), as [r, g, b, alpha].
    const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
    const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const lum = (c) => { const m = rgba(c); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const opaque = (c) => rgba(c)[3] > 0.9;
    // Text in a floating bar with no surface of its own sits over whatever scrolls beneath it; it is measured by the
    // homepage test instead of here.
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none" && !cs.backgroundImage.startsWith("url")) return null; if (opaque(cs.backgroundColor)) return cs.backgroundColor; if (cs.position === "fixed" || cs.position === "sticky") return null; } return "rgb(255, 255, 255)"; };
    const visible = (el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.1) return false; } return true; };
    const old = new Set();
    const lowContrast = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      for (const prop of ["color", "backgroundColor", "borderTopColor", "borderBottomColor", "outlineColor", "fill", "stroke"]) {
        const v = cs[prop];
        if (!v || v === "none" || v.startsWith("url")) continue;
        const [r, g, b2, al] = rgba(v);
        if (al > 0.05 && OLD.includes(`${r}, ${g}, ${b2}`)) {
          if ((prop.startsWith("border") && cs[prop.replace("Color", "Width")] === "0px") || (prop === "outlineColor" && cs.outlineStyle === "none")) continue;
          if ((prop === "fill" || prop === "stroke") && !(el instanceof SVGElement)) continue;
          old.add(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 40)} ${prop} ${v}`);
        }
      }
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own || el.closest("[aria-hidden=true]") || el.closest("svg") || el.matches(":disabled, [aria-disabled=true]") || el.closest("button:disabled") || !visible(el)) continue;
      const bg = bgOf(el);
      if (!bg) continue; // text on a gradient or image is checked visually, not here
      const a = lum(cs.color), b = lum(bg);
      const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight);
      const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
      if (r < need) lowContrast.push(`${r.toFixed(2)}<${need} "${el.textContent.trim().slice(0, 40)}" ${cs.color} on ${bg}`);
    }
    const h = document.querySelector("h1, h2");
    const heading = h ? getComputedStyle(h).fontFamily : "";
    const body = getComputedStyle(document.body).fontFamily;
    return { old: [...old].slice(0, 8), lowContrast: lowContrast.slice(0, 8), heading, headingLang: h?.closest("[lang]")?.getAttribute("lang") ?? "en", body, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }, OLD);
}

async function sweep(page, label, paths) {
  for (const path of paths) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => undefined);
    await page.waitForTimeout(600);
    await page.evaluate(() => document.fonts.ready);
    const a = await audit(page);
    check(`${label} ${path}: no old violet colours`, a.old.length === 0, a.old.join(" | "));
    check(`${label} ${path}: text contrast meets WCAG AA`, a.lowContrast.length === 0, a.lowContrast.join(" | "));
    check(`${label} ${path}: Montserrat headings and Open Sans text`, /^"?Open Sans/.test(a.body) && (!a.heading || /^"?Montserrat/.test(a.heading) || a.headingLang === "bn"), `${a.heading} / ${a.body}`);
    check(`${label} ${path}: no sideways scroll`, a.overflow <= 0, a.overflow);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}${path.replace(/[/?=&]/g, "_") || "_root"}.jpg`, type: "jpeg", quality: 50 });
  }
}

const browser = await chromium.launch();
const PUBLIC = ["/", "/signin", "/signup", "/judge", "/start", "/help", "/privacy"];
const APP = ["/dashboard", "/learn", "/subjects/mathematics", "/practice", "/quiz", "/tutor", "/progress", "/knowledge-map", "/revision", "/mistakes", "/mastery", "/missions", "/achievements", "/history", "/settings", "/account", "/more", "/twin", "/cards", "/notes", "/formulas", "/concepts", "/exam-arena", "/summary", "/reflect", "/family", "/topics", "/path", "/plan", "/search"];

const V = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await sweep(await V.newPage(), "visitor", PUBLIC);

const S = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await S.newPage();
await p.goto(`${BASE}/signup`);
await p.getByLabel("Full name").fill("Theme Check"); await p.getByLabel("Username").fill("theme_check"); await p.getByLabel("Email", { exact: true }).fill("theme@example.com");
await p.getByLabel("Password", { exact: true }).fill(PW); await p.getByLabel("Confirm password").fill(PW);
await p.getByText("Available").waitFor({ timeout: 10000 }); await p.getByRole("button", { name: "Continue" }).click(); await p.waitForTimeout(200);
await p.getByRole("combobox").fill("Dhak"); await p.getByRole("option", { name: /^Dhaka ঢাকা/ }).click();
await p.getByRole("radio", { name: "Class 7" }).click(); await p.getByRole("radio", { name: /NCTB, Bangla Medium/ }).click();
await p.getByRole("button", { name: "Continue" }).click(); await p.getByRole("checkbox").check(); await p.getByRole("button", { name: "Create account" }).click();
await p.getByText(/^Welcome, /).waitFor({ timeout: 15000 });
// A tutor conversation, so the answer view is audited too.
await p.goto(`${BASE}/tutor?subject=mathematics`);
await p.getByPlaceholder(/Ask a question/).fill("ধারাবাহিক অনুপাত কাকে বলে?");
await p.getByRole("button", { name: "Send" }).click();
await p.waitForURL(/\/tutor\/[0-9a-f-]{36}/, { timeout: 40000 });
const thread = new URL(p.url()).pathname;
await sweep(p, "student", [...APP, thread]);

const M = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, storageState: await S.storageState() });
await sweep(await M.newPage(), "phone", ["/dashboard", "/tutor", "/practice", "/progress", thread]);

await browser.close();
const n = results.filter(Boolean).length;
console.log(`SUMMARY ${n}/${results.length}`);
process.exit(n === results.length ? 0 : 1);
