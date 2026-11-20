// Judge-demo sign-in core (server only). See ../api/judge.functions.ts for the server functions and admin controls.
import { getCookie, setCookie } from "@tanstack/react-start/server";

import { dummyVerify, randomToken, sha256Hex, verifyPassword } from "./crypto.server";
import { clientKey, rateCheck, rateHit, startSession } from "./session.server";
import { normalizeUsername } from "./validation";
import { bindings } from "../bindings.server";
import { linkLearnerToUser } from "../learner.server";
import { audit } from "../learning/engine.server";

const fail = <C extends string>(code: C) => ({ ok: false as const, code });
// Judge access never expires. A judge's browser keeps a random resume token (httpOnly; only its hash is stored), so
// signing in again with the judge credential on that browser returns to the same workspace. The credential is still
// checked every time; the token only chooses which workspace to reopen. The owner revokes access by rotating the
// password, ending judge sessions or turning judge access off.
const RESUME = "ih_judge_ws";
const RESUME_MAX_AGE = 400 * 24 * 3600; // the longest lifetime browsers allow for a cookie; it is renewed at each sign-in


export async function isJudgeUsername(ident: string): Promise<boolean> {
  const { DB } = bindings();
  if (!DB) return false;
  try {
    const r = await DB.prepare("SELECT 1 AS x FROM demo_access WHERE username = ?").bind(normalizeUsername(ident)).first();
    return !!r;
  } catch {
    return false;
  }
}

/** Verifies the judge credential and opens a new isolated demo workspace. Used by /judge and by the normal sign-in. */
export async function judgeLogin(identifier: string, password: string): Promise<{ ok: true; redirect: string } | { ok: false; code: "invalid_credentials" | "rate_limited" | "unavailable_now" | "judge_disabled" }> {
  const { DB } = bindings();
  if (!DB) return fail("unavailable_now");
  const ident = normalizeUsername(identifier);
  const ipKey = `judge-ip:${await clientKey()}`;
  if (!(await rateCheck(ipKey, 12, 900)) || !(await rateCheck("judge-all", 150, 900))) return fail("rate_limited");
  const row = await DB.prepare("SELECT username, password_hash, active, version FROM demo_access WHERE username = ?").bind(ident).first<{ username: string; password_hash: string; active: number; version: number }>();
  const ok = row ? await verifyPassword(password, row.password_hash) : (await dummyVerify(password), false);
  if (!row || !ok) { await rateHit(ipKey); await rateHit("judge-all"); return fail("invalid_credentials"); }
  if (!row.active) return fail("judge_disabled");
  // Same browser, same workspace (if it still exists and is a demo student).
  const prior = getCookie(RESUME);
  if (prior && prior.length >= 32 && prior.length <= 64) {
    const ws = await DB.prepare("SELECT id FROM users WHERE demo_resume_hash = ? AND is_demo = 1 AND status = 'active'").bind(await sha256Hex(prior)).first<{ id: string }>();
    if (ws) {
      await startSession(ws.id);
      setCookie(RESUME, prior, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: RESUME_MAX_AGE });
      await audit(DB, ws.id, "judge_workspace_resumed", ws.id, { version: row.version });
      return { ok: true, redirect: "/dashboard?tour=judge" };
    }
  }
  // Workspace creation is capped, so a leaked password can't fill the database.
  if (!(await rateCheck("judge-create", 200, 86400))) return fail("rate_limited");
  await rateHit("judge-create");
  const id = crypto.randomUUID();
  const tag = (await sha256Hex(id)).slice(0, 6);
  const resume = randomToken(32);
  const iso = new Date().toISOString();
  await DB.batch([
    // No usable password: "demo-locked" is not a valid hash, so this account can only be entered through the judge flow.
    DB.prepare("INSERT INTO users (id, email, email_verified_at, password_hash, status, created_at, updated_at, role, is_demo, demo_expires_at, demo_resume_hash) VALUES (?, ?, ?, 'demo-locked', 'active', ?, ?, 'student', 1, NULL, ?)")
      .bind(id, `demo-${tag}-${id.slice(0, 8)}@judge.invalid`, iso, iso, iso, await sha256Hex(resume)),
    DB.prepare(`INSERT INTO profiles (user_id, full_name, username, avatar_preset, country, grade, curriculum, created_at, updated_at, tutor_lang, explain_lang)
                VALUES (?, 'Judge (demo)', ?, 'galaxy', 'BD', 7, 'nctb-bangla', ?, ?, 'bn', 'bn')`).bind(id, `demo_judge_${tag}`, iso, iso),
  ]);
  await startSession(id);
  setCookie(RESUME, resume, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: RESUME_MAX_AGE });
  await linkLearnerToUser(id);
  await audit(DB, id, "judge_workspace_opened", id, { version: row.version });
  return { ok: true, redirect: "/dashboard?tour=judge" };
}

