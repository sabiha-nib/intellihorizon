import { useEffect, useState } from "react";

import { contentCoverage, type CoverageBook } from "../../lib/api/review.functions";
import { SUBJECTS, type SubjectId } from "../../lib/curriculum/registry";
import { call } from "../auth/messages";

const f = "h-10 rounded-[10px] border border-ink-low/35 bg-sheet px-3 text-[15px] outline-none focus:border-ink";
type Data = { books: CoverageBook[]; totals: Record<string, number>; subjects: Record<string, string | number>[] };

const TILES: [string, string][] = [
  ["books", "Books"], ["chapters", "Chapters"], ["pages_imported", "Pages imported"], ["pages_awaiting", "Pages awaiting review"],
  ["pages_low_conf", "Low-confidence pages"], ["checked", "Passages checked against images"], ["teacher", "Teacher-reviewed passages"],
  ["published", "Published passages"], ["student_visible", "Passages students can see"], ["blocked", "Held back by warnings"],
  ["math_unverified", "Unchecked mathematics"], ["failed_imports", "Failed imports"],
];

/** Real counts from the database, never estimates. "Students can see" applies the same rule as the tutor's retrieval. */
export function Coverage({ onOpenBook }: { onOpenBook: (bookId: string) => void }) {
  const [subject, setSubject] = useState<SubjectId | "">("");
  const [grade, setGrade] = useState<number | "">(7);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    void call(contentCoverage({ data: { grade: grade === "" ? null : grade, subjectId: subject || null, bookId: null } })).then((r) => (r.ok ? setData(r as unknown as Data) : setErr(r.code)));
  }, [subject, grade]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm font-semibold">Class <select className={`${f} ml-1`} value={grade} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}><option value="">All</option><option value={7}>7</option></select></label>
        <label className="text-sm font-semibold">Subject <select className={`${f} ml-1`} value={subject} onChange={(e) => setSubject(e.target.value as SubjectId | "")}><option value="">All eight</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.label.en}</option>)}</select></label>
      </div>
      {err && <p role="alert" className="text-again">Couldn't load coverage: {err}</p>}
      {!data && !err && <p role="status">Loading coverage…</p>}
      {data && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {TILES.map(([k, l]) => (
              <div key={k} className="rounded-[14px] bg-lilac p-3"><dt className="text-[13px] text-ink-mid">{l}</dt><dd className="tnum text-[22px] font-bold">{data.totals[k] ?? 0}</dd></div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[14px]">
              <thead><tr className="border-b border-line text-ink-mid">
                <th className="py-2 pr-3">Book</th><th className="pr-3">Status</th><th className="pr-3">Pages</th><th className="pr-3">Passages</th>
                <th className="pr-3">Unreviewed</th><th className="pr-3">Corrected</th><th className="pr-3">Checked</th><th className="pr-3">Teacher</th>
                <th className="pr-3">Published</th><th className="pr-3">Students see</th><th className="pr-3">Warnings</th><th>Permission</th>
              </tr></thead>
              <tbody>
                {data.books.map((b) => (
                  <tr key={b.id} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-3"><button type="button" className="text-left font-semibold underline decoration-dashed underline-offset-4" onClick={() => onOpenBook(b.id)}>{b.subject_name}: <span lang="bn">{b.title}</span></button></td>
                    <td className="pr-3">{b.status.replace(/_/g, " ")}</td>
                    <td className="pr-3 tnum">{b.pages_imported}{b.page_count ? ` / ${b.page_count}` : ""}{b.pages_low_conf ? ` (${b.pages_low_conf} low)` : ""}</td>
                    <td className="pr-3 tnum">{b.passages}</td>
                    <td className="pr-3 tnum">{b.extracted}</td>
                    <td className="pr-3 tnum">{b.corrected}</td>
                    <td className="pr-3 tnum">{b.checked}</td>
                    <td className="pr-3 tnum">{b.teacher}</td>
                    <td className="pr-3 tnum">{b.published}</td>
                    <td className="pr-3 tnum font-semibold">{b.student_visible}</td>
                    <td className="pr-3 tnum">{b.blocked}{b.math_unverified ? ` (${b.math_unverified} maths)` : ""}{b.failed_imports ? `, ${b.failed_imports} failed imports` : ""}</td>
                    <td>{b.license_status === "permitted" ? "Written permission" : b.license_status === "restricted" ? "Restricted" : "Pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.books.length === 0 && <p className="text-ink-mid">No books match these filters.</p>}
          <p className="text-sm text-ink-mid">"Checked" means compared word by word with the page image. "Teacher" means a named teacher reviewed it; neither is an NCTB endorsement, and publishing does not mean NCTB permission has been received.</p>
        </>
      )}
    </div>
  );
}
