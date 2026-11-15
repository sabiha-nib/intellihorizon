import { useEffect, useState } from "react";

import { deleteQuestion, getBookStructure, saveChapters, saveObjectives, saveQuestion, type Row } from "../../lib/api/admin.functions";
import { call } from "../auth/messages";

const field = "h-10 w-full rounded-[10px] border border-ink-low/35 bg-sheet px-3 text-[15px] outline-none focus:border-ink";
const BLOOMS = ["", "remember", "understand", "apply", "analyze", "evaluate", "create"] as const;

type Ch = { id: string | null; position: number; label: string; title: string; startPage: number; endPage: number };

export function Structure({ textbookId, language }: { textbookId: string; language: "bn" | "en" }) {
  const [chapters, setChapters] = useState<Ch[]>([]);
  const [objectives, setObjectives] = useState<Row[]>([]);
  const [questions, setQuestions] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const load = async () => {
    const r = await call(getBookStructure({ data: { textbookId } }));
    if (!r.ok) return setMsg(r.code);
    setChapters(r.chapters.map((c) => ({ id: String(c.id), position: Number(c.position), label: String(c.label ?? ""), title: String(c.title), startPage: Number(c.start_page), endPage: Number(c.end_page) })));
    setObjectives(r.objectives);
    setQuestions(r.questions);
  };
  useEffect(() => { void load(); }, [textbookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCh = async () => {
    setMsg(null);
    const r = await call(saveChapters({ data: { textbookId, chapters: chapters.map((c) => ({ ...c, label: c.label.trim() || null })) } }));
    setMsg(r.ok ? "Chapters saved." : `Not saved: ${r.code}${"detail" in r && r.detail ? ` (${r.detail})` : ""}`);
    if (r.ok) void load();
  };
  const set = (i: number, p: Partial<Ch>) => setChapters((cs) => cs.map((c, k) => (k === i ? { ...c, ...p } : c)));

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-display text-lg font-bold">Chapters</h3>
        <p className="mt-1 text-sm text-ink-mid">Enter chapters exactly as printed in the book's contents, with their PDF page ranges. Ranges must not overlap.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-ink-low"><tr><th className="py-1 pr-2">#</th><th className="pr-2">Label (as printed)</th><th className="pr-2">Title</th><th className="pr-2">PDF from</th><th className="pr-2">PDF to</th><th /></tr></thead>
            <tbody>
              {chapters.map((c, i) => (
                <tr key={c.id ?? `new-${i}`}>
                  <td className="py-1 pr-2"><input aria-label="Position" type="number" className={`${field} w-16`} value={c.position} onChange={(e) => set(i, { position: Number(e.target.value) })} /></td>
                  <td className="pr-2"><input aria-label="Label" className={field} value={c.label} placeholder="Chapter 1" onChange={(e) => set(i, { label: e.target.value })} /></td>
                  <td className="pr-2"><input aria-label="Title" className={field} value={c.title} lang={language} onChange={(e) => set(i, { title: e.target.value })} /></td>
                  <td className="pr-2"><input aria-label="Start page" type="number" className={`${field} w-20`} value={c.startPage} onChange={(e) => set(i, { startPage: Number(e.target.value) })} /></td>
                  <td className="pr-2"><input aria-label="End page" type="number" className={`${field} w-20`} value={c.endPage} onChange={(e) => set(i, { endPage: Number(e.target.value) })} /></td>
                  <td><button type="button" onClick={() => setChapters((cs) => cs.filter((_, k) => k !== i))} className="px-2 text-ink-low hover:text-again" aria-label="Remove chapter">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setChapters((cs) => [...cs, { id: null, position: (cs.at(-1)?.position ?? 0) + 1, label: "", title: "", startPage: (cs.at(-1)?.endPage ?? 0) + 1, endPage: (cs.at(-1)?.endPage ?? 0) + 10 }])} className="h-10 rounded-[10px] border border-ink-low/35 px-4 font-semibold">Add chapter</button>
          <button type="button" onClick={() => void saveCh()} className="h-10 rounded-[10px] bg-brand px-4 font-semibold text-sheet">Save chapters</button>
        </div>
        {msg && <p className="mt-2 text-sm" role="status">{msg}</p>}
      </section>

      {chapters.some((c) => c.id) && (
        <section>
          <h3 className="font-display text-lg font-bold">Learning outcomes and practice questions</h3>
          <label className="mt-2 block text-sm font-semibold">Chapter
            <select className={`${field} mt-1`} value={sel ?? ""} onChange={(e) => setSel(e.target.value || null)}>
              <option value="">Choose a chapter</option>
              {chapters.filter((c) => c.id).map((c) => <option key={c.id} value={c.id!}>{c.position}. {c.title}</option>)}
            </select>
          </label>
          {sel && <ChapterDetail chapterId={sel} language={language} objectives={objectives.filter((o) => o.chapter_id === sel)} questions={questions.filter((q) => q.chapter_id === sel)} onSaved={load} />}
        </section>
      )}
    </div>
  );
}

function ChapterDetail({ chapterId, language, objectives, questions, onSaved }: { chapterId: string; language: "bn" | "en"; objectives: Row[]; questions: Row[]; onSaved: () => Promise<void> }) {
  const [objText, setObjText] = useState(objectives.map((o) => `${o.text}${o.source_page ? ` | ${o.source_page}` : ""}${o.bloom ? ` | ${o.bloom}` : ""}`).join("\n"));
  const [objMsg, setObjMsg] = useState<string | null>(null);
  useEffect(() => setObjText(objectives.map((o) => `${o.text}${o.source_page ? ` | ${o.source_page}` : ""}${o.bloom ? ` | ${o.bloom}` : ""}`).join("\n")), [chapterId]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveObj = async () => {
    const list = objText.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [text, page, bloom] = l.split("|").map((x) => x.trim());
      return { text, sourcePage: page && /^\d+$/.test(page) ? Number(page) : null, bloom: (BLOOMS as readonly string[]).includes(bloom ?? "") && bloom ? (bloom as "remember") : null };
    });
    const r = await call(saveObjectives({ data: { chapterId, objectives: list } }));
    setObjMsg(r.ok ? "Learning outcomes saved." : `Not saved: ${r.code}`);
    if (r.ok) await onSaved();
  };
  return (
    <div className="mt-4 space-y-6">
      <div>
        <label className="block text-sm font-semibold" htmlFor="obj">Learning outcomes, one per line, copied from the book</label>
        <p className="text-xs text-ink-mid">Optional extras after a bar: PDF page, then a Bloom level you have checked. Example: Explain photosynthesis | 42 | understand</p>
        <textarea id="obj" lang={language} rows={5} value={objText} onChange={(e) => setObjText(e.target.value)} className="mt-1 w-full rounded-[10px] border border-ink-low/35 bg-sheet p-3 text-[15px] outline-none focus:border-ink" />
        <button type="button" onClick={() => void saveObj()} className="mt-2 h-10 rounded-[10px] bg-brand px-4 font-semibold text-sheet">Save learning outcomes</button>
        {objMsg && <p className="mt-1 text-sm" role="status">{objMsg}</p>}
      </div>
      <QuestionEditor chapterId={chapterId} language={language} questions={questions} onSaved={onSaved} />
    </div>
  );
}

function QuestionEditor({ chapterId, language, questions, onSaved }: { chapterId: string; language: "bn" | "en"; questions: Row[]; onSaved: () => Promise<void> }) {
  const blank = { id: null as string | null, type: "mcq" as "mcq" | "numeric" | "short", prompt: "", options: "a) \nb) \nc) \nd) ", answer: "", tolerance: "", explanation: "", source: "textbook_exercise" as "textbook_exercise" | "educerro_authored", sourcePage: "", bloom: "", difficulty: "" };
  const [q, setQ] = useState(blank);
  const [msg, setMsg] = useState<string | null>(null);
  const edit = (r: Row) => {
    const opts = r.options ? (JSON.parse(String(r.options)) as { id: string; text: string }[]).map((o) => `${o.id}) ${o.text}`).join("\n") : blank.options;
    setQ({ id: String(r.id), type: r.type as "mcq", prompt: String(r.prompt), options: opts, answer: String(r.answer), tolerance: r.tolerance === null ? "" : String(r.tolerance), explanation: String(r.explanation ?? ""), source: r.source as "textbook_exercise", sourcePage: r.source_page === null ? "" : String(r.source_page), bloom: String(r.bloom ?? ""), difficulty: r.difficulty === null ? "" : String(r.difficulty) });
  };
  const save = async () => {
    setMsg(null);
    const options = q.type === "mcq" ? q.options.split("\n").map((l) => /^([a-f])\)\s*(.+)$/.exec(l.trim())).filter(Boolean).map((m) => ({ id: m![1], text: m![2].trim() })) : null;
    const answer = q.type === "short" ? JSON.stringify(q.answer.split("|").map((x) => x.trim()).filter(Boolean)) : q.answer.trim();
    const r = await call(saveQuestion({ data: {
      id: q.id, chapterId, type: q.type, prompt: q.prompt, options, answer, tolerance: q.tolerance ? Number(q.tolerance) : null, explanation: q.explanation || null,
      source: q.source, sourcePage: q.sourcePage ? Number(q.sourcePage) : null, bloom: (q.bloom || null) as "remember" | null, difficulty: q.difficulty ? Number(q.difficulty) : null, language,
    } }));
    setMsg(r.ok ? "Question saved." : `Not saved: ${r.code}`);
    if (r.ok) { setQ(blank); await onSaved(); }
  };
  const f = "h-10 w-full rounded-[10px] border border-ink-low/35 bg-sheet px-3 text-[15px] outline-none focus:border-ink";
  return (
    <div>
      <h4 className="font-semibold">Practice questions ({questions.length})</h4>
      <ul className="mt-2 divide-y divide-ink-low/15 text-sm">
        {questions.map((r) => (
          <li key={String(r.id)} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 truncate" lang={language}>{String(r.prompt)}</span>
            <span className="text-xs text-ink-low">{String(r.type)} · {r.source === "textbook_exercise" ? `textbook p.${r.source_page}` : "IntelliHorizon"}</span>
            <button type="button" className="font-semibold underline" onClick={() => edit(r)}>Edit</button>
            <button type="button" className="text-again" onClick={async () => { if (confirm("Delete this question?")) { await call(deleteQuestion({ data: { id: String(r.id) } })); await onSaved(); } }}>Delete</button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-3 rounded-[14px] border border-ink-low/25 p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Type<select className={`${f} mt-1`} value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value as "mcq" })}><option value="mcq">Multiple choice</option><option value="numeric">Number</option><option value="short">Short answer</option></select></label>
        <label className="text-sm font-semibold">Source<select className={`${f} mt-1`} value={q.source} onChange={(e) => setQ({ ...q, source: e.target.value as "textbook_exercise" })}><option value="textbook_exercise">Textbook exercise (needs page)</option><option value="educerro_authored">Written by IntelliHorizon</option></select></label>
        <label className="text-sm font-semibold sm:col-span-2">Question<textarea lang={language} rows={3} className="mt-1 w-full rounded-[10px] border border-ink-low/35 bg-sheet p-3 text-[15px]" value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} /></label>
        {q.type === "mcq" && <label className="text-sm font-semibold sm:col-span-2">Options, one per line as "a) text"<textarea lang={language} rows={4} className="mt-1 w-full rounded-[10px] border border-ink-low/35 bg-sheet p-3 text-[15px]" value={q.options} onChange={(e) => setQ({ ...q, options: e.target.value })} /></label>}
        <label className="text-sm font-semibold">{q.type === "mcq" ? "Correct option letter" : q.type === "numeric" ? "Correct number (e.g. 0.75 or 3/4)" : "Accepted answers, separated by |"}<input lang={language} className={`${f} mt-1`} value={q.answer} onChange={(e) => setQ({ ...q, answer: e.target.value })} /></label>
        {q.type === "numeric" && <label className="text-sm font-semibold">Allowed difference<input className={`${f} mt-1`} value={q.tolerance} placeholder="0.01" onChange={(e) => setQ({ ...q, tolerance: e.target.value })} /></label>}
        <label className="text-sm font-semibold">PDF page of the exercise<input className={`${f} mt-1`} value={q.sourcePage} onChange={(e) => setQ({ ...q, sourcePage: e.target.value })} /></label>
        <label className="text-sm font-semibold">Bloom level (only if checked)<select className={`${f} mt-1`} value={q.bloom} onChange={(e) => setQ({ ...q, bloom: e.target.value })}>{BLOOMS.map((b) => <option key={b} value={b}>{b || "Not set"}</option>)}</select></label>
        <label className="text-sm font-semibold">Difficulty<select className={`${f} mt-1`} value={q.difficulty} onChange={(e) => setQ({ ...q, difficulty: e.target.value })}><option value="">Not set</option><option value="1">Easier</option><option value="2">Medium</option><option value="3">Harder</option></select></label>
        <label className="text-sm font-semibold sm:col-span-2">Explanation shown after answering<textarea lang={language} rows={3} className="mt-1 w-full rounded-[10px] border border-ink-low/35 bg-sheet p-3 text-[15px]" value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} /></label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="button" onClick={() => void save()} className="h-10 rounded-[10px] bg-brand px-4 font-semibold text-sheet">{q.id ? "Update question" : "Add question"}</button>
          {q.id && <button type="button" onClick={() => setQ(blank)} className="h-10 rounded-[10px] px-3 font-semibold">Cancel edit</button>}
        </div>
        {msg && <p className="text-sm sm:col-span-2" role="status">{msg}</p>}
      </div>
    </div>
  );
}
