// Homework photos. The browser re-encodes the photo (fixing orientation and stripping EXIF/GPS) before sending it.
// The server checks type, size and file signature and reads it only when the owner has turned photo reading on
// (AI_VISION=on with a vision-capable model). The image itself is never stored: it is passed to the reader in memory
// and dropped. Only its fingerprint, the outcome and the words read from it are kept, under the student's id, for
// 30 days (so the same photo isn't processed twice). The words are returned for the student to confirm.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sha256Hex } from "../auth/crypto.server";
import { currentUser, rateLimit, sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { aiConfig, complete } from "../ai/provider";
import { parseJsonObject } from "../ai/grounding";

type Fail = { ok: false; code: string };
const fail = (code: string): Fail => ({ ok: false, code });
const MAX_BYTES = 3 * 1024 * 1024;
const RETENTION_DAYS = 30;

function sniff(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
const b64ToBytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytesToB64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

/** Clears the words read from photos once they are 30 days old. */
async function purgeExpired() {
  const { DB } = bindings();
  if (!DB) return;
  await DB.prepare("UPDATE uploads SET status = 'deleted', extracted_text = NULL WHERE expires_at < ? AND status != 'deleted'").bind(new Date().toISOString()).run();
}

export const photoReadingStatus = createServerFn({ method: "GET" }).handler(async () => {
  const cfg = aiConfig(bindings() as unknown as Record<string, string | undefined>);
  return { enabled: !!cfg?.vision };
});

export const readPhoto = createServerFn({ method: "POST" })
  .inputValidator(z.object({ mime: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().max(Math.ceil((MAX_BYTES * 4) / 3) + 8) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB || !sameOrigin()) return fail("unavailable_now");
    const me = await currentUser();
    if (!me) return fail("signed_out");
    const cfg = aiConfig(bindings() as unknown as Record<string, string | undefined>);
    // Without a configured reader nothing is processed or recorded.
    if (!cfg?.vision) return fail("photo_reading_off");
    if (!(await rateLimit(`photo:${me.id}`, 15, 3600))) return fail("rate_limited");
    let bytes: Uint8Array;
    try { bytes = b64ToBytes(data.data); } catch { return fail("bad_image"); }
    if (bytes.length > MAX_BYTES) return fail("too_large");
    const kind = sniff(bytes);
    if (!kind || kind !== data.mime) return fail("bad_image");
    await purgeExpired();
    const hash = await sha256Hex(bytesToB64(bytes));
    // The same photo again: return the earlier result instead of processing (and paying for) it twice.
    const prev = await DB.prepare("SELECT id, status, extracted_text FROM uploads WHERE user_id = ? AND sha256 = ? AND status IN ('read', 'unreadable')").bind(me.id, hash).first<{ id: string; status: string; extracted_text: string | null }>();
    if (prev) return prev.status === "read" && prev.extracted_text ? { ok: true as const, id: prev.id, ...(JSON.parse(prev.extracted_text) as { text: string; uncertain: string[] }), repeated: true } : fail("unreadable");
    const id = crypto.randomUUID();
    const key = "not-stored";
    const ts = new Date();
    await DB.prepare("INSERT OR REPLACE INTO uploads (id, user_id, r2_key, mime, bytes, sha256, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, 'stored', ?, ?)")
      .bind(id, me.id, key, kind, bytes.length, hash, ts.toISOString(), new Date(ts.getTime() + RETENTION_DAYS * 86400_000).toISOString()).run();
    const res = await complete(cfg, [
      { role: "system", content: 'You read photos of school homework for a Class 7 student. Transcribe the question exactly as written, in its own language and script. Do not solve it, explain it or add anything. Where a word, number or symbol cannot be read with confidence, write […] in its place and list your best reading in "uncertain". Write fractions as a/b and powers as x^2. Reply with JSON only: {"readable": true|false, "text": "...", "uncertain": ["..."]}. If there is no readable question, reply {"readable": false, "text": "", "uncertain": []}.' },
      { role: "user", content: "Transcribe the question in this photo.", image: { mime: kind, base64: bytesToB64(bytes) } },
    ], { maxTokens: 600, json: true });
    const log = (status: string) => DB.prepare("INSERT INTO ai_requests (user_id, purpose, provider, model, status, latency_ms, input_tokens, output_tokens, sources, checks, created_at) VALUES (?, 'image_read', ?, ?, ?, ?, ?, ?, 0, NULL, ?)")
      .bind(me.id, cfg.provider, res.ok ? res.model : cfg.model, status, res.ms, res.ok ? res.usage.input : null, res.ok ? res.usage.output : null, new Date().toISOString()).run();
    if (!res.ok) {
      await DB.prepare("UPDATE uploads SET status = 'failed' WHERE id = ?").bind(id).run();
      await log(res.code);
      return fail("reader_unavailable");
    }
    const j = parseJsonObject(res.text);
    const text = typeof j?.text === "string" ? j.text.normalize("NFC").trim().slice(0, 1000) : "";
    const uncertain = Array.isArray(j?.uncertain) ? j.uncertain.filter((x): x is string => typeof x === "string").slice(0, 10).map((x) => x.slice(0, 80)) : [];
    if (j?.readable !== true || text.replace(/[\s…[\]]/g, "").length < 3) {
      await DB.prepare("UPDATE uploads SET status = 'unreadable' WHERE id = ?").bind(id).run();
      await log("unreadable");
      return fail("unreadable");
    }
    await DB.prepare("UPDATE uploads SET status = 'read', extracted_text = ? WHERE id = ?").bind(JSON.stringify({ text, uncertain }), id).run();
    await log("ok");
    return { ok: true as const, id, text, uncertain, repeated: false };
  });

