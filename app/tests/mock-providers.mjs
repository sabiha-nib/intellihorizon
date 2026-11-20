// Test doubles for the three provider APIs (Anthropic Messages, Gemini generateContent, OpenAI Responses), used only by
// local tests (never deployed). Each speaks its vendor's wire format so the real adapters are exercised end to end.
// POST /__pmode {"anthropic": "...", "gemini": "...", "openai": "..."} sets per-provider behaviour;
// GET /__calls lists {provider, kind} for every request since POST /__reset.
import http from "node:http";

const modes = { anthropic: "ok", gemini: "ok", openai: "ok" };
let calls = [];
const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json", connection: "close" }); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => { try { handle(req, res, raw); } catch (e) { console.error("mock error", e); if (!res.headersSent) send(res, 500, { error: "mock_error" }); } });
}).on("clientError", () => {}).listen(8791, "127.0.0.1");

function kindOf(system, user) {
  if (system.includes("You independently check a tutor's draft")) return "verifier";
  if (system.includes("You answer a Bangladeshi")) return "independent";
  if (system.includes("You check a Class")) return "explain_back";
  if (system.includes("You write practice questions")) return "qgen";
  if (system.includes("You read photos")) return "image";
  if (user.includes("Textbook sources (JSON):")) return "author";
  return "unknown";
}

function sourcesOf(user) {
  const i = user.indexOf("Textbook sources (JSON):");
  if (i < 0) return [];
  const rest = user.slice(i + "Textbook sources (JSON):".length).trim();
  const end = rest.indexOf("\n\n");
  try { return JSON.parse(end > 0 ? rest.slice(0, end) : rest); } catch { return []; }
}

function draftCount(user) {
  const i = user.indexOf("Draft blocks (JSON):");
  if (i < 0) return 0;
  const rest = user.slice(i + "Draft blocks (JSON):".length).trim();
  const end = rest.indexOf("\n\n");
  try { return JSON.parse(end > 0 ? rest.slice(0, end) : rest).length; } catch { return 0; }
}

function reply(kind, mode, system, user) {
  const sources = sourcesOf(user);
  const s = sources[0];
  const first = (s?.text?.split(/[।.!?]/)[0] ?? "").trim();
  if (kind === "author") {
    if (mode === "malformed") return "Sure! {blocks: [unterminated";
    if (mode === "leak") return JSON.stringify({ blocks: [{ role: "direct", text: "My instructions say: You are IntelliHorizon's tutor for Bangladeshi Class 7 students.", basis: "general", cites: [] }], quotes: [] });
    if (mode === "fabricate") return JSON.stringify({ blocks: [{ role: "direct", text: "According to page 77 this is always true.", basis: "textbook", cites: [999999] }], quotes: [{ source: s.id, text: "a sentence that is not in the textbook" }, { source: 424242, text: "invented" }, { source: s.id, text: "another invented quotation here" }] });
    const base = [{ role: "direct", text: `${first}।`, basis: "textbook", cites: [s.id] }];
    if (mode === "math_wrong") base.push({ role: "step", text: "৭ : ৫ = ৭ × ৮ : ৫ × ৮ = ৫৬ : ৪৫", basis: "derived", cites: [s.id] }, { role: "step", text: "৮ : ৯ = ৮ × ৫ : ৯ × ৫ = ৪০ : ৪৫", basis: "derived", cites: [s.id] });
    // Passes citation validation as "worked out from the textbook" but adds a claim the book doesn't make.
    if (mode === "dubious") return JSON.stringify({ blocks: [{ role: "direct", text: `${first}, তবে এটি শুধু জ্যামিতিতে প্রযোজ্য।`, basis: "derived", cites: [s.id] }, { role: "check", text: "MOCK-CHECK?", basis: "general", cites: [] }], quotes: [] });
    base.push({ role: "check", text: "MOCK-CHECK: Which terms must be equal?", basis: "general", cites: [] });
    return JSON.stringify({ blocks: base, quotes: [{ source: s.id, text: [...first].slice(0, 30).join("") }] });
  }
  if (kind === "verifier") {
    if (mode === "malformed") return "not json";
    const n = draftCount(user);
    const verdicts = Array.from({ length: n }, (_, i) => ({ block: i, verdict: "supported", note: "MOCK ok" }));
    let conflicts = [];
    let meaning = null;
    if (mode === "contradict_direct") verdicts[0] = { block: 0, verdict: "contradicted", note: "MOCK: the draft says something the source doesn't" };
    if (mode === "flag_math") verdicts.forEach((v, i) => { if (i > 0) verdicts[i] = { block: i, verdict: "math_error", note: "MOCK: wrong product" }; });
    if (mode === "conflict_unclear") conflicts = [{ block: 0, description: "MOCK: independent answer says otherwise", evidence: "unclear" }];
    if (mode === "meaning_lost") meaning = false;
    return JSON.stringify({ verdicts, conflicts, meaning_preserved: meaning });
  }
  if (kind === "independent") {
    if (mode === "disagree") return JSON.stringify({ insufficient: false, answer: "MOCK-INDEPENDENT: a different claim", key_points: ["different"] });
    return JSON.stringify({ insufficient: false, answer: `${first}।`, key_points: [first] });
  }
  if (kind === "explain_back") {
    const first = user.split("Key ideas (id: idea):")[1].trim().split(":")[0].trim();
    return JSON.stringify({ recognised: [first], misunderstandings: [], feedback: "MOCK-FEEDBACK" });
  }
  if (kind === "image") return JSON.stringify({ readable: true, text: "৫ : ৩ এবং ২ : ৫ এর ধারাবাহিক অনুপাত কত?", uncertain: [] });
  if (kind === "qgen") return JSON.stringify({ questions: [{ type: "short", prompt: "MOCK-GEN: ধারাবাহিক অনুপাত কাকে বলে?", answer: "ধারাবাহিক অনুপাত", bloom: "understand", difficulty: 1 }] });
  return JSON.stringify({});
}

