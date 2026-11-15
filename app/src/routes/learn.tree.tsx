import { createFileRoute } from "@tanstack/react-router";

import { EvidenceBoard } from "../components/edu/EvidenceBoard";
import { LessonShell, parsePhase } from "../components/edu/LessonShell";
import { TREE } from "../content/tree";
import type { Phase } from "../lib/next";

export const Route = createFileRoute("/learn/tree")({
  validateSearch: (s: Record<string, unknown>): { phase?: Phase } => ({ phase: parsePhase(s.phase) }),
  head: () => ({ meta: [{ title: "Where does a tree get its mass? | IntelliHorizon" }] }),
  component: Page,
});

function Page() {
  const { phase } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <LessonShell pack={TREE} phase={phase ?? "wonder"} setPhase={(p) => void navigate({ search: { phase: p } })} explore={<EvidenceBoard />} />;
}
