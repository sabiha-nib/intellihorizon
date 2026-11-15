import type { Idea, LessonPack, Misconception, Question } from "./types";

const IDEAS: Idea[] = [
  { id: "size", label: { en: "More pieces means smaller pieces", bn: "টুকরো বেশি মানে টুকরো ছোট" }, keys: ["smaller piece", "pieces are smaller", "smaller", "more pieces", "ছোট টুকরো", "ছোট", "বেশি টুকরো", "ছোট হয়"], rumiAsks: { en: "But 4 is bigger than 3, so isn't a quarter bigger than a third?", bn: "কিন্তু ৪ তো ৩-এর চেয়ে বড়, তাহলে চার ভাগের এক কি তিন ভাগের একের চেয়ে বড় না?" } },
  { id: "count", label: { en: "Count how many pieces you get, too", bn: "কয়টা টুকরো পাচ্ছ তাও গুনতে হয়" }, keys: ["how many", "numerator", "top number", "pieces you get", "লব", "কয়টা", "উপরের সংখ্যা", "কতগুলো"], rumiAsks: { en: "Does the top number matter at all?", bn: "উপরের সংখ্যাটা কি কোনো কাজে লাগে?" } },
  { id: "same-whole", label: { en: "Compare shares of the same-sized whole", bn: "একই মাপের পুরো জিনিসের ভাগ তুলনা করতে হয়" }, keys: ["same size", "same whole", "same roti", "equal size", "একই মাপ", "একই রুটি", "সমান মাপ", "একই আকার"], rumiAsks: { en: "What if one roti is huge and the other is tiny?", bn: "যদি একটা রুটি বিশাল আর আরেকটা ছোট্ট হয়?" } },
  { id: "common", label: { en: "Make the pieces the same size to compare", bn: "তুলনার জন্য টুকরোগুলো সমান মাপের করতে হয়" }, keys: ["common denominator", "same denominator", "equivalent", "lcm", "cross multiply", "সমান হর", "একই হর", "সমতুল", "লসাগু", "ল.সা.গু"], rumiAsks: { en: "Is there a trick that always works?", bn: "এমন কোনো উপায় আছে যা সবসময় কাজ করে?" } },
];

