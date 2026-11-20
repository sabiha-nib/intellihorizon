// Shared validation. The client uses it for instant feedback; the server re-runs every rule.
import { districtByCode } from "../../content/districts";
import { AVATAR_PRESETS, CURRICULA, GRADES, OTHER_CURRICULA } from "./config";

export type FieldErrors = Partial<Record<string, string>>;

const CONTROL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;

export function normalizeName(raw: string): string {
  return raw.normalize("NFC").trim();
}
export function validateName(raw: string): string | null {
  const v = normalizeName(raw);
  if (!v) return "name_required";
  if ([...v].length > 80) return "name_too_long";
  if (CONTROL.test(v)) return "name_invalid";
  // Letters and marks from any script (Bangla included), joiners, spaces and common name punctuation.
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\u200C\u200D .'\u2019\-]*$/u.test(v)) return "name_invalid";
  return null;
}

const RESERVED = new Set([
  "admin", "administrator", "root", "support", "help", "educerro", "moderator", "mod", "staff", "teacher", "system", "null",
  "undefined", "official", "security", "api", "www", "mail", "owner", "account", "accounts", "signin", "signup", "login",
  "logout", "privacy", "settings", "anonymous", "guest", "nctb", "rumi", "ihjudge", "judge",
]);
// Blocked substrings, stored ROT13-encoded so offensive words do not appear in plain source.
const BLOCKED = ["shpx", "fuvg", "ovgpu", "phag", "fyhg", "juber", "cbea", "anmv", "encr", "qvpx", "chffl", "avttre", "snttbg", "onfgneq", "nffubyr"].map((w) => w.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97)));

export function normalizeUsername(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}
export function validateUsername(raw: string): string | null {
  const v = normalizeUsername(raw);
  if (!v) return "username_required";
  if (v.length < 3) return "username_too_short";
  if (v.length > 20) return "username_too_long";
  if (!/^[a-z][a-z0-9_.]*$/.test(v) || v.endsWith(".") || v.includes("..")) return "username_format";
  if (RESERVED.has(v.replace(/[_.]/g, ""))) return "username_reserved";
  if (v.startsWith("demo_") || v.startsWith("demo.")) return "username_reserved"; // judge-demo workspaces
  const flat = v.replace(/[_.0-9]/g, "");
  if (BLOCKED.some((b) => flat.includes(b))) return "username_inappropriate";
  return null;
}

export function normalizeEmail(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}
export function validateEmail(raw: string): string | null {
  const v = normalizeEmail(raw);
  if (!v) return "email_required";
  if (v.length > 254) return "email_invalid";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "email_invalid";
  return null;
}

const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789", "1234567890", "0123456789", "11111111", "00000000",
  "87654321", "12341234", "11223344", "qwerty123", "qwertyuiop", "asdfghjkl", "zxcvbnm1", "1q2w3e4r", "1qaz2wsx", "abcd1234",
  "iloveyou", "iloveyou1", "letmein1", "welcome1", "football", "sunshine", "princess", "admin123", "monkey12", "dragon12",
  "baseball", "superman", "trustno1", "aaaaaaaa", "pass1234", "loveyou1", "bangladesh", "bangladesh1", "dhaka123", "dhaka1234",
  "educerro", "educerro1", "student1", "student123", "school123", "computer", "internet", "whatever", "starwars", "pokemon1",
]);

export function passwordLength(p: string): number {
  return [...p].length;
}
export function validatePassword(p: string, ctx: { email?: string; username?: string } = {}): string | null {
  if (!p) return "password_required";
  const n = passwordLength(p);
  if (n < 8) return "password_too_short";
  if (n > 128) return "password_too_long";
  const low = p.toLowerCase();
  if (COMMON.has(low)) return "password_common";
  if (/^(.)\1+$/.test(p)) return "password_common";
  const local = ctx.email ? normalizeEmail(ctx.email).split("@")[0] : "";
  const user = ctx.username ? normalizeUsername(ctx.username) : "";
  if ((local && local.length >= 3 && low.includes(local)) || (user && user.length >= 3 && low.includes(user))) return "password_personal";
  return null;
}

/** 0 to 4. Guidance only; the hard rules are in validatePassword. */
export function passwordStrength(p: string): number {
  if (!p) return 0;
  if (COMMON.has(p.toLowerCase())) return 0;
  const n = passwordLength(p);
  let classes = 0;
  if (/[a-z]/.test(p)) classes++;
  if (/[A-Z]/.test(p)) classes++;
  if (/[0-9]/.test(p)) classes++;
  if (/[^A-Za-z0-9]/.test(p)) classes++;
  let s = n >= 16 ? 3 : n >= 12 ? 2 : n >= 8 ? 1 : 0;
  if (classes >= 3 && n >= 10) s++;
  if (/(.)\1{2,}/.test(p) || /(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(p)) s--;
  return Math.max(0, Math.min(4, s));
}

export type ProfileInput = {
  school: string;
  country: "BD" | "OTHER";
  district: string;
  region: string;
  grade: number | null;
  curriculum: string;
  curriculumOther: string;
  curriculumOtherText: string;
};

export function validateProfile(p: ProfileInput): FieldErrors {
  const e: FieldErrors = {};
  const school = p.school.normalize("NFC").trim();
  if ([...school].length > 120) e.school = "school_too_long";
  else if (CONTROL.test(school)) e.school = "school_invalid";
  if (p.country !== "BD" && p.country !== "OTHER") e.country = "country_invalid";
  if (p.country === "BD" && !districtByCode(p.district)) e.district = p.district ? "district_invalid" : "district_required";
  if (p.country === "OTHER") {
    const r = p.region.normalize("NFC").trim();
    if ([...r].length > 80 || CONTROL.test(r)) e.region = "region_invalid";
  }
  if (!GRADES.some((g) => g.value === p.grade)) e.grade = p.grade == null ? "grade_required" : "grade_invalid";
  if (!CURRICULA.some((c) => c.id === p.curriculum)) e.curriculum = p.curriculum ? "curriculum_invalid" : "curriculum_required";
  if (p.curriculum === "other") {
    if (!OTHER_CURRICULA.some((c) => c.id === p.curriculumOther)) e.curriculumOther = "curriculum_other_required";
    else if (p.curriculumOther === "other") {
      const t = p.curriculumOtherText.normalize("NFC").trim();
      if (!t) e.curriculumOtherText = "curriculum_text_required";
      else if ([...t].length > 60 || CONTROL.test(t)) e.curriculumOtherText = "curriculum_text_invalid";
    }
  }
  return e;
}

export function isAvatarPreset(v: unknown): v is (typeof AVATAR_PRESETS)[number] {
  return typeof v === "string" && (AVATAR_PRESETS as readonly string[]).includes(v);
}

/** Only allow same-site relative paths for post-login redirects. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  if (/^\/(signin|signup|login|reset-password|forgot-password)/.test(next)) return "/dashboard";
  return next.slice(0, 200);
}
