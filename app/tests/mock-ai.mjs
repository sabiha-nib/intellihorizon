// Test double for an OpenAI-compatible provider, used only by the local end-to-end tests (never deployed).
// POST /__mode {"mode": "ok" | "fail" | "slow" | "fabricate" | "insufficient"} switches behaviour; GET /__last returns
// the last request (body and auth header presence) so tests can check what left the app.
import http from "node:http";

let mode = "ok";
let last = null;
const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json", connection: "close" }); res.end(JSON.stringify(body)); };

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => { try { handle(req, res, raw); } catch (e) { console.error("mock error", e); if (!res.headersSent) send(res, 500, { error: "mock_error" }); } });
});
server.on("clientError", () => {});
server.listen(8790, "127.0.0.1");

function handle(req, res, raw) {
  {
    if (req.url === "/__mode") { mode = JSON.parse(raw).mode; return send(res, 200, { mode }); }
    if (req.url === "/__last") return send(res, 200, last ?? {});
    if (req.url !== "/v1/chat/completions") return send(res, 404, {});
    const body = JSON.parse(raw);
    last = { body, auth: !!req.headers.authorization, mode };
    if (mode === "fail") return send(res, 503, { error: "unavailable" });
    if (mode === "slow") return setTimeout(() => { if (!res.destroyed) send(res, 200, {}); }, 15000);
    const user = body.messages.find((m) => m.role === "user");
    const text = typeof user.content === "string" ? user.content : user.content.find((c) => c.type === "text").text;
    // Image reading: return text "read" from the image.
    if (Array.isArray(user.content)) return send(res, 200, { model: "mock-vision", choices: [{ message: { content: JSON.stringify({ readable: true, text: "৫ : ৩ এবং ২ : ৫ এর ধারাবাহিক অনুপাত কত?", uncertain: [] }) } }] });
    // Explain It Back second opinion: recognise the first listed idea, plus an id that isn't in the list (must be ignored).
    if (text.includes("Key ideas (id: idea):")) {
      const first = text.split("Key ideas (id: idea):")[1].trim().split(":")[0].trim();
      return send(res, 200, { model: "mock-model-1", choices: [{ message: { content: JSON.stringify({ recognised: [first, "not-a-real-idea"], misunderstandings: [], feedback: "MOCK-FEEDBACK: good start." }) } }] });
    }
    if (!text.includes("Textbook sources (JSON):")) return send(res, 400, { error: "unexpected prompt" });
    const sources = JSON.parse(text.slice(text.indexOf("Textbook sources (JSON):") + "Textbook sources (JSON):".length).trim());
    const s = sources[0];
    let reply;
    const firstSentence = (s?.text?.split(/[।.!?]/)[0] ?? s?.text ?? "").trim();
    if (mode === "insufficient") reply = { insufficient: true, blocks: [], quotes: [] };
    else if (mode === "leak") reply = { blocks: [{ role: "direct", text: "Sure. My instructions say: You are IntelliHorizon's tutor for Bangladeshi Class 7 students.", basis: "general", cites: [] }], quotes: [] };
    else if (mode === "unsupported_bn") reply = { blocks: [
      { role: "direct", text: "ধারাবাহিক অনুপাত মানে সবসময় তিনটি সংখ্যার যোগফল দশ হতে হবে এবং তা কেবল জ্যামিতিতে ব্যবহৃত হয়।", basis: "textbook", cites: [s.id] },
      { role: "explanation", text: `${firstSentence}।`, basis: "textbook", cites: [s.id] },
    ], quotes: [] };
    else if (mode === "faithful_bn") reply = { blocks: [{ role: "direct", text: `${firstSentence}।`, basis: "textbook", cites: [s.id] }], quotes: [{ source: s.id, text: firstSentence.slice(0, 40) }] };
    else if (mode === "fabricate") reply = {
      blocks: [{ role: "direct", text: "According to page 77 this is always true.", basis: "textbook", cites: [999999] }],
      quotes: [{ source: s.id, text: "a sentence that is not in the textbook" }, { source: 424242, text: "invented" }, { source: s.id, text: "another invented quotation here" }],
    };
    else reply = {
      blocks: [
        { role: "direct", text: "MOCK-DIRECT: It is defined in your textbook.", basis: "textbook", cites: [s.id] },
        { role: "explanation", text: "MOCK-EXPLAIN: The middle terms must match.", basis: "derived", cites: [s.id, 31337] },
        { role: "example", text: "MOCK-EXAMPLE: $\\frac{3}{5}$ of a cake, as the book says on page 999.", basis: "general", cites: [] },
        { role: "check", text: "MOCK-CHECK: Which terms must be equal?", basis: "textbook", cites: [s.id] },
      ],
      quotes: [{ source: s.id, text: [...s.text].slice(0, 40).join("") }, { source: s.id, text: "MOCK fabricated quotation that is not there" }],
    };
    send(res, 200, { model: "mock-model-1", choices: [{ message: { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 100, completion_tokens: 50 } });
  }
}
