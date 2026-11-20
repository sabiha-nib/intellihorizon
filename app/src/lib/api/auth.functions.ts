import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { accountSummary, mediumFor } from "../auth/account.server";
import { isJudgeUsername, judgeLogin } from "../auth/judge.server";
import { dummyVerify, hashPassword, isBreachedPassword, randomToken, sha256Hex, verifyPassword } from "../auth/crypto.server";
import { emailConfigured, sendEmailChange, sendResetEmail, sendVerifyEmail, type Delivery } from "../auth/email.server";
import { appOrigin, clientKey, currentUser, endOtherSessions, endSession, rateCheck, rateHit, rateLimit, sameOrigin, startSession } from "../auth/session.server";
import {
  type FieldErrors, isAvatarPreset, normalizeEmail, normalizeName, normalizeUsername, validateEmail, validateName, validatePassword, validateProfile, validateUsername,
} from "../auth/validation";
import { bindings } from "../bindings.server";
import { clearLearnerCookie, linkLearnerToUser } from "../learner.server";

type Fail = { ok: false; code: string; fields?: FieldErrors };
const fail = (code: string, fields?: FieldErrors): Fail => ({ ok: false, code, fields });
const nowIso = () => new Date().toISOString();
const nowSec = () => Math.floor(Date.now() / 1000);
const str = (max: number) => z.string().max(max);
const lang = z.enum(["en", "bn"]).default("en");

const profileShape = {
  school: str(400).default(""),
  country: z.enum(["BD", "OTHER"]),
  district: str(60).default(""),
  region: str(300).default(""),
  grade: z.number().int().nullable(),
  curriculum: str(40),
  curriculumOther: str(40).default(""),
  curriculumOtherText: str(300).default(""),
};

function cleanProfile(p: z.infer<z.ZodObject<typeof profileShape>>) {
  return {
    school: p.school.normalize("NFC").trim() || null,
    country: p.country,
    district: p.country === "BD" ? p.district : null,
    region: p.country === "OTHER" ? p.region.normalize("NFC").trim() || null : null,
    grade: p.grade as number,
    curriculum: p.curriculum,
    curriculumOther: p.curriculum === "other" ? p.curriculumOther : null,
    curriculumOtherText: p.curriculum === "other" && p.curriculumOther === "other" ? p.curriculumOtherText.normalize("NFC").trim() : null,
  };
}

function uniqueField(err: unknown): "username" | "email" | "key" | null {
  const m = String((err as Error)?.message ?? err);
  if (m.includes("profiles.username")) return "username";
  if (m.includes("users.email")) return "email";
  if (m.includes("users.registration_key")) return "key";
  return null;
}

async function passwordProblem(password: string, ctx: { email?: string; username?: string }): Promise<string | null> {
  const local = validatePassword(password, ctx);
  if (local) return local;
  if (await isBreachedPassword(password)) return "password_breached";
  return null;
}

async function issueToken(userId: string, purpose: "verify" | "reset" | "email_change", ttlSec: number, newEmail: string | null = null): Promise<string> {
  const { DB } = bindings();
  const token = randomToken(32);
  await DB!.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, new_email, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, purpose, newEmail, nowSec() + ttlSec, nowSec())
    .run();
  return token;
}

async function sendVerification(userId: string, email: string, l: "en" | "bn"): Promise<Delivery> {
  if (!emailConfigured()) return "not_configured";
  const token = await issueToken(userId, "verify", 24 * 3600);
  return sendVerifyEmail(email, `${appOrigin()}/verify-email?token=${token}`, l);
}

/* ─────────── Username availability ─────────── */

export const checkUsername = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: str(60) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB || !sameOrigin()) return fail("unavailable_now");
    if (!(await rateLimit(`uname:${await clientKey()}`, 60, 60))) return fail("rate_limited");
    const problem = validateUsername(data.username);
    if (problem) return fail(problem);
    const u = normalizeUsername(data.username);
    const me = await currentUser();
    const row = await DB.prepare("SELECT user_id FROM profiles WHERE username = ?").bind(u).first<{ user_id: string }>();
    if (!row || (me && row.user_id === me.id)) return { ok: true as const, available: true, suggestions: [] as string[] };
    const base = u.replace(/[._]+$/, "").slice(0, 16);
    const pool = new Set<string>();
    while (pool.size < 8) pool.add(`${base}${(crypto.getRandomValues(new Uint16Array(1))[0] % 900) + 10}`);
    const cands = [...pool].filter((c) => !validateUsername(c));
    const taken = await DB.prepare(`SELECT username FROM profiles WHERE username IN (${cands.map(() => "?").join(",")})`).bind(...cands).all<{ username: string }>();
    const takenSet = new Set((taken.results ?? []).map((r) => r.username));
    return { ok: true as const, available: false, suggestions: cands.filter((c) => !takenSet.has(c)).slice(0, 3) };
  });

