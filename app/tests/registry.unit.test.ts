import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { SUBJECT_KEYS } from "../src/lib/curriculum/config";
import { BOOKS, OFFERINGS, SUBJECTS, SUBJECT_IDS, booksFor, detectBook, detectSubject, detectUnsupportedSubject, isSubjectId, offeringFor, stripScopeNames } from "../src/lib/curriculum/registry";
import { queryTerms } from "../src/lib/curriculum/text";
import { resolveQuestionScope } from "../src/lib/curriculum/subject-scope.server";
import { OCR_MIN_CONFIDENCE, classifyOcrPage, indexable } from "../src/lib/curriculum/text";

const migration = readFileSync(new URL("../migrations/0006_grade7_registry.sql", import.meta.url), "utf8");

describe("canonical subject registry", () => {
  test("exactly the eight owner-supplied subjects, unique ids, both languages", () => {
    expect(SUBJECTS.map((s) => s.id)).toEqual(["bangla-1st", "bangla-2nd", "english-1st", "english-2nd", "mathematics", "science", "bgs", "ict"]);
    expect([...SUBJECT_IDS]).toEqual(SUBJECTS.map((s) => s.id));
    expect(new Set(SUBJECTS.map((s) => s.id)).size).toBe(8);
    expect(SUBJECTS.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const s of SUBJECTS) { expect(s.label.en.length).toBeGreaterThan(1); expect(/[ঀ-৿]/.test(s.label.bn)).toBe(true); }
    expect(SUBJECTS.map((s) => s.label.en)).toEqual(["Bangla 1st Paper", "Bangla 2nd Paper", "English 1st Paper", "English 2nd Paper", "Mathematics", "Science", "Bangladesh and Global Studies", "Information and Communication Technology"]);
  });
  test("the only other subject list in the app is derived from the registry", () => {
    expect(SUBJECT_KEYS.map((s) => s.key)).toEqual(SUBJECTS.map((s) => s.id));
  });
  test("no Soptoborna or Anandapath subject exists", () => {
    expect(SUBJECTS.some((s) => /sopto|ananda|সপ্তবর্ণা|আনন্দপাঠ/i.test(`${s.id} ${s.label.en} ${s.label.bn}`))).toBe(false);
    expect(isSubjectId("soptoborna")).toBe(false);
    expect(isSubjectId("anandapath")).toBe(false);
    expect(isSubjectId("religion")).toBe(false);
  });
  test("Bangla 1st Paper has exactly two books: Soptoborna and Anandapath, each keeping its own identity", () => {
    const b1 = booksFor("bangla-1st", 7, "bangla");
    expect(b1.map((b) => b.key).sort()).toEqual(["anandapath", "soptoborna"]);
    const [a, s] = [b1.find((b) => b.key === "anandapath")!, b1.find((b) => b.key === "soptoborna")!];
    expect(a.title).toBe("আনন্দপাঠ");
    expect(s.title).toBe("সপ্তবর্ণা");
    expect(a.id).not.toBe(s.id);
    expect(s.chapters.length).toBe(18);
    expect(a.chapters.length).toBe(9);
    expect(s.pdfPages).toBe(102);
    expect(a.pdfPages).toBe(70);
  });
  test("every other subject has exactly one book; nine books in all", () => {
    expect(BOOKS.length).toBe(9);
    for (const s of SUBJECTS.filter((x) => x.id !== "bangla-1st")) expect(booksFor(s.id, 7, "bangla").length).toBe(1);
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(9);
    expect(new Set(BOOKS.map((b) => b.key)).size).toBe(9);
  });
  test("chapters are ordered, non-overlapping and inside each book", () => {
    let n = 0;
    const ids = new Set<string>();
    for (const b of BOOKS) {
      let prevEnd = 0;
      b.chapters.forEach((c, i) => {
        expect(c.position).toBe(i + 1);
        expect(c.printedStart).toBeGreaterThan(prevEnd);
        expect(c.printedEnd).toBeGreaterThanOrEqual(c.printedStart);
        expect(c.printedEnd + b.pageOffset).toBeLessThanOrEqual(b.pdfPages);
        prevEnd = c.printedEnd;
        ids.add(c.id);
        n++;
      });
    }
    expect(n).toBe(110);
    expect(ids.size).toBe(110);
  });
  test("offerings: Class 7 Bangla medium has books; English version is registered honestly without books", () => {
    expect(OFFERINGS.length).toBe(2);
    expect(offeringFor(7, "bangla")?.status).toBe("books_supplied");
    expect(offeringFor(7, "english")?.status).toBe("books_not_supplied");
    expect(offeringFor(8, "bangla")).toBeNull();
    expect(BOOKS.every((b) => b.medium === "bangla" && b.grade === 7)).toBe(true);
  });
  test("source language is separate from medium: English papers are printed in English in the Bangla-medium set", () => {
    expect(booksFor("english-1st", 7, "bangla")[0].language).toBe("en");
    expect(booksFor("english-2nd", 7, "bangla")[0].language).toBe("en");
    expect(booksFor("science", 7, "bangla")[0].language).toBe("bn");
  });
});

