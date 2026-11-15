import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { EmptyState, PageHeader, SignInPrompt, SourceCard, SubjectFilter, card } from "../components/app/kit";
import type { SubjectId } from "../lib/curriculum/registry";
import { PaperPage } from "../components/edu/ui";
import { deleteSaved, listSaved } from "../lib/api/tutor.functions";
import type { SourceRef } from "../lib/tutor/types";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved notes | IntelliHorizon" }] }),
  component: Saved,
});

type Item = { id: string; kind: string; excerpt: string | null; source: string | null; created_at: string };

function Saved() {
  const { tx, account } = useLearner();
  const [items, setItems] = useState<Item[] | null>(null);
  const [subject, setSubject] = useState<SubjectId | null>(null);
  useEffect(() => { if (account) { setItems(null); void call(listSaved({ data: { subjectId: subject } })).then((r) => setItems(r.ok ? r.items : [])); } }, [account, subject]);
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-6 md:px-6">
        <PageHeader title={tx("Saved notes", "সংরক্ষিত নোট")} subtitle={tx("Textbook passages you saved from the tutor, each with its source.", "টিউটর থেকে রাখা পাঠ্যবইয়ের অংশ, প্রতিটির উৎসসহ।")} />
        {account && <SubjectFilter value={subject} onChange={setSubject} />}
        {!account ? <SignInPrompt next="/saved" why={{ en: "Saved notes belong to your account.", bn: "সংরক্ষিত নোট তোমার অ্যাকাউন্টের।" }} /> : items === null ? <div className={`${card} h-32 animate-pulse motion-reduce:animate-none`} /> : items.length === 0 ? (
          <EmptyState title={subject ? tx("Nothing saved for this subject", "এই বিষয়ে কিছু রাখা হয়নি") : tx("Nothing saved yet", "এখনো কিছু রাখা হয়নি")} body={tx("When the tutor shows a passage you want to keep, choose \"Save to my notes\".", "টিউটর কোনো অংশ দেখালে রাখতে চাইলে \"নোটে রাখো\" চাপো।")} />
        ) : (
          <ul className="space-y-4">
            {items.map((it) => {
              const src = it.source ? (JSON.parse(it.source) as SourceRef) : null;
              return (
                <li key={it.id} className={`${card} p-5`}>
                  <blockquote lang={src?.language} className="border-l-[3px] border-thread pl-3.5 leading-[1.75]">{it.excerpt}</blockquote>
                  {src && <SourceCard source={src} />}
                  <button type="button" onClick={async () => { const r = await call(deleteSaved({ data: { id: it.id } })); if (r.ok) setItems((x) => x?.filter((y) => y.id !== it.id) ?? null); }} className="mt-3 text-sm font-semibold text-ink-mid underline decoration-dashed underline-offset-4 hover:text-again">{tx("Remove", "সরাও")}</button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </PaperPage>
  );
}
