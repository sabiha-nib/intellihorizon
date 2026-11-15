// Canonical curriculum registry: the single source of truth for which subjects IntelliHorizon supports.
//
// Source of the list: the nine Class 7 NCTB textbook PDFs the owner supplied (2026 academic year, Bangla medium).
// Exactly eight subjects. "Soptoborna" (সপ্তবর্ণা) and "Anandapath" (আনন্দপাঠ) are two separate books that both
// belong to the one subject Bangla 1st Paper; neither is a subject of its own.
//
// Four ideas are kept apart on purpose:
//   - interface language   (en | bn)        what the buttons say; a viewer preference
//   - explanation language (en | bn)        what language the tutor frames answers in; a profile preference
//   - curriculum / medium  (nctb · bangla | english)  which official book set a student follows
//   - source language      (bn | en)        the language a given textbook is printed in
// A Bangla-medium student studies English 1st Paper from an English-language book; an English-version student
// would study the same canonical subjects from English-version books (none supplied yet; see OFFERINGS).
//
// Book and chapter data below was read from the supplied PDFs (title pages and tables of contents) and is
// mirrored into the database by migrations/0006_grade7_registry.sql. tests/registry.unit.test.ts keeps them in sync.
import type { L } from "../../content/types";
import BOOK_DATA from "./data/grade7-books.json";

export const SUBJECT_IDS = ["bangla-1st", "bangla-2nd", "english-1st", "english-2nd", "mathematics", "science", "bgs", "ict"] as const;
export type SubjectId = (typeof SUBJECT_IDS)[number];
export type Medium = "bangla" | "english";

export type Subject = {
  id: SubjectId;
  position: number;
  label: L;
  short: L;
  /** Words a student might use to name this subject in a question (lower-case, NFC). */
  aliases: string[];
  hue: string;
};

export const SUBJECTS: readonly Subject[] = [
  { id: "bangla-1st", position: 1, label: { en: "Bangla 1st Paper", bn: "বাংলা প্রথম পত্র" }, short: { en: "Bangla 1st", bn: "বাংলা ১ম" }, aliases: ["bangla 1st paper", "bangla first paper", "বাংলা প্রথম পত্র", "বাংলা ১ম পত্র", "বাংলা ১ম", "bangla 1st", "bangla sahitya", "বাংলা সাহিত্য"], hue: "#C8553D" },
  { id: "bangla-2nd", position: 2, label: { en: "Bangla 2nd Paper", bn: "বাংলা দ্বিতীয় পত্র" }, short: { en: "Bangla 2nd", bn: "বাংলা ২য়" }, aliases: ["bangla 2nd paper", "bangla second paper", "বাংলা দ্বিতীয় পত্র", "বাংলা ২য় পত্র", "বাংলা ২য়", "bangla 2nd", "bangla grammar", "বাংলা ব্যাকরণ"], hue: "#A23B72" },
  { id: "english-1st", position: 3, label: { en: "English 1st Paper", bn: "ইংরেজি প্রথম পত্র" }, short: { en: "English 1st", bn: "ইংরেজি ১ম" }, aliases: ["english 1st paper", "english first paper", "ইংরেজি প্রথম পত্র", "ইংরেজি ১ম পত্র", "english 1st", "english for today"], hue: "#2E86AB" },
  { id: "english-2nd", position: 4, label: { en: "English 2nd Paper", bn: "ইংরেজি দ্বিতীয় পত্র" }, short: { en: "English 2nd", bn: "ইংরেজি ২য়" }, aliases: ["english 2nd paper", "english second paper", "ইংরেজি দ্বিতীয় পত্র", "ইংরেজি ২য় পত্র", "english 2nd", "english grammar"], hue: "#3B5BA5" },
  { id: "mathematics", position: 5, label: { en: "Mathematics", bn: "গণিত" }, short: { en: "Math", bn: "গণিত" }, aliases: ["mathematics", "math", "maths", "গণিত", "অংক", "অঙ্ক"], hue: "#E09F3E" },
  { id: "science", position: 6, label: { en: "Science", bn: "বিজ্ঞান" }, short: { en: "Science", bn: "বিজ্ঞান" }, aliases: ["science", "বিজ্ঞান", "general science", "সাধারণ বিজ্ঞান"], hue: "#3A7D44" },
  { id: "bgs", position: 7, label: { en: "Bangladesh and Global Studies", bn: "বাংলাদেশ ও বিশ্বপরিচয়" }, short: { en: "BGS", bn: "বিশ্বপরিচয়" }, aliases: ["bangladesh and global studies", "bangladesh & global studies", "global studies", "bgs", "বাংলাদেশ ও বিশ্বপরিচয়", "বিশ্বপরিচয়"], hue: "#7A5C3E" },
  { id: "ict", position: 8, label: { en: "Information and Communication Technology", bn: "তথ্য ও যোগাযোগ প্রযুক্তি" }, short: { en: "ICT", bn: "আইসিটি" }, aliases: ["ict", "information and communication technology", "আইসিটি", "তথ্য ও যোগাযোগ প্রযুক্তি", "তথ্য প্রযুক্তি"], hue: "#5B5F97" },
];

