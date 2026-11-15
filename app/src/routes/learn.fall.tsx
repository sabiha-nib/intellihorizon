import { createFileRoute } from "@tanstack/react-router";

import { DropLab } from "../components/edu/DropLab";
import { LessonShell, parsePhase } from "../components/edu/LessonShell";
import { FALL } from "../content/fall";
import type { Phase } from "../lib/next";

export const Route = createFileRoute("/learn/fall")({
  validateSearch: (s: Record<string, unknown>): { phase?: Phase } => ({ phase: parsePhase(s.phase) }),
  head: () => ({ meta: [{ title: "Why do things fall together? | IntelliHorizon" }] }),
  component: Page,
});

function Page() {
  const { phase } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <LessonShell pack={FALL} phase={phase ?? "wonder"} setPhase={(p) => void navigate({ search: { phase: p } })} explore={<DropLab />} />;
}
