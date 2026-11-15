import { createFileRoute } from "@tanstack/react-router";

import { PaperPage } from "../components/edu/ui";
import type { L } from "../content/types";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Your information | IntelliHorizon" }] }),
  component: Privacy,
});

const BLOCKS: { h: L; p: L }[] = [
  { h: { en: "What we ask for, and why", bn: "আমরা কী জানতে চাই, আর কেন" }, p: { en: "Your name and username so IntelliHorizon can greet you. Your email so you can sign in and recover your account. Your class and curriculum to show the right chapters and language. Your district to add local examples. Your school is optional. A photo is optional, and you can use an illustration instead.", bn: "নাম ও ইউজারনেম, যাতে ইন্টেলিহরাইজন তোমাকে চিনতে পারে। ইমেইল, যাতে সাইন ইন ও অ্যাকাউন্ট উদ্ধার করা যায়। শ্রেণি ও পাঠ্যক্রম, সঠিক অধ্যায় ও ভাষা দেখাতে। জেলা, স্থানীয় উদাহরণ দিতে। স্কুল ঐচ্ছিক। ছবিও ঐচ্ছিক, চাইলে একটি আঁকা ছবি বেছে নিতে পারো।" } },
  { h: { en: "What we never ask for", bn: "যা আমরা কখনো চাই না" }, p: { en: "Your birthday, phone number, home address, or anything about your family, health or religion.", bn: "জন্মতারিখ, ফোন নম্বর, বাসার ঠিকানা, বা পরিবার, স্বাস্থ্য বা ধর্ম সম্পর্কে কিছু।" } },
  { h: { en: "Who can see it", bn: "কে দেখতে পারে" }, p: { en: "Only you. There are no public profiles. Your photo can only be loaded by you while signed in. Teacher or family sharing happens only if you switch it on in your Mirror.", bn: "শুধু তুমি। কোনো পাবলিক প্রোফাইল নেই। সাইন ইন অবস্থায় শুধু তুমিই তোমার ছবি দেখতে পারো। শিক্ষক বা পরিবারের সাথে শেয়ার হয় শুধু তুমি আয়নায় চালু করলে।" } },
  { h: { en: "How it's protected", bn: "কীভাবে সুরক্ষিত রাখা হয়" }, p: { en: "Your password is never stored, only a one-way scrambled version of it. Sign-in sessions use secure cookies that scripts on the page cannot read. When you choose a photo it is cropped on your device, which also removes hidden details such as location, before it is uploaded.", bn: "তোমার পাসওয়ার্ড কখনো সংরক্ষণ হয় না, শুধু তার একমুখী এলোমেলো রূপ রাখা হয়। সাইন-ইন সেশন নিরাপদ কুকি ব্যবহার করে, যা পেজের স্ক্রিপ্ট পড়তে পারে না। ছবি বাছলে তা আপলোডের আগে তোমার ডিভাইসেই কাটা হয়, এতে অবস্থানের মতো লুকানো তথ্যও মুছে যায়।" } },
  { h: { en: "AI explanations and homework photos", bn: "এআই ব্যাখ্যা ও হোমওয়ার্কের ছবি" }, p: { en: "When AI explanations are switched on, your question and the textbook passages found for it are sent to IntelliHorizon's AI provider to write the explanation, along with a short summary of your practice on that chapter. Your name, username, email and school are never sent. A homework photo is sent only when you choose \"Read this photo\"; the photo itself isn't kept, and the words read from it stay in your account for 30 days. IntelliHorizon logs only that a request happened (time, model, outcome), not what you asked. Typed questions, PDFs (read on your device) and voice (handled by your browser) never require AI.", bn: "এআই ব্যাখ্যা চালু থাকলে, ব্যাখ্যা লিখতে তোমার প্রশ্ন ও তার জন্য পাওয়া পাঠ্যবইয়ের অংশ ইন্টেলিহরাইজনের এআই সেবায় পাঠানো হয়, সঙ্গে ওই অধ্যায়ে তোমার অনুশীলনের ছোট সারাংশ। তোমার নাম, ইউজারনেম, ইমেইল ও স্কুল কখনো পাঠানো হয় না। হোমওয়ার্কের ছবি পাঠানো হয় শুধু তুমি \"ছবিটি পড়ো\" বাছলে; ছবিটি রাখা হয় না, আর তা থেকে পড়া কথাগুলো ৩০ দিন তোমার অ্যাকাউন্টে থাকে। ইন্টেলিহরাইজন শুধু অনুরোধের সময়, মডেল ও ফল লিখে রাখে, তুমি কী জিজ্ঞেস করেছ তা নয়। লিখে প্রশ্ন, পিডিএফ (তোমার ডিভাইসে পড়া) ও কণ্ঠ (তোমার ব্রাউজারে) ব্যবহারে এআই লাগে না।" } },
  { h: { en: "What we don't do", bn: "যা আমরা করি না" }, p: { en: "We don't sell your information, show ads, or send your profile to advertising or analytics companies or to AI models (only the question-related text described above). When you choose a password, only the first five characters of a scrambled code of it are checked against a public list of leaked passwords, never the password itself.", bn: "আমরা তোমার তথ্য বিক্রি করি না, বিজ্ঞাপন দেখাই না, আর প্রোফাইল বিজ্ঞাপন, বিশ্লেষণ প্রতিষ্ঠান বা এআই মডেলে পাঠাই না (শুধু উপরে বলা প্রশ্ন-সংক্রান্ত লেখা)। পাসওয়ার্ড বাছার সময় শুধু তার এলোমেলো কোডের প্রথম পাঁচটি অক্ষর ফাঁস হওয়া পাসওয়ার্ডের পাবলিক তালিকার সাথে মেলানো হয়, পাসওয়ার্ড নিজে নয়।" } },
  { h: { en: "Your choices", bn: "তোমার হাতে যা আছে" }, p: { en: "You can change your profile at any time, sign out on any device, and permanently delete your account and all learning progress from your account page.", bn: "যেকোনো সময় প্রোফাইল বদলাতে পারো, যেকোনো ডিভাইস থেকে সাইন আউট করতে পারো, আর অ্যাকাউন্ট পেজ থেকে অ্যাকাউন্ট ও শেখার সব অগ্রগতি স্থায়ীভাবে মুছে ফেলতে পারো।" } },
  { h: { en: "If you're under 18", bn: "তোমার বয়স ১৮-এর কম হলে" }, p: { en: "Please tell a parent or guardian that you use IntelliHorizon and show them this page. Before IntelliHorizon launches in schools, its guardian consent process will be confirmed against Bangladeshi law and school policies.", bn: "মা-বাবা বা অভিভাবককে জানাও যে তুমি ইন্টেলিহরাইজন ব্যবহার করো, আর এই পেজটি দেখাও। স্কুলে চালু হওয়ার আগে অভিভাবকের সম্মতির প্রক্রিয়া বাংলাদেশের আইন ও স্কুলের নীতির সাথে মিলিয়ে নিশ্চিত করা হবে।" } },
];

function Privacy() {
  const { t, tx } = useLearner();
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 md:px-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">{tx("Your information, in plain words", "তোমার তথ্য, সহজ ভাষায়")}</h1>
        <p className="mt-3 text-ink-mid">{tx("IntelliHorizon is used by students, many of them under 18. This is how we treat what you share.", "ইন্টেলিহরাইজন ব্যবহার করে শিক্ষার্থীরা, যাদের অনেকের বয়স ১৮-এর কম। তুমি যা দাও তা আমরা এভাবে রাখি।")}</p>
        <div className="mt-8 space-y-7">
          {BLOCKS.map((b) => (
            <section key={b.h.en}>
              <h2 className="text-lg font-semibold">{t(b.h)}</h2>
              <p className="mt-1.5 max-w-[65ch] leading-relaxed text-ink-mid">{t(b.p)}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-ink-low">{tx("This notice describes how the pilot works today. It is not yet a legal policy reviewed by a lawyer.", "এই নোটিশ পাইলট এখন কীভাবে চলে তা বলে। এটি এখনো আইনজীবীর পর্যালোচিত আইনি নীতি নয়।")}</p>
      </main>
    </PaperPage>
  );
}