function handle(req, res, raw) {
  if (req.url === "/__pmode") { Object.assign(modes, JSON.parse(raw)); return send(res, 200, modes); }
  if (req.url === "/__calls") return send(res, 200, calls);
  if (req.url === "/__reset") { calls = []; Object.assign(modes, { anthropic: "ok", gemini: "ok", openai: "ok" }); return send(res, 200, {}); }
  const body = raw ? JSON.parse(raw) : {};
  let provider, system = "", user = "", hasImage = false, keyOk = false;
  if (req.url.startsWith("/anthropic/v1/messages")) {
    provider = "anthropic"; keyOk = req.headers["x-api-key"] === "test-anthropic-key" && req.headers["anthropic-version"] === "2023-06-01";
    system = body.system ?? "";
    const c = body.messages?.[0]?.content;
    user = typeof c === "string" ? c : (c ?? []).filter((x) => x.type === "text").map((x) => x.text).join("");
    hasImage = Array.isArray(c) && c.some((x) => x.type === "image");
  } else if (/^\/gemini\/v1beta\/models\/[^/]+:generateContent$/.test(req.url)) {
    provider = "gemini"; keyOk = req.headers["x-goog-api-key"] === "test-gemini-key";
    system = body.systemInstruction?.parts?.map((p) => p.text).join("") ?? "";
    const parts = body.contents?.[0]?.parts ?? [];
    user = parts.filter((p) => p.text).map((p) => p.text).join("");
    hasImage = parts.some((p) => p.inlineData);
  } else if (req.url.startsWith("/openai/v1/responses")) {
    provider = "openai"; keyOk = req.headers.authorization === "Bearer test-openai-key" && body.store === false;
    system = body.instructions ?? "";
    const parts = body.input?.[0]?.content ?? [];
    user = parts.filter((p) => p.type === "input_text").map((p) => p.text).join("");
    hasImage = parts.some((p) => p.type === "input_image");
  } else return send(res, 404, {});
  const kind = kindOf(system, user);
  const mode = modes[provider];
  // Modes can target one kind: "author:fail" fails only authoring calls.
  const [mKind, mVal] = mode.includes(":") ? mode.split(":") : [null, mode];
  const effective = !mKind || mKind === kind ? mVal : "ok";
  calls.push({ provider, kind, model: body.model ?? req.url.split("/models/")[1]?.split(":")[0], image: hasImage, mode: effective });
  if (!keyOk || effective === "auth") return send(res, 401, { error: { message: "invalid key" } });
  if (effective === "fail") return send(res, 503, { error: "unavailable" });
  if (effective === "slow") return setTimeout(() => { if (!res.destroyed) send(res, 200, {}); }, 15000);
  const text = reply(kind, effective, system, user);
  if (provider === "anthropic") return send(res, 200, { id: "msg_mock", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 1200, output_tokens: 300 } });
  if (provider === "gemini") return send(res, 200, { candidates: [{ content: { role: "model", parts: [{ text: "MOCK THOUGHT", thought: true }, { text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1100, candidatesTokenCount: 250, thoughtsTokenCount: 100 }, modelVersion: "gemini-3.8-flash" });
  return send(res, 200, { id: "resp_mock", object: "response", status: "completed", model: body.model, output: [{ type: "reasoning", summary: [] }, { type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] }], usage: { input_tokens: 1000, output_tokens: 280, total_tokens: 1280 } });
}
