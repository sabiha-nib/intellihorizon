import { describe, expect, test } from "bun:test";

import { chunkPage, classifyPage, evalArithmetic, excerpt, gradeAnswer, isArithmetic, joinPdfItems, nextReview, queryTerms, repairBanglaOrder } from "../src/lib/curriculum/text";

describe("page quality", () => {
  test("readable English and Bangla pages are ok", () => {
    const en = "Photosynthesis is the process by which green plants make their own food. ".repeat(3);
    expect(classifyPage(en, "en").quality).toBe("ok");
    const bn = "সবুজ উদ্ভিদ সূর্যালোকের উপস্থিতিতে কার্বন ডাই-অক্সাইড ও পানি থেকে শর্করা তৈরি করে। এই প্রক্রিয়াকে সালোকসংশ্লেষণ বলে। এ সময় অক্সিজেন নির্গত হয়।";
    expect(classifyPage(bn, "bn").quality).toBe("ok");
  });
  test("legacy Bijoy text is flagged in Bangla and English books", () => {
    const legacy = "evsjv‡´k RvZxq wkÿvµg I cvV¨cy¯Íi †evW© Øviv cÖYxZ Ges ivóªxq gyÖYvjq KZ©„K gyw´ªZ wkÿve‡l© cvV¨cy¯ÍK";
    expect(classifyPage(legacy, "bn").quality).toBe("legacy_font");
    expect(classifyPage(legacy, "en").quality).toBe("legacy_font");
  });
  test("unmapped glyphs and blank pages are not indexable", () => {
    expect(classifyPage("সা\u0000লো ক সং\u0000\u0000ষণ সবুজ উদ্ভিদ সূর্যালোকের উপস্থিতিতে কার্বন ডাই-অক্সাইড ও পানি থেকে শর্করা তৈরি করে", "bn").quality).toBe("garbled");
    expect(classifyPage("   \n ", "en").quality).toBe("empty");
  });
});

describe("Bangla visual-order repair", () => {
  test("repairs visual-order pre-base vowel signs", () => {
    const r = repairBanglaOrder("সবুজ গাছ পাতা িদেয় খাবার ৈতির কের। এই কােজ েরাদ লােগ। গাছ বাতাস েথেক বায়ু েনয়।".normalize("NFC"));
    expect(r.repaired).toBe(true);
    expect(r.text).toBe("সবুজ গাছ পাতা দিয়ে খাবার তৈরি করে। এই কাজে রোদ লাগে। গাছ বাতাস থেকে বায়ু নেয়।".normalize("NFC"));
  });
  test("never touches correct logical-order text", () => {
    const good = "সবুজ গাছ পাতা দিয়ে খাবার তৈরি করে। কেক খেতে ভালো লাগে। সে বাড়ি গেল।";
    expect(repairBanglaOrder(good)).toEqual({ text: good, repaired: false });
  });
  test("joins touching pdf items without spurious spaces", () => {
    expect(joinPdfItems([{ str: "সা", x: 30, w: 18.4, eol: false }, { str: "লো", x: 48.7, w: 20, eol: false }, { str: "ক", x: 75, w: 8, eol: true }, { str: "next", x: 30, w: 20, eol: false }])).toBe("সালো ক\nnext");
  });
});

describe("retrieval helpers", () => {
  test("query terms drop question words in both languages", () => {
    expect(queryTerms("What is photosynthesis in plants?")).not.toContain("what");
    expect(queryTerms("সালোকসংশ্লেষণ কাকে বলে?").join(" ")).toContain("সালোকসংশ্লেষণ");
  });
  test("chunks stay near the target size and excerpts are bounded", () => {
    const t = "Photosynthesis is the process by which green plants make food. They use sunlight, water and carbon dioxide. ".repeat(12);
    for (const c of chunkPage(t)) expect(c.length).toBeLessThan(1000);
    expect(excerpt(t, queryTerms("photosynthesis sunlight")).length).toBeLessThanOrEqual(430);
  });
});

describe("arithmetic, grading and scheduling", () => {
  test("exact fraction arithmetic including Bangla digits", () => {
    expect(isArithmetic("3/4 + 1/6")).toBe(true);
    expect(evalArithmetic("3/4 + 1/6").fraction).toBe("11/12");
    expect(evalArithmetic("২.৫×৪").decimal).toBe("10");
  });
  test("grading", () => {
    expect(gradeAnswer({ type: "numeric", answer: "0.75", tolerance: null }, "৩/৪")).toBe(true);
    expect(gradeAnswer({ type: "short", answer: '["oxygen","অক্সিজেন"]', tolerance: null }, " Oxygen. ")).toBe(true);
    expect(gradeAnswer({ type: "mcq", answer: "a", tolerance: null }, "b")).toBe(false);
  });
  test("Leitner boxes move up on success and reset on a miss", () => {
    const now = new Date("2026-10-16T00:00:00Z");
    expect(nextReview(null, true, now).box).toBe(1);
    expect(nextReview(2, true, now).box).toBe(3);
    expect(nextReview(4, false, now).box).toBe(1);
    expect(nextReview(5, true, now).box).toBe(5);
  });
});
