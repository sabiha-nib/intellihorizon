// OCR quality review. Mathematics pages are sorted into tiers; an editor reads the page, corrects the text,
// or marks it as checked. Corrections are stored beside the original OCR and re-index only that page.
import { useEffect, useState } from "react";

import { correctOcrPage, ocrPage, ocrQuality } from "../../lib/api/admin.functions";
import { call } from "../auth/messages";
import { Badge, Button } from "../universe/ui";

type Page = {
  page: number;
  confidence: number | null;
  quality: string;
  corrected: boolean;
  reviewState: string | null;
  tier: string;
  density: number;
  brokenLines: number;
};
const TIER: Record<string, { label: string; tone: "again" | "amber" | "mint" | "neutral" }> = {
  excluded: { label: "Excluded (below 55%)", tone: "neutral" },
  high_risk: { label: "High risk", tone: "again" },
  check: { label: "Check notation", tone: "amber" },
  clean: { label: "Looks clean", tone: "mint" },
};

export function OcrQc({
  textbookId,
  language,
  offset,
}: {
  textbookId: string;
  language: string;
  offset: number | null;
}) {
  const [pages, setPages] = useState<Page[] | null>(null);
  const [tiers, setTiers] = useState<Record<string, number>>({});
  const [threshold, setThreshold] = useState(75);
  const [filter, setFilter] = useState("high_risk");
  const [open, setOpen] = useState<{
    page: number;
    text: string;
    corrected: string | null;
    state: string | null;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = async () => {
    const r = await call(ocrQuality({ data: { textbookId, threshold } }));
    if (r.ok) {
      const x = r as { pages: Page[]; tiers: Record<string, number> };
      setPages(x.pages);
      setTiers(x.tiers);
    }
  };
  useEffect(() => {
    void load();
  }, [textbookId, threshold]); // eslint-disable-line react-hooks/exhaustive-deps
  const openPage = async (page: number) => {
    const r = await call(ocrPage({ data: { textbookId, page } }));
    if (r.ok) {
      const p = (r as { page: Record<string, string | number | null> }).page;
      setOpen({
        page,
        text: String(p.text ?? ""),
        corrected: (p.corrected_text as string) ?? null,
        state: (p.review_state as string) ?? null,
      });
      setDraft(String(p.corrected_text ?? p.text ?? ""));
      setMsg(null);
    }
  };
  const save = async (state: "corrected" | "checked_ok" | "needs_teacher") => {
    if (!open) return;
    const r = await call(
      correctOcrPage({
        data: { textbookId, page: open.page, text: state === "corrected" ? draft : null, state },
      }),
    );
    setMsg(
      r.ok
        ? state === "corrected"
          ? "Correction saved and the page re-indexed. The original OCR is kept."
          : "Recorded."
        : `Not saved: ${r.code}`,
    );
    if (r.ok) void load();
  };
  if (!pages) return <p>Loading pages…</p>;
  if (!pages.length)
    return (
      <p className="text-ink-mid">
        No pages imported for this book yet. Import the text pack first.
      </p>
    );
  const shown = pages.filter((p) => filter === "all" || p.tier === filter);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(TIER).map(([k, v]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`rounded-full border-2 px-3 py-1 text-[14px] font-semibold ${filter === k ? "border-brand bg-brand-soft" : "border-line"}`}
          >
            {v.label}: {tiers[k] ?? 0}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
          className={`rounded-full border-2 px-3 py-1 text-[14px] font-semibold ${filter === "all" ? "border-brand bg-brand-soft" : "border-line"}`}
        >
          All: {pages.length}
        </button>
        <label className="ml-auto flex items-center gap-2 text-[14px]">
          Review below{" "}
          <input
            type="number"
            min={55}
            max={95}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(55, Math.min(95, Number(e.target.value) || 75)))}
            className="h-9 w-16 rounded-[10px] border border-line px-2"
          />
          % confidence
        </label>
      </div>
      <p className="text-[13px] text-ink-mid">
        High risk: OCR confidence under the threshold, 40+ suspicious marks per 1,000 characters, or
        4+ broken lines. Check notation: 8+ suspicious marks per 1,000. This is a heuristic to order
        the work, not a judgement of correctness: formulas are never guessed.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((p) => (
          <li key={p.page}>
            <button
              type="button"
              onClick={() => void openPage(p.page)}
              className={`rounded-[10px] border px-2.5 py-1 text-[13px] ${open?.page === p.page ? "border-brand bg-brand-soft" : "border-line bg-sheet"}`}
            >
              p.{offset !== null ? p.page - offset : p.page}
              {p.confidence !== null ? ` · ${Math.round(p.confidence)}%` : ""}
              {p.corrected
                ? " · corrected"
                : p.reviewState
                  ? ` · ${p.reviewState.replace("_", " ")}`
                  : ""}
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="space-y-3 rounded-[18px] border border-line bg-sheet p-4">
          <div className="flex flex-wrap items-center gap-2">
            <strong>
              PDF page {open.page}
              {offset !== null ? ` (printed ${open.page - offset})` : ""}
            </strong>
            {(() => {
              const p = pages.find((x) => x.page === open.page);
              return p ? <Badge tone={TIER[p.tier].tone}>{TIER[p.tier].label}</Badge> : null;
            })()}
          </div>
          <p className="text-[13px] text-ink-mid">
            Compare with the printed page in the book, then fix the text below. Write fractions as
            3/4 and ratios as 3 : 4.
          </p>
          <label className="block text-[14px] font-semibold" htmlFor="ocr-edit">
            Page text
          </label>
          <textarea
            id="ocr-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            lang={language}
            className="w-full rounded-[12px] border-2 border-line p-3 font-mono text-[14px] leading-relaxed outline-none focus:border-brand"
          />
          {open.corrected && (
            <details className="text-[13px]">
              <summary className="cursor-pointer font-semibold">Original OCR</summary>
              <pre
                className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-[10px] bg-lilac p-2"
                lang={language}
              >
                {open.text}
              </pre>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save("corrected")} disabled={!draft.trim()}>
              Save correction
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void save("checked_ok")}>
              Checked: no changes needed
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void save("needs_teacher")}>
              Needs a teacher
            </Button>
          </div>
          {msg && (
            <p role="status" className="text-[14px]">
              {msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
