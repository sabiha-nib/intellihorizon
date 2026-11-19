import { useEffect, useState } from "react";

import { call } from "../auth/messages";
import { MathText } from "../app/MathText";
import { adminConcepts, adminFormulas, buildSemanticIndex, generateQuestions, reviewConcept, reviewFormula, saveConcept, semanticIndexStatus, summaryChapters, listConcepts, chapterSummary } from "../../lib/api/studio.functions";

const box = "space-y-3 rounded-[16px] border border-line p-4";
const b = "h-10 rounded-[10px] border-2 border-line bg-sheet px-3 text-sm font-semibold hover:border-brand disabled:opacity-50";
const inp = "w-full rounded-[10px] border border-line bg-sheet px-2 py-1.5 text-sm";

/** Admin tools for FormulaVault, ConceptConnect, QuestionGen and the semantic index. Nothing here publishes to students without review. */
export function StudioAdmin() {
  return <div className="space-y-6"><Semantic /><QuestionGen /><Formulas /><Concepts /></div>;
}

function Semantic() {
  const [s, setS] = useState<{ configured: boolean; model: string | null; visible: number; indexed: number } | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => void call(semanticIndexStatus()).then((r) => r.ok && setS(r));
  useEffect(load, []);
  return (
    <section className={box} aria-labelledby="sem-h"><h3 id="sem-h" className="font-display text-lg font-bold">Meaning-based search index</h3>
      {s && (s.configured ? <p className="text-sm">Model {s.model}: {s.indexed} of {s.visible} student-visible passages indexed.</p> : <p className="text-sm">Not configured. Set the secrets EMBED_API_KEY, EMBED_MODEL and EMBED_BASE_URL to switch on meaning-based search. Until then the tutor uses keyword search only, and says so.</p>)}
      <button className={b} disabled={!s?.configured} onClick={async () => { setMsg("Working…"); const r = await call(buildSemanticIndex()); setMsg(r.ok ? `Indexed ${r.embedded} passages${r.done ? "; all done." : "; run again for more."}` : `Failed: ${r.code}`); load(); }}>Build index</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}

function ChapterPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [ch, setCh] = useState<{ id: string; title: string; book_title: string }[]>([]);
  useEffect(() => { void call(summaryChapters()).then((r) => r.ok && setCh(r.chapters)); }, []);
  return <select className={inp} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Chapter"><option value="">Choose a chapter with student-visible text</option>{ch.map((c) => <option key={c.id} value={c.id}>{c.book_title} · {c.title}</option>)}</select>;
}

