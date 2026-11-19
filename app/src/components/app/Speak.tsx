import { useEffect, useState } from "react";

import { useLearner } from "../../lib/store";

/**
 * Reads text aloud with the browser's own speech synthesis. Each part is read with its label ("From your textbook",
 * "General explanation"...), so a spoken answer carries the same caveats as the written one. If the device has no
 * voice for the language (Bangla voices are often missing), it says so instead of reading with the wrong voice.
 */
export function SpeakButton({ parts, lang }: { parts: string[]; lang: "bn" | "en" }) {
  const { tx } = useLearner();
  const [state, setState] = useState<"idle" | "speaking" | "no_voice" | "unsupported">("idle");
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* nothing to stop */ } }, []);
  const speak = () => {
    const ss = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!ss || typeof SpeechSynthesisUtterance === "undefined") return setState("unsupported");
    if (state === "speaking") { ss.cancel(); return setState("idle"); }
    const voice = ss.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
    if (!voice) return setState("no_voice");
    ss.cancel();
    const u = new SpeechSynthesisUtterance(parts.join(". "));
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    setState("speaking");
    ss.speak(u);
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={speak} aria-pressed={state === "speaking"} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-low/30 bg-sheet px-3 text-sm font-semibold hover:border-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
        {state === "speaking" ? tx("Stop reading", "পড়া থামাও") : tx("Listen", "শোনো")}
      </button>
      {state === "no_voice" && <span role="status" className="text-sm text-ink-mid">{lang === "bn" ? tx("This device has no Bangla voice, so it can't read this aloud. The text is above.", "এই ডিভাইসে বাংলা কণ্ঠ নেই, তাই পড়ে শোনানো যাচ্ছে না। লেখা উপরে আছে।") : tx("This device has no English voice for reading aloud.", "এই ডিভাইসে ইংরেজি পড়ার কণ্ঠ নেই।")}</span>}
      {state === "unsupported" && <span role="status" className="text-sm text-ink-mid">{tx("This browser can't read text aloud.", "এই ব্রাউজার লেখা পড়ে শোনাতে পারে না।")}</span>}
    </span>
  );
}
