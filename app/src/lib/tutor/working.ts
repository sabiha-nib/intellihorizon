// Step-by-step maths working checker (pure, deterministic). The student writes one step per line; each line with "="
// is checked exactly (rational arithmetic, or ratio equality). The first step that doesn't hold is reported, with
// what was right before it. Steps that can't be read are marked "not checked", never guessed.
import { evalArithmetic, toAsciiDigits } from "../curriculum/text";
import { parseRatio, sameRatio } from "../learning/rules";

export type StepResult = { line: string; status: "ok" | "wrong" | "unchecked" | "no_equation"; detail: { left: string; right: string } | null };
export type WorkingCheck = { steps: StepResult[]; firstWrong: number | null; checked: number };

/** True when the message looks like worked steps: at least two lines, at least one containing "=" and a digit. */
export function looksLikeWorking(text: string): boolean {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.length >= 2 && lines.filter((l) => l.includes("=") && /[0-9০-৯]/.test(l)).length >= 1;
}

function value(expr: string): { kind: "num"; s: string } | { kind: "ratio"; r: ReturnType<typeof parseRatio> } | null {
  const e = toAsciiDigits(expr).trim();
  if (!e) return null;
  if (/:/.test(e)) {
    // Each term may itself be arithmetic (the book writes "7 × 8 : 5 × 8"); evaluate the terms exactly, then compare.
    const terms = e.split(":").map((t) => t.trim());
    if (terms.some((t) => !t)) return null;
    try {
      const vals = terms.map((t) => { const v = evalArithmetic(t); return v.fraction ?? v.decimal; });
      const r = parseRatio(vals.join(" : "));
      return r ? { kind: "ratio", r } : null;
    } catch {
      return null;
    }
  }
  try {
    const v = evalArithmetic(e);
    return { kind: "num", s: v.fraction ?? v.decimal };
  } catch {
    return null;
  }
}

export function checkWorking(text: string): WorkingCheck {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 20);
  const steps: StepResult[] = [];
  let firstWrong: number | null = null;
  let checked = 0;
  lines.forEach((line, i) => {
    if (!line.includes("=")) { steps.push({ line, status: "no_equation", detail: null }); return; }
    const parts = line.split("=").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) { steps.push({ line, status: "unchecked", detail: null }); return; }
    const vals = parts.map(value);
    if (vals.some((v) => !v)) { steps.push({ line, status: "unchecked", detail: null }); return; }
    checked++;
    let ok = true;
    for (let k = 1; k < vals.length; k++) {
      const a = vals[k - 1]!, b = vals[k]!;
      if (a.kind === "num" && b.kind === "num") ok = ok && a.s === b.s;
      else if (a.kind === "ratio" && b.kind === "ratio") ok = ok && !!a.r && !!b.r && a.r.length === b.r.length && sameRatio(a.r, b.r);
      else ok = false;
    }
    const show = (v: NonNullable<ReturnType<typeof value>>) => (v.kind === "num" ? v.s : v.r!.map((x) => (x.d === 1n ? String(x.n) : `${x.n}/${x.d}`)).join(" : "));
    steps.push({ line, status: ok ? "ok" : "wrong", detail: { left: show(vals[0]!), right: show(vals[vals.length - 1]!) } });
    if (!ok && firstWrong === null) firstWrong = i;
  });
  return { steps, firstWrong, checked };
}
