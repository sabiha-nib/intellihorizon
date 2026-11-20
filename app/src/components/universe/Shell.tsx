// IntelliHorizon navigation. Signed-in students get the app shell (top bar on wide screens, bottom bar on phones,
// and a labelled More menu). Visitors get the public header. Both use the same mark, type and colours.
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { Lang } from "../../content/types";
import { levelInfo } from "../../lib/learning/rules";
import { gradeLabel } from "../../lib/curriculum/scope";
import { useLearner } from "../../lib/store";
import { AccountAvatar } from "../auth/Avatar";
import { Icon, Mark } from "./icons";
import { GROUPS, MODULES, PRIMARY } from "./modules";
import { btnClass } from "./ui";

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, updatePrefs, tx } = useLearner();
  return (
    <div
      role="group"
      aria-label={tx("Interface language", "ইন্টারফেসের ভাষা")}
      className="flex items-center rounded-full border border-line bg-sheet p-0.5 text-[14px]"
    >
      {(["bn", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => updatePrefs({ lang: l })}
          lang={l}
          className={`rounded-full font-semibold transition-colors ${compact ? "px-2.5 py-1" : "px-3 py-1"} ${lang === l ? "bg-brand text-white" : "text-ink-mid hover:text-ink"}`}
        >
          {l === "bn" ? "বাংলা" : "EN"}
        </button>
      ))}
    </div>
  );
}

function SyncPill() {
  const { online, pending, tx } = useLearner();
  if (online && pending === 0) return null;
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-[13px] font-semibold text-amber"
    >
      {!online && <Icon name="offline" size={15} />}
      {!online
        ? tx(
            pending ? `Offline: ${pending} saved on this device` : "Offline",
            pending ? `অফলাইন: ${pending}টি এই ডিভাইসে জমা` : "অফলাইন",
          )
        : tx(`${pending} waiting to sync`, `${pending}টি সিঙ্কের অপেক্ষায়`)}
    </span>
  );
}

function useActive(match: string[]) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return match.some((m) => path === m || path.startsWith(m + "/"));
}

/* ─────────── App shell: a calm grouped sidebar on wide screens, a slim bar plus bottom tabs on phones ─────────── */

// Order inside each group: the core of the learning journey first.
const ORDER = ["tutor", "path", "topics", "map", "concepts", "formulas", "summary", "lab", "quiz", "plan", "practice", "exam", "mastery", "progress", "mistakes", "twin", "horizon", "revision", "achievements", "missions", "history", "cards", "notes", "reflect", "saved", "share", "search", "settings", "account", "help", "admin"];
const rank = (id: string) => { const i = ORDER.indexOf(id); return i < 0 ? 99 : i; };
const COLLAPSE_KEY = "ih_nav_collapsed_v1";

