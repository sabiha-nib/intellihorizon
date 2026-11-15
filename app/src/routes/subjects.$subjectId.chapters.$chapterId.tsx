import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/subjects/$subjectId/chapters/$chapterId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/chapters/$chapterId", params: { chapterId: params.chapterId } });
  },
});
