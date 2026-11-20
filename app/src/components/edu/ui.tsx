import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import type { L, Lang } from "../../content/types";
import type { Glow } from "../../lib/model";
import { useLearner } from "../../lib/store";
import { AppHeader, PublicHeader } from "../universe/Shell";

export const GLOW_LABEL: Record<Glow, L> = {
  unexplored: { en: "Not explored yet", bn: "এখনো দেখা হয়নি" },
  glimpsed: { en: "Glimpsed", bn: "এক ঝলক দেখা" },
  fragile: { en: "Fragile: right, not yet steady", bn: "ভঙ্গুর: সঠিক, এখনো দৃঢ় নয়" },
  holding: { en: "Holding", bn: "টিকে আছে" },
  shapeshifter: { en: "Survives disguises", bn: "ছদ্মবেশেও টেকে" },
  durable: { en: "Durable: still there days later", bn: "স্থায়ী: দিন পরেও আছে" },
};

export const GLOW_HINT: Record<Glow, L> = {
  unexplored: { en: "No evidence yet. Nothing is assumed.", bn: "এখনো কোনো প্রমাণ নেই। কিছুই ধরে নেওয়া হয়নি।" },
  glimpsed: { en: "You have started, and the idea has not clicked yet. That is normal.", bn: "তুমি শুরু করেছ, ধারণাটা এখনো ধরা দেয়নি। এটা স্বাভাবিক।" },
  fragile: { en: "You got it right, but it may crack under a new disguise.", bn: "সঠিক হয়েছে, কিন্তু নতুন ছদ্মবেশে ভেঙে যেতে পারে।" },
  holding: { en: "Right, explained or tested once in a new form.", bn: "সঠিক, ব্যাখ্যা করা বা নতুন রূপে একবার যাচাই করা।" },
  shapeshifter: { en: "Your idea survived new contexts, forms and languages.", bn: "তোমার ধারণা নতুন প্রসঙ্গ, রূপ আর ভাষাতেও টিকেছে।" },
  durable: { en: "It survived disguises and was still there a day later.", bn: "ছদ্মবেশে টিকেছে এবং এক দিন পরেও মনে ছিল।" },
};

/** Star glyph used everywhere a concept appears. Brightness carries meaning. */
export function StarGlyph({ glow, r = 9, thread = "#57707A", ignite = false }: { glow: Glow; r?: number; thread?: string; ignite?: boolean }) {
  const lit = glow === "holding" || glow === "shapeshifter" || glow === "durable";
  const fill = glow === "unexplored" ? "transparent" : glow === "glimpsed" ? "#8E95B8" : "#57707A";
  const op = glow === "glimpsed" ? 0.75 : glow === "fragile" ? 0.7 : 1;
  const d = `M0 ${-r} L${r * 0.28} ${-r * 0.28} L${r} 0 L${r * 0.28} ${r * 0.28} L0 ${r} L${-r * 0.28} ${r * 0.28} L${-r} 0 L${-r * 0.28} ${-r * 0.28} Z`;
  return (
    <g>
      {(glow === "shapeshifter" || glow === "durable") && <circle r={r * 1.9} fill="#57707A" opacity={0.16} />}
      {glow === "durable" && <circle r={r * 1.55} fill="none" stroke="#57707A" strokeWidth={1.4} strokeDasharray="3 3" />}
      {lit && <circle r={r * 1.25} fill="none" stroke={thread} strokeWidth={1.2} opacity={0.9} />}
      <path
        d={d}
        fill={fill}
        opacity={op}
        stroke={glow === "unexplored" ? "#8E95B8" : "none"}
        strokeWidth={1.2}
        className={`${glow === "fragile" ? "edu-flicker" : ""} ${ignite ? "edu-ignite" : ""}`}
      />
    </g>
  );
}

export function Monogram({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-16 -16 32 32" aria-hidden="true">
      {/* Same mark as the app bar: the surrounding text colour, with the rose dot. */}
      <circle r="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3.2 2.6" />
      <path d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z" fill="currentColor" />
      <circle cx="9.9" cy="-9.9" r="2.2" fill="#F9A8D4" />
    </svg>
  );
}

