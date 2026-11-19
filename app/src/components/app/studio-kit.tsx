import type { ReactNode } from "react";

import { PaperPage } from "../edu/ui";
import { PageHeader, SignInPrompt, card } from "./kit";
import { useLearner } from "../../lib/store";
import type { L } from "../../content/types";

/** Page frame shared by the study-tool pages: header, sign-in gate, and an honest note on what the page does and doesn't do. */
export function StudioPage({ title, subtitle, next, needsAccount = true, why, note, children }: { title: string; subtitle: string; next: string; needsAccount?: boolean; why?: L; note?: string; children: ReactNode }) {
  const { account } = useLearner();
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-6 md:px-6">
        <PageHeader title={title} subtitle={subtitle} />
        {note && <p className="rounded-[14px] bg-lilac px-3.5 py-2.5 text-sm leading-relaxed">{note}</p>}
        {needsAccount && !account ? <SignInPrompt next={next} why={why ?? { en: "This belongs to your account.", bn: "এটি তোমার অ্যাকাউন্টের।" }} /> : children}
      </main>
    </PaperPage>
  );
}
export const btn = "inline-flex h-10 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-sheet hover:opacity-90 disabled:opacity-50";
export const btnGhost = "inline-flex h-10 items-center justify-center rounded-full border border-ink-low/30 bg-sheet px-4 text-sm font-semibold hover:border-ink disabled:opacity-50";
export const input = "w-full rounded-[12px] border border-ink-low/30 bg-sheet px-3 py-2 text-[15px] focus:border-brand focus:outline-none";
export function Loading() { return <div className={`${card} h-32 animate-pulse motion-reduce:animate-none`} />; }
export function ErrorLine({ code }: { code: string | null }) {
  const { tx } = useLearner();
  if (!code) return null;
  const m: Record<string, [string, string]> = {
    signed_out: ["Please sign in again.", "আবার সাইন ইন করো।"], too_many: ["You've reached the limit for this.", "এর সীমা পূর্ণ হয়েছে।"], not_found: ["That item couldn't be found.", "জিনিসটি পাওয়া যায়নি।"],
    empty: ["Write at least one answer first.", "আগে অন্তত একটি উত্তর লেখো।"], invalid_code: ["That code isn't valid. It may have expired or been withdrawn.", "কোডটি বৈধ নয়। মেয়াদ শেষ বা বাতিল হয়ে থাকতে পারে।"],
    rate_limited: ["Too many tries. Wait a few minutes.", "অনেকবার চেষ্টা হয়েছে। কয়েক মিনিট অপেক্ষা করো।"], not_configured: ["The AI provider isn't configured on this site.", "এই সাইটে এআই প্রদানকারী চালু নেই।"],
  };
  const t = m[code] ?? [`Something went wrong (${code}).`, `কিছু ভুল হয়েছে (${code})।`];
  return <p role="alert" className="text-sm font-semibold text-again">{tx(t[0], t[1])}</p>;
}