describe("migration mirrors the registry", () => {
  test("seeds 8 subjects, 16 offerings, 9 books and 110 chapters", () => {
    expect((migration.match(/INSERT OR IGNORE INTO subjects /g) ?? []).length).toBe(8);
    expect((migration.match(/INSERT OR IGNORE INTO subject_offerings /g) ?? []).length).toBe(16);
    expect((migration.match(/INSERT OR IGNORE INTO textbooks /g) ?? []).length).toBe(9);
    expect((migration.match(/INSERT OR IGNORE INTO chapters /g) ?? []).length).toBe(110);
  });
  test("every registry book and chapter id is in the migration with PDF page ranges", () => {
    for (const b of BOOKS) {
      expect(migration).toContain(`'${b.id}', 'nctb-2026', 7, 'bangla', '${b.subjectId}'`);
      for (const c of b.chapters) expect(migration).toContain(`'${c.id}', '${b.id}', ${c.position}, `);
      const first = b.chapters[0];
      expect(migration).toContain(`${first.printedStart + b.pageOffset}, ${first.printedEnd + b.pageOffset}, '2026`);
    }
  });
  test("is additive and guards subjects at the database level", () => {
    expect(/DROP TABLE|DELETE FROM|DROP COLUMN/i.test(migration)).toBe(false);
    expect(migration).toContain("RAISE(ABORT, 'subject_not_in_registry')");
  });
});

describe("subject and book detection", () => {
  test("names of the eight subjects", () => {
    expect(detectSubject("Explain this from Bangla 1st Paper")).toBe("bangla-1st");
    expect(detectSubject("বাংলা দ্বিতীয় পত্রের সন্ধি")).toBe("bangla-2nd");
    expect(detectSubject("english 2nd paper voice change")).toBe("english-2nd");
    expect(detectSubject("বিজ্ঞানের শ্বসন অধ্যায়")).toBe("science");
    expect(detectSubject("গণিতে ভগ্নাংশ")).toBe("mathematics");
    expect(detectSubject("BGS chapter 4")).toBe("bgs");
    expect(detectSubject("আইসিটি ওয়ার্ড প্রসেসিং")).toBe("ict");
  });
  test("no false matches inside other words, and ambiguity gives no subject", () => {
    expect(detectSubject("dictionary meaning of kite")).toBeNull();
    expect(detectSubject("হিসাববিজ্ঞান কী")).toBeNull();
    expect(detectSubject("english 1st paper or english 2nd paper?")).toBeNull();
    expect(detectSubject("what is a cell")).toBeNull();
  });
  test("book titles, in Bangla and Latin script", () => {
    expect(detectBook("আনন্দপাঠ বইয়ের জিদ গল্পের মূলভাব কী?", 7, "bangla")?.key).toBe("anandapath");
    expect(detectBook("In Soptoborna, who is Mini?", 7, "bangla")?.key).toBe("soptoborna");
    expect(detectBook("English For Today unit 3", 7, "bangla")?.key).toBe("english1");
    expect(detectBook("photosynthesis", 7, "bangla")).toBeNull();
    expect(detectBook("সপ্তবর্ণা আর আনন্দপাঠ", 7, "bangla")).toBeNull();
    expect(detectBook("আনন্দপাঠ", 7, "english")).toBeNull();
  });
  test("subjects outside the eight are recognised so the tutor can decline politely", () => {
    expect(detectUnsupportedSubject("ইসলাম ও নৈতিক শিক্ষা বইয়ের প্রশ্ন")?.en).toBe("Religion and Moral Education");
    expect(detectUnsupportedSubject("হিসাববিজ্ঞান কী")?.en).toBe("Business studies");
    expect(detectUnsupportedSubject("agriculture studies chapter 2")?.en).toBe("Agriculture Studies");
    expect(detectUnsupportedSubject("What is photosynthesis?")).toBeNull();
    expect(detectUnsupportedSubject("ধর্ম মানে কী? কাবুলিওয়ালা গল্পে")).toBeNull();
  });
});

