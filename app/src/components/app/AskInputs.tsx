// Extra ways to put a question into the tutor box: speaking it, reading it from a PDF, or reading a photo of homework.
// All of them only fill the text box. Nothing is asked until the student checks the words and presses Send.
// PDFs are read in the browser and never leave the device. Photos are sent only when the student chooses
// "Read this photo", and only if photo reading is switched on; otherwise the tutor says so and nothing is uploaded.
// A photo that is read is not stored; only the words read from it are kept for 30 days.
import { useEffect, useRef, useState } from "react";

import { useLearner } from "../../lib/store";
import { photoReadingStatus, readPhoto } from "../../lib/api/upload.functions";
import { call } from "../auth/messages";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_PAGES = 3;

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

function recognizer(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type PdfResult = { kind: "text"; text: string; pages: number; readPages: number } | { kind: "scanned" | "empty" | "password" | "corrupt" | "failed"; pages?: number };

/** Reads the text layer of the first pages of a PDF in the browser, and says precisely why when it can't. */
export async function pdfText(file: File): Promise<PdfResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    return { kind: name === "PasswordException" ? "password" : name === "InvalidPDFException" ? "corrupt" : "failed" };
  }
  if (!doc.numPages) return { kind: "empty", pages: 0 };
  const parts: string[] = [];
  const readPages = Math.min(doc.numPages, MAX_PAGES);
  try {
    for (let i = 1; i <= readPages; i++) {
      const c = await (await doc.getPage(i)).getTextContent();
      parts.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
  } catch {
    return { kind: "failed", pages: doc.numPages };
  }
  const text = parts.join("\n").replace(/[ \t]+/g, " ").trim();
  if (text.replace(/\s/g, "").length < 10) return { kind: "scanned", pages: doc.numPages };
  return { kind: "text", text, pages: doc.numPages, readPages };
}

