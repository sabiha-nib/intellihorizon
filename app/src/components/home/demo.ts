// Homepage tutor demonstration. Written by the IntelliHorizon team to show how answers are laid out; it is labelled as
// a demonstration on the page and is never presented as a live model response. Every "From your textbook" line is
// grounded in a real checked passage: Class 7 Mathematics (গণিত), printed pages 18–19 (PDF pages 23–24), and the two
// quotations are copied character for character from those passages.
export type Tri = { bn: string; en: string; mixed: string };
export type DemoLang = keyof Tri;
export type Basis = "textbook" | "derived" | "practice" | "general" | "app";
export type DemoBlock = { role: "direct" | "explanation" | "step" | "example" | "check" | "notice"; basis: Basis; text: Tri; cite?: 1 | 2 };
export type DemoFlow = { id: string; label: Tri; question: Tri; blocks: DemoBlock[]; quote?: { source: 1 | 2; text: string }; checks: Tri[]; noSources?: boolean };

const same = (s: string): Tri => ({ bn: s, en: s, mixed: s });

export const SOURCES: Record<1 | 2, { book: string; page: string; pageEn: string; text: string }> = {
  1: { book: "গণিত · ৭ম শ্রেণি", page: "ছাপা পৃষ্ঠা ১৮", pageEn: "printed page 18", text: "…দুটি অনুপাতকে একত্র করে পাই, পুত্রের বয়স : পিতার বয়স : দাদার বয়স = ১৫ : ৪১ : ৬৫। এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে।…" },
  2: { book: "গণিত · ৭ম শ্রেণি", page: "ছাপা পৃষ্ঠা ১৯", pageEn: "printed page 19", text: "উদাহরণ ১। ৭ : ৫ এবং ৮ : ৯ দুটি অনুপাত। … ∴ অনুপাত দুটির ধারাবাহিক অনুপাত ৫৬ : ৪০ : ৪৫।" },
};

