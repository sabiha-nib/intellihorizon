// Every student-facing module in one list. Navigation, the More page and the dashboard all read from here,
// so a module can't be reachable in one place and missing in another.
import type { L } from "../../content/types";
import type { IconName } from "./icons";

export type Module = {
  id: string;
  to: string;
  icon: IconName;
  label: L;
  blurb: L;
  group: "learn" | "practise" | "progress" | "you";
  admin?: boolean;
};

export const PRIMARY: { to: string; icon: IconName; label: L; match: string[] }[] = [
  { to: "/dashboard", icon: "home", label: { en: "Home", bn: "হোম" }, match: ["/dashboard"] },
  {
    to: "/learn",
    icon: "learn",
    label: { en: "Learn", bn: "শেখো" },
    match: ["/learn", "/subjects", "/books", "/chapters", "/path", "/knowledge-map", "/topics"],
  },
  {
    to: "/practice",
    icon: "practice",
    label: { en: "Practice", bn: "অনুশীলন" },
    match: ["/practice", "/revision", "/quiz"],
  },
  { to: "/tutor", icon: "tutor", label: { en: "AI Tutor", bn: "এআই টিউটর" }, match: ["/tutor"] },
  {
    to: "/progress",
    icon: "progress",
    label: { en: "Progress", bn: "অগ্রগতি" },
    match: ["/progress", "/mastery", "/achievements", "/missions", "/mistakes"],
  },
];

