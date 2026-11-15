import { useEffect, useRef, useState } from "react";

import { getPassage, passageQueue, reviewPassage, type QueueRow } from "../../lib/api/review.functions";
import { FLAG_TEXT, type QualityFlag } from "../../lib/curriculum/quality";
import { call } from "../auth/messages";

const f = "h-10 rounded-[10px] border border-ink-low/35 bg-sheet px-3 text-[15px] outline-none focus:border-ink";
const btn = "h-10 rounded-[10px] px-3.5 text-sm font-semibold disabled:opacity-40";
type Book = { id: string; title: string; subject_name: string };
type P = Record<string, string | number | null>;
type Hist = Record<string, string | number | null>;

const REVIEW_LABEL: Record<string, string> = { none: "Extracted, unreviewed", ocr_corrected: "OCR corrected", checked: "Checked against page image", teacher_reviewed: "Teacher reviewed", rejected: "Rejected" };
const PUBLISH_LABEL: Record<string, string> = { draft: "Draft", approved: "Approved, not published", published: "Published to students", withdrawn: "Withdrawn" };
const ERR: Record<string, string> = {
  not_admin: "Only administrators can review content.", changed_meanwhile: "Someone changed this passage after you opened it. It has been reloaded.",
  confirm_compared: "Tick that you compared the text word by word with the page image.", math_confirmation_required: "This passage contains mathematics: confirm every expression against the printed page, or correct it first.",
  teacher_name_required: "Record the name of the teacher who reviewed it.", must_be_checked_first: "Check the text against the page before recording a teacher review.",
  not_reviewed: "Only text checked against the page (or teacher reviewed) can be approved.", approve_first: "Approve before publishing.", note_required: "Add a note saying why.",
  no_change: "The text is unchanged.", already_checked: "Already checked.", bad_transition: "That step isn't available from the passage's current state.", withdraw_first: "Withdraw it from students first.", rejected_passage: "This passage was rejected. Return it to draft first.",
};

/** Renders one PDF page from a book file the reviewer opens on their own device. The file is never uploaded. */
function PageImage({ file, page }: { file: File | null; page: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setMsg("Rendering page…");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
        if (page > doc.numPages) { setMsg(`This PDF has ${doc.numPages} pages; page ${page} isn't in it. Is it the right book?`); return; }
        const pg = await doc.getPage(page);
        const vp = pg.getViewport({ scale: 1.6 });
        const c = ref.current;
        if (!c || cancelled) return;
        c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c } as never).promise;
        if (!cancelled) setMsg(null);
      } catch {
        if (!cancelled) setMsg("Couldn't render that file. Open the book's PDF.");
      }
    })();
    return () => { cancelled = true; };
  }, [file, page]);
  if (!file) return null;
  return <div>{msg && <p role="status" className="text-sm text-ink-mid">{msg}</p>}<canvas ref={ref} className="w-full rounded-[10px] border border-line" aria-label={`PDF page ${page}`} /></div>;
}

