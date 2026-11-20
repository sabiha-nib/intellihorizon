import { createFileRoute } from "@tanstack/react-router";

import { Home } from "../components/home/Home";
import { curriculumMatrix, homeStatus } from "../lib/api/learning.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [m, s] = await Promise.all([curriculumMatrix(), homeStatus()]);
    return { cells: m.cells, aiOn: s.aiOn };
  },
  head: () => ({
    meta: [
      { title: "IntelliHorizon: learning should understand you" },
      { name: "description", content: "IntelliHorizon is an AI-powered personalised learning ecosystem for Classes 6–10, aligned with Bangladesh's NCTB curriculum, for both Bangla Version and English Version students. Its tutor answers from your own textbook and says when it can't." },
      { property: "og:title", content: "IntelliHorizon: learning should understand you" },
      { property: "og:description", content: "A curriculum-grounded, bilingual AI tutor and learning ecosystem for NCTB Classes 6–10, Bangla Version and English Version." },
    ],
    links: [
      // Homepage typefaces only (the app keeps its own). Three families, the weights actually used, swap to avoid invisible text.
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600&family=Playfair+Display:ital,wght@1,500&display=swap" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { cells, aiOn } = Route.useLoaderData();
  return <Home cells={cells} aiOn={aiOn} />;
}
