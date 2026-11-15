import { Link, createFileRoute } from "@tanstack/react-router";

import { Frame } from "../components/universe/Shell";
import { PageTitle, Panel } from "../components/universe/ui";
import type { L } from "../content/types";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help and accessibility | IntelliHorizon" }] }),
  component: Help,
});

const QA: { q: L; a: L }[] = [
  {
    q: { en: "Where do the questions come from?", bn: "প্রশ্নগুলো কোথা থেকে আসে?" },
    a: {
      en: "From the exercises printed in your NCTB textbook, with answers from the book's own answer key. Where the book prints no answer, IntelliHorizon works it out exactly and says so. Questions written by IntelliHorizon are reviewed by an editor before any student sees them.",
      bn: "তোমার এনসিটিবি পাঠ্যবইয়ে ছাপা অনুশীলনী থেকে, বইয়ের উত্তরমালার উত্তরসহ। বইয়ে উত্তর না থাকলে ইন্টেলিহরাইজন নির্ভুলভাবে হিসাব করে তা জানায়। ইন্টেলিহরাইজনের লেখা প্রশ্ন কোনো শিক্ষার্থী দেখার আগে সম্পাদক যাচাই করেন।",
    },
  },
  {
    q: { en: "How do I earn XP?", bn: "এক্সপি কীভাবে পাই?" },
    a: {
      en: "From real learning only: a question right for the first time, a mistake fixed, a due revision answered correctly, a chapter explained in your own words, a finished session, or a new chapter opened. Each reward can be earned once.",
      bn: "শুধু আসল শেখা থেকে: প্রথমবার সঠিক উত্তর, ভুল শোধরানো, সময়মতো পুনরালোচনায় সঠিক, নিজের ভাষায় অধ্যায় ব্যাখ্যা, সেশন শেষ, বা নতুন অধ্যায় খোলা। প্রতিটি একবারই পাওয়া যায়।",
    },
  },
  {
    q: { en: "What happens if I miss a day?", bn: "একদিন বাদ পড়লে কী হয়?" },
    a: {
      en: "Nothing you've earned is taken away. One rest day in every seven learning days keeps your streak going.",
      bn: "অর্জিত কিছুই কাটা যায় না। প্রতি সাত দিনে এক দিন বিশ্রাম নিলেও ধারা থাকে।",
    },
  },
  {
    q: { en: "Can I use IntelliHorizon offline?", bn: "অফলাইনে কি ইন্টেলিহরাইজন চলে?" },
    a: {
      en: "Pages you've opened stay available, and answers you give offline are saved on your device and sent once when you reconnect. They're checked and counted then, not before. You can install IntelliHorizon from your browser's menu (Add to Home screen).",
      bn: "খোলা পাতাগুলো পাওয়া যায়, আর অফলাইনে দেওয়া উত্তর ডিভাইসে জমা থাকে এবং সংযোগ ফিরলে একবার পাঠানো হয়। তখনই যাচাই ও গণনা হয়। ব্রাউজারের মেনু থেকে (হোম স্ক্রিনে যোগ করো) ইন্টেলিহরাইজন ইনস্টল করা যায়।",
    },
  },
  {
    q: { en: "Who can see my progress?", bn: "আমার অগ্রগতি কে দেখতে পায়?" },
    a: {
      en: "Only you. Your answers, sessions, notes and tutor conversations are tied to your account and are never shown to other students.",
      bn: "শুধু তুমি। তোমার উত্তর, সেশন, নোট আর টিউটরের কথোপকথন তোমার অ্যাকাউন্টের সঙ্গে যুক্ত, অন্য কোনো শিক্ষার্থী দেখতে পায় না।",
    },
  },
  {
    q: { en: "Is there an English-version book?", bn: "ইংলিশ ভার্সনের বই আছে?" },
    a: {
      en: "Not yet. English-version students see all eight subjects, but the books will be added only after they're supplied and checked. Nothing is translated to fill the gap.",
      bn: "এখনো নেই। ইংলিশ ভার্সনের শিক্ষার্থীরা আটটি বিষয়ই দেখে, তবে বইগুলো পাওয়া ও যাচাইয়ের পরেই যোগ হবে। ফাঁক পূরণে কিছু অনুবাদ করা হয় না।",
    },
  },
];

function Help() {
  const { tx, t } = useLearner();
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageTitle icon="help" title={tx("Help and accessibility", "সাহায্য ও প্রবেশযোগ্যতা")} />
        <Panel className="p-6">
          <h2 className="font-display text-[20px] font-bold">
            {tx("Getting around", "ঘুরে দেখা")}
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[16px] text-ink-mid">
            <li>
              {tx(
                "On a phone, the bar at the bottom has Home, Learn, Practice, AI Tutor and More. More lists every part of IntelliHorizon.",
                "ফোনে নিচের বারে আছে হোম, শেখো, অনুশীলন, এআই টিউটর আর আরও। 'আরও'-তে ইন্টেলিহরাইজনের সব অংশ।",
              )}
            </li>
            <li>
              {tx(
                "Every page works with a keyboard: Tab moves between controls, Enter or Space presses them, and the first Tab offers a link to skip to the content.",
                "প্রতিটি পাতা কিবোর্ডে চলে: ট্যাব দিয়ে এক নিয়ন্ত্রণ থেকে আরেকটিতে, এন্টার বা স্পেস দিয়ে চাপ, আর প্রথম ট্যাবেই সরাসরি মূল অংশে যাওয়ার লিংক।",
              )}
            </li>
            <li>
              {tx(
                "Text size and animation can be changed in ",
                "লেখার আকার ও অ্যানিমেশন বদলাতে পারো ",
              )}
              <Link to="/settings" className="font-semibold text-brand-deep hover:underline">
                {tx("Settings", "সেটিংসে")}
              </Link>
              .
            </li>
            <li>
              {tx(
                "Right and wrong are always shown with words and icons as well as colour.",
                "সঠিক ও ভুল সবসময় রঙের পাশাপাশি শব্দ ও চিহ্নে দেখানো হয়।",
              )}
            </li>
          </ul>
        </Panel>
        <Panel className="divide-y divide-line">
          {QA.map((x, i) => (
            <details key={i} className="group p-5">
              <summary className="cursor-pointer list-none text-[17px] font-semibold marker:hidden">
                {t(x.q)}
              </summary>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-mid">{t(x.a)}</p>
            </details>
          ))}
        </Panel>
        <p className="text-[15px] text-ink-mid">
          <Link to="/privacy" className="font-semibold text-brand-deep hover:underline">
            {tx("Privacy", "গোপনীয়তা")}
          </Link>
        </p>
      </div>
    </Frame>
  );
}
