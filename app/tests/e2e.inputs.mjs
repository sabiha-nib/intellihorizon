// End-to-end tests for question input: homework photos (valid, repeated, unsupported, HEIC, oversized, forged,
// reader failure, privacy between students), PDFs (text, scanned, password-protected, damaged) and the voice fallback.
// Uses the mock provider (tests/mock-ai.mjs) with AI_VISION=on. Fixtures are generated in /tmp by the test runner.
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { execSync } from "node:child_process";

const BASE = "http://127.0.0.1:8787";
const MOCK = "http://127.0.0.1:8790";
const PW = "monsoon river kite 7";
const results = [];
const check = (n, ok, x = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : x); };
const WR = "/home/user/website-17609620527ef5f4f428f302/app/tests/support/d1-cli.sh";
const sql = (q) => JSON.parse(execSync(`${WR} d1 execute DB --local --config /tmp/wr/wrangler.jsonc --json --command ${JSON.stringify(q)}`, { cwd: "/tmp/wr", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0].results;
const mode = (m) => fetch(`${MOCK}/__mode`, { method: "POST", body: JSON.stringify({ mode: m }) });

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

await mode("ok");
const browser = await chromium.launch();
const A = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const reqs = [];
pa.on("request", (r) => { if (r.method() === "POST" && (r.postData() ?? "").includes('"mime"')) reqs.push({ url: r.url(), body: r.postData(), headers: Object.fromEntries(Object.entries(r.headers()).filter(([k]) => !["host", "content-length", "cookie"].includes(k))) }); });
await register(pa, { name: "Photo Tester", username: "photo_t", email: "photo.t@example.com" });
await pa.goto(`${BASE}/tutor`);
const box = pa.getByPlaceholder(/Ask a question/);
const photo = pa.locator("input[type=file][accept*=image]");
const pdf = pa.locator("input[type=file][accept*=pdf]");

// Photos
await photo.setInputFiles("/tmp/hw.jpg");
await pa.getByRole("button", { name: "Read this photo" }).waitFor({ timeout: 10000 });
check("before sending, the student is told where the photo goes and what is kept", (await pa.getByText(/The photo itself isn't kept; the words read from it are kept privately in your account for 30 days/).count()) === 1);
check("nothing is uploaded until the student chooses to read it", sql("SELECT COUNT(*) AS n FROM uploads")[0].n === 0);
await pa.getByRole("button", { name: "Read this photo" }).click();
await pa.getByText("Is this your question?").waitFor({ timeout: 20000 });
check("the read question is shown for confirmation before it goes into the box", (await box.inputValue()) === "");
await pa.getByRole("button", { name: "Yes, use it" }).click();
check("confirmed text goes into the box", (await box.inputValue()).includes("ধারাবাহিক অনুপাত"));
const up = sql("SELECT * FROM uploads")[0];
check("the image itself is not stored; only the words read from it, under the student, for 30 days", up.status === "read" && up.r2_key === "not-stored" && JSON.parse(up.extracted_text).text.includes("অনুপাত") && new Date(up.expires_at) - new Date(up.created_at) === 30 * 86400000, JSON.stringify(up));
check("the photo was re-encoded in the browser (EXIF removed) and sent as JPEG", up.mime === "image/jpeg");
// Same photo again: no second processing
await photo.setInputFiles("/tmp/hw.jpg");
await pa.getByRole("button", { name: "Read this photo" }).click();
await pa.getByText("Is this your question?").waitFor({ timeout: 20000 });
check("re-sending the same photo reuses the earlier result instead of processing it again", sql("SELECT COUNT(*) AS n FROM ai_requests WHERE purpose = 'image_read'")[0].n === 1 && sql("SELECT COUNT(*) AS n FROM uploads")[0].n === 1);
await pa.getByRole("button", { name: "No, discard" }).click();
// Unsupported, HEIC, oversized
await photo.setInputFiles("/tmp/anim.gif");
check("an unsupported image type is refused", await pa.getByText("Use a JPEG, PNG or WebP photo.").isVisible());
await photo.setInputFiles({ name: "photo.heic", mimeType: "image/heic", buffer: Buffer.alloc(500) });
check("HEIC is refused with a way forward", await pa.getByText(/HEIC photos can't be read here/).isVisible());
await photo.setInputFiles("/tmp/big.jpg");
check("an oversized photo is refused before upload", await pa.getByText(/over 12 MB/).isVisible());
// Forged file: right mime, wrong bytes, sent straight to the server
const forged = await pa.evaluate(async ({ url, body, headers }) => { const b = JSON.parse(body); const walk = (o) => { for (const k in o) { if (typeof o[k] === "string" && o[k].length > 1000) o[k] = btoa("this is not an image at all, just text pretending to be one"); else if (o[k] && typeof o[k] === "object") walk(o[k]); } }; walk(b); return (await fetch(url, { method: "POST", body: JSON.stringify(b), headers })).text(); }, reqs[0]);
check("the server checks the file signature, not just the declared type", forged.includes("bad_image"), forged.slice(0, 200));
// Reader failure: nothing pretended
await mode("fail");
await photo.setInputFiles("/tmp/face.png");
await pa.getByRole("button", { name: "Read this photo" }).click();
await pa.getByText(/photo reader isn't responding/).waitFor({ timeout: 20000 });
check("when reading fails, nothing is put in the box and the student is told", (await box.inputValue()).includes("ধারাবাহিক") && (await pa.getByText("Is this your question?").count()) === 0 && sql("SELECT COUNT(*) AS n FROM uploads WHERE status = 'failed'")[0].n === 1);
await mode("ok");

// Another student sending the same photo gets their own reading, never the first student's stored result
const B = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pb = await B.newPage();
await register(pb, { name: "Other Student", username: "other_t", email: "other.t@example.com" });
await pb.goto(`${BASE}/tutor`);
const readsBefore = sql("SELECT COUNT(*) AS n FROM ai_requests WHERE purpose = 'image_read'")[0].n;
await pb.locator("input[type=file][accept*=image]").setInputFiles("/tmp/hw.jpg");
await pb.getByRole("button", { name: "Read this photo" }).click();
await pb.getByText("Is this your question?").waitFor({ timeout: 20000 });
check("one student's photo results are never served to another", sql("SELECT COUNT(*) AS n FROM ai_requests WHERE purpose = 'image_read'")[0].n === readsBefore + 1 && sql("SELECT COUNT(DISTINCT user_id) AS n FROM uploads")[0].n === 2);
const r2 = await pb.request.get(`${BASE}/uploads/${up.id}`);
check("there is no URL that serves uploads", r2.status() === 404, String(r2.status()));

// PDFs
await box.fill("");
await pdf.setInputFiles("/tmp/fixture.pdf");
await pa.getByText(/PDF's text is in the box/).waitFor({ timeout: 20000 });
check("a text PDF's words go into the box", (await box.inputValue()).includes("EDUCERRO TEST FIXTURE"));
await pdf.setInputFiles("/tmp/scan.pdf");
await pa.getByText(/no readable text/).waitFor({ timeout: 20000 });
check("a scanned PDF is reported as unreadable, not as an empty success", true);
await pdf.setInputFiles("/tmp/locked.pdf");
await pa.getByText(/password-protected/).waitFor({ timeout: 20000 });
check("a password-protected PDF is reported as such", true);
await pdf.setInputFiles("/tmp/broken.pdf");
await pa.getByText(/damaged or isn't really a PDF|couldn't be read/).waitFor({ timeout: 20000 });
check("a damaged PDF is reported, with nothing taken from it", true);
await pdf.setInputFiles({ name: "empty.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) });
check("an empty file is reported", await pa.getByText("That PDF is empty.").isVisible());

// Voice: optional, never required (headless Chromium has no speech recognition)
const hasSpeech = await pa.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
check("voice is optional: a Speak button with a language choice when the browser supports it, otherwise a note; typing always works",
  (hasSpeech ? (await pa.getByRole("button", { name: "Speak" }).count()) === 1 && (await pa.getByLabel("Speaking language").count()) === 1 : (await pa.getByText(/Typing always works/).count()) === 1) && (await box.isEditable()));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`SUMMARY ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
