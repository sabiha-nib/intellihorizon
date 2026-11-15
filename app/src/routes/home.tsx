import { createFileRoute, redirect } from "@tanstack/react-router";

// The old authenticated home now lives at /dashboard.
export const Route = createFileRoute("/home")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