export type OfferingStatus = "books_supplied" | "books_not_supplied";
export type Offering = { grade: number; medium: Medium; status: OfferingStatus; note: L };

/** Where the eight subjects are offered. Only Class 7 is supported in this phase. */
export const OFFERINGS: readonly Offering[] = [
  { grade: 7, medium: "bangla", status: "books_supplied", note: { en: "All nine Class 7 Bangla-medium textbooks were supplied by the owner.", bn: "৭ম শ্রেণির বাংলা মাধ্যমের নয়টি পাঠ্যবই-ই মালিক দিয়েছেন।" } },
  { grade: 7, medium: "english", status: "books_not_supplied", note: { en: "Same eight subjects. The English-version textbooks have not been supplied yet, so there is no English-version book text to learn from.", bn: "একই আটটি বিষয়। ইংলিশ ভার্সনের পাঠ্যবই এখনো দেওয়া হয়নি, তাই ইংলিশ ভার্সনের বইয়ের লেখা থেকে শেখার সুযোগ এখনো নেই।" } },
];
export const SUPPORTED_GRADES = [...new Set(OFFERINGS.map((o) => o.grade))];

export type RegistryChapter = { id: string; position: number; label: string | null; title: string; printedStart: number; printedEnd: number };
export type RegistryBook = {
  id: string; key: string; subjectId: SubjectId; grade: number; medium: Medium; title: string; titleLatin: string; language: "bn" | "en";
  pdfPages: number; pageOffset: number; edition: string; aliases: string[]; chapters: RegistryChapter[];
};
export const BOOKS: readonly RegistryBook[] = BOOK_DATA as RegistryBook[];

export const isSubjectId = (s: unknown): s is SubjectId => typeof s === "string" && (SUBJECT_IDS as readonly string[]).includes(s);
export const subjectById = (id: string): Subject | null => SUBJECTS.find((s) => s.id === id) ?? null;
export const offeringFor = (grade: number | null, medium: Medium | null): Offering | null =>
  grade === null || medium === null ? null : OFFERINGS.find((o) => o.grade === grade && o.medium === medium) ?? null;
export const booksFor = (subjectId: SubjectId, grade: number, medium: Medium) => BOOKS.filter((b) => b.subjectId === subjectId && b.grade === grade && b.medium === medium);
export const bookById = (id: string) => BOOKS.find((b) => b.id === id) ?? null;

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ");

/** Book named by its distinctive title ("in Anandapath …", "সপ্তবর্ণা বইয়ে …"). Single-book subjects have no aliases: naming the subject is enough. Null when none or ambiguous. */
export function detectBook(question: string, grade: number, medium: Medium): RegistryBook | null {
  const q = norm(question);
  const hits = BOOKS.filter((b) => b.grade === grade && b.medium === medium)
    .map((b) => ({ b, len: Math.max(0, ...b.aliases.filter((a) => q.includes(norm(a))).map((a) => a.length)) }))
    .filter((x) => x.len > 0);
  if (hits.length !== 1) return null;
  return hits[0].b;
}

/** Subject named in a question. Returns null when no subject or more than one subject is named. */
export function detectSubject(question: string): SubjectId | null {
  const q = norm(stripUnsupported(question));
  const hits = SUBJECTS.map((s) => ({ s, len: Math.max(0, ...s.aliases.filter((a) => aliasIn(q, norm(a))).map((a) => a.length)) })).filter((x) => x.len > 0);
  if (!hits.length) return null;
  hits.sort((a, b) => b.len - a.len);
  // "bangla 1st paper" also contains no other alias; "english grammar" vs "english 1st" are disjoint. Ambiguity = two different subjects of equal strength.
  if (hits.length > 1 && hits[0].len === hits[1].len) return null;
  return hits[0].s.id;
}

