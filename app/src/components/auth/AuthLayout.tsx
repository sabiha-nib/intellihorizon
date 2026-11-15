import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useLearner } from "../../lib/store";
import { LangToggle, Monogram, StarGlyph } from "../edu/ui";

const STARS: [number, number, number, "holding" | "shapeshifter" | "fragile" | "glimpsed"][] = [
  [70, 90, 9, "shapeshifter"], [150, 60, 6, "holding"], [210, 120, 7, "fragile"], [120, 170, 6, "holding"], [260, 70, 5, "glimpsed"], [300, 160, 8, "shapeshifter"], [40, 200, 5, "glimpsed"],
];

/** Split layout: a quiet night-sky identity panel and a bright, readable form. Single column on phones. */
export function AuthLayout({ title, subtitle, children, aside }: { title: string; subtitle?: string; children: ReactNode; aside?: { title: string; body: string } }) {
  const { lang, tx } = useLearner();
  return (
    <div className="theme-paper min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" lang={lang}>
      <aside className="theme-night relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12" aria-hidden="true">
        <Link to="/" className="flex items-center gap-2" tabIndex={-1}>
          <Monogram />
          <span className="font-display text-xl font-bold tracking-tight" lang="en">IntelliHorizon</span>
        </Link>
        <svg viewBox="0 0 340 240" className="w-full max-w-md">
          <polyline points="70,90 150,60 210,120 120,170 70,90" fill="none" stroke="#5B3FD6" strokeOpacity=".55" strokeWidth="1.4" strokeDasharray="5 5" />
          <polyline points="210,120 260,70 300,160" fill="none" stroke="#D3CCE3" strokeWidth="1.4" strokeDasharray="5 5" />
          {STARS.map(([x, y, r, g], i) => (
            <g key={i} transform={`translate(${x} ${y})`}><StarGlyph glow={g} r={r} /></g>
          ))}
        </svg>
        <div>
          <p className="font-display max-w-sm text-3xl font-bold leading-tight tracking-tight">{aside?.title ?? tx("Your learning universe starts here.", "তোমার শেখার মহাবিশ্ব শুরু এখানেই।")}</p>
          <p className="mt-3 max-w-sm leading-relaxed text-cloth-mid">{aside?.body ?? tx("One account keeps your sky with you on any phone or computer. Your details stay private by default.", "একটি অ্যাকাউন্টে যেকোনো ফোন বা কম্পিউটারে তোমার আকাশ তোমার সাথে থাকে। তোমার তথ্য শুরু থেকেই গোপন থাকে।")}</p>
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 lg:invisible" aria-label="IntelliHorizon home">
            <Monogram size={26} />
            <span className="font-display text-lg font-bold tracking-tight" lang="en">IntelliHorizon</span>
          </Link>
          <LangToggle tone="paper" />
        </header>
        <main className="mx-auto w-full max-w-[460px] flex-1 px-5 pb-16 pt-4 sm:pt-10">
          <h1 className="font-display text-[32px] font-bold leading-[1.1] tracking-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-3 text-[16px] leading-relaxed text-ink-mid">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </main>
        <footer className="px-5 pb-6 text-center text-xs text-ink-low sm:px-8">
          <Link to="/privacy" className="underline decoration-dashed underline-offset-4 hover:text-ink">{tx("How we look after your information", "আমরা কীভাবে তোমার তথ্য রাখি")}</Link>
        </footer>
      </div>
    </div>
  );
}
