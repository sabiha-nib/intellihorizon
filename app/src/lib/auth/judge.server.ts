// Judge-demo sign-in core (server only). See ../api/judge.functions.ts for the server functions and admin controls.
import { dummyVerify, sha256Hex, verifyPassword } from "./crypto.server";
import { clientKey, rateCheck, rateHit, startSession } from "./session.server";
import { normalizeUsername } from "./validation";
import { bindings } from "../bindings.server";
import { linkLearnerToUser } from "../learner.server";
import { audit } from "../learning/engine.server";

const fail = <C extends string>(code: C) => ({ ok: false as const, code });
const DEMO_HOURS = 24;


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
  // Workspace creation is capped too, so a leaked password can't fill the database.
  if (!(await rateCheck("judge-create", 200, 86400))) return fail("rate_limited");
  await rateHit("judge-create");
  const id = crypto.randomUUID();
  const tag = (await sha256Hex(id)).slice(0, 6);
  const ts = new Date();
  const iso = ts.toISOString();
  const expires = new Date(ts.getTime() + DEMO_HOURS * 3600_000).toISOString();
  await DB.batch([
    // No usable password: "demo-locked" is not a valid hash, so this account can only be entered through the judge flow.
    DB.prepare("INSERT INTO users (id, email, email_verified_at, password_hash, status, created_at, updated_at, role, is_demo, demo_expires_at) VALUES (?, ?, ?, 'demo-locked', 'active', ?, ?, 'student', 1, ?)")
      .bind(id, `demo-${tag}-${id.slice(0, 8)}@judge.invalid`, iso, iso, iso, expires),
    DB.prepare(`INSERT INTO profiles (user_id, full_name, username, avatar_preset, country, grade, curriculum, created_at, updated_at, tutor_lang, explain_lang)
                VALUES (?, 'Judge (demo)', ?, 'galaxy', 'BD', 7, 'nctb-bangla', ?, ?, 'bn', 'bn')`).bind(id, `demo_judge_${tag}`, iso, iso),
  ]);
  await startSession(id, DEMO_HOURS * 3600);
  await linkLearnerToUser(id);
  await audit(DB, id, "judge_workspace_opened", id, { version: row.version, expires });
  return { ok: true, redirect: "/dashboard?tour=judge" };
}

