import { deleteCookie, getCookie, getRequest, getRequestHeader, setCookie } from "@tanstack/react-start/server";

import { bindings } from "../bindings.server";
import { randomToken, sha256Hex } from "./crypto.server";

export const SID = "edu_sid";
const TTL = 30 * 24 * 3600; // seconds
const now = () => Math.floor(Date.now() / 1000);

export type SessionUser = { id: string; email: string; emailVerified: boolean; pendingEmail: string | null; sessionHash: string; role: "student" | "admin" };

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

async function userFromToken(token: string | null | undefined): Promise<SessionUser | null> {
  const { DB } = bindings();
  if (!DB || !token || token.length < 32 || token.length > 64) return null;
  const hash = await sha256Hex(token);
  const row = await DB.prepare(
    "SELECT s.user_id, s.expires_at, u.email, u.email_verified_at, u.pending_email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ? AND u.status = 'active'",
  )
    .bind(hash)
    .first<{ user_id: string; expires_at: number; email: string; email_verified_at: string | null; pending_email: string | null; role: string | null }>();
  if (!row) return null;
  const t = now();
  if (row.expires_at <= t) {
    await DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(hash).run();
    return null;
  }
  if (row.expires_at - t < TTL / 2) {
    await DB.prepare("UPDATE sessions SET expires_at = ?, last_seen_at = ? WHERE id_hash = ?").bind(t + TTL, t, hash).run();
  }
  return { id: row.user_id, email: row.email, emailVerified: !!row.email_verified_at, pendingEmail: row.pending_email, sessionHash: hash, role: row.role === "admin" ? "admin" : "student" };
}

/** Current user inside a server function or loader. */
export async function currentUser(): Promise<SessionUser | null> {
  return userFromToken(getCookie(SID));
}

/** Current user inside a raw server route. */
export async function userFromRequest(request: Request): Promise<SessionUser | null> {
  return userFromToken(cookieValue(request.headers.get("cookie"), SID));
}

export async function startSession(userId: string): Promise<void> {
  const { DB } = bindings();
  if (!DB) throw new Error("storage_unavailable");
  const token = randomToken(32);
  const t = now();
  await DB.prepare("INSERT INTO sessions (id_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, t, t + TTL, t)
    .run();
  setCookie(SID, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: TTL });
}

export async function endSession(): Promise<void> {
  const { DB } = bindings();
  const token = getCookie(SID);
  if (DB && token) await DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256Hex(token)).run();
  deleteCookie(SID, { path: "/" });
}

export async function endOtherSessions(userId: string, keepHash: string | null): Promise<void> {
  const { DB } = bindings();
  if (!DB) return;
  if (keepHash) await DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id_hash != ?").bind(userId, keepHash).run();
  else await DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

/** Reject cross-site mutation requests. Same-origin browser requests always send a matching Origin. */
export function sameOrigin(request?: Request): boolean {
  const origin = request ? request.headers.get("origin") : getRequestHeader("origin");
  const url = new URL(request ? request.url : getRequest().url);
  if (!origin) return true; // non-browser or same-origin GET; cookies are SameSite=Lax
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

export async function clientKey(request?: Request): Promise<string> {
  const ip = (request ? request.headers.get("cf-connecting-ip") : getRequestHeader("cf-connecting-ip")) ?? "local";
  return (await sha256Hex(`edu-rl:${ip}`)).slice(0, 24);
}

/** Sliding-window limiter stored in D1. Returns false when the limit is reached. */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const { DB } = bindings();
  if (!DB) return true;
  const t = now();
  const row = await DB.prepare("SELECT COUNT(*) AS n FROM rate_events WHERE bucket = ? AND at > ?").bind(bucket, t - windowSec).first<{ n: number }>();
  if ((row?.n ?? 0) >= limit) return false;
  await DB.prepare("INSERT INTO rate_events (bucket, at) VALUES (?, ?)").bind(bucket, t).run();
  if (crypto.getRandomValues(new Uint8Array(1))[0] < 4) {
    await DB.prepare("DELETE FROM rate_events WHERE at < ?").bind(t - 86400).run();
  }
  return true;
}

export function appOrigin(): string {
  const fixed = bindings().APP_ORIGIN;
  if (fixed && /^https:\/\/[a-z0-9.-]+$/.test(fixed)) return fixed;
  const url = new URL(getRequest().url);
  if (url.hostname.endsWith(".higgsfield.app") || url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin;
  return "https://educerro.higgsfield.app";
}

/** Count-only check (no consumption). Pair with rateHit to count failures only. */
export async function rateCheck(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const { DB } = bindings();
  if (!DB) return true;
  const row = await DB.prepare("SELECT COUNT(*) AS n FROM rate_events WHERE bucket = ? AND at > ?").bind(bucket, now() - windowSec).first<{ n: number }>();
  return (row?.n ?? 0) < limit;
}
export async function rateHit(bucket: string): Promise<void> {
  const { DB } = bindings();
  if (DB) await DB.prepare("INSERT INTO rate_events (bucket, at) VALUES (?, ?)").bind(bucket, now()).run();
}
