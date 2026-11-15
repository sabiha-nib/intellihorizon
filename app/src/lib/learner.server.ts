import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { accountSummary, mediumFor } from "./auth/account.server";
import { currentUser } from "./auth/session.server";
import type { AccountSummary } from "./auth/types";
import { totalXp } from "./learning/engine.server";
import { bindings } from "./bindings.server";
import { DEFAULT_PREFS, type EvidenceRow, type Prefs } from "./model";
export { DEFAULT_PREFS, type Prefs };

const COOKIE = "edu_lid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function readLearnerId(): string | null {
  const v = getCookie(COOKIE);
  return v && UUID.test(v) ? v : null;
}

function setLearnerCookie(id: string) {
  setCookie(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
}
export function clearLearnerCookie() {
  deleteCookie(COOKIE, { path: "/" });
}

/**
 * Resolve the learner record this request may use, without creating one.
 * Signed in: the learner owned by the account. Signed out: only an anonymous (unlinked) learner.
 */
async function resolveLearner(userId: string | null): Promise<string | null> {
  const { DB } = bindings();
  if (!DB) return null;
  if (userId) {
    const own = await DB.prepare("SELECT id FROM learners WHERE user_id = ?").bind(userId).first<{ id: string }>();
    return own?.id ?? null;
  }
  const id = readLearnerId();
  if (!id) return null;
  const row = await DB.prepare("SELECT id FROM learners WHERE id = ? AND user_id IS NULL").bind(id).first<{ id: string }>();
  return row?.id ?? null;
}

export async function ensureLearner(): Promise<string | null> {
  const { DB } = bindings();
  if (!DB) return null;
  const user = await currentUser();
  const existing = await resolveLearner(user?.id ?? null);
  if (existing) {
    if (readLearnerId() !== existing) setLearnerCookie(existing);
    return existing;
  }
  if (user) {
    const linked = await linkLearnerToUser(user.id);
    if (linked) return linked;
  }
  const id = crypto.randomUUID();
  await DB.prepare("INSERT INTO learners (id, user_id) VALUES (?, ?)").bind(id, user?.id ?? null).run();
  setLearnerCookie(id);
  return id;
}

/**
 * Called after sign-up or sign-in. If the account already has a learner, switch this device to it.
 * Otherwise adopt the anonymous learner on this device, so progress made before signing up is kept.
 */
export async function linkLearnerToUser(userId: string): Promise<string | null> {
  const { DB } = bindings();
  if (!DB) return null;
  let id = (await DB.prepare("SELECT id FROM learners WHERE user_id = ?").bind(userId).first<{ id: string }>())?.id ?? null;
  if (!id) {
    const anon = readLearnerId();
    if (anon) {
      const res = await DB.prepare("UPDATE learners SET user_id = ? WHERE id = ? AND user_id IS NULL").bind(userId, anon).run();
      if ((res.meta?.changes ?? 0) > 0) id = anon;
    }
  }
  if (!id) {
    id = crypto.randomUUID();
    await DB.prepare("INSERT INTO learners (id, user_id) VALUES (?, ?)").bind(id, userId).run();
  }
  const p = await DB.prepare("SELECT grade, curriculum FROM profiles WHERE user_id = ?").bind(userId).first<{ grade: number; curriculum: string }>();
  if (p) await DB.prepare("UPDATE learners SET grade = ?, medium = ?, onboarded = 1 WHERE id = ?").bind(p.grade, mediumFor(p.curriculum), id).run();
  setLearnerCookie(id);
  return id;
}

type LearnerRow = { lang: string; grade: number | null; medium: string | null; style: string; share_teacher: number; share_family: number; onboarded: number };

export function rowToPrefs(r: LearnerRow | null): Prefs {
  if (!r) return DEFAULT_PREFS;
  return {
    lang: r.lang === "bn" ? "bn" : "en",
    grade: r.grade ?? null,
    medium: r.medium === "bangla" || r.medium === "english" ? r.medium : null,
    style: (["visual", "story", "steps", "analogy"].includes(r.style) ? r.style : "visual") as Prefs["style"],
    share_teacher: !!r.share_teacher,
    share_family: !!r.share_family,
    onboarded: !!r.onboarded,
  };
}

export type LoadedState = { hasLearner: boolean; storage: boolean; prefs: Prefs; rows: EvidenceRow[]; account: AccountSummary | null; xp: number | null };

export async function loadState(): Promise<LoadedState> {
  const { DB } = bindings();
  if (!DB) return { hasLearner: false, storage: false, prefs: DEFAULT_PREFS, rows: [], account: null, xp: null };
  let user = null;
  let account: AccountSummary | null = null;
  try {
    user = await currentUser();
    account = user ? await accountSummary(user.id) : null;
  } catch {
    user = null;
  }
  let xp: number | null = null;
  try { xp = user && account ? await totalXp(DB, user.id) : null; } catch { xp = null; }
  const id = await resolveLearner(user && account ? user.id : null);
  if (!id) return { hasLearner: false, storage: true, prefs: DEFAULT_PREFS, rows: [], account, xp };
  const learner = await DB.prepare("SELECT lang, grade, medium, style, share_teacher, share_family, onboarded FROM learners WHERE id = ?").bind(id).first<LearnerRow>();
  if (!learner) return { hasLearner: false, storage: true, prefs: DEFAULT_PREFS, rows: [], account, xp };
  const res = await DB.prepare(
    "SELECT id, concept, kind, item, correct, confidence, misconception, detail, created_at FROM evidence WHERE learner_id = ? ORDER BY id DESC LIMIT 400",
  )
    .bind(id)
    .all<EvidenceRow>();
  return { hasLearner: true, storage: true, prefs: rowToPrefs(learner), rows: (res.results ?? []).reverse(), account, xp };
}

/** Delete learning evidence for the learner this request is allowed to use. The account itself is kept. */
export async function forgetLearner(): Promise<void> {
  const { DB } = bindings();
  const user = await currentUser();
  const id = await resolveLearner(user?.id ?? null);
  if (DB && id) {
    await DB.batch([DB.prepare("DELETE FROM evidence WHERE learner_id = ?").bind(id), DB.prepare("DELETE FROM learners WHERE id = ?").bind(id)]);
  }
  clearLearnerCookie();
}
