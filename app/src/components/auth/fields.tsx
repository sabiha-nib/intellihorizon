import { useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { BD_DISTRICTS, districtByCode } from "../../content/districts";
import type { L } from "../../content/types";
import { CURRICULA, GRADES, OTHER_CURRICULA } from "../../lib/auth/config";
import { passwordStrength } from "../../lib/auth/validation";
import { useLearner } from "../../lib/store";
import { msg } from "./messages";

const inputBase =
  "block h-[52px] w-full rounded-[14px] border bg-sheet px-4 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-low/70 focus:border-ink focus:shadow-[0_0_0_4px_rgba(246,196,83,0.35)] disabled:opacity-60";

export function FieldError({ id, code }: { id: string; code?: string | null }) {
  const { t } = useLearner();
  const m = msg(code);
  if (!m) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-again" role="alert">
      <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><rect x="7.2" y="3.6" width="1.6" height="5.6" rx=".8" fill="#fff" /><circle cx="8" cy="11.6" r="1" fill="#fff" /></svg>
      <span>{t(m)}</span>
    </p>
  );
}

type TextFieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  trailing?: ReactNode;
  status?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function TextField({ label, hint, error, optional, trailing, status, id: given, ...rest }: TextFieldProps) {
  const { tx } = useLearner();
  const auto = useId();
  const id = given ?? auto;
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between gap-2 text-[15px] font-semibold text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-medium text-ink-low">{tx("Optional", "ঐচ্ছিক")}</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={[hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined}
          className={`${inputBase} ${error ? "border-again" : "border-ink-low/35 hover:border-ink-low/60"} ${trailing ? "pr-12" : ""}`}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
      {status}
      {hint && !error && <p id={hintId} className="mt-2 text-sm text-ink-mid">{hint}</p>}
      <FieldError id={errId} code={error} />
    </div>
  );
}

const STRENGTH: L[] = [
  { en: "Too weak", bn: "খুব দুর্বল" },
  { en: "Weak", bn: "দুর্বল" },
  { en: "Okay", bn: "চলনসই" },
  { en: "Strong", bn: "শক্তিশালী" },
  { en: "Very strong", bn: "খুব শক্তিশালী" },
];