export function LangToggle({ tone }: { tone: "night" | "paper" }) {
  const { lang, updatePrefs } = useLearner();
  const base = tone === "night" ? "border-stitch text-cloth-mid" : "border-ink-low/40 text-ink-mid";
  return (
    <div role="group" aria-label="Language" className={`flex items-center rounded-full border border-dashed p-0.5 text-sm ${base}`}>
      {(["bn", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => updatePrefs({ lang: l })}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${lang === l ? "bg-thread text-night-0" : "hover:text-thread"}`}
          lang={l}
        >
          {l === "bn" ? "বাংলা" : "EN"}
        </button>
      ))}
    </div>
  );
}

function SyncNote({ tone }: { tone: "night" | "paper" }) {
  const { online, pending, tx } = useLearner();
  if (online && pending === 0) return null;
  const c = tone === "night" ? "text-cloth-mid border-stitch" : "text-ink-mid border-ink-low/40";
  return (
    <span className={`hidden rounded-full border border-dashed px-3 py-1 text-xs sm:inline ${c}`} role="status">
      {!online ? tx("Offline: saving on this phone", "অফলাইন: এই ফোনে জমা হচ্ছে") : tx(`${pending} to sync`, `${pending}টি সিঙ্ক বাকি`)}
    </span>
  );
}

/** Legacy entry point kept for older screens: renders the IntelliHorizon app header (signed in) or public header. */
export function TopBar(_props: { tone?: "night" | "paper" }) {
  const { account } = useLearner();
  return account ? <AppHeader /> : <PublicHeader />;
}

/** Primary action: a thread-filled capsule whose stitched border fills on press. */
export function IgniteButton({ children, onClick, disabled, type = "button", wide }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; wide?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-[14px] bg-thread px-6 py-3 text-base font-bold text-night-0 outline-offset-4 transition-transform hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${wide ? "w-full" : ""}`}
    >
      <span className="pointer-events-none absolute inset-1 rounded-[11px] border border-dashed border-night-0/35" aria-hidden="true" />
      <span className="relative">{children}</span>
    </button>
  );
}

/** Primary action rendered as a router link. */
export function IgniteLink({ to, children, params, search }: { to: string; children: ReactNode; params?: Record<string, string>; search?: Record<string, string> }) {
  return (
    <Link
      to={to}
      params={params as never}
      search={search as never}
      className="group relative inline-flex items-center justify-center gap-2 rounded-[14px] bg-thread px-6 py-3 text-base font-bold text-night-0 transition-transform hover:-translate-y-[1px] active:scale-[0.98]"
    >
      <span className="pointer-events-none absolute inset-1 rounded-[11px] border border-dashed border-night-0/35" aria-hidden="true" />
      <span className="relative">{children}</span>
    </Link>
  );
}

/** Secondary text action with a running-stitch underline. */
export function StitchLink({ to, children, tone = "night", params }: { to: string; children: ReactNode; tone?: "night" | "paper"; params?: Record<string, string> }) {
  return (
    <Link
      to={to}
      params={params as never}
      className={`inline-flex items-center gap-1 font-semibold underline decoration-dashed decoration-[1.5px] underline-offset-[6px] transition-colors ${tone === "night" ? "text-cloth decoration-thread hover:text-thread" : "text-ink decoration-ink-low hover:decoration-ink"}`}
    >
      {children}
    </Link>
  );
}

/** Quiet text button used for secondary choices inside lessons. */
export function QuietButton({ children, onClick, tone = "paper" }: { children: ReactNode; onClick: () => void; tone?: "night" | "paper" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border border-dashed px-4 py-2 text-sm font-semibold transition-colors active:scale-[0.98] ${tone === "paper" ? "border-ink-low/50 text-ink hover:border-ink" : "border-stitch text-cloth hover:border-thread"}`}
    >
      {children}
    </button>
  );
}

const CONF: { v: 1 | 2 | 3; label: L }[] = [
  { v: 1, label: { en: "Guessing", bn: "আন্দাজ" } },
  { v: 2, label: { en: "Fairly sure", bn: "মোটামুটি নিশ্চিত" } },
  { v: 3, label: { en: "Certain", bn: "পুরো নিশ্চিত" } },
];

/** Three-bead confidence selector. Confidence is evidence too. */
export function ConfidenceDial({ value, onChange }: { value: 1 | 2 | 3 | null; onChange: (v: 1 | 2 | 3) => void }) {
  const { t, tx } = useLearner();
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 text-sm font-semibold text-ink-mid">{tx("How sure are you?", "তুমি কতটা নিশ্চিত?")}</legend>
      <div className="flex flex-wrap gap-2">
        {CONF.map((c) => (
          <button
            key={c.v}
            type="button"
            aria-pressed={value === c.v}
            onClick={() => onChange(c.v)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${value === c.v ? "border-brand bg-brand text-sheet" : "border-ink-low/40 bg-sheet text-ink hover:border-ink"}`}
          >
            <span className="flex gap-0.5" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${i <= c.v ? (value === c.v ? "bg-thread" : "bg-ink-mid") : "bg-ink-low/30"}`} />
              ))}
            </span>
            {t(c.label)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SourceTag({ source }: { source?: "verified" | "historical" | "generated" }) {
  const { tx } = useLearner();
  const s = source ?? "generated";
  const label =
    s === "verified" ? tx("Checked curriculum fact", "যাচাই করা পাঠ্যক্রম তথ্য") : s === "historical" ? tx("Historical record", "ঐতিহাসিক নথি") : tx("IntelliHorizon explanation, may contain mistakes", "ইন্টেলিহরাইজনের ব্যাখ্যা, ভুল থাকতে পারে");
  const c = s === "generated" ? "border-ink-low/50 text-ink-mid" : s === "historical" ? "border-[#C98B62] text-[#8a5a37]" : "border-right/60 text-right";
  return <span className={`inline-flex items-center rounded-full border border-dashed px-2.5 py-0.5 text-xs font-semibold ${c}`}>{label}</span>;
}

/** Read aloud with the device voice (Bangla when available). Hidden when unsupported. */
export function ReadAloud({ text, lang }: { text: string; lang: Lang }) {
  const { tx } = useLearner();
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(typeof window !== "undefined" && "speechSynthesis" in window), []);
  if (!ok) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === "bn" ? "bn-BD" : "en-IN";
        u.rate = 0.95;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-low/50 px-3 py-1 text-xs font-semibold text-ink-mid hover:border-ink hover:text-ink"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
      </svg>
      {tx("Read aloud", "পড়ে শোনাও")}
    </button>
  );
}

export function NightPage({ children }: { children: ReactNode }) {
  return <LegacyFrame>{children}</LegacyFrame>;
}

export function PaperPage({ children }: { children: ReactNode }) {
  return <LegacyFrame>{children}</LegacyFrame>;
}

function LegacyFrame({ children }: { children: ReactNode }) {
  const { lang, account } = useLearner();
  return (
    <div className="relative min-h-dvh bg-canvas pb-28 lg:pb-12" lang={lang}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[10px] focus:bg-brand focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      {account ? <AppHeader /> : <PublicHeader />}
      <div id="main">{children}</div>
    </div>
  );
}
