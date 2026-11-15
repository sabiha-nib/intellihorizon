// Lesson support written by IntelliHorizon for chapters whose pages were checked against the owner-supplied NCTB PDFs.
// Everything here is labelled in the app as an IntelliHorizon explanation, never as textbook text. Page numbers are printed pages.
import type { L } from "../../content/types";
import type { KeyIdea } from "./rules";

export const MATH_CH2 = "f9c3f216-a09e-5c02-979e-497b60f8333a";
export const SCI_CH2 = "ae6eee78-b6a9-535a-ae63-4b532e918850";
export const SOP_KABULI = "f876e1e6-bd87-5a43-9232-369fd194711c";

export type Lesson = {
  /** Where in the book the ideas come from (printed pages). */
  pages: string;
  /** Short explanation steps, revealed one at a time. IntelliHorizon's wording, checked against the pages above. */
  steps: L[];
  /** The ideas Explain It Back looks for. */
  keyIdeas: KeyIdea[];
  /** An interactive model for this chapter, if one exists. */
  interactive?: "continued-ratio";
  recap: L;
};

export const LESSONS: Record<string, Lesson> = {
  [MATH_CH2]: {
    pages: "18–19",
    steps: [
      {
        en: "A ratio compares two quantities in order: first term : second term. 2 : 3 and 4 : 6 are the same ratio, because both terms were multiplied by 2.",
        bn: "অনুপাত দুটি রাশিকে ক্রম মেনে তুলনা করে: পূর্ব রাশি : উত্তর রাশি। ২ : ৩ আর ৪ : ৬ একই অনুপাত, কারণ দুই রাশিকেই ২ দিয়ে গুণ করা হয়েছে।",
      },
      {
        en: "A continued ratio joins two ratios that share a quantity, such as son : father and father : grandfather, into son : father : grandfather.",
        bn: "ধারাবাহিক অনুপাত এমন দুটি অনুপাতকে জোড়ে যাদের মধ্যে একটি রাশি একই, যেমন পুত্র : পিতা আর পিতা : দাদা থেকে পুত্র : পিতা : দাদা।",
      },
      {
        en: "To join them, the shared (middle) term must be equal. Multiply both terms of the second ratio by the first ratio's second term, and both terms of the first ratio by the second ratio's first term.",
        bn: "জোড়ার জন্য মাঝের রাশি সমান হতে হবে। প্রথম অনুপাতের উত্তর রাশি দিয়ে দ্বিতীয় অনুপাতের উভয় রাশিকে, আর দ্বিতীয় অনুপাতের পূর্ব রাশি দিয়ে প্রথম অনুপাতের উভয় রাশিকে গুণ করো।",
      },
      {
        en: "Example (IntelliHorizon's numbers): a : b = 2 : 3 and b : c = 4 : 5. Then 2 : 3 = 8 : 12 and 4 : 5 = 12 : 15, so a : b : c = 8 : 12 : 15.",
        bn: "উদাহরণ (ইন্টেলিহরাইজনের সংখ্যা): ক : খ = ২ : ৩ এবং খ : গ = ৪ : ৫। তাহলে ২ : ৩ = ৮ : ১২ আর ৪ : ৫ = ১২ : ১৫, তাই ক : খ : গ = ৮ : ১২ : ১৫।",
      },
    ],
    keyIdeas: [
      {
        id: "middle-equal",
        label: {
          en: "The middle term must be made equal",
          bn: "মাঝের রাশি (উত্তর রাশি ও পূর্ব রাশি) সমান করতে হয়",
        },
        words: ["সমান", "equal", "same", "middle", "মাঝ", "উত্তর রাশি", "পূর্ব রাশি"],
      },
      {
        id: "multiply-both",
        label: {
          en: "Both terms of a ratio are multiplied",
          bn: "অনুপাতের উভয় রাশিকে গুণ করতে হয়",
        },
        words: ["গুণ", "multiply", "multiplied", "×", "times", "উভয়"],
      },
      {
        id: "three-terms",
        label: { en: "The result joins three quantities", bn: "ফলাফলে তিনটি রাশি একসঙ্গে আসে" },
        words: ["তিন", "three", "a:b:c", "ধারাবাহিক", "continued"],
      },
    ],
    interactive: "continued-ratio",
    recap: {
      en: "Make the middle terms equal, then write the three terms in the order the question asks.",
      bn: "মাঝের রাশি সমান করো, তারপর প্রশ্নে চাওয়া ক্রমে তিনটি রাশি লেখো।",
    },
  },
  [SCI_CH2]: {
    pages: "10",
    steps: [
      {
        en: "Every living body, from the tiniest to the largest plant or animal, is made of cells. That is what all living things have in common.",
        bn: "ক্ষুদ্রতম থেকে বৃহত্তম, সব উদ্ভিদ ও প্রাণীর দেহই কোষ দিয়ে তৈরি। সব জীবের মধ্যে এটাই সাধারণ মিল।",
      },
      {
        en: "The cells inside one body are not all alike. Their structure differs, and not every part described in the chapter is found in every cell.",
        bn: "একটি দেহের সব কোষ এক রকম নয়। তাদের গঠন ভিন্ন, আর অধ্যায়ে বর্ণিত সব অঙ্গাণু প্রতিটি কোষে একসাথে থাকে না।",
      },
      {
        en: "Our picture of the cell became much clearer after the electron microscope was invented.",
        bn: "ইলেকট্রন অণুবীক্ষণ যন্ত্র আবিষ্কারের পর কোষ সম্পর্কে ধারণা অনেক স্পষ্ট হয়েছে।",
      },
    ],
    keyIdeas: [
      {
        id: "made-of-cells",
        label: { en: "All living bodies are made of cells", bn: "জীবদেহ মাত্রই কোষ দ্বারা গঠিত" },
        words: ["কোষ", "cell"],
      },
      {
        id: "not-alike",
        label: { en: "Cells in one body are not all alike", bn: "একটি দেহের সব কোষ এক রকম নয়" },
        words: ["ভিন্ন", "এক রকম নয়", "different", "not the same", "not alike"],
      },
    ],
    recap: {
      en: "All living things are made of cells, and the cells in one body differ from each other.",
      bn: "সব জীব কোষ দিয়ে তৈরি, আর একটি দেহের কোষগুলো একে অপরের থেকে ভিন্ন।",
    },
  },
  [SOP_KABULI]: {
    pages: "1–2",
    steps: [
      {
        en: "The story is told by Mini's father. Mini is five and talks all the time.",
        bn: "গল্পটি মিনির বাবার মুখে বলা। মিনির বয়স পাঁচ, সে সারাক্ষণ কথা বলে।",
      },
      {
        en: "When a Kabuliwala comes to the house, Mini is frightened at first and runs inside.",
        bn: "একজন কাবুলিওয়ালা বাড়ির দিকে এলে মিনি প্রথমে ভয় পেয়ে ভেতরে দৌড় দেয়।",
      },
      {
        en: "Over time the two become friends: he brings her raisins and nuts and they chat and laugh together.",
        bn: "ধীরে ধীরে তারা বন্ধু হয়ে যায়: সে কিসমিস-বাদাম আনে, দুজনে গল্প করে হাসে।",
      },
    ],
    keyIdeas: [
      {
        id: "afraid",
        label: {
          en: "Mini is afraid of the Kabuliwala at first",
          bn: "প্রথমে মিনি কাবুলিওয়ালাকে ভয় পায়",
        },
        words: ["ভয়", "afraid", "fear", "scared", "দৌড়", "ran"],
      },
      {
        id: "friends",
        label: { en: "Later they become friends", bn: "পরে তারা বন্ধু হয়" },
        words: ["বন্ধু", "friend", "গল্প", "talk"],
      },
      {
        id: "gifts",
        label: { en: "He gives her raisins and nuts", bn: "সে কিসমিস-বাদাম দেয়" },
        words: ["কিসমিস", "বাদাম", "raisin", "nut", "খোবানি"],
      },
    ],
    recap: {
      en: "Fear turns into friendship between Mini and the Kabuliwala.",
      bn: "মিনি আর কাবুলিওয়ালার মধ্যে ভয় থেকে বন্ধুত্ব।",
    },
  },
};