const esc = (a: string) => a.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");
/** Latin aliases must match whole words ("ict" must not match "dictionary"). Bangla aliases must start a word
 *  ("বিজ্ঞান" must not match "হিসাববিজ্ঞান") but may carry a case ending ("বিজ্ঞানের"). */
function aliasIn(q: string, a: string): boolean {
  if (/[a-z]/.test(a)) return new RegExp(`(^|[^a-z])${esc(a)}($|[^a-z])`).test(q);
  return new RegExp(`(^|[^\\u0980-\\u09FF])${esc(a)}`).test(q);
}

/** Subjects a student may name that are outside the eight. Used only to answer politely, never to filter content. */
const UNSUPPORTED: { pattern: RegExp; label: L }[] = [
  { pattern: /(religio|islam(ic)? studies|hindu ?dharma|christian religion|buddhist religion|ধর্ম ও নৈতিক|ইসলাম ও নৈতিক|হিন্দুধর্ম|বৌদ্ধধর্ম|খ্রিষ্টধর্ম|খ্রিস্টধর্ম|ধর্ম শিক্ষা|ধর্মশিক্ষা)/i, label: { en: "Religion and Moral Education", bn: "ধর্ম ও নৈতিক শিক্ষা" } },
  { pattern: /(agricultur|কৃষিশিক্ষা|কৃষি শিক্ষা)/i, label: { en: "Agriculture Studies", bn: "কৃষিশিক্ষা" } },
  { pattern: /(home science|গার্হস্থ্য)/i, label: { en: "Home Science", bn: "গার্হস্থ্য বিজ্ঞান" } },
  { pattern: /(physical education|শারীরিক শিক্ষা)/i, label: { en: "Physical Education", bn: "শারীরিক শিক্ষা" } },
  { pattern: /(arts? and crafts|চারু ও কারুকলা|শিল্প ও সংস্কৃতি)/i, label: { en: "Arts", bn: "চারু ও কারুকলা / শিল্প ও সংস্কৃতি" } },
  { pattern: /(work and life|কর্ম ও জীবনমুখী|জীবন ও জীবিকা)/i, label: { en: "Work and Life Oriented Education", bn: "কর্ম ও জীবনমুখী শিক্ষা" } },
  { pattern: /(higher math|উচ্চতর গণিত)/i, label: { en: "Higher Mathematics", bn: "উচ্চতর গণিত" } },
  { pattern: /(accounting|হিসাববিজ্ঞান|finance and banking|ফিন্যান্স|business entrepreneurship|ব্যবসায় উদ্যোগ)/i, label: { en: "Business studies", bn: "ব্যবসায় শিক্ষা" } },
  { pattern: /(\barabic\b|আরবি|sanskrit|সংস্কৃত|\bpali\b|পালি)/i, label: { en: "Arabic, Sanskrit or Pali", bn: "আরবি, সংস্কৃত বা পালি" } },
  { pattern: /(digital technology|ডিজিটাল প্রযুক্তি|history and social science|ইতিহাস ও সামাজিক বিজ্ঞান|স্বাস্থ্য সুরক্ষা)/i, label: { en: "a subject from the 2023-24 curriculum", bn: "২০২৩-২৪ পাঠ্যক্রমের একটি বিষয়" } },
];

function stripUnsupported(question: string): string {
  let q = question.normalize("NFC");
  for (const u of UNSUPPORTED) q = q.replace(new RegExp(u.pattern.source, "gi"), " ");
  return q;
}

/** An out-of-scope subject the question explicitly names, if it names none of the eight. */
export function detectUnsupportedSubject(question: string): L | null {
  if (detectSubject(question)) return null;
  const q = question.normalize("NFC");
  return UNSUPPORTED.find((u) => u.pattern.test(q))?.label ?? null;
}

/** Remove a book's or subject's own name from a question before searching: it says where to look, not what to find. */
export function stripScopeNames(question: string, opts: { bookId?: string | null; subjectId?: string | null }): string {
  let q = question.normalize("NFC");
  const names = [...(opts.bookId ? bookById(opts.bookId)?.aliases ?? [] : []), ...(opts.subjectId ? subjectById(opts.subjectId)?.aliases ?? [] : [])].sort((a, b) => b.length - a.length);
  for (const n of names) q = q.replace(new RegExp(esc(n.normalize("NFC")), "gi"), " ");
  return q;
}

/** Printed page (as on the book's pages) -> PDF page, using the book's verified offset. */
export const pdfPageFor = (b: RegistryBook, printed: number) => printed + b.pageOffset;