/** Re-encodes a photo in the browser: applies its EXIF orientation, scales it to at most 1600px and drops all metadata (including location). */
async function preparePhoto(f: File): Promise<{ blob: Blob; url: string }> {
  const bmp = await createImageBitmap(f, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("encode"))), "image/jpeg", 0.85));
  return { blob, url: URL.createObjectURL(blob) };
}
const blobToB64 = async (b: Blob) => { const u = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

export function AskInputs({ onText, disabled }: { onText: (text: string, from: "voice" | "pdf" | "photo") => void; disabled?: boolean }) {
  const { tx, lang } = useLearner();
  const [voiceOk, setVoiceOk] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"bn-BD" | "en-US">(lang === "bn" ? "bn-BD" : "en-US");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<{ text: string; final: boolean } | null>(null);
  const [note, setNote] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [photoOn, setPhotoOn] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [read, setRead] = useState<{ text: string; uncertain: string[] } | null>(null);
  const rec = useRef<Rec | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => setVoiceOk(!!recognizer()), []);
  useEffect(() => { void photoReadingStatus().then((s) => setPhotoOn(s.enabled)).catch(() => setPhotoOn(false)); }, []);
  useEffect(() => () => rec.current?.abort(), []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const listen = () => {
    const R = recognizer();
    if (!R) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new R();
    r.lang = voiceLang;
    r.interimResults = true;
    r.continuous = false;
    setHeard(null);
    r.onresult = (e) => {
      const all = Array.from(e.results);
      const said = all.map((x) => x[0]?.transcript ?? "").join(" ").trim();
      setHeard({ text: said, final: all.every((x) => x.isFinal) });
    };
    r.onerror = (e) => {
      setHeard(null);
      setNote({ tone: "warn", text:
        e.error === "not-allowed" || e.error === "service-not-allowed" ? tx("Microphone access was blocked. Allow it in your browser's site settings to speak your question, or type it.", "মাইক্রোফোন বন্ধ। কথা বলে প্রশ্ন করতে ব্রাউজারের সাইট সেটিংসে অনুমতি দাও, অথবা লেখো।")
        : e.error === "audio-capture" ? tx("No microphone was found. Connect one, or type your question.", "কোনো মাইক্রোফোন পাওয়া যায়নি। একটি লাগাও, অথবা প্রশ্ন লেখো।")
        : e.error === "no-speech" ? tx("Nothing was heard. Try again a little closer to the microphone.", "কিছু শোনা যায়নি। মাইক্রোফোনের আরেকটু কাছে আবার চেষ্টা করো।")
        : e.error === "network" ? tx("Speech recognition needs an internet connection in this browser. Type the question instead.", "এই ব্রাউজারে কথা চিনতে ইন্টারনেট লাগে। প্রশ্নটি লিখে দাও।")
        : e.error === "language-not-supported" ? tx("This browser can't recognise that language. Try the other language or type.", "এই ব্রাউজার ভাষাটি চিনতে পারে না। অন্য ভাষা চেষ্টা করো বা লেখো।")
        : tx("Speech couldn't be recognised this time. Try again or type the question.", "এবার কথা চেনা যায়নি। আবার চেষ্টা করো বা প্রশ্নটি লেখো।") });
    };
    r.onend = () => { setListening(false); setHeard((h) => (h ? { ...h, final: true } : h)); };
    rec.current = r;
    setNote(null);
    setListening(true);
    try { r.start(); } catch { setListening(false); setNote({ tone: "warn", text: tx("The microphone couldn't start. Try again.", "মাইক্রোফোন চালু হয়নি। আবার চেষ্টা করো।") }); }
  };

  const pickPdf = async (f: File | undefined) => {
    if (!f) return;
    if (pdfInput.current) pdfInput.current.value = "";
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (!isPdf) return setNote({ tone: "warn", text: tx("Only PDF files with text can be read here. For a picture of homework, use \"Photo of a question\".", "এখানে শুধু লেখাসহ পিডিএফ পড়া যায়। হোমওয়ার্কের ছবির জন্য \"প্রশ্নের ছবি\" ব্যবহার করো।") });
    if (f.size === 0) return setNote({ tone: "warn", text: tx("That PDF is empty.", "পিডিএফটি ফাঁকা।") });
    if (f.size > MAX_PDF_BYTES) return setNote({ tone: "warn", text: tx("That PDF is over 10 MB. Choose a smaller file, or copy just the question.", "পিডিএফটি ১০ এমবির বেশি। ছোট ফাইল বাছো, বা শুধু প্রশ্নটি কপি করো।") });
    setReading(true);
    try {
      const r = await pdfText(f);
      if (r.kind === "text") {
        onText(r.text.slice(0, 1000), "pdf");
        const more = r.pages > r.readPages ? tx(` Only the first ${r.readPages} of its ${r.pages} pages were read.`, ` এর ${r.pages} পৃষ্ঠার মধ্যে শুধু প্রথম ${r.readPages}টি পড়া হয়েছে।`) : "";
        setNote({ tone: "info", text: tx(`The PDF's text is in the box${r.text.length > 1000 ? " (cut to 1,000 characters)" : ""}.${more} Keep only your question, then press Send. The file stayed on your device.`, `পিডিএফের লেখা বক্সে আছে${r.text.length > 1000 ? " (১,০০০ অক্ষরে ছাঁটা)" : ""}।${more} শুধু তোমার প্রশ্নটুকু রেখে পাঠাও চাপো। ফাইলটি তোমার ডিভাইসেই ছিল।`) });
      } else {
        const m: Record<string, [string, string]> = {
          scanned: ["This PDF has no readable text (it looks like a scanned page), so nothing was taken from it. Type the question, or take a photo of it with \"Photo of a question\".", "এই পিডিএফে পড়ার মতো লেখা নেই (স্ক্যান করা পৃষ্ঠা মনে হচ্ছে), তাই কিছু নেওয়া হয়নি। প্রশ্নটি লেখো, অথবা \"প্রশ্নের ছবি\" দিয়ে ছবি তোলো।"],
          empty: ["That PDF has no pages.", "পিডিএফটিতে কোনো পৃষ্ঠা নেই।"],
          password: ["That PDF is password-protected, so it can't be read here. Type the question instead.", "পিডিএফটি পাসওয়ার্ড দিয়ে সুরক্ষিত, তাই এখানে পড়া যাচ্ছে না। প্রশ্নটি লিখে দাও।"],
          corrupt: ["That file is damaged or isn't really a PDF, so nothing was read from it.", "ফাইলটি নষ্ট বা আসলে পিডিএফ নয়, তাই কিছু পড়া হয়নি।"],
          failed: ["That PDF couldn't be read. Nothing was taken from it; please type the question.", "পিডিএফটি পড়া যায়নি। কিছু নেওয়া হয়নি; প্রশ্নটি লিখে দাও।"],
        };
        setNote({ tone: "warn", text: tx(...m[r.kind]) });
      }
    } catch {
      setNote({ tone: "warn", text: tx("That PDF couldn't be read. Nothing was taken from it; please type the question.", "পিডিএফটি পড়া যায়নি। কিছু নেওয়া হয়নি; প্রশ্নটি লিখে দাও।") });
    } finally {
      setReading(false);
    }
  };

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    if (photoInput.current) photoInput.current.value = "";
    setRead(null);
    if (/heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) return setNote({ tone: "warn", text: tx("HEIC photos can't be read here. Set your camera to JPEG, or take a screenshot of the photo and use that.", "HEIC ছবি এখানে পড়া যায় না। ক্যামেরা JPEG-এ রাখো, অথবা ছবির স্ক্রিনশট নিয়ে সেটি দাও।") });
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setNote({ tone: "warn", text: tx("Use a JPEG, PNG or WebP photo.", "JPEG, PNG বা WebP ছবি দাও।") });
    if (f.size > MAX_PHOTO_BYTES) return setNote({ tone: "warn", text: tx("That photo is over 12 MB. Choose a smaller one.", "ছবিটি ১২ এমবির বেশি। ছোট ছবি বাছো।") });
    try {
      setPhoto(await preparePhoto(f));
      setNote(null);
    } catch {
      setNote({ tone: "warn", text: tx("That image couldn't be opened. Try another photo.", "ছবিটি খোলা যায়নি। অন্য ছবি চেষ্টা করো।") });
    }
  };

  const sendPhoto = async () => {
    if (!photo) return;
    setReading(true);
    setNote({ tone: "info", text: tx("Reading the photo…", "ছবি পড়ছি…") });
    const r = await call(readPhoto({ data: { mime: "image/jpeg", data: await blobToB64(photo.blob) } }), 40000);
    setReading(false);
    if (r.ok) {
      setRead({ text: r.text, uncertain: r.uncertain });
      setNote({ tone: "info", text: r.uncertain.length ? tx("Some parts were hard to read and are marked […]. Check them against your homework.", "কিছু অংশ পড়া কঠিন ছিল, […] দিয়ে চিহ্নিত। হোমওয়ার্কের সঙ্গে মিলিয়ে নাও।") : tx("Check that this is exactly your question.", "দেখো, এটিই হুবহু তোমার প্রশ্ন কি না।") });
      return;
    }
    const m: Record<string, [string, string]> = {
      photo_reading_off: ["Reading photos isn't switched on for IntelliHorizon yet, so the photo wasn't sent anywhere. Please type the question.", "ইন্টেলিহরাইজনে ছবি পড়া এখনো চালু হয়নি, তাই ছবিটি কোথাও পাঠানো হয়নি। প্রশ্নটি লিখে দাও।"],
      unreadable: ["I couldn't read a question in this photo clearly, so nothing was put in the box. Try a sharper, well-lit photo, or type it.", "ছবিতে প্রশ্নটি পরিষ্কার পড়তে পারিনি, তাই বক্সে কিছু দিইনি। আরও পরিষ্কার, আলোতে তোলা ছবি দাও, অথবা লেখো।"],
      reader_unavailable: ["The photo reader isn't responding right now. Nothing was put in the box; try again later or type the question.", "ছবি পড়ার ব্যবস্থা এখন সাড়া দিচ্ছে না। বক্সে কিছু দেওয়া হয়নি; পরে আবার চেষ্টা করো বা লেখো।"],
      too_large: ["That photo is too large even after shrinking it. Crop it to the question.", "ছোট করার পরও ছবিটি বড়। শুধু প্রশ্নের অংশটুকু কেটে নাও।"],
      bad_image: ["That file isn't a valid image.", "ফাইলটি সঠিক ছবি নয়।"],
      rate_limited: ["You've sent many photos in a short time. Try again later.", "অল্প সময়ে অনেক ছবি পাঠিয়েছ। পরে আবার চেষ্টা করো।"],
    };
    setNote({ tone: "warn", text: tx(...(m[r.code] ?? ["The photo couldn't be read. Nothing was put in the box.", "ছবিটি পড়া যায়নি। বক্সে কিছু দেওয়া হয়নি।"])) });
  };

  const btn = "inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-low/30 bg-sheet px-3 text-sm font-semibold text-ink-mid hover:border-ink hover:text-ink disabled:opacity-50";
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {voiceOk && (
          <>
            <button type="button" onClick={listen} disabled={disabled} aria-pressed={listening} className={`${btn} ${listening ? "border-brand text-brand" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              {listening ? tx("Stop", "থামাও") : tx("Speak", "বলে প্রশ্ন করো")}
            </button>
            <label className="sr-only" htmlFor="voice-lang">{tx("Speaking language", "বলার ভাষা")}</label>
            <select id="voice-lang" value={voiceLang} disabled={listening} onChange={(e) => setVoiceLang(e.target.value as "bn-BD")} className="h-9 rounded-full border border-ink-low/30 bg-sheet px-2 text-sm" title={tx("Speaking language", "বলার ভাষা")}>
              <option value="bn-BD">বাংলা</option>
              <option value="en-US">English</option>
            </select>
          </>
        )}
        <button type="button" onClick={() => pdfInput.current?.click()} disabled={disabled || reading} className={btn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
          <span className="sm:hidden" aria-hidden="true">PDF</span>
          <span className="sr-only sm:not-sr-only">{tx("Read from a PDF", "পিডিএফ থেকে পড়ো")}</span>
        </button>
        <button type="button" onClick={() => photoInput.current?.click()} disabled={disabled || reading} className={btn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="4" /></svg>
          <span className="sm:hidden" aria-hidden="true">{tx("Photo", "ছবি")}</span>
          <span className="sr-only sm:not-sr-only">{tx("Photo of a question", "প্রশ্নের ছবি")}</span>
        </button>
        <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-label={tx("Choose a PDF", "পিডিএফ বাছো")} onChange={(e) => void pickPdf(e.target.files?.[0])} />
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" tabIndex={-1} aria-label={tx("Choose a photo", "ছবি বাছো")} onChange={(e) => void pickPhoto(e.target.files?.[0])} />
      </div>
      {listening && <p role="status" className="text-sm text-brand">{tx("Listening… ask your question, then pause.", "শুনছি… প্রশ্ন বলো, তারপর থামো।")}{heard?.text ? ` "${heard.text}"` : ""}</p>}
      {!listening && heard?.text && (
        <div className="rounded-[14px] bg-paper p-3 text-sm">
          <p className="font-semibold">{tx("Did I hear you right?", "ঠিক শুনেছি?")}</p>
          <p className="mt-1 text-[15px]">{heard.text}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={btn} onClick={() => { onText(heard.text, "voice"); setHeard(null); setNote({ tone: "info", text: tx("Your words are in the box. Edit them if needed, then press Send.", "তোমার কথা বক্সে আছে। দরকার হলে ঠিক করে পাঠাও চাপো।") }); }}>{tx("Use these words", "এই কথাগুলো নাও")}</button>
            <button type="button" className={btn} onClick={() => setHeard(null)}>{tx("Discard", "বাদ দাও")}</button>
          </div>
        </div>
      )}
      {photo && (
        <div className="space-y-2 rounded-[14px] bg-paper p-3 text-sm">
          <img src={photo.url} alt={tx("Your photo", "তোমার ছবি")} className="max-h-48 rounded-[10px]" />
          {!read && (
            <>
              <p className="text-ink-mid">{photoOn === false
                ? tx("Reading photos isn't switched on for IntelliHorizon yet. The photo stays on your device.", "ইন্টেলিহরাইজনে ছবি পড়া এখনো চালু হয়নি। ছবিটি তোমার ডিভাইসেই আছে।")
                : tx("To read it, the photo is sent to IntelliHorizon's AI provider. The photo itself isn't kept; the words read from it are kept privately in your account for 30 days. Make sure it shows only the question: no faces or names.", "পড়ার জন্য ছবিটি ইন্টেলিহরাইজনের এআই সেবায় পাঠানো হবে। ছবিটি রাখা হয় না; এর থেকে পড়া কথাগুলো তোমার অ্যাকাউন্টে ৩০ দিন গোপনে থাকে। ছবিতে শুধু প্রশ্নটি থাকুক: কোনো মুখ বা নাম নয়।")}</p>
              <div className="flex gap-2">
                {photoOn !== false && <button type="button" className={btn} disabled={reading} onClick={() => void sendPhoto()}>{reading ? tx("Reading…", "পড়ছি…") : tx("Read this photo", "ছবিটি পড়ো")}</button>}
                <button type="button" className={btn} onClick={() => { setPhoto(null); setNote(null); }}>{tx("Remove", "সরাও")}</button>
              </div>
            </>
          )}
          {read && (
            <>
              <p className="font-semibold">{tx("Is this your question?", "এটিই কি তোমার প্রশ্ন?")}</p>
              <p className="text-[15px] whitespace-pre-wrap">{read.text}</p>
              {read.uncertain.length > 0 && <p className="text-ink-mid">{tx("Unsure readings: ", "অনিশ্চিত পাঠ: ")}{read.uncertain.join(", ")}</p>}
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={() => { onText(read.text, "photo"); setRead(null); setPhoto(null); setNote({ tone: "info", text: tx("The question is in the box. Fix anything marked […], then press Send.", "প্রশ্নটি বক্সে আছে। […] চিহ্নিত অংশ ঠিক করে পাঠাও চাপো।") }); }}>{tx("Yes, use it", "হ্যাঁ, নাও")}</button>
                <button type="button" className={btn} onClick={() => { setRead(null); setPhoto(null); setNote(null); }}>{tx("No, discard", "না, বাদ দাও")}</button>
              </div>
            </>
          )}
        </div>
      )}
      {note && <p role="status" className={`text-sm ${note.tone === "warn" ? "text-again" : "text-ink-mid"}`}>{note.text}</p>}
      {!voiceOk && <p className="text-xs text-ink-low">{tx("Speaking a question needs a browser with speech recognition (for example Chrome). Typing always works.", "কথা বলে প্রশ্ন করতে স্পিচ রিকগনিশনসহ ব্রাউজার (যেমন ক্রোম) লাগে। লিখে প্রশ্ন সবসময় করা যায়।")}</p>}
    </div>
  );
}
