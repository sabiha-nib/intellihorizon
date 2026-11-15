import { useEffect, useRef, useState } from "react";

import type { L } from "../../content/types";
import { useLearner } from "../../lib/store";
import { IgniteButton, QuietButton } from "./ui";

type ObjId = "stone5" | "stone1" | "ball" | "sheet" | "feather";
type Env = "air" | "vacuum" | "moon";

const OBJ: Record<ObjId, { label: L; drag: number }> = {
  stone5: { label: { en: "Stone, 5 kg", bn: "পাথর, ৫ কেজি" }, drag: 0.00056 },
  stone1: { label: { en: "Stone, 1 kg", bn: "পাথর, ১ কেজি" }, drag: 0.001 },
  ball: { label: { en: "Crumpled paper", bn: "দলা পাকানো কাগজ" }, drag: 0.168 },
  sheet: { label: { en: "Flat paper sheet", bn: "সমান কাগজ" }, drag: 8.6 },
  feather: { label: { en: "Feather", bn: "পালক" }, drag: 27 },
};
const ENV: Record<Env, { label: L; g: number; air: boolean }> = {
  air: { label: { en: "Earth, with air", bn: "পৃথিবী, বাতাসসহ" }, g: 9.8, air: true },
  vacuum: { label: { en: "Vacuum tube", bn: "বায়ুশূন্য নল" }, g: 9.8, air: false },
  moon: { label: { en: "The Moon", bn: "চাঁদ" }, g: 1.62, air: false },
};
const H = 5; // metres
const TOP = 40;
const GROUND = 370;
const PPM = (GROUND - TOP) / H;

type Lane = { y: number; v: number; landed: number | null; trace: [number, number][] };
const fresh = (): Lane => ({ y: 0, v: 0, landed: null, trace: [[0, 0]] });

function Shape({ id, x, y, t }: { id: ObjId; x: number; y: number; t: number }) {
  if (id === "stone5") return <circle cx={x} cy={y - 16} r={16} fill="#6C6886" stroke="#1D1B2C" strokeWidth={1.5} />;
  if (id === "stone1") return <circle cx={x} cy={y - 10} r={10} fill="#8E95B8" stroke="#1D1B2C" strokeWidth={1.5} />;
  if (id === "ball") return <polygon points={`${x - 8},${y - 6} ${x - 3},${y - 15} ${x + 6},${y - 13} ${x + 9},${y - 4} ${x + 2},${y} ${x - 6},${y - 1}`} fill="#fff" stroke="#1D1B2C" strokeWidth={1.4} />;
  if (id === "sheet") return <rect x={x - 22} y={y - 4} width={44} height={3} fill="#fff" stroke="#1D1B2C" strokeWidth={1.2} transform={`rotate(${Math.sin(t * 5) * 12} ${x} ${y})`} />;
  return <path d={`M${x - 16} ${y - 4} Q${x} ${y - 14} ${x + 16} ${y - 6} Q${x} ${y - 2} ${x - 16} ${y - 4} Z M${x - 18} ${y - 3} L${x + 18} ${y - 7}`} fill="#1D1B2C" stroke="#8a5a37" strokeWidth={1.1} transform={`rotate(${Math.sin(t * 3) * 18} ${x} ${y})`} />;
}

