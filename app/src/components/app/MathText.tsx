import { Fragment, type ReactNode } from "react";

/**
 * Renders the small maths markup reviewers use in corrected text: $...$ spans with a^{b}, a_{b}, \frac{a}{b} and \sqrt{a}.
 * Anything else is shown exactly as written. No HTML is ever interpreted.
 */
function parse(s: string, key: { n: number }): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let buf = "";
  const flush = () => { if (buf) { out.push(<Fragment key={key.n++}>{buf}</Fragment>); buf = ""; } };
  const group = (): string => {
    if (s[i] !== "{") { const c = s[i] ?? ""; i++; return c; }
    let depth = 0;
    const start = i + 1;
    for (; i < s.length; i++) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}" && --depth === 0) { i++; return s.slice(start, i - 1); }
    }
    return s.slice(start);
  };
  while (i < s.length) {
    if (s.startsWith("\\frac", i)) {
      i += 5; flush();
      const a = group(); const b = group();
      out.push(<span key={key.n++} className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.85em] leading-tight"><span className="border-b border-current px-0.5">{parse(a, key)}</span><span className="px-0.5">{parse(b, key)}</span></span>);
    } else if (s.startsWith("\\sqrt", i)) {
      i += 5; flush();
      const a = group();
      out.push(<span key={key.n++}>√<span className="border-t border-current">{parse(a, key)}</span></span>);
    } else if (s[i] === "^" || s[i] === "_") {
      const sup = s[i] === "^"; i++; flush();
      const a = group();
      out.push(sup ? <sup key={key.n++}>{parse(a, key)}</sup> : <sub key={key.n++}>{parse(a, key)}</sub>);
    } else { buf += s[i]; i++; }
  }
  flush();
  return out;
}

export function MathText({ text }: { text: string }) {
  const parts = text.split(/(?<!\\)\$([^$]+)\$/g);
  if (parts.length === 1) return <>{text}</>;
  const key = { n: 0 };
  return <>{parts.map((p, k) => (k % 2 ? <span key={k} className="font-[cambria,serif] italic" role="math" aria-label={p}>{parse(p, key)}</span> : <Fragment key={k}>{p}</Fragment>))}</>;
}