const MISC: Misconception[] = [
  { id: "bigger-denominator", name: { en: "Bigger bottom number, bigger fraction", bn: "হর বড় মানে ভগ্নাংশ বড়" }, looksLike: { en: "Choosing 1/4 over 1/3 because 4 is bigger than 3.", bn: "৪ বড় বলে ১/৩-এর চেয়ে ১/৪-কে বড় ভাবা।" }, repair: {
    visual: { en: "Cut one roti into 3 and another into 4. Lay one piece of each side by side. The quarter is visibly thinner.", bn: "একটা রুটি ৩ ভাগে আর একটা ৪ ভাগে কাটো। একটা করে টুকরো পাশাপাশি রাখো। চার ভাগের টুকরোটা স্পষ্টতই সরু।" },
    story: { en: "One pitha shared by 3 friends or by 4 friends: with more friends at the plate, each person's piece gets smaller.", bn: "একটা পিঠা ৩ বন্ধু ভাগ করলে আর ৪ বন্ধু ভাগ করলে: মানুষ বাড়লে প্রত্যেকের টুকরো ছোট হয়।" },
    steps: { en: "1. The bottom number says how many equal pieces the whole is cut into. 2. More cuts make each piece smaller. 3. So 1/3 > 1/4.", bn: "১. হর বলে পুরোটা কয় সমান ভাগে কাটা। ২. যত বেশি কাটা, তত ছোট টুকরো। ৩. তাই ১/৩ > ১/৪।" },
    analogy: { en: "A cricket over split among more bowlers gives each bowler fewer balls.", bn: "এক ওভার বেশি বোলারে ভাগ করলে প্রত্যেকে কম বল পায়।" },
  } },
  { id: "numerator-only", name: { en: "Only the top number matters", bn: "শুধু লব দেখলেই হয়" }, looksLike: { en: "Saying 3/5 is bigger than 2/3 because 3 is bigger than 2.", bn: "৩ বড় বলে ২/৩-এর চেয়ে ৩/৫-কে বড় বলা।" }, repair: {
    visual: { en: "Shade 2 of 3 pieces on one roti and 3 of 5 on another. Line the shaded parts up as bars: 2/3 reaches further.", bn: "এক রুটির ৩ ভাগের ২ আর অন্যটির ৫ ভাগের ৩ রং করো। রং করা অংশ লাইনে সাজাও: ২/৩ বেশি দূর যায়।" },
    story: { en: "Getting 3 slices of a mango cut into 5, or 2 slices of a mango cut into 3? The bigger slices win here.", bn: "৫ ভাগ করা আমের ৩ ফালি, নাকি ৩ ভাগ করা আমের ২ ফালি? এখানে বড় ফালিই জেতে।" },
    steps: { en: "1. A fraction has two numbers that work together. 2. Rewrite both with the same bottom: 2/3 = 10/15, 3/5 = 9/15. 3. Now compare tops: 10 > 9.", bn: "১. ভগ্নাংশের দুটি সংখ্যা একসাথে কাজ করে। ২. দুটোকে একই হরে লেখো: ২/৩ = ১০/১৫, ৩/৫ = ৯/১৫। ৩. এখন লব তুলনা: ১০ > ৯।" },
    analogy: { en: "Three small coins can be worth less than two big notes. Size of each piece matters as much as the count.", bn: "তিনটা ছোট পয়সা দুটো বড় নোটের চেয়ে কম হতে পারে। সংখ্যার মতো প্রতিটির মাপও জরুরি।" },
  } },
  { id: "missing-piece", name: { en: "One piece short means equal", bn: "এক টুকরো কম মানেই সমান" }, looksLike: { en: "Saying 3/4 and 4/5 are equal because each is one piece away from a whole.", bn: "দুটোই পুরো থেকে এক টুকরো কম বলে ৩/৪ আর ৪/৫-কে সমান বলা।" }, repair: {
    visual: { en: "Look at the missing piece on each roti. The missing quarter is bigger than the missing fifth, so 4/5 has more left.", bn: "প্রতিটি রুটির না-থাকা টুকরোটা দেখো। না-থাকা চার ভাগের এক, পাঁচ ভাগের একের চেয়ে বড়, তাই ৪/৫ বেশি।" },
    story: { en: "Two friends each lose one piece of their roti, but one roti was cut into bigger pieces. Who lost more?", bn: "দুই বন্ধুই এক টুকরো রুটি হারাল, কিন্তু একজনের রুটির টুকরো বড় ছিল। কে বেশি হারাল?" },
    steps: { en: "1. 3/4 is missing 1/4. 4/5 is missing 1/5. 2. 1/4 > 1/5. 3. Missing more means having less, so 4/5 > 3/4.", bn: "১. ৩/৪-এ ১/৪ কম। ৪/৫-এ ১/৫ কম। ২. ১/৪ > ১/৫। ৩. বেশি কম মানে কম আছে, তাই ৪/৫ > ৩/৪।" },
    analogy: { en: "Arriving one stop early on a long bus route or a short one leaves different distances to walk.", bn: "লম্বা আর ছোট বাসরুটে এক স্টপ আগে নামলে হাঁটার দূরত্ব আলাদা হয়।" },
  } },
  { id: "different-wholes", name: { en: "A half is always the same amount", bn: "অর্ধেক সবসময় একই পরিমাণ" }, looksLike: { en: "Comparing fractions of wholes that are different sizes.", bn: "ভিন্ন মাপের পুরো জিনিসের ভগ্নাংশ তুলনা করা।" }, repair: {
    visual: { en: "Draw half of a big roti and half of a small one. Both are halves, but the amounts are different.", bn: "বড় রুটির অর্ধেক আর ছোট রুটির অর্ধেক আঁকো। দুটোই অর্ধেক, কিন্তু পরিমাণ আলাদা।" },
    story: { en: "Half a family-size cake and half a cupcake are both halves. Only one of them feeds the guests.", bn: "বড় কেকের অর্ধেক আর ছোট কাপকেকের অর্ধেক, দুটোই অর্ধেক। অতিথিদের পেট ভরে একটাতেই।" },
    steps: { en: "1. A fraction is always a fraction OF something. 2. Compare only when the wholes match. 3. Otherwise compare actual amounts.", bn: "১. ভগ্নাংশ সবসময় কোনো কিছুর ভগ্নাংশ। ২. পুরো জিনিস মিললে তবেই তুলনা। ৩. নইলে আসল পরিমাণ তুলনা করো।" },
    analogy: { en: "Half of 100 taka and half of 10 taka are both halves.", bn: "১০০ টাকার অর্ধেক আর ১০ টাকার অর্ধেক, দুটোই অর্ধেক।" },
  } },
];