export function DropLab() {
  const { t, tx, record, rows } = useLearner();
  const [env, setEnv] = useState<Env>("air");
  const [a, setA] = useState<ObjId>("stone5");
  const [b, setB] = useState<ObjId>("stone1");
  const [slow, setSlow] = useState(false);
  const [lanes, setLanes] = useState<[Lane, Lane]>([fresh(), fresh()]);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState(0);
  const raf = useRef<number | null>(null);

  const prediction = [...rows].reverse().find((r) => r.item === "fall.p1");
  const predText: Record<string, L> = {
    a: { en: "the 5 kg stone lands first", bn: "৫ কেজির পাথর আগে পড়বে" },
    b: { en: "both land together", bn: "দুটো একসাথে পড়বে" },
    c: { en: "the 1 kg stone lands first", bn: "১ কেজির পাথর আগে পড়বে" },
    d: { en: "it depends on the height", bn: "উচ্চতার ওপর নির্ভর করে" },
  };

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const run = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const sim: [Lane, Lane] = [fresh(), fresh()];
    const ids: [ObjId, ObjId] = [a, b];
    const e = ENV[env];
    let simT = 0;
    let last = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRunning(true);
    setRuns((n) => n + 1);
    record({ concept: "fall", kind: "lab", item: "fall.lab", correct: true, confidence: 2, detail: `${env}.${a}.${b}` });
    const step = (now: number) => {
      const frame = Math.min(0.05, (now - last) / 1000);
      last = now;
      const adv = reduced ? 20 : frame * (slow ? 0.25 : 1);
      const target = simT + adv;
      while (simT < target && simT < 20) {
        const dt = 1 / 240;
        simT += dt;
        sim.forEach((L, k) => {
          if (L.landed !== null) return;
          const drag = e.air ? OBJ[ids[k]].drag : 0;
          const acc = e.g - drag * L.v * L.v;
          L.v += acc * dt;
          L.y += L.v * dt;
          if (L.y >= H) {
            L.y = H;
            L.landed = simT;
          }
          if (Math.round(simT * 240) % 6 === 0) L.trace.push([simT, L.v]);
        });
        if (sim.every((L) => L.landed !== null)) break;
      }
      setLanes([{ ...sim[0], trace: [...sim[0].trace] }, { ...sim[1], trace: [...sim[1].trace] }]);
      setTime(simT);
      if (sim.every((L) => L.landed !== null) || simT >= 20) {
        setRunning(false);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const preset = (e: Env, x: ObjId, y: ObjId) => {
    setEnv(e);
    setA(x);
    setB(y);
    setLanes([fresh(), fresh()]);
    setTime(0);
  };

  const tMax = Math.max(1.2, ...lanes.map((L) => L.landed ?? time));
  const vMax = Math.max(5, ...lanes.flatMap((L) => L.trace.map((p) => p[1])));
  const ids: [ObjId, ObjId] = [a, b];
  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="rounded-[14px] bg-sheet p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold tracking-tight">{tx("Drop Lab", "ড্রপ ল্যাব")}</h2>
        <span className="rounded-full border border-dashed border-ink-low/50 px-2.5 py-0.5 text-xs font-semibold text-ink-mid">{tx("Educational simulation, not a real measurement", "শিক্ষামূলক সিমুলেশন, আসল পরিমাপ নয়")}</span>
      </div>
      {prediction?.detail && predText[prediction.detail] && (
        <p className="mt-2 text-ink-mid">
          {tx("You predicted that ", "তোমার অনুমান ছিল ")}
          <span className="font-semibold text-ink">{t(predText[prediction.detail])}</span>. {tx("Run it and see.", "চালিয়ে দেখো।")}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <QuietButton onClick={() => preset("vacuum", "stone5", "stone1")}>{tx("5 kg vs 1 kg, no air", "৫ কেজি বনাম ১ কেজি, বাতাস ছাড়া")}</QuietButton>
        <QuietButton onClick={() => preset("air", "ball", "sheet")}>{tx("Paper ball vs flat sheet", "কাগজের দলা বনাম সমান কাগজ")}</QuietButton>
        <QuietButton onClick={() => preset("moon", "stone5", "feather")}>{tx("Hammer and feather on the Moon", "চাঁদে হাতুড়ি আর পালক")}</QuietButton>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <svg viewBox="0 0 360 400" className="w-full rounded-[14px] bg-paper" role="img" aria-label={tx("Two objects falling side by side", "পাশাপাশি দুটি বস্তু পড়ছে")}>
            {env !== "air" && <rect x="40" y="20" width="280" height="356" rx="14" fill="none" stroke="#4A4664" strokeDasharray="6 5" />}
            <line x1="20" y1={GROUND + 1} x2="340" y2={GROUND + 1} stroke="#1D1B2C" strokeWidth="3" />
            {[0, 1, 2, 3, 4, 5].map((m) => (
              <g key={m}>
                <line x1="22" x2="30" y1={TOP + m * PPM} y2={TOP + m * PPM} stroke="#6C6886" />
                <text x="34" y={TOP + m * PPM + 4} fontSize="10" fill="#6C6886">{m} m</text>
              </g>
            ))}
            {lanes.map((L, k) => (
              <g key={k}>
                <Shape id={ids[k]} x={k === 0 ? 130 : 250} y={TOP + L.y * PPM} t={time} />
                <text x={k === 0 ? 130 : 250} y={392} fontSize="11" textAnchor="middle" fill="#1D1B2C" fontWeight={600}>
                  {t(OBJ[ids[k]].label)}
                </text>
              </g>
            ))}
            <text x="340" y="34" fontSize="12" textAnchor="end" fill="#4A4664">{t(ENV[env].label)}</text>
          </svg>
        </div>
        <div className="space-y-4">
          <fieldset>
            <legend className="text-sm font-semibold text-ink-mid">{tx("Where?", "কোথায়?")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(ENV) as Env[]).map((k) => (
                <button key={k} type="button" aria-pressed={env === k} onClick={() => preset(k, a, b)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${env === k ? "border-brand bg-brand text-sheet" : "border-ink-low/40 hover:border-ink"}`}>
                  {t(ENV[k].label)}
                </button>
              ))}
            </div>
          </fieldset>
          {([0, 1] as const).map((k) => (
            <label key={k} className="block text-sm font-semibold text-ink-mid">
              {k === 0 ? tx("Left object", "বাঁয়ের বস্তু") : tx("Right object", "ডানের বস্তু")}
              <select value={ids[k]} onChange={(e) => (k === 0 ? setA : setB)(e.target.value as ObjId)} className="mt-1 block w-full rounded-[14px] border border-ink-low/40 bg-sheet px-3 py-2 text-base font-medium text-ink">
                {(Object.keys(OBJ) as ObjId[]).map((o) => (
                  <option key={o} value={o}>{t(OBJ[o].label)}</option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-mid">
            <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} className="h-4 w-4 accent-[#1D1B2C]" />
            {tx("Slow motion (quarter speed)", "ধীর গতি (চার ভাগের এক)")}
          </label>
          <IgniteButton onClick={run} disabled={running} wide>
            {running ? tx("Falling…", "পড়ছে…") : runs > 0 ? tx("Drop again", "আবার ফেলো") : tx("Drop both", "দুটোই ফেলো")}
          </IgniteButton>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {lanes.map((L, k) => (
              <div key={k} className="rounded-[14px] border border-dashed border-ink-low/40 p-2">
                <dt className="text-xs text-ink-low">{t(OBJ[ids[k]].label)}</dt>
                <dd className="font-semibold">{L.landed !== null ? tx(`Landed: ${fmt(L.landed)} s`, `পড়ল: ${fmt(L.landed)} সে`) : tx(`${fmt(L.v)} m/s`, `${fmt(L.v)} মি/সে`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold text-ink-mid">{tx("Speed over time", "সময়ের সাথে বেগ")}</p>
        <svg viewBox="0 0 360 150" className="mt-2 w-full max-w-xl" role="img" aria-label={tx("Live speed-time graph", "সরাসরি বেগ-সময় লেখচিত্র")}>
          <line x1="30" y1="130" x2="350" y2="130" stroke="#6C6886" />
          <line x1="30" y1="130" x2="30" y2="8" stroke="#6C6886" />
          <text x="350" y="146" fontSize="10" textAnchor="end" fill="#4A4664">{tx("time (s)", "সময় (সে)")}</text>
          <text x="2" y="14" fontSize="10" fill="#4A4664">{tx("m/s", "মি/সে")}</text>
          {lanes.map((L, k) => (
            <polyline key={k} points={L.trace.map(([tt, v]) => `${30 + (tt / tMax) * 320},${130 - (v / vMax) * 118}`).join(" ")} fill="none" stroke={k === 0 ? "#E8644A" : "#1D1B2C"} strokeWidth={k === 0 ? 4 : 2} strokeDasharray={k === 1 ? "6 4" : undefined} />
          ))}
        </svg>
      </div>
    </div>
  );
}
