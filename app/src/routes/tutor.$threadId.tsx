import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { call, msg } from "../components/auth/messages";
import { Composer, ContextPicker, MessageList, PersonaPicker, usePersona, type TutorContext, useTutorLang, LangPicker } from "../components/app/Tutor";
import { PERSONAS, type StyleId } from "../lib/tutor/teach";
import { isSubjectId, subjectById, type SubjectId } from "../lib/curriculum/registry";
import { SignInPrompt, EmptyState } from "../components/app/kit";
import { PaperPage } from "../components/edu/ui";
import { ask, deleteThread, getThread, renameThread } from "../lib/api/tutor.functions";
import type { TutorMessage } from "../lib/tutor/types";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/tutor/$threadId")({
  loader: ({ params }) => getThread({ data: { id: params.threadId } }),
  head: () => ({ meta: [{ title: "Tutor | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: Thread,
});

function Thread() {
  const data = Route.useLoaderData();
  const { threadId } = Route.useParams();
  const { tx, t, account } = useLearner();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<TutorMessage[]>(data.ok ? data.messages : []);
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const initial: TutorContext = { subject: data.ok && isSubjectId(data.thread.subject_key) ? data.thread.subject_key : null, book: data.ok ? data.thread.textbook_id : null, chapter: data.ok ? data.thread.chapter_id : null };
  const [ctx, setCtx] = useState<TutorContext>(initial);
  const [showCtx, setShowCtx] = useState(false);
  const [title, setTitle] = useState(data.ok ? data.thread.title : "");
  const [editing, setEditing] = useState(false);
  const [persona, setPersona] = usePersona();
  const [tutorLang, setTutorLang] = useTutorLang();

  if (!account) return <PaperPage><main className="mx-auto max-w-3xl px-4 pt-6"><SignInPrompt next={`/tutor/${threadId}`} why={{ en: "Sign in to see your conversation.", bn: "তোমার কথোপকথন দেখতে সাইন ইন করো।" }} /></main></PaperPage>;
  if (!data.ok) {
    return (
      <PaperPage>
        <main className="mx-auto max-w-3xl px-4 pt-6">
          <EmptyState title={tx("Conversation not found", "কথোপকথন পাওয়া যায়নি")} body={tx("It may have been deleted, or it belongs to a different account.", "হয়তো মুছে ফেলা হয়েছে, অথবা এটি অন্য অ্যাকাউন্টের।")} action={<Link to="/tutor" className="font-semibold underline decoration-dashed underline-offset-4">{tx("Back to the tutor", "টিউটরে ফিরে যাও")}</Link>} />
        </main>
      </PaperPage>
    );
  }
  const th = data.thread;
  const changed = ctx.subject !== initial.subject || ctx.book !== initial.book || ctx.chapter !== initial.chapter;
  const subj = ctx.subject ? subjectById(ctx.subject) : null;
  const ctxLabel = changed ? (subj ? t(subj.label) : tx("All subjects", "সব বিষয়")) : [subj ? t(subj.label) : tx("All subjects", "সব বিষয়"), th.book_title, th.chapter_title ? `${tx("Chapter", "অধ্যায়")} ${th.chapter_position}: ${th.chapter_title}` : null].filter(Boolean).join(" · ");

  const send = async (text: string, style: StyleId | null = null, subjectOverride: SubjectId | null = null) => {
    setPending(text);
    setErr(null);
    const scope = subjectOverride ? { subjectId: subjectOverride, textbookId: null, chapterId: null } : { subjectId: ctx.subject, textbookId: ctx.book, chapterId: ctx.chapter };
    if (subjectOverride) setCtx({ subject: subjectOverride, book: null, chapter: null });
    const r = await call(ask({ data: { threadId, question: text, ...scope, scopeExplicit: true, persona, style, langMode: tutorLang } }), 25000);
    setPending(null);
    if (!r.ok) { setErr(r.code); return false; }
    setMessages((m) => [...m, ...r.messages]);
    return true;
  };

  return (
    <PaperPage>
      <main className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-4 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/tutor" className="text-sm text-ink-mid hover:text-ink">{tx("All conversations", "সব কথোপকথন")}</Link>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          {editing ? (
            <form className="flex flex-1 gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await call(renameThread({ data: { id: threadId, title } })); if (r.ok) setEditing(false); }}>
              <label htmlFor="title" className="sr-only">{tx("Conversation name", "কথোপকথনের নাম")}</label>
              <input id="title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="h-11 flex-1 rounded-[12px] border border-ink-low/30 bg-sheet px-3 text-lg font-semibold outline-none focus:border-ink" />
              <button type="submit" className="h-11 rounded-[12px] bg-brand px-4 font-semibold text-sheet">{tx("Save", "সংরক্ষণ")}</button>
            </form>
          ) : (
            <h1 className="font-display min-w-0 break-words text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          )}
          {!editing && (
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setEditing(true)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-mid hover:text-ink">{tx("Rename", "নাম বদলাও")}</button>
              <button type="button" onClick={async () => { if (!confirm(tx("Delete this conversation?", "এই কথোপকথন মুছে ফেলবে?"))) return; const r = await call(deleteThread({ data: { id: threadId } })); if (r.ok) void navigate({ to: "/tutor" }); }} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-mid hover:text-again">{tx("Delete", "মুছো")}</button>
            </div>
          )}
        </div>
        <div className="mt-2 text-sm text-ink-mid">
          {tx("Searching in: ", "খোঁজা হচ্ছে: ")}<span className="font-semibold text-ink">{ctxLabel}</span>{" · "}{t(PERSONAS[persona].name)}{" "}
          <button type="button" onClick={() => setShowCtx((v) => !v)} className="font-semibold underline decoration-dashed underline-offset-4">{showCtx ? tx("Done", "ঠিক আছে") : tx("Change", "বদলাও")}</button>
        </div>
        {showCtx && <div className="edu-rise mt-3 space-y-4"><ContextPicker value={ctx} onChange={setCtx} /><PersonaPicker value={persona} onChange={setPersona} /><LangPicker value={tutorLang} onChange={setTutorLang} /></div>}
        <div className="mt-6 flex-1 pb-40">
          <MessageList messages={messages} pending={pending} onAppend={(ms) => setMessages((m) => [...m, ...ms])} onAskDifferently={(q, style) => void send(q, style)} onAskInSubject={(q, sid) => { if (isSubjectId(sid)) void send(q, null, sid); }} />
        </div>
        <div className="fixed inset-x-0 bottom-[76px] z-20 px-4 md:bottom-4">
          <div className="mx-auto max-w-3xl space-y-2">
            {err && <p className="rounded-[12px] bg-sheet px-3 py-2 text-sm font-medium text-again shadow" role="alert">{err === "rate_limited" ? tx("You've asked a lot in a short time. Take a short break and try again.", "অল্প সময়ে অনেক প্রশ্ন হয়েছে। একটু বিরতি নিয়ে আবার চেষ্টা করো।") : t(msg(err) ?? msg("unknown")!)}</p>}
            <Composer onSend={(text) => send(text)} busy={pending !== null} />
          </div>
        </div>
      </main>
    </PaperPage>
  );
}