const q = (id: string, kind: Question["kind"], prompt: Question["prompt"], options: Question["options"], explain: Question["explain"], disguise?: Question["disguise"]): Question => ({ id, concept: "share", kind, prompt, options, explain, disguise, source: "verified" });

const PROBE: Question[] = [
  q("share.p1", "probe", { en: "Which is bigger: 1/3 or 1/4 of the same roti?", bn: "একই রুটির ১/৩ আর ১/৪, কোনটি বড়?" }, [
    { id: "a", text: { en: "1/3", bn: "১/৩" }, correct: true },
    { id: "b", text: { en: "1/4", bn: "১/৪" }, misconception: "bigger-denominator" },
    { id: "c", text: { en: "They are equal, both have 1 on top", bn: "সমান, দুটোরই লব ১" }, misconception: "numerator-only" },
  ], { en: "Cutting into 3 makes bigger pieces than cutting into 4.", bn: "৩ ভাগে কাটলে ৪ ভাগের চেয়ে বড় টুকরো হয়।" }),
  q("share.p2", "probe", { en: "Which is bigger: 2/3 or 3/5?", bn: "কোনটি বড়: ২/৩ নাকি ৩/৫?" }, [
    { id: "a", text: { en: "2/3", bn: "২/৩" }, correct: true },
    { id: "b", text: { en: "3/5", bn: "৩/৫" }, misconception: "numerator-only" },
    { id: "c", text: { en: "They are equal", bn: "সমান" } },
  ], { en: "2/3 = 10/15 and 3/5 = 9/15, so 2/3 is bigger.", bn: "২/৩ = ১০/১৫ আর ৩/৫ = ৯/১৫, তাই ২/৩ বড়।" }),
  q("share.p3", "probe", { en: "Which is bigger: 3/4 or 4/5?", bn: "কোনটি বড়: ৩/৪ নাকি ৪/৫?" }, [
    { id: "a", text: { en: "4/5", bn: "৪/৫" }, correct: true },
    { id: "b", text: { en: "3/4", bn: "৩/৪" } },
    { id: "c", text: { en: "Equal, each is one piece short of a whole", bn: "সমান, দুটোতেই পুরো থেকে এক টুকরো কম" }, misconception: "missing-piece" },
  ], { en: "3/4 misses a quarter, 4/5 misses only a fifth. 4/5 is bigger.", bn: "৩/৪-এ চার ভাগের এক কম, ৪/৫-এ মাত্র পাঁচ ভাগের এক কম। ৪/৫ বড়।" }),
];

const TRIALS: Question[] = [
  q("share.t.context", "trial", { en: "At the Poush mela, Ayan gets 2/5 of a plate of pitha and Rina gets 3/10 of an identical plate. Who gets more?", bn: "পৌষমেলায় আয়ান এক প্লেট পিঠার ২/৫ আর রিনা একই রকম প্লেটের ৩/১০ পেল। কে বেশি পেল?" }, [
    { id: "a", text: { en: "Ayan", bn: "আয়ান" }, correct: true },
    { id: "b", text: { en: "Rina", bn: "রিনা" }, misconception: "numerator-only" },
    { id: "c", text: { en: "They get the same", bn: "দুজনে সমান" } },
  ], { en: "2/5 = 4/10, which is more than 3/10.", bn: "২/৫ = ৪/১০, যা ৩/১০-এর চেয়ে বেশি।" }, "context"),
  q("share.t.representation", "trial", { en: "Which point shows 2/3 on this number line?", bn: "সংখ্যারেখার কোন বিন্দুটি ২/৩ দেখায়?" }, [
    { id: "a", text: { en: "Point A", bn: "বিন্দু ক" }, mark: 0.4, misconception: "numerator-only" },
    { id: "b", text: { en: "Point B", bn: "বিন্দু খ" }, mark: 0.667, correct: true },
    { id: "c", text: { en: "Point C", bn: "বিন্দু গ" }, mark: 1.5 },
  ], { en: "2/3 is between 1/2 and 1, two thirds of the way from 0 to 1.", bn: "২/৩ থাকে ১/২ আর ১-এর মাঝে, ০ থেকে ১-এর তিন ভাগের দুই ভাগ দূরে।" }, "representation"),
  q("share.t.language", "trial", { en: "Which is bigger: 5/6 or 7/8?", bn: "কোনটি বড়: ৫/৬ নাকি ৭/৮?" }, [
    { id: "a", text: { en: "7/8", bn: "৭/৮" }, correct: true },
    { id: "b", text: { en: "5/6", bn: "৫/৬" } },
    { id: "c", text: { en: "Equal, both are one piece short", bn: "সমান, দুটোতেই এক টুকরো কম" }, misconception: "missing-piece" },
  ], { en: "7/8 misses only an eighth, 5/6 misses a sixth.", bn: "৭/৮-এ মাত্র আট ভাগের এক কম, ৫/৬-এ ছয় ভাগের এক কম।" }, "language"),
  q("share.t.reverse", "trial", { en: "Nadia says: \"Half of my big family pizza is the same as half of your small pizza.\" What is wrong?", bn: "নাদিয়া বলে: \"আমার বড় পিৎজার অর্ধেক আর তোমার ছোট পিৎজার অর্ধেক একই।\" ভুলটা কোথায়?" }, [
    { id: "a", text: { en: "The wholes are different sizes, so the halves are different amounts", bn: "পুরো জিনিস দুটোর মাপ আলাদা, তাই অর্ধেকের পরিমাণও আলাদা" }, correct: true },
    { id: "b", text: { en: "Nothing, a half is always a half", bn: "কিছুই না, অর্ধেক সবসময় অর্ধেক" }, misconception: "different-wholes" },
    { id: "c", text: { en: "Half of a bigger number is always smaller", bn: "বড় সংখ্যার অর্ধেক সবসময় ছোট" }, misconception: "bigger-denominator" },
  ], { en: "Fractions compare fairly only when they are fractions of the same whole.", bn: "একই পুরো জিনিসের ভগ্নাংশ হলে তবেই ন্যায্য তুলনা হয়।" }, "reverse"),
];

