// Question review: draft -> reviewed -> published. Each step is a separate, audited action, and publishing
// is blocked until the question passes its checks (answer is an option, answer passes its own checker, source recorded).
import { useEffect, useState } from "react";

import {
  listReviewQuestions,
  reviewQuestion,
  type ReviewQuestion,
} from "../../lib/api/admin.functions";
import { SUBJECTS } from "../../lib/curriculum/registry";
import { displayAnswer } from "../../lib/learning/rules";
import { call } from "../auth/messages";
import { Badge, Button } from "../universe/ui";

const CHECK: Record<string, string> = {
  prompt_missing: "The question text is empty.",
  explanation_missing: "Add an explanation students see after answering.",
  source_page_missing: "Textbook questions need the page number.",
  provenance_unreadable: "The source record can't be read.",
  answer_source_missing: "Record where the answer comes from.",
  evidence_missing: "Drafted questions need the quoted passage they rely on.",
  mcq_answer_not_an_option: "The correct answer isn't one of the options.",
  options_unreadable: "The options can't be read.",
  answer_fails_own_check: "Typing the stored answer would be marked wrong.",
};

export function Review() {
  const [status, setStatus] = useState<"draft" | "reviewed" | "published">("draft");
  const [rows, setRows] = useState<ReviewQuestion[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const load = async (s = status) => {
    const r = await call(listReviewQuestions({ data: { status: s } }));
    if (r.ok) {
      const x = r as {
        questions: ReviewQuestion[];
        counts: { review_status: string; n: number }[];
      };
      setRows(x.questions);
      setCounts(Object.fromEntries(x.counts.map((c) => [c.review_status, c.n])));
    }
  };
  useEffect(() => {
    void load();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (
    id: string,
    action: "mark_reviewed" | "publish" | "unpublish" | "return_to_draft",
  ) => {
    setMsg(null);
    const r = await call(reviewQuestion({ data: { id, action, note: null } }));
    if (!r.ok)
      setMsg(
        `Not done: ${
          (r as { code: string; detail?: string }).detail
            ? (r as { detail: string }).detail
                .split(",")
                .map((c) => CHECK[c] ?? c)
                .join(" ")
            : r.code
        }`,
      );
    else {
      setMsg("Done. Recorded in the audit log.");
      void load();
    }
  };
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-2">
        {(["draft", "reviewed", "published"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`h-10 rounded-[12px] border-2 px-4 text-[15px] font-semibold ${status === s ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-sheet"}`}
          >
            {s === "draft" ? "Drafts" : s === "reviewed" ? "Reviewed, not published" : "Published"}{" "}
            ({counts[s] ?? 0})
          </button>
        ))}
      </div>
      <p className="text-[14px] text-ink-mid">
        Students only ever see published questions. Mark a draft reviewed after checking it against
        the book page, then publish it as a separate step. Editing a question sends it back to
        draft.
      </p>
      {msg && (
        <p role="status" className="rounded-[12px] bg-lilac p-3 text-[14px]">
          {msg}
        </p>
      )}
      {!rows ? (
        <p>Loading…</p>
      ) : !rows.length ? (
        <p className="text-ink-mid">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((q) => {
            let prov: Record<string, string | number | null> = {};
            try {
              prov = q.provenance ? JSON.parse(q.provenance) : {};
            } catch {
              prov = {};
            }
            const subj = SUBJECTS.find((s) => s.id === q.subject_key);
            return (
              <li key={q.id} className="rounded-[18px] border border-line bg-sheet p-4">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-mid">
                  <Badge>{subj?.label.en ?? q.subject_key}</Badge>
                  <span lang="bn">{q.chapter_title}</span>
                  <Badge tone={q.source === "textbook_exercise" ? "mint" : "pink"}>
                    {q.source === "textbook_exercise" ? "Textbook exercise" : "IntelliHorizon-authored"}
                  </Badge>
                  {q.attempts > 0 && <Badge tone="amber">{q.attempts} student answers</Badge>}
                </div>
                <p className="mt-2 whitespace-pre-line text-[16px] font-semibold" lang={q.language}>
                  {q.prompt}
                </p>
                {q.options && (
                  <ul className="mt-1 text-[15px]" lang={q.language}>
                    {(JSON.parse(q.options) as { id: string; text: string }[]).map((o) => (
                      <li key={o.id} className={o.id === q.answer ? "font-semibold text-mint" : ""}>
                        {o.id}) {o.text}
                        {o.id === q.answer ? "  (correct)" : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {!q.options && (
                  <p className="mt-1 text-[15px]" lang={q.language}>
                    Answer: <strong>{displayAnswer(q)}</strong>{" "}
                    <span className="text-ink-low">({q.answer_kind ?? q.type})</span>
                  </p>
                )}
                {q.explanation && (
                  <p className="mt-1 text-[14px] text-ink-mid" lang={q.language}>
                    {q.explanation}
                  </p>
                )}
                <dl className="mt-2 grid gap-x-4 text-[13px] text-ink-mid sm:grid-cols-2">
                  {prov.answerFrom && (
                    <div>
                      <dt className="inline font-semibold">Answer from: </dt>
                      <dd className="inline">{String(prov.answerFrom)}</dd>
                    </div>
                  )}
                  {prov.printedPage && (
                    <div>
                      <dt className="inline font-semibold">Printed page: </dt>
                      <dd className="inline">{String(prov.printedPage)}</dd>
                    </div>
                  )}
                  {prov.evidenceQuote && (
                    <div className="sm:col-span-2">
                      <dt className="inline font-semibold">Evidence: </dt>
                      <dd className="inline" lang={q.language}>
                        “{String(prov.evidenceQuote)}”
                      </dd>
                    </div>
                  )}
                  {prov.checkedBy && (
                    <div className="sm:col-span-2">
                      <dt className="inline font-semibold">Checked by: </dt>
                      <dd className="inline">{String(prov.checkedBy)}</dd>
                    </div>
                  )}
                  {q.reviewed_at && (
                    <div>
                      <dt className="inline font-semibold">Reviewed: </dt>
                      <dd className="inline">{q.reviewed_at.slice(0, 10)}</dd>
                    </div>
                  )}
                  {q.published_at && (
                    <div>
                      <dt className="inline font-semibold">Published: </dt>
                      <dd className="inline">{q.published_at.slice(0, 10)}</dd>
                    </div>
                  )}
                </dl>
                {q.checks.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-[14px] text-again">
                    {q.checks.map((c) => (
                      <li key={c}>{CHECK[c] ?? c}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.review_status === "draft" && (
                    <Button
                      size="sm"
                      disabled={q.checks.length > 0}
                      onClick={() => void act(q.id, "mark_reviewed")}
                    >
                      Mark reviewed
                    </Button>
                  )}
                  {q.review_status === "reviewed" && (
                    <Button
                      size="sm"
                      disabled={q.checks.length > 0}
                      onClick={() => void act(q.id, "publish")}
                    >
                      Publish to students
                    </Button>
                  )}
                  {q.review_status === "reviewed" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void act(q.id, "return_to_draft")}
                    >
                      Send back to draft
                    </Button>
                  )}
                  {q.review_status === "published" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void act(q.id, "unpublish")}
                    >
                      Unpublish
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
