// File storage with the subset of Cloudflare R2's API the app uses (get, put, delete). Two backends:
//  - Supabase Storage (private bucket) when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set on the server;
//  - otherwise the private Postgres table app_files (fine for the app's small files: avatars).
// The service-role key is used only here, on the server; it never reaches the browser.
import type { PgD1 } from "./pg-d1.server";

type Obj = { body: Uint8Array; httpMetadata: { contentType?: string }; size: number };
type PutOptions = { httpMetadata?: { contentType?: string } };
export interface FileStore {
  get(key: string): Promise<Obj | null>;
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

const bytesOf = (v: ArrayBuffer | Uint8Array | string) => (typeof v === "string" ? new TextEncoder().encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v));
const safeKey = (key: string) => { if (!/^[\w./-]{1,300}$/.test(key) || key.includes("..")) throw new Error("bad_storage_key"); return key; };

export function supabaseStore(url: string, serviceKey: string, bucket: string): FileStore {
  const base = `${url.replace(/\/+$/, "")}/storage/v1/object`;
  const auth = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  const path = (key: string) => `${bucket}/${safeKey(key).split("/").map(encodeURIComponent).join("/")}`;
  return {
    async get(key) {
      const r = await fetch(`${base}/authenticated/${path(key)}`, { headers: auth });
      if (r.status === 400 || r.status === 404) return null;
      if (!r.ok) throw new Error(`storage_get_${r.status}`);
      const body = new Uint8Array(await r.arrayBuffer());
      return { body, size: body.byteLength, httpMetadata: { contentType: r.headers.get("content-type") ?? undefined } };
    },
    async put(key, value, options) {
      const r = await fetch(`${base}/${path(key)}`, {
        method: "POST",
        headers: { ...auth, "x-upsert": "true", "content-type": options?.httpMetadata?.contentType ?? "application/octet-stream" },
        body: bytesOf(value) as unknown as BodyInit,
      });
      if (!r.ok) throw new Error(`storage_put_${r.status}`);
    },
    async delete(key) {
      const r = await fetch(`${base}/${bucket}`, { method: "DELETE", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ prefixes: [safeKey(key)] }) });
      if (!r.ok && r.status !== 404) throw new Error(`storage_delete_${r.status}`);
    },
  };
}

export function postgresStore(db: PgD1): FileStore {
  return {
    async get(key) {
      const row = await db.prepare("SELECT content, content_type, size FROM app_files WHERE key = ?").bind(safeKey(key)).first<{ content: ArrayBuffer; content_type: string | null; size: number }>();
      if (!row) return null;
      return { body: new Uint8Array(row.content), size: row.size, httpMetadata: { contentType: row.content_type ?? undefined } };
    },
    async put(key, value, options) {
      const b = bytesOf(value);
      await db.prepare("INSERT INTO app_files (key, content, content_type, size) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, content_type = EXCLUDED.content_type, size = EXCLUDED.size")
        .bind(safeKey(key), b, options?.httpMetadata?.contentType ?? null, b.byteLength).run();
    },
    async delete(key) {
      await db.prepare("DELETE FROM app_files WHERE key = ?").bind(safeKey(key)).run();
    },
  };
}