export const FLOWS: DemoFlow[] = [
  {
    id: "definition",
    label: { bn: "সংজ্ঞা", en: "A definition", mixed: "Definition" },
    question: { bn: "ধারাবাহিক অনুপাত কাকে বলে?", en: "What is a continued ratio?", mixed: "continued ratio কাকে বলে?" },
    blocks: [
      { role: "direct", basis: "textbook", cite: 1, text: { bn: "দুটি অনুপাত জুড়ে যখন তিন রাশির একটি অনুপাত হয়, আর প্রথম অনুপাতের উত্তর রাশি ও দ্বিতীয় অনুপাতের পূর্ব রাশি সমান থাকে, তাকে ধারাবাহিক অনুপাত বলে।", en: "When two ratios are joined into one ratio of three quantities, and the second term of the first equals the first term of the second, it is called a continued ratio (ধারাবাহিক অনুপাত).", mixed: "দুটি ratio জুড়ে যখন তিন রাশির একটা ratio হয়, আর প্রথমটার উত্তর রাশি = দ্বিতীয়টার পূর্ব রাশি, সেটাই continued ratio বা ধারাবাহিক অনুপাত।" } },
      { role: "example", basis: "textbook", cite: 1, text: { bn: "বইয়ের উদাহরণ: পুত্র : পিতা = ১৫ : ৪১, পিতা : দাদা = ৪১ : ৬৫, তাই পুত্র : পিতা : দাদা = ১৫ : ৪১ : ৬৫।", en: "The book's example: son : father = 15 : 41 and father : grandfather = 41 : 65, so son : father : grandfather = 15 : 41 : 65.", mixed: "বইয়ের example: পুত্র : পিতা = ১৫ : ৪১, পিতা : দাদা = ৪১ : ৬৫, so পুত্র : পিতা : দাদা = ১৫ : ৪১ : ৬৫।" } },
      { role: "check", basis: "practice", text: { bn: "নিজে করো: ৩ : ৪ এবং ৪ : ৭ থেকে ধারাবাহিক অনুপাত কত?", en: "Try it: what continued ratio do 3 : 4 and 4 : 7 make?", mixed: "Try করো: ৩ : ৪ আর ৪ : ৭ থেকে continued ratio কত?" } },
    ],
    quote: { source: 1, text: "এ ধরনের অনুপাতকে ধারাবাহিক অনুপাত বলে।" },
    checks: [
      { bn: "প্রতিটি উৎসনির্দেশ খুঁজে পাওয়া পাঠ্যাংশের সঙ্গে মেলানো", en: "Every citation matched to a retrieved passage", mixed: "প্রতিটি citation retrieved passage-এর সঙ্গে মেলানো" },
      { bn: "উদ্ধৃতি বইয়ের সঙ্গে হুবহু মেলানো", en: "The quotation matched word for word", mixed: "Quotation হুবহু মেলানো" },
    ],
  },
  {
    id: "worked",
    label: { bn: "উদাহরণ সমাধান", en: "A worked example", mixed: "Worked example" },
    question: { bn: "৭ : ৫ এবং ৮ : ৯ কে ধারাবাহিক অনুপাতে প্রকাশ করো", en: "Write 7 : 5 and 8 : 9 as a continued ratio", mixed: "৭ : ৫ আর ৮ : ৯ কে continued ratio-তে কীভাবে লিখব?" },
    blocks: [
      { role: "step", basis: "derived", cite: 2, text: { bn: "প্রথম অনুপাতের উত্তর রাশি ৫, দ্বিতীয়টির পূর্ব রাশি ৮। এ দুটি সমান করতে হবে।", en: "The second term of the first ratio is 5; the first term of the second is 8. These must be made equal.", mixed: "প্রথম ratio-র উত্তর রাশি ৫, দ্বিতীয়টার পূর্ব রাশি ৮। এ দুটো equal করতে হবে।" } },
      { role: "step", basis: "derived", cite: 2, text: same("$7 : 5 = 7 \\times 8 : 5 \\times 8 = 56 : 40$") },
      { role: "step", basis: "derived", cite: 2, text: same("$8 : 9 = 8 \\times 5 : 9 \\times 5 = 40 : 45$") },
      { role: "direct", basis: "textbook", cite: 2, text: { bn: "তাই ধারাবাহিক অনুপাত ৫৬ : ৪০ : ৪৫।", en: "So the continued ratio is 56 : 40 : 45.", mixed: "So ধারাবাহিক অনুপাত ৫৬ : ৪০ : ৪৫।" } },
    ],
    quote: { source: 2, text: "∴ অনুপাত দুটির ধারাবাহিক অনুপাত ৫৬ : ৪০ : ৪৫।" },
    checks: [
      { bn: "প্রতিটি হিসাব অ্যাপ নিজে হুবহু আবার কষেছে", en: "Every calculation recalculated exactly by the app", mixed: "প্রতিটি calculation অ্যাপ নিজে আবার কষেছে" },
      { bn: "গণিতের উত্তর আরেকটি স্বাধীন মডেল যাচাই করে", en: "Maths answers are checked by a second, independent model", mixed: "Maths answer আরেকটা independent model যাচাই করে" },
    ],
  },
  {
    id: "working",
    label: { bn: "আমার ধাপ যাচাই", en: "Check my working", mixed: "Working check" },
    question: { bn: "৫ : ৩ ও ২ : ৫\n৫ : ৩ = ১০ : ৬\n২ : ৫ = ৬ : ১৬", en: "5 : 3 and 2 : 5\n5 : 3 = 10 : 6\n2 : 5 = 6 : 16", mixed: "৫ : ৩ আর ২ : ৫\n৫ : ৩ = ১০ : ৬\n২ : ৫ = ৬ : ১৬" },
    blocks: [
      { role: "step", basis: "app", text: { bn: "লাইন ২ ঠিক আছে: ৫ : ৩ = ১০ : ৬।", en: "Line 2 holds: 5 : 3 = 10 : 6.", mixed: "Line ২ ঠিক: ৫ : ৩ = ১০ : ৬।" } },
      { role: "notice", basis: "app", text: { bn: "প্রথম ভুল লাইন ৩-এ: ২ × ৩ : ৫ × ৩ = ৬ : ১৫, ৬ : ১৬ নয়।", en: "The first wrong step is line 3: 2 × 3 : 5 × 3 = 6 : 15, not 6 : 16.", mixed: "প্রথম ভুল line ৩-এ: ২ × ৩ : ৫ × ৩ = ৬ : ১৫, ৬ : ১৬ না।" } },
      { role: "direct", basis: "app", text: { bn: "ঠিক করলে ধারাবাহিক অনুপাত হয় ১০ : ৬ : ১৫।", en: "Corrected, the continued ratio is 10 : 6 : 15.", mixed: "ঠিক করলে continued ratio হয় ১০ : ৬ : ১৫।" } },
    ],
    checks: [{ bn: "এই যাচাই অ্যাপের নির্দিষ্ট হিসাব-যন্ত্রে, কোনো এআই নয়", en: "This check is the app's exact calculator, not an AI model", mixed: "এই check অ্যাপের exact calculator-এ, কোনো AI না" }],
    noSources: true,
  },
  {
    id: "outside",
    label: { bn: "বইয়ে নেই", en: "Not in the book", mixed: "Not in book" },
    question: { bn: "শুক্র গ্রহে পারদের স্ফুটনাঙ্ক কত?", en: "What is the boiling point of mercury on Venus?", mixed: "Venus-এ mercury-র boiling point কত?" },
    blocks: [
      { role: "notice", basis: "general", text: { bn: "তোমার ৭ম শ্রেণির যাচাই করা পাঠ্যবইয়ে এটি খুঁজে পাইনি, তাই স্মৃতি থেকে উত্তর দেব না। শিক্ষককে জিজ্ঞেস করো, বা তোমার বইয়ের কোনো অধ্যায় নিয়ে প্রশ্ন করো।", en: "I couldn't find this in your checked Class 7 textbooks, so I won't answer from memory. Ask your teacher, or ask about a chapter in your books.", mixed: "তোমার checked Class 7 বইয়ে এটা পাইনি, তাই memory থেকে উত্তর দেব না। Teacher-কে জিজ্ঞেস করো, বা বইয়ের কোনো chapter নিয়ে প্রশ্ন করো।" } },
    ],
    checks: [{ bn: "উৎস না পেলে কোনো এআই উত্তর তৈরি হয় না", en: "No sources found means no AI answer is generated", mixed: "Source না পেলে কোনো AI answer তৈরি হয় না" }],
    noSources: true,
  },
];