const EXAM: Question[] = [
  q("share.e1", "exam", { en: "Which fraction is equivalent to 2/3?", bn: "কোন ভগ্নাংশটি ২/৩-এর সমতুল?" }, [
    { id: "a", text: { en: "4/6", bn: "৪/৬" }, correct: true },
    { id: "b", text: { en: "3/4", bn: "৩/৪" } },
    { id: "c", text: { en: "2/6", bn: "২/৬" }, misconception: "numerator-only" },
    { id: "d", text: { en: "4/9", bn: "৪/৯" } },
  ], { en: "Multiply top and bottom by 2: 2/3 = 4/6.", bn: "লব ও হরকে ২ দিয়ে গুণ করো: ২/৩ = ৪/৬।" }),
  q("share.e2", "exam", { en: "Arrange from smallest to largest: 1/2, 2/5, 3/4", bn: "ছোট থেকে বড় সাজাও: ১/২, ২/৫, ৩/৪" }, [
    { id: "a", text: { en: "2/5, 1/2, 3/4", bn: "২/৫, ১/২, ৩/৪" }, correct: true },
    { id: "b", text: { en: "1/2, 2/5, 3/4", bn: "১/২, ২/৫, ৩/৪" }, misconception: "bigger-denominator" },
    { id: "c", text: { en: "1/2, 3/4, 2/5", bn: "১/২, ৩/৪, ২/৫" } },
  ], { en: "In twentieths: 8/20, 10/20, 15/20.", bn: "বিশ ভাগে: ৮/২০, ১০/২০, ১৫/২০।" }),
  q("share.e3", "exam", { en: "A rope is 12 m long. 3/4 of it is used. How much is used?", bn: "একটি দড়ি ১২ মিটার লম্বা। এর ৩/৪ ব্যবহার হলো। কত মিটার ব্যবহার হলো?" }, [
    { id: "a", text: { en: "9 m", bn: "৯ মি" }, correct: true },
    { id: "b", text: { en: "3 m", bn: "৩ মি" } },
    { id: "c", text: { en: "4 m", bn: "৪ মি" } },
    { id: "d", text: { en: "8 m", bn: "৮ মি" } },
  ], { en: "12 ÷ 4 = 3, and 3 × 3 = 9 m.", bn: "১২ ÷ ৪ = ৩, আর ৩ × ৩ = ৯ মি।" }),
];

export const SHARE: LessonPack = {
  concept: "share",
  rumiOpening: { en: "My cousin says 1/4 of a roti is more than 1/3 because 4 is bigger. Is she right?", bn: "আমার কাজিন বলে রুটির ১/৪, ১/৩-এর চেয়ে বেশি কারণ ৪ বড়। ও কি ঠিক?" },
  ideas: IDEAS,
  misconceptions: MISC,
  probe: PROBE,
  trials: TRIALS,
  exam: EXAM,
};