export const MISCONCEPTIONS: Record<string, L> = {
  "reversed-order": { en: "Reverses the order of the terms", bn: "রাশির ক্রম উল্টে ফেলা" },
  "order-not-reversed": {
    en: "Gives the ratio in the order it was found, not the order asked",
    bn: "প্রশ্নে চাওয়া ক্রম না মেনে পাওয়া ক্রমেই লেখা",
  },
  "middle-not-equalized": {
    en: "Joins two ratios without making the middle term equal",
    bn: "মাঝের রাশি সমান না করেই দুটি অনুপাত জোড়া",
  },
  "terms-mismatched": {
    en: "Puts the right numbers against the wrong quantities",
    bn: "সঠিক সংখ্যা ভুল রাশির সঙ্গে বসানো",
  },
  "picked-wrong-term": {
    en: "Calculates correctly but reports a different term",
    bn: "হিসাব ঠিক, কিন্তু অন্য রাশিটি উত্তর দেওয়া",
  },
  "squared-not-rooted": {
    en: "Squares the terms when the question needs the square root",
    bn: "বর্গমূলের বদলে বর্গ নেওয়া",
  },
  "copied-ratio": {
    en: "Repeats the given ratio without changing it",
    bn: "দেওয়া অনুপাতটিই আবার লেখা",
  },
  "added-not-scaled": {
    en: "Adds a difference instead of scaling by a ratio",
    bn: "অনুপাতে গুণ না করে পার্থক্য যোগ করা",
  },
  "doubled-last-term": {
    en: "Doubles a term instead of using the ratio",
    bn: "অনুপাত না মেনে রাশি দ্বিগুণ করা",
  },
  "total-as-count": {
    en: "Treats the total amount as the number of items",
    bn: "মোট টাকাকে জিনিসের সংখ্যা ধরা",
  },
  "price-as-count": { en: "Treats a price as the number of items", bn: "দামকে জিনিসের সংখ্যা ধরা" },
};

