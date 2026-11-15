import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import type { L } from "../../content/types";
import { subjectLabel } from "../../lib/curriculum/config";
import { BOOKS, SUBJECTS, subjectById, type SubjectId } from "../../lib/curriculum/registry";
import type { SourceRef } from "../../lib/tutor/types";
import { useLearner } from "../../lib/store";

export const card = "rounded-[24px] border border-line bg-sheet shadow-[var(--shadow-quiet)]";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-[60ch] text-[16px] leading-relaxed text-ink-mid">{subtitle}</p>
        )}
      </div>
      {children}
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${card} flex flex-col items-start gap-3 p-6`}>
      <svg width="40" height="40" viewBox="-20 -20 40 40" aria-hidden="true">
        <circle r="17" fill="none" stroke="#6C6886" strokeDasharray="3 3" />
        <path
          d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z"
          fill="none"
          stroke="#6C6886"
          strokeWidth="1.4"
        />
      </svg>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="max-w-[60ch] leading-relaxed text-ink-mid">{body}</p>
      {action}
    </div>
  );
}

export function SignInPrompt({ next, why }: { next: string; why: L }) {
  const { t, tx } = useLearner();
  return (
    <EmptyState
      title={tx("Sign in to continue", "চালিয়ে যেতে সাইন ইন করো")}
      body={t(why)}
      action={
        <div className="flex flex-wrap gap-3">
          <Link
            to="/signin"
            search={{ next }}
            className="inline-flex h-11 items-center rounded-[14px] bg-brand px-5 font-semibold text-sheet"
          >
            {tx("Sign in", "সাইন ইন")}
          </Link>
          <Link
            to="/signup"
            className="inline-flex h-11 items-center rounded-[14px] border border-ink-low/35 px-5 font-semibold"
          >
            {tx("Create an account", "অ্যাকাউন্ট খোলো")}
          </Link>
        </div>
      }
    />
  );
}

const BOOK_STATUS: Record<string, { label: L; tone: string }> = {
  indexed: {
    label: { en: "Ready for the tutor", bn: "টিউটরের জন্য প্রস্তুত" },
    tone: "border-right/50 text-right",
  },
  partial: { label: { en: "Some pages checked for the tutor", bn: "কিছু পৃষ্ঠা টিউটরের জন্য যাচাই করা" }, tone: "border-right/50 text-right" },
  needs_review: {
    label: { en: "Being checked", bn: "যাচাই চলছে" },
    tone: "border-thread-deep/60 text-[#8a5a12]",
  },
  processing: {
    label: { en: "Being added", bn: "যোগ করা হচ্ছে" },
    tone: "border-ink-low/50 text-ink-mid",
  },
  discovered: {
    label: { en: "Tutor text not added yet", bn: "টিউটরের লেখা এখনো যোগ হয়নি" },
    tone: "border-ink-low/50 text-ink-mid",
  },
  failed: {
    label: { en: "Couldn't be read", bn: "পড়া যায়নি" },
    tone: "border-again/50 text-again",
  },
};

export function BookStatus({ status }: { status: string }) {
  const { t } = useLearner();
  const s = BOOK_STATUS[status] ?? BOOK_STATUS.discovered;
  return (
    <span
      className={`inline-flex items-center rounded-full border border-dashed px-2.5 py-0.5 text-xs font-semibold ${s.tone}`}
    >
      {t(s.label)}
    </span>
  );
}

export function subjectName(
  t: (l: L) => string,
  key: string,
  printed: string,
  lang: "en" | "bn",
): string {
  const l = subjectLabel(key);
  return key === "other" || !l ? printed : lang === "bn" ? l.bn : l.en;
}

export function bookLabel(
  b: {
    subject_key?: string;
    subjectKey?: string;
    subject_name?: string;
    subjectName?: string;
    paper: string;
  },
  t: (l: L) => string,
  lang: "en" | "bn",
) {
  const key = b.subject_key ?? b.subjectKey ?? "other";
  const name = b.subject_name ?? b.subjectName ?? key;
  // Registry books use the book key as their slot within a subject; the subject name is the label.
  const registryBook = BOOKS.some((x) => x.key === b.paper);
  return `${subjectName(t, key, name, lang)}${b.paper && !registryBook ? ` · ${b.paper}` : ""}`;
}

export function pageLabel(
  s: { pdfPage: number; printedPage: number | null },
  tx: (en: string, bn: string) => string,
) {
  return s.printedPage !== null && s.printedPage > 0
    ? tx(`page ${s.printedPage}`, `পৃষ্ঠা ${s.printedPage}`)
    : tx(`PDF page ${s.pdfPage}`, `পিডিএফ পৃষ্ঠা ${s.pdfPage}`);
}

/** Expandable provenance for one textbook excerpt. Only fields that exist are shown; nothing is filled in. */
export function SourceCard({ source }: { source: SourceRef }) {
  const { tx, t, lang } = useLearner();
  const [open, setOpen] = useState(false);
  const chap = source.chapter
    ? `${source.chapter.label ?? tx(`Chapter ${source.chapter.position}`, `অধ্যায় ${source.chapter.position}`)}: ${source.chapter.title}`
    : tx("Chapter not mapped", "অধ্যায় চিহ্নিত নয়");
  return (
    <div className="mt-3 rounded-[14px] border border-ink-low/20 bg-paper/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm"
      >
        <span className="min-w-0 truncate">
          <span className="font-semibold">{source.title}</span>
          <span className="text-ink-mid"> · {pageLabel(source, tx)}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-ink-mid">
          {open ? tx("Hide source", "উৎস লুকাও") : tx("Source", "উৎস")}
        </span>
      </button>
      {open && (
        <dl className="grid gap-x-4 gap-y-1.5 border-t border-ink-low/15 px-3.5 py-3 text-sm sm:grid-cols-2">
          <Row k={tx("Publisher", "প্রকাশক")} v={source.publisher} />
          <Row k={tx("Class", "শ্রেণি")} v={String(source.grade)} />
          <Row k={tx("Subject", "বিষয়")} v={bookLabel(source, t, lang)} />
          <Row
            k={tx("Version", "ভার্সন")}
            v={
              source.medium === "bangla"
                ? tx("Bangla medium", "বাংলা মাধ্যম")
                : tx("English version", "ইংলিশ ভার্সন")
            }
          />
          <Row k={tx("Chapter", "অধ্যায়")} v={chap} />
          <Row k={tx("Location", "অবস্থান")} v={pageLabel(source, tx)} />
          {source.extraction === "checked" && (
            <Row
              k={tx("Text", "লেখা")}
              v={tx(
                "Read by OCR, then checked word by word against the printed page and corrected by the IntelliHorizon team. Not yet reviewed by a teacher.",
                "ওসিআর দিয়ে পড়া, তারপর ছাপা পৃষ্ঠার সঙ্গে শব্দে শব্দে মিলিয়ে ইন্টেলিহরাইজন দল সংশোধন করেছে। এখনো কোনো শিক্ষক পর্যালোচনা করেননি।",
              )}
            />
          )}
          {source.extraction === "teacher_reviewed" && (
            <Row
              k={tx("Text", "লেখা")}
              v={tx(
                "Checked word by word against the printed page, then reviewed by a teacher. This is not an official NCTB endorsement.",
                "ছাপা পৃষ্ঠার সঙ্গে শব্দে শব্দে মেলানো, তারপর একজন শিক্ষক পর্যালোচনা করেছেন। এটি এনসিটিবির আনুষ্ঠানিক অনুমোদন নয়।",
              )}
            />
          )}
          {source.extraction === "ocr" && (
            <Row
              k={tx("Text", "লেখা")}
              v={tx(
                `Read from the page image by OCR${source.ocrConfidence != null ? ` (${Math.round(source.ocrConfidence)}% confidence)` : ""}; a letter may be misread, so check the printed page.`,
                `পৃষ্ঠার ছবি থেকে ওসিআর দিয়ে পড়া${source.ocrConfidence != null ? ` (${Math.round(source.ocrConfidence)}% নিশ্চয়তা)` : ""}; কোনো অক্ষর ভুল পড়া হতে পারে, ছাপা পৃষ্ঠা মিলিয়ে নাও।`,
              )}
            />
          )}
          {source.edition && <Row k={tx("Edition", "সংস্করণ")} v={source.edition} />}
          <Row
            k={tx("Use", "ব্যবহার")}
            v={
              source.license === "permitted"
                ? tx("Used with NCTB permission", "এনসিটিবির অনুমতিতে ব্যবহৃত")
                : tx(
                    "Short excerpt; NCTB permission pending",
                    "সংক্ষিপ্ত অংশ; এনসিটিবির অনুমতি প্রক্রিয়াধীন",
                  )
            }
          />
          {source.officialUrl && (
            <div className="sm:col-span-2">
              <a
                href={source.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-ink underline decoration-dashed underline-offset-4"
              >
                {tx("Open the official book on nctb.gov.bd", "nctb.gov.bd-তে মূল বই খোলো")}
              </a>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink-low">{k}</dt>
      <dd className="min-w-0 break-words font-medium">{v}</dd>
    </div>
  );
}

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Filter chips for the eight registry subjects ("All" + 8). */
export function SubjectFilter({
  value,
  onChange,
  label,
}: {
  value: SubjectId | null;
  onChange: (v: SubjectId | null) => void;
  label?: string;
}) {
  const { t, tx } = useLearner();
  const cls = (on: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${on ? "border-brand bg-brand text-sheet" : "border-ink-low/30 bg-sheet text-ink hover:border-ink"}`;
  return (
    <div
      role="radiogroup"
      aria-label={label ?? tx("Subject", "বিষয়")}
      className="flex flex-wrap gap-1.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onChange(null)}
        className={cls(value === null)}
      >
        {tx("All subjects", "সব বিষয়")}
      </button>
      {SUBJECTS.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          onClick={() => onChange(s.id)}
          className={cls(value === s.id)}
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: s.hue }} />
          {t(s.short)}
        </button>
      ))}
    </div>
  );
}

export function SubjectTag({ id }: { id: string | null | undefined }) {
  const { t } = useLearner();
  const s = id ? subjectById(id) : null;
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-ink-mid">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: s.hue }} />
      {t(s.short)}
    </span>
  );
}
