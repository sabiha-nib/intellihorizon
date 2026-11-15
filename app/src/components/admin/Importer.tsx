import { useRef, useState } from "react";

import { finishImport, ingestPages, startImport } from "../../lib/api/admin.functions";
import { call } from "../auth/messages";
import { joinPdfItems } from "../../lib/curriculum/text";

type Report = { jobStatus: string; bookStatus: string; issues: string[]; usable: number; passages: number; duplicateOf: string | null };

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extracts each page's text in the browser with pdf.js and sends text in batches.
 * The PDF file itself is never uploaded or stored.
 */
export function Importer({ textbookId, onDone }: { textbookId: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const abort = useRef(false);
  const [state, setState] = useState<"idle" | "reading" | "sending" | "done" | "error">("idle");
  const [progress, setProgress] = useState({ page: 0, total: 0 });
  const [tally, setTally] = useState({ ok: 0, empty: 0, low: 0, legacy: 0, duplicate: 0, passages: 0 });
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (file: File) => {
    abort.current = false;
    setError(null);
    setReport(null);
    setTally({ ok: 0, empty: 0, low: 0, legacy: 0, duplicate: 0, passages: 0 });
    if (file.size > 150 * 1024 * 1024) return setError("That file is larger than 150 MB.");
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head) !== "%PDF-") return setError("That file is not a PDF.");
    setState("reading");
    try {
      const buf = await file.arrayBuffer();
      const fileSha = await sha256(buf);
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise;
      const total = doc.numPages;
      setProgress({ page: 0, total });
      const started = (await call(startImport({ data: { textbookId, fileSha256: fileSha, pageCount: total } }))) as { ok: true; jobId: string; duplicateOf: string | null } | { ok: false; code: string };
      if (!started.ok) throw new Error(started.code);
      setState("sending");
      let batch: { page: number; text: string }[] = [];
      const flush = async () => {
        if (!batch.length) return;
        type Ing = { ok: true; pagesOk: number; empty: number; low: number; legacy: number; duplicate: number; passages: number } | { ok: false; code: string };
        let r = (await call(ingestPages({ data: { jobId: started.jobId, pages: batch } }), 45000)) as Ing;
        if (!r.ok) r = (await call(ingestPages({ data: { jobId: started.jobId, pages: batch } }), 45000)) as Ing;
        if (!r.ok) throw new Error(r.code);
        const g = r;
        setTally((t) => ({ ok: t.ok + g.pagesOk, empty: t.empty + g.empty, low: t.low + g.low, legacy: t.legacy + g.legacy, duplicate: t.duplicate + g.duplicate, passages: t.passages + g.passages }));
        batch = [];
      };
      for (let p = 1; p <= total; p++) {
        if (abort.current) break;
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const items = (tc.items as { str?: string; hasEOL?: boolean; transform?: number[]; width?: number }[])
          .filter((it) => typeof it.str === "string")
          .map((it) => ({ str: it.str as string, x: it.transform?.[4] ?? 0, w: it.width ?? 0, eol: !!it.hasEOL }));
        const text = joinPdfItems(items);
        batch.push({ page: p, text: text.slice(0, 40000) });
        page.cleanup();
        setProgress({ page: p, total });
        if (batch.length >= 10) await flush();
      }
      await flush();
      const fin = (await call(finishImport({ data: { jobId: started.jobId, aborted: abort.current } }))) as ({ ok: true } & Omit<Report, "duplicateOf">) | { ok: false; code: string };
      if (!fin.ok) throw new Error(fin.code);
      setReport({ ...fin, duplicateOf: started.duplicateOf });
      setState("done");
      onDone();
    } catch (e) {
      setError(`Import stopped: ${(e as Error).message}. Nothing was offered to students; you can run the import again.`);
      setState("error");
      onDone();
    }
  };

  const busy = state === "reading" || state === "sending";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="h-11 rounded-[12px] bg-brand px-5 font-semibold text-sheet disabled:opacity-50">{busy ? "Importing…" : "Choose the official PDF"}</button>
        {busy && <button type="button" onClick={() => (abort.current = true)} className="h-11 rounded-[12px] border border-ink-low/35 px-4 font-semibold">Stop</button>}
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="PDF file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run(f); }} />
      </div>
      <p className="text-sm text-ink-mid">Download the PDF yourself from nctb.gov.bd, then choose it here. Text is extracted in your browser; the PDF is not uploaded or stored. Importing again replaces this book's text but keeps chapters and questions.</p>
      {progress.total > 0 && (
        <div aria-live="polite">
          <div className="h-2 rounded-full bg-ink-low/15"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(progress.page / progress.total) * 100}%` }} /></div>
          <p className="mt-2 text-sm text-ink-mid">Page {progress.page} of {progress.total} · readable {tally.ok} · short {tally.low} · no text {tally.empty} · unreadable font {tally.legacy} · repeated {tally.duplicate} · passages {tally.passages}</p>
        </div>
      )}
      {error && <p className="rounded-[12px] bg-again/10 p-3 text-sm text-[#8f3423]" role="alert">{error}</p>}
      {report && (
        <div className="rounded-[14px] border border-ink-low/25 p-4 text-sm">
          <p className="font-semibold">Import {report.jobStatus.replace(/_/g, " ")}. Book status: {report.bookStatus.replace(/_/g, " ")}.</p>
          <p className="mt-1 text-ink-mid">{report.usable} pages indexed into {report.passages} passages.</p>
          {report.duplicateOf && <p className="mt-1 text-[#8a5a12]">This file is identical to the one imported for "{report.duplicateOf}". Check you picked the right book.</p>}
          {report.issues.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-mid">{report.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
          {report.bookStatus === "needs_review" && <p className="mt-2 font-semibold">Students won't see this book until you check the report and sample pages below, then approve it.</p>}
        </div>
      )}
    </div>
  );
}
