import { CONCEPTS, conceptById } from "../../content/concepts";
import { SUBJECTS } from "../../content/subjects";
import type { SubjectId } from "../../content/types";
import { glowLevel } from "../../lib/model";
import { useLearner } from "../../lib/store";
import { StarGlyph } from "./ui";

type Props = { selected: string | null; onSelect: (id: string | null) => void; only?: SubjectId };

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function SkyLayer({ selected, onSelect, only, mode }: Props & { mode: "desk" | "mob" }) {
  const { concept, t } = useLearner();
  const W = only ? 400 : mode === "desk" ? 1000 : 400;
  const H = only ? 340 : mode === "desk" ? 640 : 780;
  const scale = only ? 1.55 : mode === "desk" ? 1 : 0.72;
  const subjects = only ? SUBJECTS.filter((s) => s.id === only) : SUBJECTS;
  const centre = (sid: SubjectId): [number, number] => {
    if (only) return [W / 2, H / 2 + 6];
    const s = SUBJECTS.find((x) => x.id === sid)!;
    return mode === "desk" ? s.desk : s.mob;
  };
  const pos = (id: string): [number, number] => {
    const c = conceptById(id)!;
    const [cx, cy] = centre(c.subject);
    return [cx + c.at[0] * scale, cy + c.at[1] * scale];
  };
  const sel = selected ? conceptById(selected) : null;
  const dust = Array.from({ length: only ? 30 : 90 }, (_, i) => [rand(i) * W, rand(i + 400) * H, rand(i + 800)] as const);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="group" aria-label={t({ en: "Understanding Sky", bn: "বোঝাপড়ার আকাশ" })}>
      {dust.map(([x, y, s], i) => (
        <circle key={i} cx={x} cy={y} r={s > 0.92 ? 1.3 : 0.7} fill="#4A4664" opacity={0.18 + s * 0.25} />
      ))}
      {subjects.map((s) => {
        const [cx, cy] = centre(s.id);
        const stars = CONCEPTS.filter((c) => c.subject === s.id);
        return (
          <g key={s.id}>
            {stars.flatMap((c) =>
              c.prereqs
                .filter((p) => conceptById(p)?.subject === s.id)
                .map((p) => {
                  const [x1, y1] = pos(p);
                  const [x2, y2] = pos(c.id);
                  const lit = glowLevel(concept(p).glow) >= 3 && glowLevel(concept(c.id).glow) >= 3;
                  return <line key={`${p}-${c.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lit ? "#5B3FD6" : s.thread} strokeOpacity={lit ? 0.9 : 0.45} strokeWidth={1.4} strokeDasharray="5 5" />;
                }),
            )}
            {!only && (
              <text x={cx} y={cy - 96 * scale} textAnchor="middle" fill={s.thread} fontSize={mode === "desk" ? 15 : 15} fontWeight={700} style={{ letterSpacing: "0.02em" }}>
                {t(s.name)}
              </text>
            )}
            {stars.map((c) => {
              const [x, y] = pos(c.id);
              const g = concept(c.id).glow;
              const isSel = selected === c.id;
              const r = c.route ? (only ? 13 : 10.5) : only ? 9 : 7;
              return (
                <g
                  key={c.id}
                  transform={`translate(${x} ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t(c.title)}${c.route ? "" : ". " + t({ en: "Preview", bn: "প্রিভিউ" })}`}
                  aria-pressed={isSel}
                  onClick={() => onSelect(isSel ? null : c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(isSel ? null : c.id);
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <circle r={22} fill="transparent" />
                  {isSel && <circle r={r * 2.3} fill="none" stroke="#1D1B2C" strokeWidth={1.2} strokeDasharray="2 4" />}
                  {c.route && g === "unexplored" && <circle r={r * 1.7} fill="none" stroke={s.thread} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.9} />}
                  <StarGlyph glow={g} r={r} thread={s.thread} />
                  {(c.route || only) && (
                    <text y={r + 18} textAnchor="middle" fill="#1D1B2C" fontSize={only ? 12.5 : 12} fontWeight={600} opacity={0.92}>
                      {t(c.title).length > 30 && !only ? t(c.title).slice(0, 28) + "…" : t(c.title)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
      {sel &&
        !only &&
        sel.bridges.map((b) => {
          const [x1, y1] = pos(sel.id);
          const [x2, y2] = pos(b.to);
          const mx = (x1 + x2) / 2;
          const my = Math.min(y1, y2) - 60;
          const len = Math.hypot(x2 - x1, y2 - y1) * 1.3;
          return <path key={b.to} d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} fill="none" stroke="#5B3FD6" strokeWidth={1.6} className="edu-stitch-draw" style={{ ["--edu-len" as string]: len }} />;
        })}
    </svg>
  );
}

export function Sky(props: Props) {
  if (props.only) return <SkyLayer {...props} mode="desk" />;
  return (
    <>
      <div className="hidden md:block">
        <SkyLayer {...props} mode="desk" />
      </div>
      <div className="md:hidden">
        <SkyLayer {...props} mode="mob" />
      </div>
    </>
  );
}
