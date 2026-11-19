import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { EmptyState, card } from "../components/app/kit";
import { ErrorLine, Loading, StudioPage, btn, btnGhost, input } from "../components/app/studio-kit";
import { deleteNote, listNotes, saveNote, summaryChapters } from "../lib/api/studio.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "SmartNotes | IntelliHorizon" }] }),
  component: Notes,
});

type Note = { id: string; title: string; body: string; chapter_id: string | null; highlight: number; updated_at: string; chapter_title: string | null };

function Notes() {
  const { tx, account } = useLearner();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Note> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [chapters, setChapters] = useState<{ id: string; title: string; book_title: string }[]>([]);
  const load = (query = q) => void call(listNotes({ data: { q: query } })).then((r) => (r.ok ? setNotes(r.notes) : setErr(r.code)));
  useEffect(() => { if (account) { load(""); void call(summaryChapters()).then((r) => r.ok && setChapters(r.chapters)); } }, [account]);
  return (
    <StudioPage title={tx("SmartNotes", "স্মার্ট নোট")} subtitle={tx("Your own notes. Only you can see them; they are never shared with teachers or parents.", "তোমার নিজের নোট। শুধু তুমি দেখতে পাও; শিক্ষক বা অভিভাবকের সঙ্গে কখনো শেয়ার হয় না।")} next="/notes">
      <div className="flex flex-wrap gap-2">
        <form className="flex flex-1 gap-2" role="search" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search your notes", "নোটে খোঁজো")} aria-label={tx("Search your notes", "নোটে খোঁজো")} />
          <button className={btnGhost} type="submit">{tx("Search", "খোঁজো")}</button>
        </form>
        <button className={btn} onClick={() => setEdit({ title: "", body: "", chapter_id: null, highlight: 0 })}>{tx("New note", "নতুন নোট")}</button>
      </div>
      {edit && (
        <form className={`${card} space-y-3 p-5`} onSubmit={async (e) => { e.preventDefault(); setErr(null); const r = await call(saveNote({ data: { id: edit.id ?? null, title: edit.title ?? "", body: edit.body ?? "", chapterId: edit.chapter_id ?? null, highlight: !!edit.highlight } })); if (r.ok) { setEdit(null); load(); } else setErr(r.code); }}>
          <label className="block text-sm font-semibold">{tx("Title", "শিরোনাম")}<input className={input} required maxLength={160} value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
          <label className="block text-sm font-semibold">{tx("Note", "নোট")}<textarea className={input} rows={6} maxLength={8000} value={edit.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
          <label className="block text-sm font-semibold">{tx("Chapter (optional)", "অধ্যায় (ঐচ্ছিক)")}
            <select className={input} value={edit.chapter_id ?? ""} onChange={(e) => setEdit({ ...edit, chapter_id: e.target.value || null })}><option value="">—</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.book_title} · {c.title}</option>)}</select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!edit.highlight} onChange={(e) => setEdit({ ...edit, highlight: e.target.checked ? 1 : 0 })} />{tx("Pin to top", "উপরে রাখো")}</label>
          <div className="flex gap-2"><button className={btn} type="submit">{tx("Save note", "নোট রাখো")}</button><button type="button" className={btnGhost} onClick={() => setEdit(null)}>{tx("Cancel", "বাতিল")}</button></div>
          <ErrorLine code={err} />
        </form>
      )}
      {notes === null ? <Loading /> : notes.length === 0 ? <EmptyState title={q ? tx("No notes match", "কোনো নোট মেলেনি") : tx("No notes yet", "এখনো নোট নেই")} body={tx("Write what you want to remember in your own words.", "যা মনে রাখতে চাও নিজের ভাষায় লেখো।")} /> : (
        <ul className="space-y-3">{notes.map((n) => (
          <li key={n.id} className={`${card} p-5`}>
            <h2 className="font-display text-lg font-bold">{n.highlight ? "📌 " : ""}{n.title}</h2>
            {n.chapter_title && <p className="text-xs text-ink-low">{n.chapter_title}</p>}
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{n.body}</p>
            <div className="mt-3 flex gap-4 text-sm font-semibold">
              <button className="underline decoration-dashed underline-offset-4" onClick={() => setEdit(n)}>{tx("Edit", "সম্পাদনা")}</button>
              <button className="text-ink-mid underline decoration-dashed underline-offset-4 hover:text-again" onClick={async () => { await call(deleteNote({ data: { id: n.id } })); load(); }}>{tx("Delete", "মুছো")}</button>
            </div>
          </li>))}</ul>
      )}
    </StudioPage>
  );
}
