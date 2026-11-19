import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { MathText } from "../components/app/MathText";
import { EmptyState, card } from "../components/app/kit";
import { Loading, StudioPage } from "../components/app/studio-kit";
import { listFormulas } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/formulas")({
  head: () => ({ meta: [{ title: "FormulaVault | IntelliHorizon" }] }),
  component: Formulas,
});

type F = { id: string; name: string; name_en: string | null; expression: string; variables: string | null; explanation: string | null; example: string | null; printed_page: number | null; provenance: string; review_status: string; chapter_title: string; book_title: string; passage_text: string | null };

function Formulas() {
  const { tx } = useLearner();
  const [list, setList] = useState<F[] | null>(null);
  useEffect(() => { void call(listFormulas()).then((r) => setList(r.ok ? r.formulas : [])); }, []);
  return (
    <StudioPage needsAccount={false} next="/formulas" title={tx("FormulaVault", "সূত্র ভান্ডার")} subtitle={tx("Formulas and rules from your textbook, checked before they appear here. Each shows the page it comes from.", "পাঠ্যবইয়ের সূত্র ও নিয়ম, এখানে দেখানোর আগে যাচাই করা। প্রতিটির সঙ্গে পৃষ্ঠা দেখানো আছে।")}>
      {list === null ? <Loading /> : list.length === 0 ? <EmptyState title={tx("No checked formulas yet", "এখনো যাচাই করা সূত্র নেই")} body={tx("Formulas appear once a reviewer has checked them against the book.", "পর্যালোচক বইয়ের সঙ্গে মিলিয়ে যাচাই করলে সূত্র এখানে আসবে।")} /> : (
        <ul className="space-y-4">{list.map((f) => {
          const vars = f.variables ? (JSON.parse(f.variables) as { symbol: string; meaning: string }[]) : [];
          return (
            <li key={f.id} className={`${card} space-y-2 p-5`} data-testid="formula">
              <h2 className="font-display text-lg font-bold" lang="bn">{f.name}</h2>{f.name_en && <p className="text-sm text-ink-mid">{f.name_en}</p>}
              <p className="rounded-[12px] bg-lilac px-3 py-2 text-lg" lang="bn"><MathText text={f.expression} /></p>
              {vars.length > 0 && <ul className="text-sm">{vars.map((v) => <li key={v.symbol} lang="bn"><MathText text={`$${v.symbol}$`} />: {v.meaning}</li>)}</ul>}
              {f.explanation && <p lang="bn" className="leading-relaxed">{f.explanation}</p>}
              {f.example && <p lang="bn" className="text-sm text-ink-mid">{tx("Book example: ", "বইয়ের উদাহরণ: ")}{f.example}</p>}
              <p className="text-xs text-ink-low">{f.book_title} · {f.chapter_title}{f.printed_page ? tx(` · printed page ${f.printed_page}`, ` · ছাপা পৃষ্ঠা ${f.printed_page}`) : ""} · {f.review_status === "teacher_reviewed" ? tx("teacher reviewed", "শিক্ষক পর্যালোচিত") : tx("checked, not yet reviewed by a teacher", "যাচাই করা, শিক্ষক এখনো পর্যালোচনা করেননি")}</p>
              <p className="text-xs text-ink-low">{f.provenance}</p>
              {f.passage_text && <details className="text-sm"><summary className="cursor-pointer font-semibold">{tx("Show the textbook passage", "পাঠ্যবইয়ের অংশ দেখাও")}</summary><blockquote lang="bn" className="mt-2 border-l-[3px] border-thread pl-3.5 leading-[1.75]">{f.passage_text}</blockquote></details>}
            </li>
          );
        })}</ul>
      )}
      <p className="text-sm"><Link to="/cards" className="font-semibold underline underline-offset-4">{tx("Practise recall with MemoryCards", "মেমরি কার্ডে মনে রাখার অনুশীলন করো")}</Link></p>
    </StudioPage>
  );
}
