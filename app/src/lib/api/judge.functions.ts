// Judge demo access. One shared credential (PBKDF2 hash in demo_access, rotatable by the admin). It never expires. The
// first sign-in on a browser creates an isolated demo student workspace (Class 7, NCTB, Bangla Version, tutor in
// Bangla); signing in again on that browser reopens it, and another browser gets its own, so judges never see or
// disturb each other's activity. Demo workspaces are students: they can't claim admin, change credentials or reach
// admin routes, and their AI use has its own daily limits.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { hashPassword, randomToken } from "../auth/crypto.server";
import { judgeLogin } from "../auth/judge.server";
import { sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { requireAdmin } from "../curriculum/admin.server";
import { audit } from "../learning/engine.server";

const fail = <C extends string>(code: C) => ({ ok: false as const, code });
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Human-typeable password: four groups of four from an unambiguous alphabet (~94 bits). */
function readablePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => ALPHA[b % ALPHA.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export const judgeSignIn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().max(60), password: z.string().max(200) }))
  .handler(async ({ data }) => {
    if (!sameOrigin()) return fail("bad_origin");
    return judgeLogin(data.username, data.password);
  });

/* ─────────── Admin: status, rotation, ending sessions ─────────── */

export const judgeAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  if (!DB || !(await requireAdmin())) return fail("forbidden");
  const a = await DB.prepare("SELECT username, active, version, rotated_at FROM demo_access WHERE id = 'judge'").first<{ username: string; active: number; version: number; rotated_at: string }>();
  const nowIso = new Date().toISOString();
  const w = await DB.prepare("SELECT COUNT(*) AS total, (SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.is_demo = 1 AND s.expires_at > ?) AS live FROM users WHERE is_demo = 1").bind(Math.floor(Date.now() / 1000)).first<{ total: number; live: number | null }>();
  const ai = await DB.prepare("SELECT COUNT(DISTINCT COALESCE(a.request_group, CAST(a.id AS TEXT))) AS n FROM ai_requests a JOIN users u ON u.id = a.user_id WHERE u.is_demo = 1 AND a.created_at >= ?").bind(`${nowIso.slice(0, 10)}T00:00:00`).first<{ n: number }>();
  const env = bindings() as unknown as Record<string, string | undefined>;
  return {
    ok: true as const,
    access: a ? { username: a.username, active: !!a.active, version: a.version, rotatedAt: a.rotated_at } : null,
    workspaces: { total: w?.total ?? 0, live: w?.live ?? 0 },
    aiToday: ai?.n ?? 0,
    limits: { perWorkspace: Number(env.JUDGE_AI_DAILY_LIMIT) || 25, allJudges: Number(env.JUDGE_AI_TOTAL_DAILY) || 300 },
  };
});

async function endAllJudgeSessions(DB: NonNullable<ReturnType<typeof bindings>["DB"]>) {
  const r = await DB.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE is_demo = 1)").run();
  return r.meta?.changes ?? 0;
}

/** New password, shown to the admin once. The old one stops working and every judge session ends. */
export const rotateJudgePassword = createServerFn({ method: "POST" }).handler(async () => {
  const { DB } = bindings();
  if (!DB || !sameOrigin()) return fail("unavailable_now");
  const me = await requireAdmin();
  if (!me) return fail("forbidden");
  const password = readablePassword();
  await DB.prepare("UPDATE demo_access SET password_hash = ?, version = version + 1, rotated_at = ?, rotated_by = ?, active = 1 WHERE id = 'judge'").bind(await hashPassword(password), new Date().toISOString(), me.id).run();
  const ended = await endAllJudgeSessions(DB);
  await audit(DB, me.id, "judge_password_rotated", "judge", { endedSessions: ended });
  const a = await DB.prepare("SELECT username FROM demo_access WHERE id = 'judge'").first<{ username: string }>();
  return { ok: true as const, username: a?.username ?? "", password, endedSessions: ended, nonce: randomToken(4) };
});

export const endJudgeSessions = createServerFn({ method: "POST" }).handler(async () => {
  const { DB } = bindings();
  if (!DB || !sameOrigin()) return fail("unavailable_now");
  const me = await requireAdmin();
  if (!me) return fail("forbidden");
  const ended = await endAllJudgeSessions(DB);
  await audit(DB, me.id, "judge_sessions_ended", "judge", { ended });
  return { ok: true as const, ended };
});

export const setJudgeAccess = createServerFn({ method: "POST" })
  .inputValidator(z.object({ active: z.boolean() }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB || !sameOrigin()) return fail("unavailable_now");
    const me = await requireAdmin();
    if (!me) return fail("forbidden");
    await DB.prepare("UPDATE demo_access SET active = ? WHERE id = 'judge'").bind(data.active ? 1 : 0).run();
    if (!data.active) await endAllJudgeSessions(DB);
    await audit(DB, me.id, data.active ? "judge_enabled" : "judge_disabled", "judge", {});
    return { ok: true as const };
  });
