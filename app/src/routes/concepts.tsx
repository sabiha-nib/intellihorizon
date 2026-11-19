import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { EmptyState, card } from "../components/app/kit";
import { Loading, StudioPage } from "../components/app/studio-kit";
import { listConcepts } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/concepts")({
  head: () => ({ meta: [{ title: "ConceptConnect | IntelliHorizon" }] }),
  component: Concepts,
});

const KIND: Record<string, [string, string]> = { prerequisite: ["comes before", "আগে শিখতে হয়"], related: ["is related to", "সম্পর্কিত"], application: ["is used in", "ব্যবহৃত হয়"], contrast: ["is different from", "ভিন্ন"] };

function Concepts() {
  const { tx } = useLearner();
  const [d, setD] = useState<{ links: { id: string; kind: string; justification: string; from_id: string; from_title: string; to_id: string; to_title: string; pdf_page: number | null }[]; topics: { id: string; title: string }[] } | null>(null);
  useEffect(() => { void call(listConcepts()).then((r) => setD(r.ok ? r : { links: [], topics: [] })); }, []);
  const linked = new Set(d?.links.flatMap((l) => [l.from_id, l.to_id]) ?? []);
  return (
    <StudioPage needsAccount={false} next="/concepts" title={tx("ConceptConnect", "ধারণা সংযোগ")} subtitle={tx("How topics connect. Every link was checked by a reviewer and carries its reason. Links are never guessed.", "টপিকগুলো কীভাবে যুক্ত। প্রতিটি সংযোগ পর্যালোচক যাচাই করেছেন এবং কারণসহ দেখানো। অনুমানে সংযোগ দেওয়া হয় না।")}>
      {d === null ? <Loading /> : d.links.length === 0 ? <EmptyState title={tx("No checked links yet", "এখনো যাচাই করা সংযোগ নেই")} body={tx("Links appear after review.", "পর্যালোচনার পর সংযোগ আসবে।")} /> : (
        <ul className="space-y-3">{d.links.map((l) => (
          <li key={l.id} className={`${card} p-5`} data-testid="concept-link">
            <p className="text-lg"><Link to="/topics/$topicId" params={{ topicId: l.from_id }} className="font-semibold underline underline-offset-4" lang="bn">{l.from_title}</Link> <span className="text-ink-mid">{tx(KIND[l.kind][0], KIND[l.kind][1])}</span> <Link to="/topics/$topicId" params={{ topicId: l.to_id }} className="font-semibold underline underline-offset-4" lang="bn">{l.to_title}</Link></p>
            <p className="mt-1 text-sm text-ink-mid">{tx("Why: ", "কারণ: ")}{l.justification}</p>
          </li>))}</ul>
      )}
      {d && d.topics.some((t) => !linked.has(t.id)) && (
        <p className="text-sm text-ink-mid">{tx("Topics with no checked link yet: ", "এখনো যাচাই করা সংযোগ নেই এমন টপিক: ")}<span lang="bn">{d.topics.filter((t) => !linked.has(t.id)).map((t) => t.title).join(", ")}</span></p>
      )}
    </StudioPage>
  );
}
