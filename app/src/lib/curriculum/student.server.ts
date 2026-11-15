import type { D1Database } from "@cloudflare/workers-types";

import { ACTIVE_VERSION, mediumForCurriculum } from "./config";
import { BOOKS, SUBJECTS } from "./registry";

export type StudentContext = { grade: number | null; medium: "bangla" | "english" | null; curriculum: string | null; explainLang: "en" | "bn"; fullName: string };

export async function studentContext(DB: D1Database, userId: string): Promise<StudentContext> {
  const p = await DB.prepare("SELECT p.grade, p.curriculum, p.explain_lang, p.full_name, l.lang FROM profiles p LEFT JOIN learners l ON l.user_id = p.user_id WHERE p.user_id = ?")
    .bind(userId).first<{ grade: number; curriculum: string; explain_lang: string | null; full_name: string; lang: string | null }>();
  return {
    grade: p?.grade ?? null,
    medium: mediumForCurriculum(p?.curriculum),
    curriculum: p?.curriculum ?? null,
    explainLang: (p?.explain_lang ?? p?.lang) === "bn" ? "bn" : "en",
    fullName: p?.full_name ?? "",
  };
}

export type CatalogBook = {
  id: string; grade: number; medium: "bangla" | "english"; subject_key: string; subject_name: string; paper: string; title: string; language: "bn" | "en";
  edition: string | null; official_url: string | null; license_status: string; status: string; page_count: number | null; chapters: number; questions: number;
};

export async function catalog(DB: D1Database, grade: number, medium: "bangla" | "english"): Promise<CatalogBook[]> {
  const r = await DB.prepare(
    `SELECT t.id, t.grade, t.medium, t.subject_key, t.subject_name, t.paper, t.title, t.language, t.edition, t.official_url, t.license_status, t.status, t.page_count,
            (SELECT COUNT(*) FROM chapters c WHERE c.textbook_id = t.id) AS chapters,
            (SELECT COUNT(*) FROM questions q JOIN chapters c ON c.id = q.chapter_id WHERE c.textbook_id = t.id AND q.status = 'published') AS questions
       FROM textbooks t WHERE t.version_id = ? AND t.grade = ? AND t.medium = ? AND t.status != 'retired' ORDER BY t.subject_key, t.paper`,
  ).bind(ACTIVE_VERSION, grade, medium).all<CatalogBook>();
  // Registry order: subjects as listed, and within Bangla 1st Paper, Soptoborna before Anandapath.
  const rank = (b: CatalogBook) => {
    const s = SUBJECTS.findIndex((x) => x.id === b.subject_key);
    const k = BOOKS.findIndex((x) => x.id === b.id);
    return (s < 0 ? 99 : s) * 100 + (k < 0 ? 99 : k);
  };
  return (r.results ?? []).sort((a, b) => rank(a) - rank(b));
}

export function isoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(d);
}
/** The client sends its local date; accept it only if it is within a day of the server's date. */
export function clientToday(s: string): string {
  const now = Date.now();
  if (isoDate(s) && Math.abs(Date.parse(s + "T12:00:00Z") - now) <= 36 * 3600 * 1000) return s;
  return new Date(now).toISOString().slice(0, 10);
}