export function PassageReview({ books, initialBook }: { books: Book[]; initialBook: string | null }) {
  const [bookId, setBookId] = useState<string>(initialBook ?? "");
  const [chapterId, setChapterId] = useState("");
  const [review, setReview] = useState("");
  const [publish, setPublish] = useState("");
  const [flag, setFlag] = useState("");
  const [offset, setOffset] = useState(0);
  const [queue, setQueue] = useState<{ items: QueueRow[]; total: number; chapters: { id: string; position: number; title: string }[] } | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [p, setP] = useState<P | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [teacher, setTeacher] = useState("");
  const [compared, setCompared] = useState(false);
  const [mathOk, setMathOk] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<Record<string, File>>({});
  const [showPage, setShowPage] = useState(false);

  useEffect(() => { if (initialBook) setBookId(initialBook); }, [initialBook]);
  const loadQueue = async () => {
    if (!bookId) return setQueue(null);
    const r = await call(passageQueue({ data: { bookId, chapterId: chapterId || null, review: (review || null) as never, publish: (publish || null) as never, flag: flag || null, offset } }));
    if (r.ok) setQueue(r as never); else setMsg({ ok: false, text: ERR[r.code] ?? r.code });
  };
  useEffect(() => { void loadQueue(); }, [bookId, chapterId, review, publish, flag, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async (id: number) => {
    setSel(id); setMsg(null); setNote(""); setTeacher(""); setCompared(false); setMathOk(false);
    const r = await call(getPassage({ data: { id } }));
    if (!r.ok) return setMsg({ ok: false, text: ERR[r.code] ?? r.code });
    setP(r.passage as P); setHist(r.history as Hist[]); setText(String((r.passage as P).text ?? ""));
  };
  const act = async (action: "save_correction" | "mark_checked" | "mark_teacher_reviewed" | "approve" | "publish" | "reject" | "withdraw" | "return_to_draft") => {
    if (!p) return;
    setBusy(true); setMsg(null);
    const r = await call(reviewPassage({ data: { id: Number(p.id), action, expectedHash: String(p.content_hash), text: action === "save_correction" ? text : null, note: note || null, mathConfirmed: mathOk, comparedWithPage: compared, teacherName: teacher || null } }));
    setBusy(false);
    if (!r.ok) {
      const text = (r as { detail?: string }).detail ?? ERR[r.code] ?? r.code;
      if (r.code === "changed_meanwhile") await open(Number(p.id));
      setMsg({ ok: false, text });
      return;
    }
    await open(Number(p.id));
    setMsg({ ok: true, text: "Saved and recorded in the audit log." });
    void loadQueue();
  };
  const flags: QualityFlag[] = p?.flags ? JSON.parse(String(p.flags)) : [];
  const rs = p ? String(p.review_status ?? "none") : "none";
  const ps = p ? String(p.publish_status ?? "draft") : "draft";
  const math = flags.includes("math_unverified");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm font-semibold">Book <select aria-label="Book" className={`${f} ml-1 max-w-[18rem]`} value={bookId} onChange={(e) => { setBookId(e.target.value); setChapterId(""); setOffset(0); setSel(null); setP(null); }}><option value="">Choose a book</option>{books.map((b) => <option key={b.id} value={b.id}>{b.subject_name}: {b.title}</option>)}</select></label>
        {queue && <label className="text-sm font-semibold">Chapter <select aria-label="Chapter" className={`${f} ml-1 max-w-[16rem]`} value={chapterId} onChange={(e) => { setChapterId(e.target.value); setOffset(0); }}><option value="">All chapters</option>{queue.chapters.map((c) => <option key={c.id} value={c.id}>{c.position}. {c.title}</option>)}</select></label>}
        <label className="text-sm font-semibold">Review <select aria-label="Review status" className={`${f} ml-1`} value={review} onChange={(e) => { setReview(e.target.value); setOffset(0); }}><option value="">Any</option>{Object.entries(REVIEW_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="text-sm font-semibold">Publishing <select aria-label="Publishing status" className={`${f} ml-1`} value={publish} onChange={(e) => { setPublish(e.target.value); setOffset(0); }}><option value="">Any</option>{Object.entries(PUBLISH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="text-sm font-semibold">Warning <select aria-label="Warning filter" className={`${f} ml-1`} value={flag} onChange={(e) => { setFlag(e.target.value); setOffset(0); }}><option value="">Any</option>{Object.entries(FLAG_TEXT).map(([k, l]) => <option key={k} value={k}>{l.en}</option>)}</select></label>
      </div>
      {!bookId && <p className="text-ink-mid">Choose a book to see its passages.</p>}
      {bookId && queue && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div>
            <p className="text-sm text-ink-mid">{queue.total} passage{queue.total === 1 ? "" : "s"}{queue.total > 50 ? `, showing ${offset + 1}–${Math.min(offset + 50, queue.total)}` : ""}</p>
            {queue.total === 0 && <p className="mt-2 text-ink-mid">Nothing here. If this book hasn't been imported, import its text in "Books and import".</p>}
            <ul className="mt-2 max-h-[70vh] space-y-1 overflow-y-auto">
              {queue.items.map((q) => (
                <li key={q.id}><button type="button" onClick={() => void open(q.id)} className={`w-full rounded-[10px] px-3 py-2 text-left text-sm ${sel === q.id ? "bg-brand text-sheet" : "hover:bg-paper"}`}>
                  <span className="block font-semibold">PDF p. {q.page}{q.printed_page ? ` · printed p. ${q.printed_page}` : " · no printed page"} · #{q.seq}</span>
                  <span className="block truncate opacity-90" lang="bn">{q.snippet}</span>
                  <span className="block text-xs opacity-80">{REVIEW_LABEL[q.review_status ?? "none"]} · {PUBLISH_LABEL[q.publish_status ?? "draft"]}{q.blocked ? " · held back" : ""}{q.confidence != null ? ` · OCR ${Math.round(q.confidence)}%` : ""}</span>
                </button></li>
              ))}
            </ul>
            {queue.total > 50 && <div className="mt-2 flex gap-2"><button type="button" className={`${btn} border border-line`} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><button type="button" className={`${btn} border border-line`} disabled={offset + 50 >= queue.total} onClick={() => setOffset(offset + 50)}>Next</button></div>}
          </div>
          <div className="min-w-0 space-y-4">
            {!p && <p className="text-ink-mid">Choose a passage.</p>}
            {p && (
              <>
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold">Passage #{String(p.id)} · PDF page {String(p.page)}{p.printed_page ? `, printed page ${String(p.printed_page)}` : ""}</h3>
                  <p className="text-sm text-ink-mid">{String(p.subject_name)} · <span lang="bn">{String(p.book_title)}</span>{p.chapter ? <> · <span lang="bn">{String(p.chapter)}</span></> : " · no chapter"} · OCR confidence {p.page_confidence != null ? `${Math.round(Number(p.page_confidence))}%` : "not recorded"} · provenance {String(p.provenance ?? "legacy import")}</p>
                  <p className="text-sm"><b>{REVIEW_LABEL[rs]}</b> · <b>{PUBLISH_LABEL[ps]}</b>{p.blocked ? " · held back from students" : ""} · NCTB permission {p.license_status === "permitted" ? "received" : "pending"}</p>
                  {flags.length > 0 && <ul className="flex flex-wrap gap-2">{flags.map((x) => <li key={x} className="rounded-full bg-amber-soft px-2.5 py-0.5 text-xs font-semibold text-amber">{FLAG_TEXT[x]?.en ?? x}</li>)}</ul>}
                </div>
                <div className="rounded-[14px] border border-line p-3">
                  <p className="text-sm font-semibold">Source page</p>
                  <p className="text-sm text-ink-mid">Open this book's PDF from your device to see page {String(p.page)} beside the text. The file stays on your device.</p>
                  <input type="file" accept="application/pdf" aria-label="Open the book PDF" className="mt-2 text-sm" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setPdf((m) => ({ ...m, [bookId]: file })); setShowPage(true); } }} />
                  {pdf[bookId] && <label className="ml-3 text-sm"><input type="checkbox" checked={showPage} onChange={(e) => setShowPage(e.target.checked)} /> Show page</label>}
                  {showPage && <div className="mt-2"><PageImage file={pdf[bookId] ?? null} page={Number(p.page)} /></div>}
                  {!pdf[bookId] && p.page_text && <details className="mt-2"><summary className="cursor-pointer text-sm font-semibold">Whole extracted page text</summary><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap text-sm" lang="bn">{String(p.page_text)}</pre></details>}
                </div>
                <label className="block text-sm font-semibold" htmlFor="ptext">Passage text</label>
                <textarea id="ptext" lang="bn" rows={8} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-[10px] border border-ink-low/35 bg-sheet p-3 text-[15px] leading-relaxed outline-none focus:border-ink" />
                <p className="text-xs text-ink-mid">For mathematics you may write expressions as $\frac{"{3}{5}"}$, $x^{"{2}"}$, $a_{"{1}"}$ or $\sqrt{"{2}"}$. Never guess an expression you can't read: reject the passage instead.</p>
                {p.original_text && <details><summary className="cursor-pointer text-sm font-semibold">Original extracted text</summary><pre className="mt-1 whitespace-pre-wrap text-sm" lang="bn">{String(p.original_text)}</pre></details>}
                <div className="space-y-2 rounded-[14px] bg-lilac p-3 text-sm">
                  <label className="flex gap-2"><input type="checkbox" checked={compared} onChange={(e) => setCompared(e.target.checked)} /> I compared this text word by word with the page image.</label>
                  {math && <label className="flex gap-2"><input type="checkbox" checked={mathOk} onChange={(e) => setMathOk(e.target.checked)} /> Every mathematical expression matches the printed page.</label>}
                  <label className="block font-semibold">Teacher who reviewed it (for a teacher review)<input className={`${f} mt-1 w-full`} value={teacher} maxLength={80} onChange={(e) => setTeacher(e.target.value)} /></label>
                  <label className="block font-semibold">Note<input className={`${f} mt-1 w-full`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Required to reject or withdraw" /></label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy || text === p.text} onClick={() => void act("save_correction")} className={`${btn} bg-ink text-sheet`}>Save correction</button>
                  <button type="button" disabled={busy || rs === "checked" || rs === "teacher_reviewed" || rs === "rejected"} onClick={() => void act("mark_checked")} className={`${btn} bg-brand text-sheet`}>Mark checked against page</button>
                  <button type="button" disabled={busy || rs !== "checked"} onClick={() => void act("mark_teacher_reviewed")} className={`${btn} border border-brand text-brand-deep`}>Record teacher review</button>
                  <button type="button" disabled={busy || !(rs === "checked" || rs === "teacher_reviewed") || !(ps === "draft" || ps === "withdrawn")} onClick={() => void act("approve")} className={`${btn} bg-mint text-sheet`}>Approve for students</button>
                  <button type="button" disabled={busy || ps !== "approved"} onClick={() => void act("publish")} className={`${btn} bg-mint text-sheet`}>Publish</button>
                  <button type="button" disabled={busy || !(ps === "published" || ps === "approved")} onClick={() => void act("withdraw")} className={`${btn} border border-again text-again`}>Withdraw</button>
                  <button type="button" disabled={busy || rs === "rejected"} onClick={() => void act("reject")} className={`${btn} border border-again text-again`}>Reject</button>
                  <button type="button" disabled={busy || ps === "published" || (ps === "draft" && rs !== "rejected")} onClick={() => void act("return_to_draft")} className={`${btn} border border-line`}>Return to draft</button>
                </div>
                {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-mint" : "text-sm text-again"}>{msg.text}</p>}
                <div>
                  <p className="text-sm font-semibold">History</p>
                  {hist.length === 0 ? <p className="text-sm text-ink-mid">No review actions yet.</p> : (
                    <ol className="mt-1 space-y-1 text-sm">{hist.map((h) => <li key={String(h.id)}><span className="tnum text-ink-mid">{String(h.created_at).slice(0, 16).replace("T", " ")}</span> · {String(h.username ?? (h.action === "seed_checked" ? "IntelliHorizon team" : "admin"))} · {String(h.action).replace(/_/g, " ")} · {REVIEW_LABEL[String(h.to_review ?? "none")]} / {PUBLISH_LABEL[String(h.to_publish ?? "draft")]}{h.note ? ` · ${String(h.note)}` : ""}</li>)}</ol>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
