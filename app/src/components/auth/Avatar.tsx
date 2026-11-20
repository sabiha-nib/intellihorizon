import { useEffect, useRef, useState, type ReactNode } from "react";

import { AVATAR_PICK_MAX_BYTES, AVATAR_PRESETS } from "../../lib/auth/config";
import type { AvatarRef } from "../../lib/auth/types";
import { useLearner } from "../../lib/store";
import { msg } from "./messages";

const PRESET_BG: Record<string, string> = { comet: "#E2A93B", ringed: "#E8644A", moon: "#7FA7EA", star: "#191D23", galaxy: "#E57AA0", leaf: "#8DBF5A", atom: "#4FB5A5", kite: "#C98B62" };

export function PresetArt({ id, size }: { id: string; size: number }) {
  const ink = "#191D23";
  const cloth = "#191D23";
  const glyph: Record<string, ReactNode> = {
    comet: <><circle cx="38" cy="26" r="7" fill={cloth} /><path d="M33 31 L16 46 M30 27 L14 38 M35 34 L24 48" stroke={cloth} strokeWidth="3" strokeLinecap="round" opacity=".7" /></>,
    ringed: <><circle cx="32" cy="32" r="11" fill={cloth} /><ellipse cx="32" cy="32" rx="21" ry="6" fill="none" stroke={ink} strokeWidth="3" transform="rotate(-20 32 32)" /></>,
    moon: <path d="M38 16a17 17 0 1 0 8 30A14 14 0 0 1 38 16z" fill={cloth} />,
    star: <path d="M32 12 L37 27 L52 32 L37 37 L32 52 L27 37 L12 32 L27 27 Z" fill="#57707A" />,
    galaxy: <><path d="M32 32m-3 0a3 3 0 1 0 6 0a9 9 0 1 0-18 0a15 15 0 1 0 30 0" fill="none" stroke={cloth} strokeWidth="3.2" strokeLinecap="round" /></>,
    leaf: <><path d="M18 46C18 26 32 16 48 16c0 18-12 30-30 30z" fill={cloth} /><path d="M20 44 L40 24" stroke="#8DBF5A" strokeWidth="2.5" /></>,
    atom: <><circle cx="32" cy="32" r="4" fill={cloth} />{[0, 60, 120].map((r) => <ellipse key={r} cx="32" cy="32" rx="19" ry="7" fill="none" stroke={cloth} strokeWidth="2.4" transform={`rotate(${r} 32 32)`} />)}</>,
    kite: <><path d="M32 12 L46 30 L32 44 L18 30 Z" fill={cloth} /><path d="M32 12 V44 M18 30 H46" stroke="#C98B62" strokeWidth="2" /><path d="M32 44 q4 6 0 10 q-4 4 0 8" fill="none" stroke={cloth} strokeWidth="2" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill={PRESET_BG[id] ?? "#E2E8EA"} />
      {glyph[id] ?? glyph.star}
    </svg>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = [...(parts[0] ?? "")][0] ?? "";
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** The signed-in student's avatar: private photo via the owner-only endpoint, an illustration, or initials. */
export function AccountAvatar({ avatar, name, size = 40 }: { avatar: AvatarRef; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (avatar?.type === "upload" && !broken) {
    return <img src={`/api/avatar?v=${avatar.v}`} alt="" width={size} height={size} onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  if (avatar?.type === "preset") return <span className="inline-flex shrink-0 overflow-hidden rounded-full"><PresetArt id={avatar.id} size={size} /></span>;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-night-2 font-semibold text-cloth" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name) || "E"}
    </span>
  );
}

export type AvatarDraft = { kind: "none" } | { kind: "preset"; id: string } | { kind: "file"; blob: Blob; url: string };

async function sniffType(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function Cropper({ bitmap, onCancel, onDone }: { bitmap: ImageBitmap; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const { tx } = useLearner();
  const V = 280;
  const base = Math.max(V / bitmap.width, V / bitmap.height);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const urlRef = useRef<string>("");
  const canvasPreview = useRef<HTMLCanvasElement>(null);
  const scale = base * zoom;
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  const clamp = (x: number, y: number) => ({ x: Math.max(-(w - V) / 2, Math.min((w - V) / 2, x)), y: Math.max(-(h - V) / 2, Math.min((h - V) / 2, y)) });
  useEffect(() => setOff((o) => clamp(o.x, o.y)), [zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = canvasPreview.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, V, V);
    ctx.drawImage(bitmap, (V - w) / 2 + off.x, (V - h) / 2 + off.y, w, h);
  }, [bitmap, w, h, off]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const exportBlob = () => {
    const S = 512;
    const k = S / V;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (S - w * k) / 2 + off.x * k, (S - h * k) / 2 + off.y * k, w * k, h * k);
    c.toBlob((b) => {
      if (b && b.type === "image/webp") onDone(b);
      else c.toBlob((j) => j && onDone(j), "image/jpeg", 0.88);
    }, "image/webp", 0.86);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night-0/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className="edu-rise w-full max-w-md rounded-t-[22px] bg-sheet p-6 text-ink sm:rounded-[22px]">
        <h2 id="crop-title" className="font-display text-xl font-bold">{tx("Position your photo", "ছবিটি ঠিক জায়গায় বসাও")}</h2>
        <p className="mt-1 text-sm text-ink-mid">{tx("Drag to move. Use the slider or arrow keys to adjust.", "টেনে সরাও। স্লাইডার বা অ্যারো কী দিয়ে ঠিক করো।")}</p>
        <div
          tabIndex={0}
          aria-label={tx("Photo position", "ছবির অবস্থান")}
          className="relative mx-auto mt-5 cursor-grab touch-none overflow-hidden rounded-full bg-paper outline-offset-4 active:cursor-grabbing"
          style={{ width: V, height: V, maxWidth: "100%" }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d) setOff(clamp(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y));
          }}
          onPointerUp={() => (drag.current = null)}
          onKeyDown={(e) => {
            const step = 12;
            const m: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
            if (m[e.key]) {
              e.preventDefault();
              setOff((o) => clamp(o.x + m[e.key][0], o.y + m[e.key][1]));
            }
          }}
        >
          <canvas ref={canvasPreview} width={V} height={V} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_2px_rgba(255,255,255,0.8)]" />
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm font-semibold text-ink-mid">
          {tx("Zoom", "জুম")}
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[#191D23]" />
        </label>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="h-12 rounded-[14px] border border-ink-low/35 font-semibold hover:border-ink">{tx("Cancel", "বাতিল")}</button>
          <button type="button" onClick={exportBlob} className="h-12 rounded-[14px] bg-brand font-semibold text-sheet hover:bg-brand-deep">{tx("Use photo", "ছবি ব্যবহার করো")}</button>
        </div>
      </div>
    </div>
  );
}

/** Photo or illustration picker with preview, replace and remove. Never required. */
export function AvatarEditor({ value, onChange, name, busy, hideLabel }: { value: AvatarDraft; onChange: (v: AvatarDraft) => void; name: string; busy?: boolean; hideLabel?: boolean }) {
  const { t, tx } = useLearner();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(value.kind === "preset");

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > AVATAR_PICK_MAX_BYTES) return setError("image_too_large");
    const type = await sniffType(file);
    if (!type) return setError("image_type");
    try {
      setBitmap(await createImageBitmap(file));
    } catch {
      setError("image_unreadable");
    }
  };

  const preview =
    value.kind === "file" ? <img src={value.url} alt={tx("Your chosen photo", "তোমার বেছে নেওয়া ছবি")} className="h-24 w-24 rounded-full object-cover" /> : value.kind === "preset" ? <PresetArt id={value.id} size={96} /> : (
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-night-2 font-display text-3xl font-bold text-cloth" aria-hidden="true">{initials(name) || "?"}</span>
    );

  return (
    <div>
      {!hideLabel && (
        <p className="mb-2 flex items-baseline justify-between text-[15px] font-semibold">
          <span>{tx("Profile picture", "প্রোফাইল ছবি")}</span>
          <span className="text-xs font-medium text-ink-low">{tx("Optional", "ঐচ্ছিক")}</span>
        </p>
      )}
      <div className="flex items-center gap-5">
        <div className={`relative transition-transform duration-200 ${busy ? "opacity-60" : ""}`}>{preview}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="h-10 rounded-full bg-brand px-4 text-sm font-semibold text-sheet hover:bg-brand-deep">
            {value.kind === "file" ? tx("Replace photo", "ছবি বদলাও") : tx("Upload photo", "ছবি আপলোড")}
          </button>
          <button type="button" aria-expanded={showPresets} onClick={() => setShowPresets((v) => !v)} className="h-10 rounded-full border border-ink-low/35 px-4 text-sm font-semibold hover:border-ink">
            {tx("Choose illustration", "ছবি বেছে নাও")}
          </button>
          {value.kind !== "none" && (
            <button type="button" onClick={() => onChange({ kind: "none" })} className="h-10 rounded-full px-3 text-sm font-semibold text-ink-mid underline decoration-dashed underline-offset-4 hover:text-ink">
              {tx("Remove", "সরাও")}
            </button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <p className="mt-2 text-sm font-medium text-again" role="alert">{t(msg(error)!)}</p>}
      <p className="mt-2 text-sm text-ink-mid">{tx("JPEG, PNG or WebP, up to 10 MB. Only you can see your photo.", "JPEG, PNG বা WebP, সর্বোচ্চ ১০ এমবি। তোমার ছবি শুধু তুমিই দেখতে পাবে।")}</p>
      {showPresets && (
        <div role="radiogroup" aria-label={tx("Illustrations", "ছবির তালিকা")} className="edu-rise mt-3 grid grid-cols-8 gap-2">
          {AVATAR_PRESETS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={value.kind === "preset" && value.id === id} aria-label={id} onClick={() => onChange({ kind: "preset", id })} className={`rounded-full p-0.5 transition-transform hover:scale-105 ${value.kind === "preset" && value.id === id ? "ring-2 ring-ink ring-offset-2" : ""}`}>
              <PresetArt id={id} size={36} />
            </button>
          ))}
        </div>
      )}
      {bitmap && (
        <Cropper
          bitmap={bitmap}
          onCancel={() => setBitmap(null)}
          onDone={(blob) => {
            if (value.kind === "file") URL.revokeObjectURL(value.url);
            onChange({ kind: "file", blob, url: URL.createObjectURL(blob) });
            setBitmap(null);
          }}
        />
      )}
    </div>
  );
}

export async function uploadAvatar(blob: Blob): Promise<{ ok: true; v: string } | { ok: false; code: string }> {
  const form = new FormData();
  form.append("file", blob, blob.type === "image/webp" ? "avatar.webp" : "avatar.jpg");
  try {
    const res = await fetch("/api/avatar", { method: "POST", body: form, credentials: "same-origin" });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; v?: string; code?: string };
    return body.ok && body.v ? { ok: true, v: body.v } : { ok: false, code: body.code ?? "upload_failed" };
  } catch {
    return { ok: false, code: "network" };
  }
}
