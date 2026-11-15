import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/practice/review")({
  beforeLoad: () => {
    throw redirect({ to: "/revision" });
  },
});
