import type { L, SubjectId } from "./types";

export type Subject = {
  id: SubjectId;
  name: L;
  thread: string;
  world: L;
  signature: L;
  /** constellation centre: desktop in 1000x620, mobile in 400x780 */
  desk: [number, number];
  mob: [number, number];
};

export const SUBJECTS: Subject[] = [
  { id: "physics", name: { en: "Physics", bn: "পদার্থবিজ্ঞান" }, thread: "#E8644A", world: { en: "A world of forces you can switch on and off.", bn: "এমন এক জগৎ যেখানে বল চালু-বন্ধ করা যায়।" }, signature: { en: "Predict first, then run the experiment and watch your prediction meet reality.", bn: "আগে অনুমান করো, তারপর পরীক্ষা চালিয়ে দেখো অনুমান মিলল কিনা।" }, desk: [170, 170], mob: [105, 120] },
  { id: "math", name: { en: "Mathematics", bn: "গণিত" }, thread: "#E2A93B", world: { en: "Quantities you can cut, stretch and compare with your hands.", bn: "এমন রাশি যা হাত দিয়ে কাটা, টানা আর তুলনা করা যায়।" }, signature: { en: "Every rule earns its place: you see why a procedure works before you use it.", bn: "প্রতিটি নিয়ম কেন কাজ করে তা আগে দেখো, তারপর ব্যবহার করো।" }, desk: [430, 125], mob: [295, 125] },
  { id: "biology", name: { en: "Biology", bn: "জীববিজ্ঞান" }, thread: "#8DBF5A", world: { en: "Living systems, read like evidence.", bn: "জীবন্ত তন্ত্র, প্রমাণের মতো করে পড়া।" }, signature: { en: "Sort real evidence, then decide whether your first idea survives.", bn: "আসল প্রমাণ সাজাও, তারপর ঠিক করো তোমার প্রথম ধারণা টেকে কিনা।" }, desk: [690, 170], mob: [105, 310] },
  { id: "chemistry", name: { en: "Chemistry", bn: "রসায়ন" }, thread: "#4FB5A5", world: { en: "Zoom from a glass of water down to its particles.", bn: "এক গ্লাস পানি থেকে জুম করে তার কণা পর্যন্ত।" }, signature: { en: "Every visible change is paired with what the particles are doing.", bn: "প্রতিটি দৃশ্যমান পরিবর্তনের পাশে কণার আচরণ দেখানো হয়।" }, desk: [880, 330], mob: [295, 310] },
  { id: "english", name: { en: "English", bn: "ইংরেজি" }, thread: "#7FA7EA", world: { en: "Conversations, arguments and audiences.", bn: "কথোপকথন, যুক্তি আর শ্রোতা।" }, signature: { en: "Rewrite a message for three different listeners and see how each one reacts.", bn: "একই বার্তা তিন রকম শ্রোতার জন্য লেখো এবং প্রতিক্রিয়া দেখো।" }, desk: [640, 470], mob: [105, 490] },
  { id: "bangla", name: { en: "Bangla", bn: "বাংলা" }, thread: "#E57AA0", world: { en: "Meaning, rhythm and expression in your own language.", bn: "নিজের ভাষায় অর্থ, ছন্দ ও প্রকাশ।" }, signature: { en: "Read a poem line by line and defend your interpretation with words from the text.", bn: "লাইন ধরে কবিতা পড়ো আর পাঠ থেকে শব্দ দিয়ে নিজের ব্যাখ্যা দাঁড় করাও।" }, desk: [390, 460], mob: [295, 490] },
  { id: "ict", name: { en: "ICT", bn: "তথ্য ও যোগাযোগ প্রযুক্তি" }, thread: "#A9B6D8", world: { en: "Instructions, logic and the machines that follow them.", bn: "নির্দেশ, যুক্তি আর যে যন্ত্র তা মানে।" }, signature: { en: "Find the bug in a robot's route before it walks into the river.", bn: "রোবটের পথের ভুলটা খুঁজে বের করো, নদীতে পড়ার আগেই।" }, desk: [140, 440], mob: [105, 665] },
  { id: "social", name: { en: "History and Society", bn: "ইতিহাস ও সমাজ" }, thread: "#C98B62", world: { en: "Sources, places and the people behind events.", bn: "উৎস, স্থান আর ঘটনার পেছনের মানুষ।" }, signature: { en: "Weigh two sources that disagree and decide what can be trusted.", bn: "দুটি ভিন্নমতের উৎস যাচাই করে ঠিক করো কোনটি বিশ্বাসযোগ্য।" }, desk: [880, 555], mob: [295, 665] },
];

export const subjectById = (id: string) => SUBJECTS.find((s) => s.id === id);