export type DemoPersona = "mentor" | "socratic" | "challenger" | "simplifier" | "exam";
export const PERSONA_LEAD: Record<DemoPersona, Tri> = {
  mentor: { bn: "মূল কথা, মূল শব্দ, তারপর ছোট্ট একটি যাচাই।", en: "The idea, the key words, then a quick check.", mixed: "মূল idea, key words, তারপর একটা quick check।" },
  socratic: { bn: "বোঝানোর আগে ভাবো: দুটি অনুপাত জোড়া লাগাতে কোন দুটি রাশি সমান হতে হবে?", en: "Before I explain: which two terms must be equal for two ratios to join?", mixed: "Explain করার আগে ভাবো: দুটো ratio জোড়াতে কোন দুটো term equal হতে হবে?" },
  challenger: { bn: "বোঝার পর কঠিনটা: ২ : ৩, ৪ : ৫ ও ৬ : ৭ কে একটি ধারাবাহিক অনুপাতে লেখো।", en: "Once it clicks, the harder one: write 2 : 3, 4 : 5 and 6 : 7 as one continued ratio.", mixed: "বোঝার পর harder one: ২ : ৩, ৪ : ৫ আর ৬ : ৭ কে একটা continued ratio-তে লেখো।" },
  simplifier: { bn: "একবারে একটি ছোট কথা।", en: "One small idea at a time.", mixed: "একবারে একটা ছোট idea।" },
  exam: { bn: "পরীক্ষার উত্তরের মতো: আগে সংজ্ঞা, তারপর মূল বিষয়গুলো ক্রমে।", en: "Like an exam answer: the definition first, then the key points in order.", mixed: "Exam answer-এর মতো: আগে definition, তারপর key points ক্রমে।" },
};
export const PERSONA_NAME: Record<DemoPersona, Tri> = {
  mentor: { bn: "মেন্টর", en: "Mentor", mixed: "Mentor" },
  socratic: { bn: "প্রশ্নকারী গাইড", en: "Socratic", mixed: "Socratic" },
  challenger: { bn: "চ্যালেঞ্জার", en: "Challenger", mixed: "Challenger" },
  simplifier: { bn: "সহজকারী", en: "Simplifier", mixed: "Simplifier" },
  exam: { bn: "পরীক্ষার কোচ", en: "Exam Coach", mixed: "Exam Coach" },
};

export type DemoStyle = "default" | "beginner" | "steps" | "example" | "testme";
export const STYLE_NAME: Record<DemoStyle, Tri> = {
  default: { bn: "সাধারণ", en: "Standard", mixed: "Standard" },
  beginner: { bn: "একদম নতুনের মতো", en: "Like I'm a beginner", mixed: "Beginner-এর মতো" },
  steps: { bn: "ধাপে ধাপে", en: "Step by step", mixed: "Step by step" },
  example: { bn: "বইয়ের উদাহরণ দিয়ে", en: "With the book's example", mixed: "বইয়ের example দিয়ে" },
  testme: { bn: "আমাকে যাচাই করো", en: "Test me", mixed: "Test me" },
};

/** Persona and style change presentation only: which blocks lead, which are shown. The evidence never changes. */
export function arrange(flow: DemoFlow, persona: DemoPersona, style: DemoStyle): DemoBlock[] {
  let b = [...flow.blocks];
  if (persona === "simplifier" || style === "beginner") b = b.filter((x) => x.role !== "example" || flow.id !== "definition").slice(0, 3);
  if (persona === "exam") b = [...b.filter((x) => x.role === "direct"), ...b.filter((x) => x.role !== "direct")];
  if (style === "example") b = [...b.filter((x) => x.role === "example"), ...b.filter((x) => x.role !== "example")];
  if (style === "steps") b = [...b.filter((x) => x.role === "step"), ...b.filter((x) => x.role !== "step")];
  if (style === "testme") b = [...b.filter((x) => x.role === "check"), ...b.filter((x) => x.role !== "check")];
  return b;
}
