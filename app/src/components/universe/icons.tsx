// One icon family for IntelliHorizon: 24px grid, 1.8px rounded strokes, no fills except the brand star.
import type { SVGProps } from "react";

const P: Record<string, string> = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  learn:
    "M4 5.5C6.5 4.3 9.3 4.3 12 6c2.7-1.7 5.5-1.7 8-.5V18c-2.5-1.2-5.3-1.2-8 .5-2.7-1.7-5.5-1.7-8-.5zM12 6v12.5",
  practice:
    "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z",
  tutor:
    "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8.5 9.5h7M8.5 12.5h4.5",
  progress: "M4 20h16M6.5 16v-4M11 16V8M15.5 16v-6M20 16V5",
  more: "M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 20 20",
  revision: "M5 12a7 7 0 0 1 12-5l2 2M19 5v4h-4M19 12a7 7 0 0 1-12 5l-2-2M5 19v-4h4",
  radar: "M12 3.5a8.5 8.5 0 1 0 8.5 8.5M12 7.5a4.5 4.5 0 1 0 4.5 4.5M12 12l6-6M12 12h.01",
  evidence: "M12 3.5 14.4 8l5 .8-3.6 3.5.9 5-4.7-2.4-4.7 2.4.9-5L4.6 8.8l5-.8z",
  map: "M6 6.5a2 2 0 1 0 0 .01M18 5.5a2 2 0 1 0 0 .01M12 12.5a2 2 0 1 0 0 .01M7 18.5a2 2 0 1 0 0 .01M17.5 18a2 2 0 1 0 0 .01M7.6 7.7l3 3.4M16.6 6.9l-3.2 4M11 14.2 8 16.8M13.3 14l2.9 2.6",
  missions: "M5 21V4M5 4h11l-2 3.5L16 11H5",
  achievements:
    "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4",
  saved: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z",
  history: "M12 4a8 8 0 1 0 8 8M12 8v4l3 2M20 4v4h-4",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8",
  help: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.3-1.1.9-1.1 1.6v.4M12 16.6h.01",
  plan: "M5 6h14v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM5 10h14M9 3.5V7M15 3.5V7M8.5 14l2 2 4-4",
  check: "M5 12.5 10 17l9-10",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  close: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.5 20a7.5 7.5 0 0 1 15 0",
  logout: "M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9",
  offline:
    "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a9.9 9.9 0 0 1 4.2-2.4M12 20h.01M16.2 10.8A9.9 9.9 0 0 1 19 13M2 9.5a14 14 0 0 1 4.5-2.8M10.5 5.6A14 14 0 0 1 22 9.5",
  hint: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z",
  book: "M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h10.5",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  play: "M8 5.5v13l10-6.5z",
  pen: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  layers: "M12 4 3 9l9 5 9-5zM3 14l9 5 9-5",
  shield: "M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
};

export type IconName = keyof typeof P;

export function Icon({
  name,
  size = 22,
  ...rest
}: { name: IconName | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={P[name] ?? P.spark} />
    </svg>
  );
}

/** The IntelliHorizon mark: a four-point star inside a stitched orbit. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-16 -16 32 32" aria-hidden="true">
      <circle r="14" fill="none" stroke="#5B3FD6" strokeWidth="1.8" strokeDasharray="3.2 2.6" />
      <path d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z" fill="#5B3FD6" />
      <circle cx="9.9" cy="-9.9" r="2.2" fill="#F3B23E" />
    </svg>
  );
}

/** Subject glyph: a small coloured disc with the subject's initial letter shape, shared everywhere a subject appears. */
export function SubjectDot({ hue, size = 10 }: { hue: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: hue }}
    />
  );
}