function QuestionGen() {
  const [chapter, setChapter] = useState("");
  const [passages, setPassages] = useState<{ id: number; page: number }[]>([]);
  const [pid, setPid] = useState(0); const [count, setCount] = useState(3); const [msg, setMsg] = useState("");
  useEffect(() => { setPassages([]); setPid(0); if (chapter) void fetchPassages(chapter).then(setPassages); }, [chapter]);
  return (
    <section className={box} aria-labelledby="qg-h"><h3 id="qg-h" className="font-display text-lg font-bold">QuestionGen</h3>
      <p className="text-sm text-ink-mid">Drafts questions from one student-visible passage with the configured AI provider. Malformed output is rejected; everything saved is a draft marked as AI-generated and appears under Question review. Nothing reaches students until a reviewer publishes it.</p>
      <ChapterPick value={chapter} onChange={setChapter} />
      {passages.length > 0 && <select className={inp} value={pid} onChange={(e) => setPid(Number(e.target.value))} aria-label="Passage"><option value={0}>Choose a passage</option>{passages.map((p) => <option key={p.id} value={p.id}>PDF page {p.page} · passage {p.id}</option>)}</select>}
      <label className="flex items-center gap-2 text-sm">How many <input className={`${inp} w-20`} type="number" min={1} max={5} value={count} onChange={(e) => setCount(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} /></label>
      <button className={b} disabled={!pid} onClick={async () => { setMsg("Generating…"); const r = await call(generateQuestions({ data: { chapterId: chapter, passageId: pid, count } })); setMsg(r.ok ? `Saved ${r.saved} draft(s).${r.rejected.length ? ` Rejected ${r.rejected.length}: ${r.rejected.join(", ")}.` : ""}` : r.code === "not_configured" ? "The AI provider isn't configured (AI_PROVIDER, AI_API_KEY, AI_MODEL)." : `Failed: ${r.code}`); }}>Generate drafts</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}
// Student-visible passages of the chapter (the same set the summary is built from).
async function fetchPassages(chapterId: string): Promise<{ id: number; page: number }[]> {
  const r = await chapterSummary({ data: { chapterId } });
  if (!r.ok) return [];
  return r.passageList;
}

function Formulas() {
  const [list, setList] = useState<{ id: string; name: string; expression: string; review_status: string; chapter_title: string; printed_page: number | null; provenance: string }[]>([]);
  const load = () => void call(adminFormulas()).then((r) => r.ok && setList(r.formulas));
  useEffect(load, []);
  return (
    <section className={box} aria-labelledby="fv-h"><h3 id="fv-h" className="font-display text-lg font-bold">FormulaVault review</h3>
      <ul className="space-y-2">{list.map((f) => (
        <li key={f.id} className="rounded-[12px] border border-line p-3 text-sm">
          <p className="font-semibold" lang="bn">{f.name} · <MathText text={f.expression} /></p>
          <p className="text-ink-mid">{f.chapter_title} · printed page {f.printed_page ?? "—"} · {f.review_status} · {f.provenance}</p>
          <div className="mt-2 flex gap-2">
            {f.review_status !== "checked" && <button className={b} onClick={async () => { await call(reviewFormula({ data: { id: f.id, status: "checked", confirmed: true } })); load(); }}>Mark checked (I compared it with the book)</button>}
            {f.review_status !== "rejected" && <button className={b} onClick={async () => { await call(reviewFormula({ data: { id: f.id, status: "rejected" } })); load(); }}>Reject</button>}
          </div>
        </li>))}</ul>
    </section>
  );
}

function Concepts() {
  const [list, setList] = useState<{ id: string; kind: string; justification: string; review_status: string; from_title: string; to_title: string }[]>([]);
  const [topics, setTopics] = useState<{ id: string; title: string }[]>([]);
  const [f, setF] = useState({ from: "", to: "", kind: "related" as "prerequisite" | "related" | "application" | "contrast", justification: "" });
  const [msg, setMsg] = useState("");
  const load = () => { void call(adminConcepts()).then((r) => r.ok && setList(r.links)); void call(listConcepts()).then((r) => r.ok && setTopics(r.topics)); };
  useEffect(load, []);
  return (
    <section className={box} aria-labelledby="cc-h"><h3 id="cc-h" className="font-display text-lg font-bold">ConceptConnect links</h3>
      <p className="text-sm text-ink-mid">Every link needs a written reason from the book. New links start as drafts and are hidden from students until checked.</p>
      <form className="grid gap-2 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); const r = await call(saveConcept({ data: { ...f, sourcePassageId: null } })); setMsg(r.ok ? "Draft link saved." : `Failed: ${r.code}`); load(); }}>
        <select className={inp} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From topic" required><option value="">From topic</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
        <select className={inp} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To topic" required><option value="">To topic</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
        <select className={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })} aria-label="Kind"><option value="prerequisite">prerequisite</option><option value="related">related</option><option value="application">application</option><option value="contrast">contrast</option></select>
        <input className={inp} value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} placeholder="Reason, with page (at least 20 characters)" aria-label="Justification" minLength={20} required />
        <button className={b} type="submit">Save draft link</button>
      </form>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <ul className="space-y-2">{list.map((l) => (
        <li key={l.id} className="rounded-[12px] border border-line p-3 text-sm"><p lang="bn"><b>{l.from_title}</b> {l.kind} <b>{l.to_title}</b> · {l.review_status}</p><p className="text-ink-mid">{l.justification}</p>
          <div className="mt-2 flex gap-2">
            {l.review_status !== "checked" && <button className={b} onClick={async () => { await call(reviewConcept({ data: { id: l.id, status: "checked", confirmed: true } })); load(); }}>Mark checked</button>}
            {l.review_status !== "rejected" && <button className={b} onClick={async () => { await call(reviewConcept({ data: { id: l.id, status: "rejected" } })); load(); }}>Reject</button>}
          </div>
        </li>))}</ul>
    </section>
  );
}