function SideLink({ to, icon, label, match }: { to: string; icon: string; label: string; match: string[] }) {
  const on = useActive(match);
  return (
    <Link
      to={to as "/"}
      aria-current={on ? "page" : undefined}
      className={`ih-side-link group relative flex min-h-[36px] items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] font-semibold transition-colors ${on ? "bg-[#fce7f3] text-[#191d23]" : "text-[#465c65] hover:bg-[#f4f0f3] hover:text-[#191d23]"}`}
    >
      {on && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#f9a8d4]" />}
      <Icon name={icon} size={18} className={on ? "text-[#b0386f]" : "text-[#7b919c] group-hover:text-[#57707a]"} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function ScopeChip() {
  const { account, tx, t } = useLearner();
  if (!account) return null;
  const version = account.curriculum === "nctb-bangla" ? tx("Bangla Version", "বাংলা ভার্সন") : account.curriculum === "nctb-english" ? tx("English Version", "ইংলিশ ভার্সন") : null;
  const label = [account.grade ? t(gradeLabel(account.grade)) : null, "NCTB", version].filter(Boolean).join(" · ");
  return (
    <Link to="/start" className="block rounded-[12px] border border-[#dedcdc] bg-[#f7f6f6] px-3 py-2 text-[13px] font-semibold text-[#191d23] hover:border-[#c5bac4]" data-testid="scope-chip"
      aria-label={tx(`Your curriculum: ${label}. Change class or version`, `তোমার পাঠ্যক্রম: ${label}। শ্রেণি বা ভার্সন বদলাও`)}>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#57707a]">{tx("Studying", "পড়ছ")}</span>
      {label}
    </Link>
  );
}

function Sidebar() {
  const { t, tx, account, lang, xp } = useLearner();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState<string[]>(["you"]);
  useEffect(() => {
    try { const v = window.localStorage.getItem(COLLAPSE_KEY); if (v) setCollapsed(JSON.parse(v) as string[]); } catch { /* storage unavailable */ }
  }, []);
  const toggle = (id: string) => setCollapsed((c) => {
    const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
    try { window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const mods = MODULES.filter((m) => !m.admin || account?.role === "admin");
  const lv = xp === null ? null : levelInfo(xp);
  return (
    <aside className="ih-sidebar ih-appbar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#dedcdc] bg-white lg:flex" lang={lang} aria-label={tx("App", "অ্যাপ")}>
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        <Link to="/dashboard" className="flex items-center gap-2" aria-label={tx("IntelliHorizon, go to your dashboard", "ইন্টেলিহরাইজন, ড্যাশবোর্ডে যাও")}>
          <Mark />
          <span className="font-display text-[19px] font-extrabold tracking-tight text-[#191d23]" lang="en">IntelliHorizon</span>
        </Link>
      </div>
      <div className="space-y-2 px-4 pb-3">
        <Link to="/tutor" className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#f9a8d4] px-4 text-[15px] font-bold text-[#191d23] transition-colors hover:bg-[#f7bfdf]" data-testid="ask-tutor">
          <Icon name="spark" size={18} />
          {tx("Ask IntelliTutor", "ইন্টেলিটিউটরকে জিজ্ঞেস করো")}
        </Link>
        <Link to="/search" className="flex min-h-[38px] items-center gap-2 rounded-[10px] border border-[#dedcdc] px-3 text-[14px] font-medium text-[#57707a] hover:border-[#c5bac4] hover:text-[#191d23]">
          <Icon name="search" size={17} />
          {tx("Search", "খোঁজো")}
        </Link>
      </div>
      <nav aria-label={tx("Main", "প্রধান")} className="ih-side-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <SideLink to="/dashboard" icon="home" label={tx("Home", "হোম")} match={["/dashboard"]} />
        {GROUPS.map((g) => {
          const items = mods.filter((m) => m.group === g.id).sort((a, b) => rank(a.id) - rank(b.id));
          const here = items.some((m) => path === m.to || path.startsWith(m.to + "/"));
          const open = here || !collapsed.includes(g.id);
          return (
            <div key={g.id} className="mt-4">
              <button type="button" aria-expanded={open} aria-controls={`nav-${g.id}`} onClick={() => toggle(g.id)}
                className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#57707a] hover:text-[#191d23]">
                {t(g.label)}
                <Icon name="arrow" size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
              </button>
              {open && (
                <ul id={`nav-${g.id}`} className="mt-1 space-y-0.5">
                  {items.map((m) => <li key={m.id}><SideLink to={m.to} icon={m.icon} label={t(m.label)} match={[m.to]} /></li>)}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-[#dedcdc] px-4 py-3">
        <ScopeChip />
        <div className="flex items-center justify-between gap-2">
          <LangSwitch compact />
          <SyncPill />
        </div>
        {account && (
          <Link to="/account" className="flex items-center gap-2.5 rounded-[12px] px-1 py-1 hover:bg-[#f4f0f3]" aria-label={tx("Your account", "তোমার অ্যাকাউন্ট")}>
            <AccountAvatar avatar={account.avatar} name={account.fullName} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-[#191d23]">{account.fullName}</span>
              {lv && <span className="block text-[12px] text-[#57707a] tnum">{tx(`Level ${lv.level} · ${xp} XP`, `লেভেল ${lv.level} · ${xp} এক্সপি`)}</span>}
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}

export function AppHeader() {
  const { tx, account, lang } = useLearner();
  return (
    <>
      <Sidebar />
      {/* Phones and tablets: a slim bar; the sidebar takes over from 1024px. */}
      <header className="ih-appbar sticky top-0 z-40 border-b border-line bg-canvas lg:hidden" lang={lang}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 md:px-6">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2" aria-label={tx("IntelliHorizon, go to your dashboard", "ইন্টেলিহরাইজন, ড্যাশবোর্ডে যাও")}>
            <Mark />
            <span className="font-display text-[19px] font-extrabold tracking-tight text-ink" lang="en">IntelliHorizon</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <SyncPill />
            <Link to="/search" aria-label={tx("Search", "খোঁজো")} className="flex h-11 w-11 items-center justify-center rounded-[12px] text-ink-mid hover:bg-lilac hover:text-ink">
              <Icon name="search" size={20} />
            </Link>
            <span className="hidden sm:block"><LangSwitch compact /></span>
            {account && (
              <Link to="/account" aria-label={tx("Your account", "তোমার অ্যাকাউন্ট")} className="rounded-full">
                <AccountAvatar avatar={account.avatar} name={account.fullName} size={34} />
              </Link>
            )}
          </div>
        </div>
      </header>
      <BottomNav />
    </>
  );
}

function BottomNav() {
  const { t, tx, lang } = useLearner();
  const items = [
    ...PRIMARY.slice(0, 4),
    {
      to: "/more",
      icon: "more" as const,
      label: { en: "More", bn: "আরও" },
      match: [
        "/more",
        "/progress",
        "/mastery",
        "/missions",
        "/achievements",
        "/mistakes",
        "/revision",
        "/history",
        "/settings",
        "/saved",
        "/knowledge-map",
        "/plan",
        "/help",
      ],
    },
  ];
  return (
    <nav
      aria-label={tx("Main", "প্রধান")}
      lang={lang}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-sheet/95 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur lg:hidden"
    >
      {items.map((n) => (
        <BottomItem key={n.to} to={n.to} icon={n.icon} label={t(n.label)} match={n.match} />
      ))}
    </nav>
  );
}
function BottomItem({
  to,
  icon,
  label,
  match,
}: {
  to: string;
  icon: string;
  label: string;
  match: string[];
}) {
  const on = useActive(match);
  return (
    <Link
      to={to as "/"}
      aria-current={on ? "page" : undefined}
      className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[12px] text-[12px] font-semibold ${on ? "text-brand-deep" : "text-ink-mid"}`}
    >
      <span
        className={`flex h-7 w-12 items-center justify-center rounded-full ${on ? "bg-brand-soft" : ""}`}
      >
        <Icon name={icon} size={21} />
      </span>
      <span className="max-w-full truncate px-0.5">{label}</span>
    </Link>
  );
}

const PUBLIC_LINKS = [
  { hash: "product", label: { en: "Product", bn: "প্রোডাক্ট" } },
  { hash: "how", label: { en: "How it works", bn: "কীভাবে কাজ করে" } },
  { hash: "tutor", label: { en: "AI Tutor", bn: "এআই টিউটর" } },
  { hash: "features", label: { en: "Learning features", bn: "শেখার ফিচার" } },
  { hash: "curriculum", label: { en: "Curriculum", bn: "পাঠ্যক্রম" } },
];

export function PublicHeader() {
  const { t, tx, lang, account } = useLearner();
  const [open, setOpen] = useState(false);
  return (
    <header
      className="ih-appbar sticky top-0 z-40 border-b border-line bg-canvas"
      lang={lang}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="IntelliHorizon">
          <Mark />
          <span
            className="font-display text-[21px] font-extrabold tracking-tight text-ink"
            lang="en"
          >
            IntelliHorizon
          </span>
        </Link>
        <nav aria-label={tx("Site", "সাইট")} className="ml-6 hidden items-center gap-1 lg:flex">
          {PUBLIC_LINKS.map((l) => (
            <Link
              key={l.hash}
              to="/"
              hash={l.hash}
              className="rounded-[10px] px-3 py-2 text-[15px] font-medium text-ink-mid hover:bg-lilac hover:text-ink"
            >
              {t(l.label)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:block">
            <LangSwitch compact />
          </span>
          {account ? (
            <Link to="/dashboard" className={btnClass("primary", "sm")}>
              {tx("Open my dashboard", "আমার ড্যাশবোর্ড")}
            </Link>
          ) : (
            <>
              <Link
                to="/signin"
                className="hidden rounded-[10px] px-3 py-2 text-[15px] font-semibold text-ink hover:bg-lilac sm:block"
              >
                {tx("Sign in", "সাইন ইন")}
              </Link>
              <Link to="/signup" className={btnClass("primary", "sm", "hidden sm:inline-flex")}>
                {tx("Start learning", "শেখা শুরু করো")}
              </Link>
            </>
          )}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-[12px] text-ink hover:bg-lilac lg:hidden"
            aria-expanded={open}
            aria-controls="public-menu"
            aria-label={open ? tx("Close menu", "মেনু বন্ধ করো") : tx("Open menu", "মেনু খোলো")}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <div
          id="public-menu"
          className="edu-rise border-t border-line bg-canvas px-4 pb-5 pt-3 lg:hidden"
        >
          <nav aria-label={tx("Site", "সাইট")} className="grid gap-1">
            {PUBLIC_LINKS.map((l) => (
              <Link
                key={l.hash}
                to="/"
                hash={l.hash}
                onClick={() => setOpen(false)}
                className="rounded-[12px] px-3 py-3 text-[17px] font-semibold text-ink hover:bg-lilac"
              >
                {t(l.label)}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <LangSwitch />
            {!account && (
              <Link to="/signin" className={btnClass("secondary", "md")}>
                {tx("Sign in", "সাইন ইন")}
              </Link>
            )}
            {!account && (
              <Link to="/signup" className={btnClass("primary", "md")}>
                {tx("Start learning", "শেখা শুরু করো")}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { tx, lang } = useLearner();
  const col = "space-y-2 text-[15px]";
  const a = "text-ink-mid hover:text-ink";
  return (
    <footer className="border-t border-line bg-sheet" lang={lang}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-6">
        <div className="max-w-[40ch]">
          <div className="flex items-center gap-2">
            <Mark size={26} />
            <span className="font-display text-[19px] font-extrabold" lang="en">
              IntelliHorizon
            </span>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-mid">
            {tx(
              "A personalised learning ecosystem for Classes 6–10 of Bangladesh's NCTB curriculum, Bangla Version and English Version. Textbook content is available today for Class 7, Bangla Version; the other classes and versions are being added. IntelliHorizon is independent and is not affiliated with or endorsed by NCTB. Textbook excerpts are short and cited; NCTB's written permission is still pending.",
              "বাংলাদেশের এনসিটিবি পাঠ্যক্রমের ৬ষ্ঠ–১০ম শ্রেণির জন্য ব্যক্তিগত শিক্ষার ইকোসিস্টেম, বাংলা ভার্সন ও ইংলিশ ভার্সন। পাঠ্যবইয়ের বিষয়বস্তু আজ পাওয়া যাচ্ছে ৭ম শ্রেণি, বাংলা ভার্সনের জন্য; অন্য শ্রেণি ও ভার্সন যোগ হচ্ছে। ইন্টেলিহরাইজন স্বাধীন, এনসিটিবির সঙ্গে যুক্ত বা অনুমোদিত নয়। পাঠ্যবইয়ের অংশ ছোট ও উৎসসহ; এনসিটিবির লিখিত অনুমতি এখনো প্রক্রিয়াধীন।",
            )}
          </p>
        </div>
        <nav aria-label={tx("Product", "প্রোডাক্ট")} className={col}>
          <p className="font-semibold">{tx("Product", "প্রোডাক্ট")}</p>
          <Link to="/" hash="how" className={`block ${a}`}>
            {tx("How it works", "কীভাবে কাজ করে")}
          </Link>
          <Link to="/" hash="features" className={`block ${a}`}>
            {tx("Learning features", "শেখার ফিচার")}
          </Link>
          <Link to="/learn" className={`block ${a}`}>
            {tx("Browse the curriculum", "পাঠ্যক্রম দেখো")}
          </Link>
        </nav>
        <nav aria-label={tx("Account", "অ্যাকাউন্ট")} className={col}>
          <p className="font-semibold">{tx("Account", "অ্যাকাউন্ট")}</p>
          <Link to="/signup" className={`block ${a}`}>
            {tx("Create an account", "অ্যাকাউন্ট খোলো")}
          </Link>
          <Link to="/signin" className={`block ${a}`}>
            {tx("Sign in", "সাইন ইন")}
          </Link>
          <Link to="/forgot-password" className={`block ${a}`}>
            {tx("Forgot password", "পাসওয়ার্ড ভুলে গেছি")}
          </Link>
        </nav>
        <nav aria-label={tx("Support", "সহায়তা")} className={col}>
          <p className="font-semibold">{tx("Support", "সহায়তা")}</p>
          <Link to="/help" className={`block ${a}`}>
            {tx("Help & accessibility", "সাহায্য ও প্রবেশযোগ্যতা")}
          </Link>
          <Link to="/privacy" className={`block ${a}`}>
            {tx("Privacy", "গোপনীয়তা")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** Page frame for every screen: app shell when signed in, public header otherwise. */
export function Frame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { account, lang } = useLearner();
  return (
    <div className="min-h-dvh bg-canvas pb-28 lg:pb-12" lang={lang}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[10px] focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      {account ? <AppHeader /> : <PublicHeader />}
      <div
        id="main"
        className={`mx-auto w-full ${wide ? "max-w-6xl" : "max-w-6xl"} px-4 pt-6 md:px-6 md:pt-8`}
      >
        {children}
      </div>
    </div>
  );
}
