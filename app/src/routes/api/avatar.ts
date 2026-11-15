import { createFileRoute } from "@tanstack/react-router";

import { userFromRequest, sameOrigin } from "../../lib/auth/session.server";
import { AVATAR_MAX_BYTES } from "../../lib/auth/config";
import { bindings } from "../../lib/bindings.server";

// Profile photos are private: only the signed-in owner can read, replace or delete their own photo.

function sniff(b: Uint8Array): { type: string; ext: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { type: "image/png", ext: "png" };
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/avatar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { DB, STORAGE } = bindings();
        const me = await userFromRequest(request);
        if (!me) return json({ ok: false, code: "signed_out" }, 401);
        if (!DB || !STORAGE) return json({ ok: false, code: "unavailable_now" }, 503);
        const row = await DB.prepare("SELECT avatar_key, avatar_type FROM profiles WHERE user_id = ?").bind(me.id).first<{ avatar_key: string | null; avatar_type: string | null }>();
        if (!row?.avatar_key) return json({ ok: false, code: "none" }, 404);
        // Revalidate on every use so a signed-out or different student never gets the photo from the browser cache.
        const etag = `"${row.avatar_key.slice(-40)}"`;
        const headers = { "Content-Type": row.avatar_type ?? "image/jpeg", "Cache-Control": "private, no-cache", ETag: etag, Vary: "Cookie", "Content-Disposition": "inline" };
        if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
        const obj = await STORAGE.get(row.avatar_key);
        if (!obj) return json({ ok: false, code: "none" }, 404);
        return new Response(obj.body as unknown as BodyInit, { headers });
      },
      POST: async ({ request }) => {
        const { DB, STORAGE } = bindings();
        if (!sameOrigin(request)) return json({ ok: false, code: "bad_origin" }, 403);
        const me = await userFromRequest(request);
        if (!me) return json({ ok: false, code: "signed_out" }, 401);
        if (!DB || !STORAGE) return json({ ok: false, code: "storage_unavailable" }, 503);
        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > AVATAR_MAX_BYTES + 64 * 1024) return json({ ok: false, code: "image_too_large" }, 413);
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ ok: false, code: "image_invalid" }, 400);
        }
        const file = form.get("file");
        if (!(file instanceof File)) return json({ ok: false, code: "image_invalid" }, 400);
        if (file.size > AVATAR_MAX_BYTES) return json({ ok: false, code: "image_too_large" }, 413);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const kind = sniff(bytes);
        if (!kind) return json({ ok: false, code: "image_type" }, 415);
        const key = `avatars/${me.id}/${crypto.randomUUID()}.${kind.ext}`;
        const prev = await DB.prepare("SELECT avatar_key FROM profiles WHERE user_id = ?").bind(me.id).first<{ avatar_key: string | null }>();
        try {
          await STORAGE.put(key, bytes, { httpMetadata: { contentType: kind.type } });
          await DB.prepare("UPDATE profiles SET avatar_key = ?, avatar_type = ?, avatar_preset = NULL, updated_at = ? WHERE user_id = ?").bind(key, kind.type, new Date().toISOString(), me.id).run();
        } catch {
          await STORAGE.delete(key).catch(() => undefined);
          return json({ ok: false, code: "upload_failed" }, 500);
        }
        if (prev?.avatar_key) await STORAGE.delete(prev.avatar_key).catch(() => undefined);
        return json({ ok: true, v: key.slice(-12) });
      },
      DELETE: async ({ request }) => {
        const { DB, STORAGE } = bindings();
        if (!sameOrigin(request)) return json({ ok: false, code: "bad_origin" }, 403);
        const me = await userFromRequest(request);
        if (!me) return json({ ok: false, code: "signed_out" }, 401);
        if (!DB) return json({ ok: false, code: "unavailable_now" }, 503);
        const prev = await DB.prepare("SELECT avatar_key FROM profiles WHERE user_id = ?").bind(me.id).first<{ avatar_key: string | null }>();
        await DB.prepare("UPDATE profiles SET avatar_key = NULL, avatar_type = NULL, avatar_preset = NULL, updated_at = ? WHERE user_id = ?").bind(new Date().toISOString(), me.id).run();
        if (prev?.avatar_key && STORAGE) await STORAGE.delete(prev.avatar_key).catch(() => undefined);
        return json({ ok: true });
      },
    },
  },
});
