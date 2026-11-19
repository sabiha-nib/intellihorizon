import { useEffect, useState } from "react";

import { getBookStructure } from "../../lib/api/admin.functions";
import { adminTopics, reviewTopic, saveTopic } from "../../lib/api/topics.functions";
import { call } from "../auth/messages";

const f = "h-10 rounded-[10px] border border-ink-low/35 bg-sheet px-3 text-[15px] outline-none focus:border-ink";
const btn = "h-10 rounded-[10px] px-3.5 text-sm font-semibold disabled:opacity-40";
type T = Record<string, string | number | null>;
const LABEL: Record<string, string> = { draft: "Draft (students can't see it)", checked: "Checked against the book", teacher_reviewed: "Teacher reviewed", rejected: "Rejected" };

/** Create topics inside a chapter and review them. Students see only checked or teacher-reviewed topics. */
export function TopicAdmin({ books }: { books: { id: string; title: string; subject_name: string }[] }) {
  const [bookId, setBookId] = useState("");
  const [chapters, setChapters] = useState<T[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [topics, setTopics] = useState<T[]>([]);
  const [skills, setSkills] = useState<{ skill: string; n: number }[]>([]);
  const [form, setForm] = useState({ id: null as string | null, title: "", titleEn: "", skill: "", sourcePassageId: "", provenance: "" });
  const [rev, setRev] = useState<Record<string, { confirmed: boolean; teacher: string; note: string }>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (bookId) void call(getBookStructure({ data: { textbookId: bookId } })).then((r) => { if (r.ok) { setChapters((r as { chapters: T[] }).chapters); setChapterId(""); setTopics([]); } }); }, [bookId]);
  const load = async () => { if (!chapterId) return; const r = await call(adminTopics({ data: { chapterId } })); if (r.ok) { setTopics(r.topics as unknown as T[]); setSkills(r.skills); } };
  useEffect(() => { void load(); }, [chapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setMsg(null);
    const r = await call(saveTopic({ data: { id: form.id, chapterId, title: form.title, titleEn: form.titleEn || null, skill: form.skill || null, sourcePassageId: form.sourcePassageId ? Number(form.sourcePassageId) : null, provenance: form.provenance } }));
    if (!r.ok) return setMsg({ ok: false, text: (r as { detail?: string }).detail ?? r.code });
    setForm({ id: null, title: "", titleEn: "", skill: "", sourcePassageId: "", provenance: "" });
    setMsg({ ok: true, text: "Saved as a draft. Review it below before students can see it." });
    void load();
  };
  const review = async (id: string, status: "checked" | "teacher_reviewed" | "rejected" | "draft") => {
    const x = rev[id] ?? { confirmed: false, teacher: "", note: "" };
    const r = await call(reviewTopic({ data: { id, status, confirmed: x.confirmed, teacherName: x.teacher || null, note: x.note || null } }));
    if (!r.ok) return setMsg({ ok: false, text: (r as { detail?: string }).detail ?? r.code });
    setMsg({ ok: true, text: "Recorded in the audit log." });
    void load();
  };
  const setR = (id: string, p: Partial<{ confirmed: boolean; teacher: string; note: string }>) => setRev((m) => ({ ...m, [id]: Object.assign({ confirmed: false, teacher: "", note: "" }, m[id], p) }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-mid">Only add a topic you can trace to the book: a heading on a page, the contents page, or a checked passage. Say where it comes from. Link it to a question skill so topic practice and progress can use it.</p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm font-semibold">Book <select aria-label="Topic book" className={`${f} ml-1`} value={bookId} onChange={(e) => setBookId(e.target.value)}><option value="">Choose a book</option>{books.map((b) => <option key={b.id} value={b.id}>{b.subject_name}: {b.title}</option>)}</select></label>
        {chapters.length > 0 && <label className="text-sm font-semibold">Chapter <select aria-label="Topic chapter" className={`${f} ml-1`} value={chapterId} onChange={(e) => setChapterId(e.target.value)}><option value="">Choose a chapter</option>{chapters.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.position)}. {String(c.title)}</option>)}</select></label>}
      </div>
      {chapterId && (
        <>
          <ul className="space-y-3">
            {topics.length === 0 && <li className="text-ink-mid">No topics in this chapter yet.</li>}
            {topics.map((tp) => {
              const id = String(tp.id);
              const x = rev[id] ?? { confirmed: false, teacher: "", note: "" };
              return (
                <li key={id} className="space-y-2 rounded-[14px] border border-line p-3 text-sm">
                  <p><b lang="bn">{String(tp.title)}</b>{tp.title_en ? ` (${String(tp.title_en)})` : ""} · skill {String(tp.skill ?? "none")} · <b>{LABEL[String(tp.review_status)]}</b></p>
                  <p className="text-ink-mid">Source: {String(tp.provenance)}{tp.source_passage_id ? ` · passage #${String(tp.source_passage_id)}` : ""}{tp.review_note ? ` · ${String(tp.review_note)}` : ""}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={x.confirmed} onChange={(e) => setR(id, { confirmed: e.target.checked })} /> The title appears in the book</label>
                    <input aria-label="Teacher name" placeholder="Teacher name (for teacher review)" className={`${f} w-56`} value={x.teacher} onChange={(e) => setR(id, { teacher: e.target.value })} />
                    <input aria-label="Review note" placeholder="Note (needed to reject)" className={`${f} w-56`} value={x.note} onChange={(e) => setR(id, { note: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={`${btn} bg-brand text-sheet`} disabled={tp.review_status === "checked"} onClick={() => void review(id, "checked")}>Mark checked</button>
                    <button type="button" className={`${btn} border border-brand text-brand-deep`} disabled={tp.review_status !== "checked"} onClick={() => void review(id, "teacher_reviewed")}>Record teacher review</button>
                    <button type="button" className={`${btn} border border-again text-again`} disabled={tp.review_status === "rejected"} onClick={() => void review(id, "rejected")}>Reject</button>
                    <button type="button" className={`${btn} border border-line`} onClick={() => setForm({ id, title: String(tp.title), titleEn: String(tp.title_en ?? ""), skill: String(tp.skill ?? ""), sourcePassageId: tp.source_passage_id ? String(tp.source_passage_id) : "", provenance: String(tp.provenance) })}>Edit (returns to draft)</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="space-y-2 rounded-[14px] bg-lilac p-3 text-sm">
            <p className="font-semibold">{form.id ? "Edit topic" : "Add a topic"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="font-semibold">Title as printed<input lang="bn" className={`${f} mt-1 w-full`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label className="font-semibold">English name (optional)<input className={`${f} mt-1 w-full`} value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} /></label>
              <label className="font-semibold">Question skill<select className={`${f} mt-1 w-full`} value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })}><option value="">None</option>{skills.map((s) => <option key={s.skill} value={s.skill}>{s.skill} ({s.n})</option>)}</select></label>
              <label className="font-semibold">Source passage # (optional)<input inputMode="numeric" className={`${f} mt-1 w-full`} value={form.sourcePassageId} onChange={(e) => setForm({ ...form, sourcePassageId: e.target.value.replace(/\D/g, "") })} /></label>
              <label className="font-semibold sm:col-span-2">Where it comes from<input className={`${f} mt-1 w-full`} placeholder="e.g. Heading on printed page 21" value={form.provenance} onChange={(e) => setForm({ ...form, provenance: e.target.value })} /></label>
            </div>
            <button type="button" className={`${btn} bg-ink text-sheet`} disabled={form.title.trim().length < 2 || form.provenance.trim().length < 5} onClick={() => void save()}>{form.id ? "Save changes" : "Add as draft"}</button>
          </div>
        </>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-mint" : "text-sm text-again"}>{msg.text}</p>}
    </div>
  );
}