export function PasswordField({ label, value, onChange, error, autoComplete, meter, hint, onBlur, id: given, name }: { label: string; value: string; onChange: (v: string) => void; error?: string | null; autoComplete: "new-password" | "current-password"; meter?: boolean; hint?: ReactNode; onBlur?: () => void; id?: string; name?: string }) {
  const { t, tx } = useLearner();
  const [show, setShow] = useState(false);
  const s = passwordStrength(value);
  const auto = useId();
  const id = given ?? auto;
  return (
    <TextField
      id={id}
      name={name}
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      maxLength={256}
      error={error}
      hint={hint}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
          aria-controls={id}
          aria-label={show ? tx("Hide password", "পাসওয়ার্ড লুকাও") : tx("Show password", "পাসওয়ার্ড দেখাও")}
          className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink-mid hover:bg-paper hover:text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {show && <path d="M4 4l16 16" />}
          </svg>
        </button>
      }
      status={
        meter && value ? (
          <div className="mt-2.5 flex items-center gap-3" aria-live="polite">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${i < s ? (s <= 1 ? "bg-again" : s === 2 ? "bg-thread" : "bg-right") : "bg-ink-low/20"}`} />
              ))}
            </div>
            <span className="w-24 text-right text-xs font-semibold text-ink-mid">{t(STRENGTH[s])}</span>
          </div>
        ) : null
      }
    />
  );
}

export function DistrictCombobox({ value, onChange, error }: { value: string; onChange: (code: string) => void; error?: string | null }) {
  const { t, tx, lang } = useLearner();
  const id = useId();
  const listId = `${id}-list`;
  const selected = districtByCode(value);
  const [text, setText] = useState(selected ? t(selected) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = text.trim().toLowerCase();
  const options = useMemo(() => {
    const list = BD_DISTRICTS.filter((d) => !q || (selected && t(selected).toLowerCase() === q) || d.en.toLowerCase().includes(q) || d.bn.includes(text.trim()) || d.division.toLowerCase().includes(q));
    return [...list].sort((a, b) => (lang === "bn" ? a.bn.localeCompare(b.bn, "bn") : a.en.localeCompare(b.en)));
  }, [q, text, selected, t, lang]);

  const choose = (code: string) => {
    const d = districtByCode(code)!;
    onChange(code);
    setText(t(d));
    setOpen(false);
  };
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-ink">{tx("District", "জেলা")}</label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${options[active].code}` : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          autoComplete="off"
          placeholder={tx("Search 64 districts", "৬৪টি জেলা থেকে খোঁজো")}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => {
              setOpen(false);
              setText(selected ? t(selected) : "");
            }, 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && options[active]) {
              e.preventDefault();
              choose(options[active].code);
            } else if (e.key === "Escape") {
              setOpen(false);
              setText(selected ? t(selected) : "");
            }
          }}
          className={`${inputBase} pr-10 ${error ? "border-again" : "border-ink-low/35 hover:border-ink-low/60"}`}
        />
        <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-mid" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
        {open && (
          <ul id={listId} role="listbox" className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-[14px] border border-ink-low/25 bg-sheet py-1.5 shadow-[0_18px_40px_-18px_rgba(52,36,140,0.45)]">
            {options.length === 0 && <li className="px-4 py-3 text-sm text-ink-mid">{tx("No district matches that.", "এমন কোনো জেলা নেই।")}</li>}
            {options.map((d, i) => (
              <li
                key={d.code}
                id={`${listId}-${d.code}`}
                role="option"
                aria-selected={value === d.code}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  choose(d.code);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-[15px] ${i === active ? "bg-paper" : ""}`}
              >
                <span>
                  {t(d)} <span className="text-ink-low">{lang === "bn" ? d.en : d.bn}</span>
                </span>
                <span className="text-xs text-ink-low">{d.division}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FieldError id={`${id}-err`} code={error} />
    </div>
  );
}

export function GradePicker({ value, onChange, error }: { value: number | null; onChange: (g: number) => void; error?: string | null }) {
  const { t, tx } = useLearner();
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="mb-2 text-[15px] font-semibold text-ink">{tx("Class", "শ্রেণি")}</legend>
      <div role="radiogroup" className="grid grid-cols-5 gap-1.5 rounded-[14px] bg-paper p-1.5">
        {GRADES.map((g) => (
          <button
            key={g.value}
            type="button"
            role="radio"
            aria-checked={value === g.value}
            aria-label={t(g.label)}
            onClick={() => onChange(g.value)}
            className={`h-11 rounded-[10px] text-[15px] font-bold transition-all duration-150 ${value === g.value ? "bg-sheet text-ink shadow-[0_1px_2px_rgba(52,36,140,0.18),0_4px_12px_-6px_rgba(52,36,140,0.4)]" : "text-ink-mid hover:text-ink"}`}
          >
            {t({ en: String(g.value), bn: ["৬", "৭", "৮", "৯", "১০"][g.value - 6] ?? String(g.value) })}
          </button>
        ))}
      </div>
      <FieldError id={`${id}-err`} code={error} />
    </fieldset>
  );
}

export function CurriculumPicker({ value, other, otherText, onChange, errors }: { value: string; other: string; otherText: string; onChange: (p: { curriculum?: string; curriculumOther?: string; curriculumOtherText?: string }) => void; errors: Record<string, string | undefined> }) {
  const { t, tx } = useLearner();
  const id = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-[15px] font-semibold text-ink">{tx("Curriculum", "পাঠ্যক্রম")}</legend>
      <div role="radiogroup" className="grid gap-2">
        {CURRICULA.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            onClick={() => onChange({ curriculum: c.id })}
            className={`flex items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition-colors ${value === c.id ? "border-ink bg-sheet shadow-[0_0_0_1px_#191D23]" : "border-ink-low/35 bg-sheet hover:border-ink-low/70"}`}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${value === c.id ? "border-ink" : "border-ink-low/50"}`} aria-hidden="true">
              {value === c.id && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
            </span>
            <span>
              <span className="block text-[15px] font-semibold">{t(c.label)}</span>
              <span className="block text-sm text-ink-mid">{t(c.hint)}</span>
            </span>
          </button>
        ))}
      </div>
      <FieldError id={`${id}-err`} code={errors.curriculum} />
      {value === "other" && (
        <div className="edu-rise mt-3 space-y-3">
          <label htmlFor={`${id}-o`} className="block text-[15px] font-semibold">{tx("Which one?", "কোনটি?")}</label>
          <select id={`${id}-o`} value={other} onChange={(e) => onChange({ curriculumOther: e.target.value })} aria-invalid={!!errors.curriculumOther} className={`${inputBase} ${errors.curriculumOther ? "border-again" : "border-ink-low/35"}`}>
            <option value="">{tx("Choose", "বেছে নাও")}</option>
            {OTHER_CURRICULA.map((o) => (
              <option key={o.id} value={o.id}>{t(o.label)}</option>
            ))}
          </select>
          <FieldError id={`${id}-oe`} code={errors.curriculumOther} />
          {other === "other" && (
            <TextField label={tx("Curriculum name", "পাঠ্যক্রমের নাম")} value={otherText} maxLength={60} onChange={(e) => onChange({ curriculumOtherText: e.target.value })} error={errors.curriculumOtherText} />
          )}
        </div>
      )}
    </fieldset>
  );
}

export function AuthButton({ children, loading, loadingLabel, disabled, type = "submit", onClick, tone = "primary" }: { children: ReactNode; loading?: boolean; loadingLabel?: string; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void; tone?: "primary" | "quiet" | "danger" }) {
  const styles =
    tone === "primary"
      ? "bg-brand text-sheet hover:bg-brand-deep shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_20px_-12px_rgba(52,36,140,0.8)]"
      : tone === "danger"
        ? "bg-again text-sheet hover:bg-[#a9432f]"
        : "border border-ink-low/35 bg-sheet text-ink hover:border-ink";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] px-6 text-[16px] font-semibold transition-all duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55 ${styles}`}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" />}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

export function FormAlert({ code, tone = "error", children }: { code?: string | null; tone?: "error" | "info" | "success"; children?: ReactNode }) {
  const { t } = useLearner();
  const m = msg(code);
  if (!m && !children) return null;
  const c = tone === "error" ? "border-again/40 bg-again/8 text-[#8f3423]" : tone === "success" ? "border-right/40 bg-right/10 text-[#1f6040]" : "border-ink-low/30 bg-paper text-ink";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`edu-rise rounded-[14px] border px-4 py-3 text-[15px] leading-relaxed ${c}`}>
      {children ?? (m ? t(m) : null)}
    </div>
  );
}
