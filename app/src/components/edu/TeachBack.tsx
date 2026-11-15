import { useEffect, useRef, useState } from "react";

import type { Idea, L, LessonPack } from "../../content/types";
import { useLearner } from "../../lib/store";
import { IgniteButton } from "./ui";

type Msg = { who: "rumi" | "me"; text: string };
type Rec = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };

function detect(text: string, ideas: Idea[]): string[] {
  const s = text.toLowerCase();
  return ideas.filter((i) => i.keys.some((k) => s.includes(k.toLowerCase()))).map((i) => i.id);
}

/** Teach Rumi: a simulated younger learner who asks follow-ups until the key ideas are explained. */
export function TeachBack({ pack, onDone }: { pack: LessonPack; onDone: () => void }) {
  const { t, tx, lang, record } = useLearner();
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ who: "rumi", text: t(pack.rumiOpening) }]);
  const [draft, setDraft] = useState("");
  const [covered, setCovered] = useState<string[]>([]);
  const [rounds, setRounds] = useState(0);
  const [finished, setFinished] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Rec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setCanSpeak(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = lang === "bn" ? "bn-BD" : "en-IN";
    r.interimResults = false;
    r.onresult = (e) => {
      const said = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      setDraft((d) => (d ? d + " " : "") + said);
    };
    r.onend = () => setListening(false);
    recRef.current = r;
    setListening(true);
    r.start();
  };

  const finish = (all: string[]) => {
    setFinished(true);
    record({ concept: pack.concept, kind: "explain", item: `${pack.concept}.teach`, correct: all.length >= 2, confidence: 2, detail: all.join(",") });
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const found = detect(text, pack.ideas).filter((id) => !covered.includes(id));
    const all = [...covered, ...found];
    const missing = pack.ideas.filter((i) => !all.includes(i.id));
    const r = rounds + 1;
    const ack = (l: L) => l;
    let reply: L;
    if (found.length > 0) {
      const heard = pack.ideas.filter((i) => found.includes(i.id)).map((i) => t(i.label).toLowerCase());
      reply = ack({ en: `Oh! So ${heard.join(", and ")}.`, bn: `ও! তাহলে ${heard.join(", আর ")}।` });
    } else {
      reply = { en: "Hmm, I am not sure I follow yet. Can you say it another way?", bn: "হুম, এখনো ঠিক বুঝলাম না। অন্যভাবে বলবে?" };
    }
    const next: Msg[] = [...msgs, { who: "me", text }, { who: "rumi", text: t(reply) }];
    if (missing.length > 0 && r < 4) next.push({ who: "rumi", text: t(missing[0].rumiAsks) });
    else next.push({ who: "rumi", text: tx("I think I get it now. Thank you for teaching me!", "মনে হয় এবার বুঝেছি। শেখানোর জন্য ধন্যবাদ!") });
    setMsgs(next);
    setCovered(all);
    setRounds(r);
    setDraft("");
    if (missing.length === 0 || r >= 4) finish(all);
  };

  return (
    <div className="rounded-[14px] bg-sheet p-5 shadow-[0_12px_32px_-18px_rgba(52,36,140,0.35)] md:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-[#E57AA0] font-display text-lg font-bold text-[#b44a72]" aria-hidden="true">R</span>
        <div>
          <p className="font-semibold">{tx("Rumi, Class 5", "রুমি, পঞ্চম শ্রেণি")}</p>
          <p className="text-xs text-ink-low">{tx("A simulated younger learner, not a real person. Rumi listens for key ideas, not spelling, grammar or accent.", "একজন কাল্পনিক ছোট শিক্ষার্থী, আসল মানুষ নয়। রুমি মূল ধারণা খোঁজে, বানান, ব্যাকরণ বা উচ্চারণ নয়।")}</p>
        </div>
      </div>
      <ol className="mt-5 space-y-3" aria-live="polite">
        {msgs.map((m, i) => (
          <li key={i} className={`max-w-[85%] rounded-[14px] px-4 py-2.5 leading-relaxed ${m.who === "rumi" ? "bg-paper text-ink" : "ml-auto bg-brand text-sheet"}`}>
            {m.text}
          </li>
        ))}
      </ol>
      {!finished ? (
        <div className="mt-5">
          <label htmlFor="teach" className="text-sm font-semibold text-ink-mid">
            {tx("Explain it to Rumi in your own words (Bangla, English or both)", "নিজের ভাষায় রুমিকে বোঝাও (বাংলা, ইংরেজি বা দুটোই)")}
          </label>
          <textarea
            id="teach"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-[14px] border border-ink-low/40 bg-sheet p-3 text-base text-ink outline-none focus:border-ink"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <IgniteButton onClick={send} disabled={!draft.trim()}>
              {tx("Send to Rumi", "রুমিকে পাঠাও")}
            </IgniteButton>
            {canSpeak && (
              <button type="button" onClick={listen} aria-pressed={listening} className={`rounded-full border border-dashed px-4 py-2 text-sm font-semibold ${listening ? "border-again text-again" : "border-ink-low/60 text-ink-mid hover:text-ink"}`}>
                {listening ? tx("Listening… tap to stop", "শুনছি… থামাতে চাপো") : tx("Speak instead", "বলে বোঝাও")}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-low">{tx("Your words stay on this device. IntelliHorizon saves only which key ideas you covered.", "তোমার লেখা এই ডিভাইসেই থাকে। ইন্টেলিহরাইজন শুধু কোন মূল ধারণা বলেছ তা সংরক্ষণ করে।")}</p>
        </div>
      ) : (
        <div className="edu-rise mt-5 border-t border-dashed border-ink-low/40 pt-4">
          <p className="font-semibold">{tx("Ideas you taught", "তুমি যা শেখালে")}</p>
          <ul className="mt-2 space-y-1.5">
            {pack.ideas.map((i) => (
              <li key={i.id} className={covered.includes(i.id) ? "text-ink" : "text-ink-low"}>
                <span aria-hidden="true">{covered.includes(i.id) ? "✓ " : "○ "}</span>
                {t(i.label)}
                {!covered.includes(i.id) && <span className="text-xs"> {tx("(Rumi still wonders about this)", "(রুমির এটা নিয়ে এখনো প্রশ্ন আছে)")}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <IgniteButton onClick={onDone}>{tx("Put my idea in disguise", "আমার ধারণাকে ছদ্মবেশ পরাও")}</IgniteButton>
          </div>
        </div>
      )}
    </div>
  );
}
