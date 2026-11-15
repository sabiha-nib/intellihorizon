import { useRef, useState } from "react";

import { finishImport, ingestPages, startImport } from "../../lib/api/admin.functions";
import { BOOKS } from "../../lib/curriculum/registry";
import { call } from "../auth/messages";

/** Format of an OCR text pack produced offline from the owner-supplied PDFs (one entry per book, one per page). */
export type TextPack = {
  format: "educerro-text-pack";
  version: 1;
  createdAt: string;
  engine: string;
  books: { bookId: string; key: string; sourceFile: string; sourceSha256: string; pdfPages: number; pages: { page: number; text: string; confidence: number | null }[] }[];
};

/** Validates a parsed pack against the canonical registry. Returns a list of problems; empty means it can be imported. */
export function checkPack(p: unknown): string[] {
  const problems: string[] = [];
  const pack = p as TextPack;
  if (!pack || pack.format !== "educerro-text-pack" || pack.version !== 1 || !Array.isArray(pack.books)) return ["This isn't an IntelliHorizon text pack (version 1)."];
  for (const b of pack.books) {
    const reg = BOOKS.find((x) => x.id === b.bookId);
    if (!reg) { problems.push(`Unknown book id ${String(b.bookId).slice(0, 40)}.`); continue; }
    if (reg.key !== b.key) problems.push(`${reg.titleLatin}: key "${b.key}" doesn't match the registry ("${reg.key}").`);
    if (reg.pdfPages !== b.pdfPages) problems.push(`${reg.titleLatin}: ${b.pdfPages} pages in the pack, ${reg.pdfPages} in the registry.`);
    if (!/^[0-9a-f]{64}$/.test(b.sourceSha256)) problems.push(`${reg.titleLatin}: missing source file fingerprint.`);
    if (!Array.isArray(b.pages) || b.pages.some((x) => !Number.isInteger(x.page) || x.page < 1 || x.page > reg.pdfPages || typeof x.text !== "string")) problems.push(`${reg.titleLatin}: page list is malformed.`);
  }
  return problems;
}

type Result = { title: string; jobStatus: string; bookStatus: string; passages: number; issues: string[] };

async function readPack(file: File): Promise<unknown> {
  const gz = file.name.endsWith(".gz") || new Uint8Array(await file.slice(0, 2).arrayBuffer()).join(",") === "31,139";
  const stream = gz ? file.stream().pipeThrough(new DecompressionStream("gzip")) : file.stream();
  return JSON.parse(await new Response(stream).text());
}

export function PackImporter({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pack, setPack] = useState<TextPack | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const open = async (file: File) => {
    setPack(null); setResults([]); setProblems([]);
    if (file.size > 60 * 1024 * 1024) return setProblems(["That file is larger than 60 MB."]);
    try {
      const p = await readPack(file);
      const pr = checkPack(p);
      setProblems(pr);
      if (!pr.length) { setPack(p as TextPack); setChosen(Object.fromEntries((p as TextPack).books.map((b) => [b.bookId, true]))); }
    } catch {
      setProblems(["Couldn't read that file. Choose the .json.gz text pack."]);
    }
  };

  const run = async () => {
    if (!pack) return;
    setBusy(true);
    const out: Result[] = [];
    for (const b of pack.books.filter((x) => chosen[x.bookId])) {
      const reg = BOOKS.find((x) => x.id === b.bookId)!;
      try {
        const st = await call(startImport({ data: { textbookId: b.bookId, fileSha256: b.sourceSha256, pageCount: b.pdfPages, method: "ocr" } }));
        if (!st.ok) throw new Error("detail" in st && st.detail ? st.detail : st.code);
        const pages = [...b.pages].sort((x, y) => x.page - y.page);
        for (let i = 0; i < pages.length; i += 10) {
          setProgress(`${reg.titleLatin}: page ${Math.min(i + 10, pages.length)} of ${pages.length}`);
          const batch = pages.slice(i, i + 10).map((x) => ({ page: x.page, text: x.text.slice(0, 40000), confidence: x.confidence }));
          let r = await call(ingestPages({ data: { jobId: st.jobId, pages: batch } }), 45000);
          if (!r.ok) r = await call(ingestPages({ data: { jobId: st.jobId, pages: batch } }), 45000);
          if (!r.ok) throw new Error(r.code);
        }
        const fin = await call(finishImport({ data: { jobId: st.jobId, aborted: false } }));
        if (!fin.ok) throw new Error(fin.code);
        out.push({ title: reg.titleLatin, jobStatus: fin.jobStatus, bookStatus: fin.bookStatus, passages: fin.passages, issues: fin.issues });
      } catch (e) {
        out.push({ title: reg.titleLatin, jobStatus: "failed", bookStatus: "unchanged", passages: 0, issues: [(e as Error).message] });
      }
      setResults([...out]);
    }
    setProgress(null);
    setBusy(false);
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="h-11 rounded-[12px] bg-brand px-5 font-semibold text-sheet disabled:opacity-50">Choose text pack (.json.gz)</button>
        <input ref={fileRef} type="file" accept=".gz,.json,application/gzip,application/json" className="sr-only" aria-label="Text pack file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void open(f); }} />
        {pack && <button type="button" disabled={busy || !Object.values(chosen).some(Boolean)} onClick={() => void run()} className="h-11 rounded-[12px] border border-ink px-5 font-semibold disabled:opacity-50">{busy ? "Importing…" : "Import selected books"}</button>}
      </div>
      <p className="text-sm text-ink-mid">The nine Class 7 PDFs have no text layer (their letters are drawn as shapes), so their text was read by OCR offline. Each book's pack entry is checked against the registry (book id, page count) before anything is sent. Imported books go to "needs review"; nothing reaches students until you approve each one.</p>
      {problems.length > 0 && <ul className="list-disc space-y-1 rounded-[12px] bg-again/10 p-3 pl-7 text-sm text-[#8f3423]" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      {pack && (
        <div className="rounded-[14px] border border-ink-low/25 p-3 text-sm">
          <p className="font-semibold">Pack from {new Date(pack.createdAt).toLocaleString()} · {pack.engine}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {pack.books.map((b) => {
              const reg = BOOKS.find((x) => x.id === b.bookId)!;
              const conf = b.pages.filter((p) => p.confidence !== null).map((p) => p.confidence as number);
              const mean = conf.length ? Math.round(conf.reduce((a, c) => a + c, 0) / conf.length) : null;
              return (
                <li key={b.bookId}><label className="flex items-center gap-2"><input type="checkbox" checked={!!chosen[b.bookId]} disabled={busy} onChange={(e) => setChosen((c) => ({ ...c, [b.bookId]: e.target.checked }))} />{reg.title} <span className="text-ink-mid">({b.pages.length}/{reg.pdfPages} pages{mean !== null ? `, mean confidence ${mean}%` : ""})</span></label></li>
              );
            })}
          </ul>
        </div>
      )}
      {progress && <p className="text-sm text-ink-mid" aria-live="polite">{progress}</p>}
      {results.length > 0 && (
        <ul className="space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.title} className="rounded-[12px] border border-ink-low/25 p-3">
              <p className="font-semibold">{r.title}: import {r.jobStatus.replace(/_/g, " ")}, book {r.bookStatus.replace(/_/g, " ")}, {r.passages} passages.</p>
              {r.issues.length > 0 && <ul className="mt-1 list-disc pl-5 text-ink-mid">{r.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
