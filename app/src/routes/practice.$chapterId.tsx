import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call, msg } from "../components/auth/messages";
import { Frame } from "../components/universe/Shell";
import { Empty, LinkButton, Loading } from "../components/universe/ui";
import { startLearningSession } from "../lib/api/universe.functions";
import { requireAccount } from "../lib/guard";
import { useLearner } from "../lib/store";

// Practising a chapter means starting (or resuming) a Learning Session in it.
export const Route = createFileRoute("/practice/$chapterId")({
  beforeLoad: ({ params }) => requireAccount(`/practice/${params.chapterId}`),
  head: () => ({
    meta: [{ title: "Practice | IntelliHorizon" }, { name: "robots", content: "noindex" }],
  }),
  component: StartPractice,
});

function StartPractice() {
  const { chapterId } = Route.useParams();
  const { tx, t } = useLearner();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void call(startLearningSession({ data: { chapterId } })).then((r) => {
      if (r.ok)
        void navigate({
          to: "/practice/session/$sessionId",
          params: { sessionId: (r as { id: string }).id },
          replace: true,
        });
      else setErr(r.code);
    });
  }, [chapterId, navigate]);
  return (
    <Frame>
      <div className="mx-auto max-w-2xl">
        {err ? (
          <Empty
            title={tx("Couldn't start the session", "সেশন শুরু হয়নি")}
            body={t(msg(err)!)}
            action={
              <LinkButton to="/practice">{tx("Back to Practice", "অনুশীলনে ফিরে যাও")}</LinkButton>
            }
          />
        ) : (
          <Loading label={tx("Starting your session", "সেশন শুরু হচ্ছে")} />
        )}
      </div>
    </Frame>
  );
}
