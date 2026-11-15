import { createFileRoute } from "@tanstack/react-router";

import { RotiTable } from "../components/edu/RotiTable";
import { LessonShell, parsePhase } from "../components/edu/LessonShell";
import { SHARE } from "../content/share";
import type { Phase } from "../lib/next";

export const Route = createFileRoute("/learn/share")({
  validateSearch: (s: Record<string, unknown>): { phase?: Phase } => ({ phase: parsePhase(s.phase) }),
  head: () => ({ meta: [{ title: "Which share is bigger? | IntelliHorizon" }] }),
  component: Page,
});

function Page() {
  const { phase } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <LessonShell pack={SHARE} phase={phase ?? "wonder"} setPhase={(p) => void navigate({ search: { phase: p } })} explore={<RotiTable />} />;
}