export const SKILLS: Record<string, L> = {
  "ratio-terms": { en: "Ratio terms", bn: "অনুপাতের রাশি" },
  "continued-ratio": { en: "Continued ratio", bn: "ধারাবাহিক অনুপাত" },
  proportion: { en: "Proportion", bn: "সমানুপাত" },
  "profit-loss": { en: "Profit and loss", bn: "লাভ-ক্ষতি" },
  "unitary-work": { en: "Unitary method", bn: "ঐকিক নিয়ম" },
  "time-work": { en: "Time and work", bn: "সময় ও কাজ" },
  pipes: { en: "Pipes and tanks", bn: "নল ও চৌবাচ্চা" },
  "boat-stream": { en: "Boat and stream", bn: "নৌকা ও স্রোত" },
  "train-speed": { en: "Time and distance", bn: "সময় ও দূরত্ব" },
  recall: { en: "Reading for facts", bn: "তথ্য খুঁজে পড়া" },
  inference: { en: "Reading closely", bn: "মনোযোগী পাঠ" },
  apply: { en: "Applying a rule", bn: "নিয়ম প্রয়োগ" },
};

/**
 * Suggested corrections for each mistake pattern. IntelliHorizon's own guidance (not textbook wording), written to be
 * checked against the Class 7 Mathematics Chapter 2 method; shown with that label on the Misconception Radar.
 */
export const CORRECTIONS: Record<string, L> = {
  "reversed-order": { en: "Write the ratio in the order the question names the quantities: the first one named goes first.", bn: "প্রশ্নে যে ক্রমে রাশিগুলোর নাম আছে সেই ক্রমেই অনুপাত লেখো: প্রথমে যার নাম, সে আগে।" },
  "order-not-reversed": { en: "Check which quantity the question asks to compare first, then reorder your answer to match.", bn: "প্রশ্ন কোন রাশিকে আগে তুলনা করতে বলেছে দেখো, তারপর উত্তর সেই ক্রমে সাজাও।" },
  "middle-not-equalized": { en: "Before joining two ratios, make the shared middle term equal (multiply each ratio so the middle numbers match).", bn: "দুটি অনুপাত জোড়ার আগে মাঝের সাধারণ রাশিটি সমান করো (প্রতিটি অনুপাতকে গুণ করে মাঝের সংখ্যা মেলাও)।" },
  "terms-mismatched": { en: "Label each number with its quantity before you write the ratio, so each number stays with the right thing.", bn: "অনুপাত লেখার আগে প্রতিটি সংখ্যার পাশে তার রাশির নাম লেখো, যাতে সংখ্যা ঠিক জিনিসের সঙ্গে থাকে।" },
  "picked-wrong-term": { en: "Reread the last line of the question and underline what it asks for before writing the answer.", bn: "উত্তর লেখার আগে প্রশ্নের শেষ লাইন আবার পড়ো এবং কী চেয়েছে তার নিচে দাগ দাও।" },
  "squared-not-rooted": { en: "If the ratio is of areas or squares and you need lengths, take the square root of each term, don't square it.", bn: "অনুপাত ক্ষেত্রফল বা বর্গের হলে আর দৈর্ঘ্য চাইলে, প্রতিটি রাশির বর্গমূল নাও, বর্গ নয়।" },
  "copied-ratio": { en: "Ask what the question changes (a total, a new term, a scale) and apply that change to the ratio.", bn: "প্রশ্ন কী বদলাতে বলেছে (মোট, নতুন রাশি, মাপ) দেখো এবং সেই পরিবর্তন অনুপাতে প্রয়োগ করো।" },
  "added-not-scaled": { en: "Ratios grow by multiplying both terms by the same number, not by adding the same amount.", bn: "অনুপাত বাড়ে দুই রাশিকে একই সংখ্যা দিয়ে গুণ করে, একই পরিমাণ যোগ করে নয়।" },
  "doubled-last-term": { en: "Use the ratio's own numbers to find each term; don't double a term unless the ratio says 1 : 2.", bn: "প্রতিটি রাশি বের করতে অনুপাতের নিজের সংখ্যা ব্যবহার করো; অনুপাত ১ : ২ না হলে কোনো রাশি দ্বিগুণ করো না।" },
  "total-as-count": { en: "Separate the total amount (money, length) from the number of items before dividing.", bn: "ভাগ করার আগে মোট পরিমাণ (টাকা, দৈর্ঘ্য) আর জিনিসের সংখ্যা আলাদা করো।" },
  "price-as-count": { en: "A price is an amount per item, not how many items there are. Write the unit next to each number.", bn: "দাম হলো প্রতিটির মূল্য, জিনিসের সংখ্যা নয়। প্রতিটি সংখ্যার পাশে একক লেখো।" },
};
