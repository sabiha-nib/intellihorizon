// IntelliHorizon component kit: buttons, panels, progress, badges. Built on the design tokens in styles.css.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icons";

type Tone = "brand" | "mint" | "amber" | "pink" | "again" | "neutral";
const TONE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-deep",
  mint: "bg-mint-soft text-mint",
  amber: "bg-amber-soft text-amber",
  pink: "bg-pink-soft text-pink",
  again: "bg-again-soft text-again",
  neutral: "bg-lilac text-ink-mid",
};

const BTN = {
  primary:
    "bg-brand text-white hover:bg-brand-deep shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_24px_-14px_rgba(67,41,178,0.9)]",
  secondary: "border border-line-strong bg-sheet text-ink hover:border-brand hover:text-brand-deep",
  quiet: "text-brand-deep hover:bg-brand-soft",
} as const;
const SIZE = {
  md: "h-12 px-5 text-[16px]",
  sm: "h-10 px-4 text-[15px]",
  lg: "h-14 px-7 text-[17px]",
} as const;
export const btnClass = (
  variant: keyof typeof BTN = "primary",
  size: keyof typeof SIZE = "md",
  extra = "",
) =>
  `inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${SIZE[size]} ${extra}`;

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  icon,
  className = "",
  ...aria
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof BTN;
  size?: keyof typeof SIZE;
  disabled?: boolean;
  type?: "button" | "submit";
  icon?: IconName;
  className?: string;
  "aria-describedby"?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={btnClass(variant, size, className)}
      {...aria}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  params,
  search,
  hash,
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  hash?: string;
  children: ReactNode;
  variant?: keyof typeof BTN;
  size?: keyof typeof SIZE;
  icon?: IconName;
  className?: string;
}) {
  return (
    <Link
      to={to as "/"}
      params={params as never}
      search={search as never}
      hash={hash}
      className={btnClass(variant, size, className)}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </Link>
  );
}

export function Panel({
  children,
  className = "",
  as: As = "section",
  tone = "plain",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
  tone?: "plain" | "lilac" | "lift";
  "aria-labelledby"?: string;
  id?: string;
}) {
  const t =
    tone === "lilac"
      ? "bg-lilac border-transparent"
      : tone === "lift"
        ? "bg-sheet border-line shadow-[var(--shadow-lift)]"
        : "bg-sheet border-line";
  return (
    <As className={`rounded-[24px] border ${t} ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function Badge({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: IconName;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold leading-none ${TONE[tone]}`}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  label,
  tone = "brand",
  size = "md",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "brand" | "mint" | "amber";
  size?: "sm" | "md";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = tone === "mint" ? "bg-mint" : tone === "amber" ? "bg-amber-fill" : "bg-brand";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`w-full overflow-hidden rounded-full bg-lilac-2 ${size === "sm" ? "h-1.5" : "h-2.5"}`}
    >
      <div
        className={`h-full rounded-full ${fill} transition-[width] duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Level ring: progress to the next level drawn as an orbit around the level number. */
export function LevelRing({
  level,
  progress,
  size = 64,
  label,
}: {
  level: number;
  progress: number;
  size?: number;
  label: string;
}) {
  const r = 26,
    c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#EBE5FB" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="#5B3FD6"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
        transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)" }}
      />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="Bricolage Grotesque, system-ui"
        fontWeight="800"
        fontSize="20"
        fill="#1D1B2C"
      >
        {level}
      </text>
    </svg>
  );
}

export function SectionTitle({
  id,
  title,
  action,
  sub,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[22px] font-bold leading-tight tracking-tight">
          {title}
        </h2>
        {sub && <p className="mt-1 text-[15px] text-ink-mid">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({
  title,
  sub,
  children,
  icon,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-1 hidden h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand sm:flex">
            <Icon name={icon} size={24} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-bold leading-[1.1] tracking-tight md:text-[38px]">
            {title}
          </h1>
          {sub && (
            <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-ink-mid">{sub}</p>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}

export function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="tnum font-display text-[28px] font-bold leading-none tracking-tight">
        {value}
      </div>
      <div className="mt-1.5 text-[14px] font-medium text-ink-mid">{label}</div>
      {hint && <div className="mt-0.5 text-[13px] text-ink-low">{hint}</div>}
    </div>
  );
}

export function Empty({
  icon = "spark",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[24px] border border-dashed border-line-strong bg-sheet p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-lilac text-brand">
        <Icon name={icon} size={24} />
      </span>
      <h2 className="font-display text-[20px] font-bold leading-tight">{title}</h2>
      <p className="max-w-[56ch] text-[15px] leading-relaxed text-ink-mid">{body}</p>
      {action}
    </div>
  );
}

export function Skeleton({ h = 160, className = "" }: { h?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-[24px] bg-lilac motion-reduce:animate-none ${className}`}
      style={{ height: h }}
    />
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <Skeleton h={120} />
      <Skeleton h={220} />
    </div>
  );
}