/* ─────────── Registration ─────────── */

export const register = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      requestId: z.string().uuid(),
      fullName: str(400),
      username: str(60),
      email: str(400),
      password: str(1024),
      avatarPreset: str(20).nullable().default(null),
      acceptPrivacy: z.boolean(),
      lang,
      ...profileShape,
    }),
  )
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const email = normalizeEmail(data.email);
    const username = normalizeUsername(data.username);

    // Idempotent retry: the same request id with the same credentials signs in instead of creating a duplicate.
    const prior = await DB.prepare("SELECT id, email, password_hash FROM users WHERE registration_key = ?").bind(data.requestId).first<{ id: string; email: string; password_hash: string }>();
    if (prior) {
      if (prior.email === email && (await verifyPassword(data.password, prior.password_hash))) {
        await startSession(prior.id);
        await linkLearnerToUser(prior.id);
        return { ok: true as const, delivery: "not_configured" as Delivery, account: await accountSummary(prior.id), resumed: true };
      }
      return fail("retry_conflict");
    }

    if (!(await rateLimit(`reg:${await clientKey()}`, 8, 3600))) return fail("rate_limited");

    const fields: FieldErrors = {};
    const n = validateName(data.fullName);
    if (n) fields.fullName = n;
    const u = validateUsername(username);
    if (u) fields.username = u;
    const e = validateEmail(email);
    if (e) fields.email = e;
    Object.assign(fields, validateProfile({ ...data, grade: data.grade }));
    if (data.avatarPreset !== null && !isAvatarPreset(data.avatarPreset)) fields.avatar = "avatar_invalid";
    if (!data.acceptPrivacy) fields.acceptPrivacy = "privacy_required";
    if (!fields.password) {
      const p = await passwordProblem(data.password, { email, username });
      if (p) fields.password = p;
    }
    if (Object.keys(fields).length) return fail("invalid", fields);

    const exists = await DB.prepare("SELECT 1 AS x FROM users WHERE email = ?").bind(email).first();
    if (exists) return fail("invalid", { email: "email_unavailable" });

    const id = crypto.randomUUID();
    const ts = nowIso();
    const p = cleanProfile(data);
    try {
      await DB.batch([
        DB.prepare("INSERT INTO users (id, email, password_hash, registration_key, created_at, updated_at, password_changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
          id, email, await hashPassword(data.password), data.requestId, ts, ts, ts,
        ),
        DB.prepare(
          `INSERT INTO profiles (user_id, full_name, username, avatar_preset, school, country, district, region, grade, curriculum, curriculum_other, curriculum_other_text, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(id, normalizeName(data.fullName), username, data.avatarPreset, p.school, p.country, p.district, p.region, p.grade, p.curriculum, p.curriculumOther, p.curriculumOtherText, ts, ts),
      ]);
    } catch (err) {
      const f = uniqueField(err);
      if (f === "username") return fail("invalid", { username: "username_taken" });
      if (f === "email") return fail("invalid", { email: "email_unavailable" });
      return fail("save_failed");
    }

    // Account and profile now exist atomically. Anything after this point must not report total failure.
    // Signing up never grants administrator access. Admin is claimed separately with the one-time owner code or the EDU_ADMIN_TOKEN secret.
    try {
      await startSession(id);
      await linkLearnerToUser(id);
    } catch {
      return fail("created_signin_failed");
    }
    let delivery: Delivery = "not_configured";
    try {
      delivery = await sendVerification(id, email, data.lang);
    } catch {
      delivery = "failed";
    }
    return { ok: true as const, delivery, account: await accountSummary(id), resumed: false };
  });

/* ─────────── Sign in / out ─────────── */

export const signIn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ identifier: str(400), password: str(1024) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const ident = data.identifier.includes("@") ? normalizeEmail(data.identifier) : normalizeUsername(data.identifier);
    if (!ident || !data.password) return fail("invalid_credentials");
    // The judge-demo credential works here too; it opens a fresh isolated demo workspace instead of an account.
    if (!ident.includes("@") && (await isJudgeUsername(ident))) {
      const j = await judgeLogin(ident, data.password);
      return j.ok ? { ok: true as const, account: null, redirect: j.redirect } : fail(j.code === "judge_disabled" ? "invalid_credentials" : j.code);
    }
    const ipKey = `login-ip:${await clientKey()}`;
    const acctKey = `login-acct:${(await sha256Hex(ident)).slice(0, 24)}`;
    if (!(await rateCheck(ipKey, 40, 900)) || !(await rateCheck(acctKey, 8, 900))) return fail("rate_limited");
    const row = ident.includes("@")
      ? await DB.prepare("SELECT id, password_hash FROM users WHERE email = ? AND status = 'active'").bind(ident).first<{ id: string; password_hash: string }>()
      : await DB.prepare("SELECT u.id, u.password_hash FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.username = ? AND u.status = 'active'").bind(ident).first<{ id: string; password_hash: string }>();
    const ok = row ? await verifyPassword(data.password, row.password_hash) : (await dummyVerify(data.password), false);
    if (!row || !ok) {
      await rateHit(ipKey);
      await rateHit(acctKey);
      return fail("invalid_credentials");
    }
    await startSession(row.id);
    await linkLearnerToUser(row.id);
    return { ok: true as const, account: await accountSummary(row.id) };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  if (!sameOrigin()) return fail("bad_origin");
  await endSession();
  clearLearnerCookie();
  return { ok: true as const };
});

export const signOutEverywhere = createServerFn({ method: "POST" }).handler(async () => {
  if (!sameOrigin()) return fail("bad_origin");
  const me = await currentUser();
  if (!me) return fail("signed_out");
  await endOtherSessions(me.id, null);
  await endSession();
  clearLearnerCookie();
  return { ok: true as const };
});

export const getAccount = createServerFn({ method: "GET" }).handler(async () => {
  const me = await currentUser();
  if (!me) return null;
  return accountSummary(me.id);
});

/* ─────────── Recovery and verification ─────────── */

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: str(400), lang }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const email = normalizeEmail(data.email);
    if (validateEmail(email)) return fail("invalid", { email: "email_invalid" });
    if (!emailConfigured()) return { ok: true as const, delivery: "not_configured" as const };
    const ipOk = await rateLimit(`reset-ip:${await clientKey()}`, 10, 3600);
    const acctOk = await rateLimit(`reset-acct:${(await sha256Hex(email)).slice(0, 24)}`, 3, 3600);
    // Same response whether or not the account exists, to avoid revealing who has an account.
    if (ipOk && acctOk) {
      const user = await DB.prepare("SELECT id FROM users WHERE email = ? AND status = 'active'").bind(email).first<{ id: string }>();
      if (user) {
        const token = await issueToken(user.id, "reset", 30 * 60);
        await sendResetEmail(email, `${appOrigin()}/reset-password?token=${token}`, data.lang);
      }
    }
    return { ok: true as const, delivery: "queued" as const };
  });

async function readToken(token: string, purpose: string) {
  const { DB } = bindings();
  if (!DB || token.length < 32 || token.length > 64) return { state: "invalid" as const };
  const row = await DB.prepare("SELECT token_hash, user_id, new_email, expires_at, used_at FROM email_tokens WHERE token_hash = ? AND purpose = ?")
    .bind(await sha256Hex(token), purpose)
    .first<{ token_hash: string; user_id: string; new_email: string | null; expires_at: number; used_at: number | null }>();
  if (!row) return { state: "invalid" as const };
  if (row.used_at) return { state: "used" as const };
  if (row.expires_at <= nowSec()) return { state: "expired" as const };
  return { state: "valid" as const, row };
}

export const checkResetToken = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: str(100) }))
  .handler(async ({ data }) => ({ ok: true as const, state: (await readToken(data.token, "reset")).state }));

export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: str(100), password: str(1024) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const t = await readToken(data.token, "reset");
    if (t.state !== "valid") return fail(`token_${t.state}`);
    const who = await DB.prepare("SELECT u.email, p.username FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?").bind(t.row.user_id).first<{ email: string; username: string }>();
    const problem = await passwordProblem(data.password, { email: who?.email, username: who?.username });
    if (problem) return fail("invalid", { password: problem });
    const ts = nowIso();
    await DB.batch([
      DB.prepare("UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").bind(await hashPassword(data.password), ts, ts, ts, t.row.user_id),
      DB.prepare("UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'reset' AND used_at IS NULL").bind(nowSec(), t.row.user_id),
      DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(t.row.user_id),
    ]);
    await startSession(t.row.user_id);
    await linkLearnerToUser(t.row.user_id);
    return { ok: true as const };
  });

export const verifyEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: str(100) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    let t = await readToken(data.token, "verify");
    let purpose: "verify" | "email_change" = "verify";
    if (t.state === "invalid") {
      t = await readToken(data.token, "email_change");
      purpose = "email_change";
    }
    if (t.state !== "valid") return fail(`token_${t.state}`);
    const ts = nowIso();
    if (purpose === "verify") {
      await DB.batch([
        DB.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?").bind(ts, ts, t.row.user_id),
        DB.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?").bind(nowSec(), t.row.token_hash),
      ]);
      return { ok: true as const, kind: "verified" as const };
    }
    try {
      await DB.batch([
        DB.prepare("UPDATE users SET email = ?, pending_email = NULL, email_verified_at = ?, updated_at = ? WHERE id = ?").bind(t.row.new_email, ts, ts, t.row.user_id),
        DB.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?").bind(nowSec(), t.row.token_hash),
      ]);
    } catch (err) {
      if (uniqueField(err) === "email") return fail("email_unavailable");
      return fail("save_failed");
    }
    return { ok: true as const, kind: "changed" as const };
  });

export const resendVerification = createServerFn({ method: "POST" })
  .inputValidator(z.object({ lang }))
  .handler(async ({ data }) => {
    if (!sameOrigin()) return fail("bad_origin");
    const me = await currentUser();
    if (!me) return fail("signed_out");
    if (me.emailVerified) return { ok: true as const, delivery: "already" as const };
    if (!emailConfigured()) return { ok: true as const, delivery: "not_configured" as const };
    if (!(await rateLimit(`verify:${me.id}`, 3, 3600))) return fail("rate_limited");
    return { ok: true as const, delivery: await sendVerification(me.id, me.email, data.lang) };
  });

/* ─────────── Profile management (owner only: the user id always comes from the session) ─────────── */

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator(z.object({ fullName: str(400), username: str(60), explainLang: z.enum(["en", "bn"]).nullable().default(null), goals: z.array(z.enum(["exam", "understand", "catch_up", "get_ahead"])).max(4).default([]), ...profileShape }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const me = await currentUser();
    if (!me) return fail("signed_out");
    const fields: FieldErrors = {};
    const n = validateName(data.fullName);
    if (n) fields.fullName = n;
    const u = validateUsername(data.username);
    if (u) fields.username = u;
    Object.assign(fields, validateProfile(data));
    if (Object.keys(fields).length) return fail("invalid", fields);
    const p = cleanProfile(data);
    try {
      await DB.batch([
        DB.prepare(
          "UPDATE profiles SET full_name = ?, username = ?, school = ?, country = ?, district = ?, region = ?, grade = ?, curriculum = ?, curriculum_other = ?, curriculum_other_text = ?, explain_lang = ?, goals = ?, updated_at = ? WHERE user_id = ?",
        ).bind(normalizeName(data.fullName), normalizeUsername(data.username), p.school, p.country, p.district, p.region, p.grade, p.curriculum, p.curriculumOther, p.curriculumOtherText, data.explainLang, JSON.stringify([...new Set(data.goals)]), nowIso(), me.id),
        DB.prepare("UPDATE learners SET grade = ?, medium = ? WHERE user_id = ?").bind(p.grade, mediumFor(p.curriculum), me.id),
      ]);
    } catch (err) {
      if (uniqueField(err) === "username") return fail("invalid", { username: "username_taken" });
      return fail("save_failed");
    }
    return { ok: true as const, account: await accountSummary(me.id) };
  });

export const setAvatarPreset = createServerFn({ method: "POST" })
  .inputValidator(z.object({ preset: str(20).nullable() }))
  .handler(async ({ data }) => {
    const { DB, STORAGE } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const me = await currentUser();
    if (!me) return fail("signed_out");
    if (data.preset !== null && !isAvatarPreset(data.preset)) return fail("avatar_invalid");
    const prev = await DB.prepare("SELECT avatar_key FROM profiles WHERE user_id = ?").bind(me.id).first<{ avatar_key: string | null }>();
    await DB.prepare("UPDATE profiles SET avatar_preset = ?, avatar_key = NULL, avatar_type = NULL, updated_at = ? WHERE user_id = ?").bind(data.preset, nowIso(), me.id).run();
    if (prev?.avatar_key && STORAGE) await STORAGE.delete(prev.avatar_key).catch(() => undefined);
    return { ok: true as const, account: await accountSummary(me.id) };
  });

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ current: str(1024), next: str(1024) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const me = await currentUser();
    if (!me) return fail("signed_out");
    if (me.isDemo) return fail("demo_account");
    const bucket = `pw:${me.id}`;
    if (!(await rateCheck(bucket, 6, 900))) return fail("rate_limited");
    const row = await DB.prepare("SELECT u.password_hash, p.username FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?").bind(me.id).first<{ password_hash: string; username: string }>();
    if (!row || !(await verifyPassword(data.current, row.password_hash))) {
      await rateHit(bucket);
      return fail("invalid", { current: "current_wrong" });
    }
    const problem = await passwordProblem(data.next, { email: me.email, username: row.username });
    if (problem) return fail("invalid", { next: problem });
    const ts = nowIso();
    await DB.prepare("UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(data.next), ts, ts, me.id).run();
    await endOtherSessions(me.id, me.sessionHash);
    return { ok: true as const };
  });

export const requestEmailChange = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: str(400), password: str(1024), lang }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const me = await currentUser();
    if (!me) return fail("signed_out");
    if (me.isDemo) return fail("demo_account");
    if (!emailConfigured()) return fail("email_not_configured");
    const email = normalizeEmail(data.email);
    if (validateEmail(email)) return fail("invalid", { email: "email_invalid" });
    if (email === me.email) return fail("invalid", { email: "email_same" });
    const row = await DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(me.id).first<{ password_hash: string }>();
    if (!row || !(await verifyPassword(data.password, row.password_hash))) return fail("invalid", { password: "current_wrong" });
    if (!(await rateLimit(`emailchg:${me.id}`, 3, 3600))) return fail("rate_limited");
    const taken = await DB.prepare("SELECT 1 AS x FROM users WHERE email = ?").bind(email).first();
    if (taken) return fail("invalid", { email: "email_unavailable" });
    await DB.prepare("UPDATE users SET pending_email = ?, updated_at = ? WHERE id = ?").bind(email, nowIso(), me.id).run();
    const token = await issueToken(me.id, "email_change", 24 * 3600, email);
    const delivery = await sendEmailChange(email, `${appOrigin()}/verify-email?token=${token}`, data.lang);
    return { ok: true as const, delivery };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: str(1024) }))
  .handler(async ({ data }) => {
    const { DB, STORAGE } = bindings();
    if (!DB) return fail("unavailable_now");
    if (!sameOrigin()) return fail("bad_origin");
    const me = await currentUser();
    if (!me) return fail("signed_out");
    if (me.isDemo) return fail("demo_account");
    const row = await DB.prepare("SELECT u.password_hash, p.avatar_key FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?").bind(me.id).first<{ password_hash: string; avatar_key: string | null }>();
    if (!row || !(await verifyPassword(data.password, row.password_hash))) return fail("invalid", { password: "current_wrong" });
    if (row.avatar_key && STORAGE) await STORAGE.delete(row.avatar_key).catch(() => undefined);
    await DB.batch([
      DB.prepare("DELETE FROM evidence WHERE learner_id IN (SELECT id FROM learners WHERE user_id = ?)").bind(me.id),
      DB.prepare("DELETE FROM learners WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM tutor_messages WHERE thread_id IN (SELECT id FROM tutor_threads WHERE user_id = ?)").bind(me.id),
      DB.prepare("DELETE FROM tutor_threads WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM saved_items WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM attempts WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM review_state WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM plan_tasks WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM chapter_activity WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM email_tokens WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM profiles WHERE user_id = ?").bind(me.id),
      DB.prepare("DELETE FROM users WHERE id = ?").bind(me.id),
    ]);
    await endSession();
    clearLearnerCookie();
    return { ok: true as const };
  });