export const MODULES: Module[] = [
  {
    id: "quiz",
    to: "/quiz",
    icon: "play",
    group: "practise",
    label: { en: "IntelliQuiz", bn: "ইন্টেলিকুইজ" },
    blurb: { en: "Daily Five, mistake replay, topic practice and timed exam simulation", bn: "দৈনিক পাঁচ, ভুল আবার করা, টপিক অনুশীলন ও সময় বাঁধা পরীক্ষা" },
  },
  {
    id: "topics",
    to: "/topics",
    icon: "layers",
    group: "learn",
    label: { en: "Topics", bn: "টপিক" },
    blurb: { en: "Topic by topic: material, practice, evidence and revision", bn: "টপিক ধরে: উপাদান, অনুশীলন, প্রমাণ ও পুনরালোচনা" },
  },
  {
    id: "horizon",
    to: "/path",
    icon: "missions",
    group: "learn",
    label: { en: "Horizon Path", bn: "হরাইজন পথ" },
    blurb: { en: "Where you've been, where you are, what's next", bn: "কোথায় ছিলে, কোথায় আছ, এরপর কী" },
  },
  {
    id: "path",
    to: "/learn",
    icon: "learn",
    group: "learn",
    label: { en: "Subjects and books", bn: "বিষয় ও বই" },
    blurb: { en: "Your eight subjects, book by book", bn: "তোমার আটটি বিষয়, বই ধরে ধরে" },
  },
  {
    id: "map",
    to: "/knowledge-map",
    icon: "map",
    group: "learn",
    label: { en: "Knowledge map", bn: "জ্ঞান মানচিত্র" },
    blurb: {
      en: "Every chapter, coloured by your evidence",
      bn: "প্রতিটি অধ্যায়, তোমার প্রমাণ অনুযায়ী রঙে",
    },
  },
  {
    id: "tutor",
    to: "/tutor",
    icon: "tutor",
    group: "learn",
    label: { en: "AI Tutor", bn: "এআই টিউটর" },
    blurb: {
      en: "Answers from checked textbook pages",
      bn: "যাচাই করা পাঠ্যবইয়ের পাতা থেকে উত্তর",
    },
  },
  {
    id: "search",
    to: "/search",
    icon: "search",
    group: "learn",
    label: { en: "Search", bn: "খোঁজো" },
    blurb: {
      en: "Subjects, chapters, passages and your notes",
      bn: "বিষয়, অধ্যায়, অংশ আর তোমার নোট",
    },
  },
  {
    id: "saved",
    to: "/saved",
    icon: "saved",
    group: "learn",
    label: { en: "Saved notes", bn: "সংরক্ষিত নোট" },
    blurb: { en: "Passages and questions you kept", bn: "তোমার রাখা অংশ ও প্রশ্ন" },
  },
  {
    id: "lab",
    to: "/sky",
    icon: "spark",
    group: "learn",
    label: { en: "Concept lab", bn: "ধারণা ল্যাব" },
    blurb: {
      en: "Hands-on ideas, not tied to a chapter",
      bn: "হাতেকলমে ধারণা, কোনো অধ্যায়ের সঙ্গে বাঁধা নয়",
    },
  },
  {
    id: "practice",
    to: "/practice",
    icon: "practice",
    group: "practise",
    label: { en: "Learning Sessions", bn: "লার্নিং সেশন" },
    blurb: {
      en: "Learn, try, fix and remember in one go",
      bn: "এক বসায় শেখো, চেষ্টা করো, ঠিক করো, মনে রাখো",
    },
  },
  {
    id: "plan",
    to: "/plan",
    icon: "plan",
    group: "practise",
    label: { en: "Today's plan", bn: "আজকের পরিকল্পনা" },
    blurb: {
      en: "A short plan that ticks itself off",
      bn: "ছোট পরিকল্পনা, কাজ হলে নিজেই টিক পড়ে",
    },
  },
  {
    id: "revision",
    to: "/revision",
    icon: "revision",
    group: "practise",
    label: { en: "Revision queue", bn: "পুনরালোচনা" },
    blurb: { en: "Questions due back today", bn: "আজ যে প্রশ্নগুলো ফিরে এসেছে" },
  },
  {
    id: "mistakes",
    to: "/mistakes",
    icon: "radar",
    group: "practise",
    label: { en: "Misconception Radar", bn: "ভুল ধারণার রাডার" },
    blurb: {
      en: "Mistakes you repeat, and the ones you fixed",
      bn: "বারবার হওয়া ভুল, আর যেগুলো ঠিক করেছ",
    },
  },
  {
    id: "progress",
    to: "/progress",
    icon: "progress",
    group: "progress",
    label: { en: "Progress", bn: "অগ্রগতি" },
    blurb: { en: "Activity, accuracy and your level", bn: "কাজ, সঠিকতা আর তোমার লেভেল" },
  },
  {
    id: "mastery",
    to: "/mastery",
    icon: "evidence",
    group: "progress",
    label: { en: "Mastery evidence", bn: "দক্ষতার প্রমাণ" },
    blurb: { en: "What your answers actually show", bn: "তোমার উত্তর আসলে কী দেখায়" },
  },
  {
    id: "missions",
    to: "/missions",
    icon: "missions",
    group: "progress",
    label: { en: "Missions", bn: "মিশন" },
    blurb: { en: "Today's four small goals", bn: "আজকের চারটি ছোট লক্ষ্য" },
  },
  {
    id: "achievements",
    to: "/achievements",
    icon: "achievements",
    group: "progress",
    label: { en: "Achievements", bn: "অর্জন" },
    blurb: { en: "Earned for specific things you did", bn: "নির্দিষ্ট কাজের জন্য পাওয়া" },
  },
  {
    id: "history",
    to: "/history",
    icon: "history",
    group: "progress",
    label: { en: "Learning history", bn: "শেখার ইতিহাস" },
    blurb: {
      en: "Sessions, chapters and questions, newest first",
      bn: "সেশন, অধ্যায় ও প্রশ্ন, নতুনগুলো আগে",
    },
  },
  {
    id: "settings",
    to: "/settings",
    icon: "settings",
    group: "you",
    label: { en: "Settings", bn: "সেটিংস" },
    blurb: { en: "Language, goal, text size and motion", bn: "ভাষা, লক্ষ্য, লেখার আকার, নড়াচড়া" },
  },
  {
    id: "account",
    to: "/account",
    icon: "user",
    group: "you",
    label: { en: "Account", bn: "অ্যাকাউন্ট" },
    blurb: { en: "Profile, email and password", bn: "প্রোফাইল, ইমেইল ও পাসওয়ার্ড" },
  },
  {
    id: "help",
    to: "/help",
    icon: "help",
    group: "you",
    label: { en: "Help & accessibility", bn: "সাহায্য ও প্রবেশযোগ্যতা" },
    blurb: {
      en: "How IntelliHorizon works and how to get around",
      bn: "ইন্টেলিহরাইজন কীভাবে চলে, কীভাবে ঘুরবে",
    },
  },
  {
    id: "admin",
    to: "/admin",
    icon: "shield",
    group: "you",
    admin: true,
    label: { en: "Content Studio", bn: "কনটেন্ট স্টুডিও" },
    blurb: {
      en: "Imports, OCR review, questions and audit",
      bn: "আমদানি, ওসিআর যাচাই, প্রশ্ন ও নিরীক্ষা",
    },
  },
];

export const GROUPS: { id: Module["group"]; label: L }[] = [
  { id: "learn", label: { en: "Learn", bn: "শেখো" } },
  { id: "practise", label: { en: "Practise", bn: "অনুশীলন" } },
  { id: "progress", label: { en: "Progress", bn: "অগ্রগতি" } },
  { id: "you", label: { en: "You", bn: "তুমি" } },
];
