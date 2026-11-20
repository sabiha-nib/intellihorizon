import { Link } from "@tanstack/react-router";

import { Icon } from "../universe/icons";
import { useLearner } from "../../lib/store";

/**
 * Shown only in an isolated judge-demo workspace: what this account is, its curriculum, and a short guided journey
 * through the real product. Every step opens a real screen; nothing here is a recording or a mock-up.
 */
export function JudgeWelcome({ expiresAt }: { expiresAt: string }) {
  const { tx, lang } = useLearner();
  const until = expiresAt ? new Date(expiresAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "Asia/Dhaka" }) : "";
  const steps: { to: string; search?: Record<string, string>; title: string; body: string }[] = [
    { to: "/tutor", search: { subject: "mathematics", q: "ধারাবাহিক অনুপাত কাকে বলে?" }, title: tx("Ask IntelliTutor in Bangla", "বাংলায় ইন্টেলিটিউটরকে জিজ্ঞেস করুন"), body: tx("The question is pre-filled. The answer quotes your checked Class 7 Mathematics text and labels every part.", "প্রশ্নটি আগে থেকে লেখা আছে। উত্তর ৭ম শ্রেণির যাচাই করা গণিতের লেখা থেকে উদ্ধৃতি দেয় এবং প্রতিটি অংশে লেবেল থাকে।") },
    { to: "/tutor", search: { subject: "mathematics", q: "Explain continued ratio in English" }, title: tx("Switch to English", "ইংরেজিতে বদলান"), body: tx("Same Bangla textbook, explained in English. The app shows how it searched, and never presents a translation as a quotation.", "একই বাংলা পাঠ্যবই, ব্যাখ্যা ইংরেজিতে। অ্যাপ দেখায় কীভাবে খুঁজেছে, আর অনুবাদকে কখনো উদ্ধৃতি হিসেবে দেখায় না।") },
    { to: "/tutor", search: { subject: "mathematics", q: "৫ : ৩ ও ২ : ৫\n৫ : ৩ = ১০ : ৬\n২ : ৫ = ৬ : ১৬" }, title: tx("Let it check maths working", "গণিতের ধাপ যাচাই করান"), body: tx("Pre-filled working with a mistake on the last line. The app recalculates each step exactly and points to the first wrong one.", "শেষ লাইনে একটি ভুলসহ ধাপ আগে থেকে লেখা। অ্যাপ প্রতিটি ধাপ হুবহু আবার কষে প্রথম ভুল ধাপটি দেখায়।") },
    { to: "/quiz", title: tx("Answer a checked practice question", "একটি যাচাই করা অনুশীলন প্রশ্নের উত্তর দিন"), body: tx("Questions come from the textbook's own exercises, graded on the server.", "প্রশ্নগুলো পাঠ্যবইয়ের নিজস্ব অনুশীলনী থেকে, সার্ভারে মূল্যায়ন হয়।") },
    { to: "/twin", title: tx("See what your evidence shows", "আপনার প্রমাণ কী দেখায় দেখুন"), body: tx("Learning Twin and progress update from what you just did, never from guesses.", "লার্নিং টুইন ও অগ্রগতি আপনার এইমাত্র করা কাজ থেকে হালনাগাদ হয়, অনুমান থেকে নয়।") },
    { to: "/start", title: tx("Check curriculum coverage", "পাঠ্যক্রমের ব্যাপ্তি দেখুন"), body: tx("Classes 6–10, both versions, with honest availability for each.", "৬ষ্ঠ–১০ম শ্রেণি, দুই ভার্সন, প্রতিটির সঠিক প্রাপ্যতাসহ।") },
  ];
  return (
    <section aria-labelledby="judge-h" data-testid="judge-welcome" className="rounded-[28px] border border-brand/25 bg-sheet p-6 md:p-7">
      <p className="text-sm font-semibold text-brand-deep">{tx("Judge demo workspace", "বিচারকের ডেমো ওয়ার্কস্পেস")}</p>
      <h2 id="judge-h" className="mt-1 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight">{tx("Welcome to IntelliHorizon", "ইন্টেলিহরাইজনে স্বাগতম")}</h2>
      <p className="mt-2 flex flex-wrap gap-2 text-sm" data-testid="judge-curriculum">
        {[tx("Class 7", "৭ম শ্রেণি"), tx("NCTB Bangladesh", "এনসিটিবি বাংলাদেশ"), tx("Bangla Version", "বাংলা ভার্সন"), tx("Tutor replies in Bangla", "টিউটর বাংলায় উত্তর দেয়")].map((x) => (
          <span key={x} className="rounded-full bg-lilac px-3 py-1 font-semibold text-ink">{x}</span>
        ))}
      </p>
      <p className="mt-3 max-w-prose text-[15px] text-ink-mid">
        {tx(`This private workspace started empty, so everything you see comes from what you do here. Other judges can't see it, and it ends ${until} (Dhaka time). Content today: Class 7, Bangla Version, starting with checked Mathematics passages; other classes and versions are shown honestly as coming soon.`, `এই ব্যক্তিগত ওয়ার্কস্পেস শূন্য থেকে শুরু হয়েছে, তাই এখানে যা দেখবেন সব আপনার কাজ থেকে। অন্য বিচারকেরা এটি দেখতে পান না, এবং এটি শেষ হবে ${until} (ঢাকা সময়)। আজকের বিষয়বস্তু: ৭ম শ্রেণি, বাংলা ভার্সন, শুরুতে গণিতের যাচাই করা পাঠ্যাংশ; অন্য শ্রেণি ও ভার্সন সঠিকভাবে "শীঘ্রই আসছে" দেখানো আছে।`)}
      </p>
      <Link to="/tutor" search={{ subject: "mathematics" }} className="mt-5 inline-flex items-center gap-2 rounded-[14px] bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-deep">
        <Icon name="tutor" size={20} /> {tx("Open IntelliTutor", "ইন্টেলিটিউটর খুলুন")}
      </Link>
      <ol className="mt-6 grid gap-3 md:grid-cols-2" aria-label={tx("Guided demonstration", "নির্দেশিত প্রদর্শনী")}>
        {steps.map((s, i) => (
          <li key={i}>
            <Link to={s.to} search={s.search as never} className="flex h-full gap-3 rounded-[18px] border border-line bg-canvas p-4 hover:border-line-strong" data-step={i + 1}>
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-deep">{lang === "bn" ? "১২৩৪৫৬"[i] : i + 1}</span>
              <span><span className="block font-semibold text-ink">{s.title}</span><span className="mt-0.5 block text-sm text-ink-mid">{s.body}</span></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
