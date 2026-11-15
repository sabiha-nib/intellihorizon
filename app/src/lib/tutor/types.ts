// Tutor payloads are built from database records. The optional `ai` part is model-written explanation that has been
// validated against the retrieved records (see lib/ai/grounding.ts); everything else is copied from records.
import type { AiExplanation } from "../ai/grounding";
export type SourceRef = {
  passageId: number;
  textbookId: string;
  title: string;
  publisher: string;
  subjectKey: string;
  subjectName: string;
  paper: string;
  grade: number;
  medium: "bangla" | "english";
  language: "bn" | "en";
  edition: string | null;
  chapter: { id: string; position: number; label: string | null; title: string } | null;
  pdfPage: number;
  printedPage: number | null;
  officialUrl: string | null;
  license: "permission_pending" | "permitted" | "restricted";
  /** How the page text was obtained. OCR text can contain misread letters; the UI says so. Optional for messages saved before this field existed. */
  extraction?: "ocr" | "text" | "checked" | "teacher_reviewed";
  ocrConfidence?: number | null;
};

export type Excerpt = { text: string; source: SourceRef };

export type TutorStatus =
  | "grounded" | "partial" | "not_found" | "needs_context" | "calculation" | "explain_check" | "no_books"
  /** The question names a subject outside the eight supported subjects. */
  | "unsupported_subject"
  /** The question names a subject or book that differs from the subject the student selected. */
  | "subject_conflict"
  /** No subject was chosen and the best matches come from more than one subject: the tutor asks which one. */
  | "ambiguous";

/** How the tutor decided which subject (and book) to search. */
export type SubjectResolution = {
  subjectId: string | null;
  from: "selected" | "book" | "question" | "thread" | null;
  book: { id: string; title: string; key: string } | null;
};

export type TutorPayload = {
  status: TutorStatus;
  intent: "define" | "why" | "how" | "compare" | "example" | "general";
  terms: string[];
  excerpts: Excerpt[];
  keyTerms: string[];
  scope: { grade: number | null; medium: "bangla" | "english" | null; textbookId: string | null; chapterId: string | null; booksInScope: number; subjectKey?: string | null };
  subject?: SubjectResolution;
  /** Offering for the student's class and version, so "no books" can say why. */
  offering?: { grade: number; medium: "bangla" | "english"; status: "books_supplied" | "books_not_supplied" } | null;
  unsupported?: { en: string; bn: string };
  conflict?: { selected: string; named: string; bookId: string | null };
  calc?: { expression: string; decimal: string; fraction: string | null } | { expression: string; error: string };
  practice?: { chapterId: string; chapterTitle: string; count: number } | null;
  lesson?: { route: "/learn/fall" | "/learn/share" | "/learn/tree"; key: "fall" | "share" | "tree" } | null;
  check?: { covered: string[]; missing: string[]; forMessageId: number };
  /** Subjects to choose from when the question is ambiguous. */
  choices?: { subjectId: string; name: string }[];
  /** Validated AI explanation, when configured. Absent on messages saved before it existed. */
  ai?: AiExplanation;
  /** How this answer was taught: the persona, any "ask differently" style, and the verified extras attached for it. */
  teach?: {
    persona: string;
    style: string | null;
    lang: "en" | "bn" | null;
    guide?: { en: string; bn: string }[];
    steps?: { pages: string; steps: { en: string; bn: string }[]; chapterId: string } | null;
    challenge?: { chapterId: string; count: number } | null;
    exam?: { chapterId: string; objectives: { text: string; printedPage: number | null }[]; exercises: number } | null;
  };
};

export type TutorMessage = { id: number; role: "student" | "tutor"; text: string; payload: TutorPayload | null; feedback: number | null; createdAt: string };
export type ThreadSummary = { id: string; title: string; updatedAt: string; textbookId: string | null; chapterId: string | null; contextLabel: string | null; subjectKey: string | null };
