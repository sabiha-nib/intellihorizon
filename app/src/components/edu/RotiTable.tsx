import { useState } from "react";

import { useLearner } from "../../lib/store";
import { QuietButton } from "./ui";

type Frac = { n: number; d: number };
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
const BN = "০১২৩৪৫৬৭৮৯";
const toBn = (s: string) => s.replace(/[0-9]/g, (c) => BN[Number(c)]);

function Roti({ f, cuts, label }: { f: Frac; cuts: number; label: string }) {
  const R = 70;
  const pt = (k: number, of: number): [number, number] => {
    const a = (k / of) * Math.PI * 2 - Math.PI / 2;
    return [R * Math.cos(a), R * Math.sin(a)];
  };
  const sector = (k: number, of: number) => {
    if (of === 1) return `M0 ${-R} A${R} ${R} 0 1 1 -0.01 ${-R} Z`;
    const [x1, y1] = pt(k, of);
    const [x2, y2] = pt(k + 1, of);
    return `M0 0 L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} Z`;
  };
  return (
    <svg viewBox="-82 -82 164 164" className="w-full max-w-[200px]" role="img" aria-label={label}>
      <circle r={R + 3} fill="#d9b876" />
      <circle r={R} fill="#ecd39c" />
      {Array.from({ length: f.n }, (_, k) => (
        <path key={k} d={sector(k, f.d)} fill="#E2A93B" stroke="#a46f17" strokeWidth={1} />
      ))}
      {[[-30, -20], [22, 30], [35, -28], [-18, 40], [-44, 12]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.5} fill="#b98a3e" opacity={0.35} />
      ))}
      {cuts > 1 && Array.from({ length: cuts }, (_, k) => {
        const [x, y] = pt(k, cuts);
        return <line key={`c${k}`} x1={0} y1={0} x2={x} y2={y} stroke="#191D23" strokeWidth={cuts > f.d ? 0.8 : 1.6} strokeDasharray={cuts > f.d ? "3 2" : undefined} />;
      })}
    </svg>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`${label} minus`} onClick={() => onChange(Math.max(min, value - 1))} className="h-9 w-9 rounded-full border border-ink-low/40 text-lg font-bold hover:border-ink">−</button>
      <span className="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" aria-label={`${label} plus`} onClick={() => onChange(Math.min(max, value + 1))} className="h-9 w-9 rounded-full border border-ink-low/40 text-lg font-bold hover:border-ink">+</button>
    </div>
  );
}

export function RotiTable() {
  const { tx, lang, record } = useLearner();
  const [A, setA] = useState<Frac>({ n: 1, d: 3 });
  const [B, setB] = useState<Frac>({ n: 1, d: 4 });
  const [common, setCommon] = useState(false);
  const show = (f: Frac) => (lang === "bn" ? toBn(`${f.n}/${f.d}`) : `${f.n}/${f.d}`);
  const L = lcm(A.d, B.d);
  const va = A.n / A.d;
  const vb = B.n / B.d;
  const verdict = Math.abs(va - vb) < 1e-9 ? tx("They are exactly equal.", "দুটো ঠিক সমান।") : va > vb ? tx(`${show(A)} is bigger.`, `${show(A)} বড়।`) : tx(`${show(B)} is bigger.`, `${show(B)} বড়।`);
  const set = (which: "A" | "B", f: Frac) => {
    const g = { n: Math.min(f.n, f.d), d: f.d };
    (which === "A" ? setA : setB)(g);
    setCommon(false);
  };
  const preset = (a: Frac, b: Frac) => {
    setA(a);
    setB(b);
    setCommon(false);
    record({ concept: "share", kind: "lab", item: "share.lab", correct: true, confidence: 2, detail: `${a.n}-${a.d}.${b.n}-${b.d}` });
  };
  return (
    <div className="rounded-[14px] bg-sheet p-4 md:p-6">
      <h2 className="font-display text-2xl font-bold tracking-tight">{tx("The Roti Table", "রুটির টেবিল")}</h2>
      <p className="mt-1 max-w-[60ch] text-ink-mid">{tx("Two identical rotis. Choose how many pieces to cut each into, and how many pieces you take.", "দুটি একই মাপের রুটি। প্রতিটি কয় টুকরো করবে আর কয় টুকরো নেবে তা বেছে নাও।")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <QuietButton onClick={() => preset({ n: 1, d: 3 }, { n: 1, d: 4 })}>{show({ n: 1, d: 3 })} · {show({ n: 1, d: 4 })}</QuietButton>
        <QuietButton onClick={() => preset({ n: 2, d: 3 }, { n: 3, d: 5 })}>{show({ n: 2, d: 3 })} · {show({ n: 3, d: 5 })}</QuietButton>
        <QuietButton onClick={() => preset({ n: 3, d: 4 }, { n: 4, d: 5 })}>{show({ n: 3, d: 4 })} · {show({ n: 4, d: 5 })}</QuietButton>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {(["A", "B"] as const).map((w) => {
          const f = w === "A" ? A : B;
          return (
            <section key={w} className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-ink-low/40 p-4">
              <p className="font-display text-3xl font-bold tabular-nums">{common ? (lang === "bn" ? toBn(`${(f.n * L) / f.d}/${L}`) : `${(f.n * L) / f.d}/${L}`) : show(f)}</p>
              <Roti f={f} cuts={common ? L : f.d} label={`${f.n} of ${f.d}`} />
              <div className="grid w-full grid-cols-2 gap-2 text-sm">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-ink-mid">{tx("Pieces cut", "কয় টুকরো")}</span>
                  <Stepper value={f.d} min={1} max={12} onChange={(d) => set(w, { n: f.n, d })} label={tx("pieces", "টুকরো")} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-ink-mid">{tx("Pieces taken", "কয় টুকরো নিলে")}</span>
                  <Stepper value={f.n} min={0} max={f.d} onChange={(n) => set(w, { n, d: f.d })} label={tx("taken", "নেওয়া")} />
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <div className="mt-6">
        <p className="text-sm font-semibold text-ink-mid">{tx("Line the shares up", "ভাগগুলো পাশাপাশি সাজাও")}</p>
        <div className="mt-2 space-y-2">
          {[A, B].map((f, k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-12 text-right font-bold tabular-nums">{show(f)}</span>
              <div className="relative h-6 flex-1 rounded-full bg-paper">
                <div className="absolute inset-y-0 left-0 rounded-full bg-[#E2A93B] transition-[width] duration-500" style={{ width: `${(f.n / f.d) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="font-display mt-3 text-xl font-bold" aria-live="polite">{verdict}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <QuietButton onClick={() => setCommon((c) => !c)}>{common ? tx("Back to original cuts", "আগের কাটায় ফেরো") : tx("Cut both into same-size pieces", "দুটোকেই সমান মাপের টুকরো করো")}</QuietButton>
          {common && <p className="text-sm text-ink-mid">{tx(`Both rotis are now cut into ${L} equal pieces, so you can just count.`, `দুটো রুটিই এখন ${toBn(String(L))}টি সমান টুকরো, তাই শুধু গুনলেই হবে।`)}</p>}
        </div>
      </div>
    </div>
  );
}
