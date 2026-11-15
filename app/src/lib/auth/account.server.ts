import { bindings } from "../bindings.server";
import { emailConfigured } from "./email.server";
import type { AccountSummary } from "./types";

type Row = {
  email: string; email_verified_at: string | null; pending_email: string | null; created_at: string;
  full_name: string; username: string; avatar_key: string | null; avatar_preset: string | null; school: string | null;
  country: string; district: string | null; region: string | null; grade: number; curriculum: string;
  curriculum_other: string | null; curriculum_other_text: string | null; updated_at: string;
  explain_lang: string | null; goals: string | null; role: string | null;
};

export async function accountSummary(userId: string): Promise<AccountSummary | null> {
  const { DB } = bindings();
  if (!DB) return null;
  const r = await DB.prepare(
    `SELECT u.email, u.email_verified_at, u.pending_email, u.created_at, p.full_name, p.username, p.avatar_key, p.avatar_preset, p.school,
            p.country, p.district, p.region, p.grade, p.curriculum, p.curriculum_other, p.curriculum_other_text, p.updated_at, p.explain_lang, p.goals, u.role
       FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ? AND u.status = 'active'`,
  )
    .bind(userId)
    .first<Row>();
  if (!r) return null;
  return {
    fullName: r.full_name,
    username: r.username,
    email: r.email,
    emailVerified: !!r.email_verified_at,
    pendingEmail: r.pending_email,
    avatar: r.avatar_key ? { type: "upload", v: r.avatar_key.slice(-12) } : r.avatar_preset ? { type: "preset", id: r.avatar_preset } : null,
    school: r.school ?? "",
    country: r.country === "OTHER" ? "OTHER" : "BD",
    district: r.district ?? "",
    region: r.region ?? "",
    grade: r.grade,
    curriculum: r.curriculum,
    curriculumOther: r.curriculum_other ?? "",
    curriculumOtherText: r.curriculum_other_text ?? "",
    createdAt: r.created_at,
    emailDelivery: emailConfigured(),
    explainLang: r.explain_lang === "bn" || r.explain_lang === "en" ? r.explain_lang : null,
    goals: (() => { try { const g = JSON.parse(r.goals ?? "[]"); return Array.isArray(g) ? g.filter((x) => typeof x === "string") : []; } catch { return []; } })(),
    role: r.role === "admin" ? "admin" : "student",
  };
}

export function mediumFor(curriculum: string): "bangla" | "english" | null {
  return curriculum === "nctb-bangla" ? "bangla" : curriculum === "nctb-english" ? "english" : null;
}