describe("question scope resolution", () => {
  const me = { grade: 7, medium: "bangla" as const };
  const none = { subjectId: null, textbookId: null, chapterId: null };
  const anandapath = BOOKS.find((b) => b.key === "anandapath")!;
  const soptoborna = BOOKS.find((b) => b.key === "soptoborna")!;
  test("a named book narrows the search to that book", () => {
    const r = resolveQuestionScope("আনন্দপাঠ বইয়ের জিদ গল্পে কী আছে?", me, none);
    expect(r.kind).toBe("scope");
    if (r.kind === "scope") { expect(r.ctx.textbookId).toBe(anandapath.id); expect(r.ctx.subjectId).toBe("bangla-1st"); expect(r.from).toBe("book"); }
  });
  test("a named book inside the selected subject narrows within it", () => {
    const r = resolveQuestionScope("Anandapath: King Lear", me, { subjectId: "bangla-1st", textbookId: null, chapterId: null });
    expect(r.kind === "scope" && r.ctx.textbookId === anandapath.id && r.from === "selected").toBe(true);
  });
  test("a book from another subject, or the other Bangla 1st book, is a conflict, never a silent switch", () => {
    expect(resolveQuestionScope("আনন্দপাঠ বইয়ের প্রশ্ন", me, { subjectId: "science", textbookId: null, chapterId: null }).kind).toBe("conflict");
    expect(resolveQuestionScope("আনন্দপাঠ বইয়ের প্রশ্ন", me, { subjectId: "bangla-1st", textbookId: soptoborna.id, chapterId: null }).kind).toBe("conflict");
  });
  test("a named subject is used only when none is selected; otherwise the selection holds", () => {
    const a = resolveQuestionScope("গণিতে লাভ-ক্ষতি কী?", me, none);
    expect(a.kind === "scope" && a.ctx.subjectId === "mathematics" && a.from === "question").toBe(true);
    const b = resolveQuestionScope("science: what is energy", me, { subjectId: "mathematics", textbookId: null, chapterId: null });
    expect(b.kind === "scope" && b.ctx.subjectId === "mathematics" && b.mentioned === "science").toBe(true);
  });
  test("an unsupported subject is declined even with a subject selected", () => {
    expect(resolveQuestionScope("Explain agriculture studies chapter 2", me, { subjectId: "science", textbookId: null, chapterId: null }).kind).toBe("unsupported");
  });
});

describe("search words", () => {
  test("a named book or subject is not itself a search word, nor are question words", () => {
    const anandapath = BOOKS.find((b) => b.key === "anandapath")!;
    expect(queryTerms(stripScopeNames("আনন্দপাঠ বইয়ে মিনি কে?", { bookId: anandapath.id }))).toEqual(["মিনি"]);
    expect(queryTerms(stripScopeNames("গণিতে লাভ-ক্ষতি কী?", { subjectId: "mathematics" }))).toEqual(["লাভ", "ক্ষতি"]);
    expect(queryTerms("Who is Mini in this chapter?")).toEqual(["mini"]);
  });
});

describe("OCR page quality", () => {
  const text = "কাবুলিওয়ালার সহিত মিনির যেদিন প্রথম সাক্ষাৎ হইয়াছিল, আমার সেই দিনের কথা মনে পড়িল। মনটা কেমন ব্যথিত হইয়া উঠিল। ".repeat(2);
  test("confident pages are indexed; very low confidence is held back", () => {
    expect(classifyOcrPage(text, 91).quality).toBe("ok");
    expect(indexable(classifyOcrPage(text, OCR_MIN_CONFIDENCE - 1).quality)).toBe(false);
    expect(classifyOcrPage("  ", 90).quality).toBe("empty");
    expect(classifyOcrPage("৬৫", 90).quality).toBe("empty");
    expect(classifyOcrPage("ফর্মা-৪, আনন্দপাঠ, ৭ম শ্রেণি", 90).quality).toBe("low_text");
  });
});
