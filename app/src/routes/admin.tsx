import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { call } from "../components/auth/messages";
import { Importer } from "../components/admin/Importer";
import { PackImporter } from "../components/admin/PackImporter";
import { Structure } from "../components/admin/Structure";
import { PageHeader, SignInPrompt, card } from "../components/app/kit";
import { PaperPage } from "../components/edu/ui";
import { Audit } from "../components/admin/Audit";
import { OcrQc } from "../components/admin/OcrQc";
import { Review } from "../components/admin/Review";
import { Coverage } from "../components/admin/Coverage";
import { PassageReview } from "../components/admin/PassageReview";
import { TopicAdmin } from "../components/admin/TopicAdmin";
import { StudioAdmin } from "../components/admin/StudioAdmin";
import { AiUsage } from "../components/admin/AiUsage";
import { JudgeAdmin } from "../components/admin/JudgeAdmin";
import { ProviderEval } from "../components/admin/ProviderEval";
import { aiAdminStatus } from "../lib/api/review.functions";
import { adminStatus, claimAdmin, importHistory, listBooks, previewPage, saveBook, setBookStatus, type AdminBook, type Row } from "../lib/api/admin.functions";
import { SUBJECT_KEYS } from "../lib/curriculum/config";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Curriculum admin | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const f = "h-10 w-full rounded-[10px] border border-ink-low/35 bg-sheet px-3 text-[15px] outline-none focus:border-ink";
type Form = { grade: number; medium: "bangla" | "english"; subjectKey: string; subjectName: string; paper: string; title: string; language: "bn" | "en"; edition: string; officialUrl: string; licenseStatus: "permission_pending" | "permitted" | "restricted"; licenseNote: string; pageOffset: string };
const empty: Form = { grade: 7, medium: "bangla", subjectKey: "mathematics", subjectName: "", paper: "", title: "", language: "bn", edition: "", officialUrl: "", licenseStatus: "permission_pending", licenseNote: "", pageOffset: "" };

function Admin() {
  const [status, setStatus] = useState<{ signedIn: boolean; admin: boolean; configured: boolean; codeAvailable: boolean } | null>(null);
  const [tab, setTab] = useState<"coverage" | "passages" | "topics" | "studio" | "books" | "review" | "ocr" | "audit" | "ai" | "judge">("books");
  const [reviewBook, setReviewBook] = useState<string | null>(null);
  const [ai, setAi] = useState<{ ai: { configured: boolean; provider: string | null; model: string | null; vision: boolean }; providers: { id: string; label: string; configured: boolean; model: string | null }[]; today: { status: string; n: number }[]; email: { configured: boolean } } | null>(null);
  const [token, setToken] = useState("");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [hist, setHist] = useState<{ jobs: Row[]; quality: { quality: string; n: number }[]; flagged: Row[] } | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);

  const load = async () => {
    const r = await call(listBooks());
    if (r.ok) setBooks(r.books);
  };
  const loadHist = async (id: string) => {
    const r = await call(importHistory({ data: { textbookId: id } }));
    setHist(r.ok ? r : null);
  };
  useEffect(() => { void call(adminStatus()).then((s) => { setStatus(s as never); if ((s as { admin: boolean }).admin) { void load(); void call(aiAdminStatus()).then((r) => r.ok && setAi(r as never)); } }); }, []);
  useEffect(() => {
    const b = books.find((x) => x.id === sel);
    if (b) {
      setForm({ grade: b.grade, medium: b.medium as "bangla", subjectKey: b.subject_key, subjectName: b.subject_name, paper: b.paper, title: b.title, language: b.language as "bn", edition: b.edition ?? "", officialUrl: b.official_url ?? "", licenseStatus: b.license_status as "permission_pending", licenseNote: b.license_note ?? "", pageOffset: b.page_offset === null ? "" : String(b.page_offset) });
      void loadHist(b.id);
    } else { setForm(empty); setHist(null); }
    setPreview(null);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!status) return <PaperPage><main className="mx-auto max-w-5xl px-4 pt-6"><div className={`${card} h-40 animate-pulse`} /></main></PaperPage>;
  if (!status.signedIn) return <PaperPage><main className="mx-auto max-w-3xl px-4 pt-6"><SignInPrompt next="/admin" why={{ en: "Sign in with the account that will manage curriculum imports.", bn: "যে অ্যাকাউন্ট দিয়ে পাঠ্যক্রম আমদানি পরিচালনা করবে, সেটি দিয়ে সাইন ইন করো।" }} /></main></PaperPage>;
  if (!status.admin) {
    return (
      <PaperPage>
        <main className="mx-auto max-w-xl space-y-5 px-4 pt-6">
          <PageHeader title="Curriculum admin" subtitle="This area is for adding NCTB textbooks to IntelliHorizon." />
          <div className={`${card} space-y-2 p-5 text-ink-mid`}>
            <p>Administrator access is never given by signing up. It is unlocked for a signed-in account with either:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>the one-time owner code given privately to the site owner{status.codeAvailable ? " (still unused)" : " (already used)"}, or</li>
              <li>the EDU_ADMIN_TOKEN secret, if the owner has set it in the website settings{status.configured ? "" : " (not set)"}.</li>
            </ul>
            <p>Every attempt, successful or not, is recorded in the audit log.</p>
          </div>
          {(status.codeAvailable || status.configured) && (
            <form className={`${card} space-y-3 p-5`} onSubmit={async (e) => { e.preventDefault(); const r = await call(claimAdmin({ data: { token } })); setToken(""); if (r.ok) { setClaimMsg(null); setStatus({ ...status, admin: true }); void load(); void call(aiAdminStatus()).then((x) => x.ok && setAi(x as never)); } else setClaimMsg(r.code === "wrong_token" ? "That code isn't valid, or it has already been used." : r.code === "rate_limited" ? "Too many attempts. Try again in an hour." : r.code === "demo_account" ? "This is a judge demo workspace, so it can't become an administrator." : r.code); }}>
              <label className="block text-sm font-semibold" htmlFor="tok">Owner code or admin token</label>
              <input id="tok" type="password" autoComplete="off" className={f} value={token} onChange={(e) => setToken(e.target.value)} />
              <button type="submit" className="h-10 rounded-[10px] bg-brand px-4 font-semibold text-sheet">Unlock admin for this account</button>
              {claimMsg && <p className="text-sm text-again" role="alert">{claimMsg}</p>}
            </form>
          )}
        </main>
      </PaperPage>
    );
  }

  const current = books.find((b) => b.id === sel) ?? null;
  const submitBook = async () => {
    setFormMsg(null);
    const r = await call(saveBook({ data: { id: sel, book: { ...form, edition: form.edition || null, officialUrl: form.officialUrl || null, licenseNote: form.licenseNote || null, pageOffset: form.pageOffset === "" ? null : Number(form.pageOffset) } } }));
    if (!r.ok) {
      const m: Record<string, string> = { religion_excluded: "Religion subjects are out of scope in this phase.", official_url_not_nctb: "The official link must be on nctb.gov.bd.", duplicate_book: "A book for this class, version, subject and paper already exists.", subject_key_invalid: "Choose one of the eight registry subjects.", class_not_offered: "Only Class 7 (Bangla medium or English version) is offered." };
      return setFormMsg(m[r.code] ?? `Not saved: ${r.code}`);
    }
    setFormMsg("Saved.");
    await load();
    setSel(r.id);
  };

  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-6 md:px-6">
        <PageHeader title="Content Studio" subtitle="Import and check textbook text, review practice questions, and see every administrative action. Students only ever see text and questions that have been approved here." />
        <div role="tablist" aria-label="Content Studio" className="flex flex-wrap gap-2">
          {([["books", "Books and import"], ["coverage", "Coverage"], ["passages", "Passage review"], ["topics", "Topics"], ["studio", "Formulas, links and AI drafts"], ["review", "Question review"], ["ocr", "OCR quality"], ["ai", "AI providers"], ["judge", "Judge demo"], ["audit", "Audit log"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-11 rounded-[12px] border-2 px-4 font-semibold ${tab === k ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-sheet"}`}>{l}</button>
          ))}
        </div>
        {tab === "coverage" && (
          <section className={`${card} space-y-4 p-5`}>
            {ai && (
              <div className="rounded-[14px] bg-paper p-3 text-sm">
                <p><b>AI explanations:</b> {ai.ai.configured ? `on: ${ai.providers.filter((p) => p.configured).map((p) => `${p.label} (${p.model})`).join(", ")}${ai.ai.vision ? "; photo reading on" : "; photo reading off"}` : "off. Set ANTHROPIC_API_KEY + ANTHROPIC_MODEL, GEMINI_API_KEY + GEMINI_MODEL and/or OPENAI_API_KEY + OPENAI_MODEL in the website secrets and redeploy. Until then the tutor shows checked textbook text only."}{ai.today.length ? ` · today: ${ai.today.map((x) => `${x.n} ${x.status}`).join(", ")}` : ""}</p>
                <p><b>Account email:</b> {ai.email.configured ? "configured (RESEND_API_KEY and EMAIL_FROM are set)" : "not configured: RESEND_API_KEY and EMAIL_FROM are missing, so verification and password-reset emails cannot be sent."}</p>
              </div>
            )}
            <Coverage onOpenBook={(id) => { setReviewBook(id); setTab("passages"); }} />
          </section>
        )}
        {tab === "passages" && <section className={`${card} p-5`}><PassageReview books={books.map((b) => ({ id: b.id, title: b.title, subject_name: b.subject_name }))} initialBook={reviewBook} /></section>}
        {tab === "topics" && <section className={`${card} p-5`}><TopicAdmin books={books.map((b) => ({ id: b.id, title: b.title, subject_name: b.subject_name }))} /></section>}
        {tab === "studio" && <section className={`${card} p-5`}><StudioAdmin /></section>}
        {tab === "review" && <section className={`${card} p-5`}><Review /></section>}
        {tab === "audit" && <section className={`${card} p-5`}><Audit /></section>}
        {tab === "ai" && <><section className={`${card} p-5`}><AiUsage /></section><section className={`${card} mt-4 p-5`}><ProviderEval /></section></>}
        {tab === "judge" && <section className={`${card} p-5`}><JudgeAdmin /></section>}
        {tab === "ocr" && (
          <section className={`${card} space-y-4 p-5`}>
            <label className="block text-sm font-semibold">Book
              <select className={`${f} mt-1 max-w-md`} value={sel ?? ""} onChange={(e) => setSel(e.target.value || null)}>
                <option value="">Choose a book</option>
                {books.map((b) => <option key={b.id} value={b.id}>{b.subject_name}{b.paper ? ` (${b.paper})` : ""}: {b.title}</option>)}
              </select>
            </label>
            {current ? <OcrQc textbookId={current.id} language={current.language} offset={current.page_offset} /> : <p className="text-ink-mid">Choose a book. Mathematics is where OCR needs the most checking.</p>}
          </section>
        )}
        {tab === "books" && <>
        <section className={`${card} space-y-3 p-5`} aria-labelledby="pack-h">
          <h2 id="pack-h" className="font-display text-xl font-bold">Import the Class 7 OCR text pack</h2>
          <PackImporter onDone={() => void load()} />
        </section>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`${card} p-4`}>
            <div className="flex items-center justify-between"><h2 className="font-semibold">Textbooks ({books.length})</h2><button type="button" onClick={() => setSel(null)} className="text-sm font-semibold underline">New</button></div>
            <ul className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto text-sm">
              {books.map((b) => (
                <li key={b.id}><button type="button" onClick={() => setSel(b.id)} className={`w-full rounded-[10px] px-3 py-2 text-left ${sel === b.id ? "bg-brand text-sheet" : "hover:bg-paper"}`}>
                  <span className="block font-semibold">Class {b.grade} · {b.medium === "bangla" ? "BN" : "EN"} · {b.subject_name}{b.paper ? ` (${b.paper})` : ""}</span>
                  <span className="block text-xs opacity-80">{b.status.replace(/_/g, " ")} · {b.passages} passages · {b.chapters} ch · {b.questions} q</span>
                </button></li>
              ))}
            </ul>
          </aside>
          <div className="space-y-6">
            <section className={`${card} space-y-4 p-5`}>
              <h2 className="font-display text-xl font-bold">{current ? "Textbook details" : "Register a textbook"}</h2>
              <p className="text-sm text-ink-mid">Copy title, subject name, paper and edition exactly as printed on the book. Leave anything you can't confirm empty.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-semibold">Class<select className={`${f} mt-1`} value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}>{[7].map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
                <label className="text-sm font-semibold">Version<select className={`${f} mt-1`} value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value as "bangla" })}><option value="bangla">Bangla medium</option><option value="english">English version</option></select></label>
                <label className="text-sm font-semibold">Book language<select className={`${f} mt-1`} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as "bn" })}><option value="bn">Bangla</option><option value="en">English</option></select></label>
                <label className="text-sm font-semibold">Subject (registry)<select className={`${f} mt-1`} value={form.subjectKey} onChange={(e) => setForm({ ...form, subjectKey: e.target.value })}>{SUBJECT_KEYS.map((s) => <option key={s.key} value={s.key}>{s.label.en}</option>)}</select></label>
                <label className="text-sm font-semibold">Subject name as printed<input className={`${f} mt-1`} value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} /></label>
                <label className="text-sm font-semibold">Paper (if any)<input className={`${f} mt-1`} value={form.paper} placeholder="e.g. 1st paper" onChange={(e) => setForm({ ...form, paper: e.target.value })} /></label>
                <label className="text-sm font-semibold sm:col-span-2">Title as printed<input className={`${f} mt-1`} value={form.title} lang={form.language} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                <label className="text-sm font-semibold">Edition as printed<input className={`${f} mt-1`} value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} /></label>
                <label className="text-sm font-semibold sm:col-span-2">Official page on nctb.gov.bd<input className={`${f} mt-1`} value={form.officialUrl} placeholder="https://nctb.gov.bd/..." onChange={(e) => setForm({ ...form, officialUrl: e.target.value })} /></label>
                <label className="text-sm font-semibold">PDF pages before printed page 1<input className={`${f} mt-1`} value={form.pageOffset} placeholder="Unknown" onChange={(e) => setForm({ ...form, pageOffset: e.target.value })} /></label>
                <label className="text-sm font-semibold">Permission<select className={`${f} mt-1`} value={form.licenseStatus} onChange={(e) => setForm({ ...form, licenseStatus: e.target.value as "permitted" })}><option value="permission_pending">NCTB permission pending</option><option value="permitted">Written NCTB permission received</option><option value="restricted">Restricted: do not show</option></select></label>
                <label className="text-sm font-semibold sm:col-span-2">Permission note<input className={`${f} mt-1`} value={form.licenseNote} onChange={(e) => setForm({ ...form, licenseNote: e.target.value })} /></label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void submitBook()} className="h-10 rounded-[10px] bg-brand px-4 font-semibold text-sheet">{current ? "Save details" : "Register textbook"}</button>
                {formMsg && <span className="text-sm" role="status">{formMsg}</span>}
              </div>
            </section>
            {current && (
              <>
                <section className={`${card} space-y-4 p-5`}>
                  <h2 className="font-display text-xl font-bold">Import text</h2>
                  <Importer textbookId={current.id} onDone={() => { void load(); void loadHist(current.id); }} />
                  {hist && (
                    <div className="space-y-3 text-sm">
                      <p><span className="font-semibold">Status:</span> {current.status.replace(/_/g, " ")} · {current.passages} passages · page quality: {hist.quality.map((q) => `${q.quality.replace("_", " ")} ${q.n}`).join(", ") || "not imported"}</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={async () => { const r = await call(setBookStatus({ data: { id: current.id, status: "indexed" } })); if (r.ok) void load(); else alert(r.code === "nothing_indexed" ? "Nothing has been indexed for this book yet." : r.code); }} className="h-9 rounded-[10px] bg-right px-3 font-semibold text-sheet">Approve for the tutor</button>
                        <button type="button" onClick={async () => { await call(setBookStatus({ data: { id: current.id, status: "needs_review" } })); void load(); }} className="h-9 rounded-[10px] border border-ink-low/35 px-3 font-semibold">Hold for review</button>
                        <button type="button" onClick={async () => { if (confirm("Retire this book? Students will no longer see it.")) { await call(setBookStatus({ data: { id: current.id, status: "retired" } })); void load(); } }} className="h-9 rounded-[10px] px-3 font-semibold text-again">Retire</button>
                      </div>
                      {hist.flagged.length > 0 && (
                        <details>
                          <summary className="cursor-pointer font-semibold">Flagged pages ({hist.flagged.length})</summary>
                          <ul className="mt-2 flex flex-wrap gap-1.5">{hist.flagged.map((p) => <li key={String(p.page)}><button type="button" onClick={async () => { const r = await call(previewPage({ data: { textbookId: current.id, page: Number(p.page) } })); setPreview(r.ok ? r.page : null); }} className="rounded-full border border-ink-low/30 px-2.5 py-0.5 text-xs">p.{String(p.page)} {String(p.quality).replace("_", " ")}{p.confidence !== null && p.confidence !== undefined ? ` · ${Math.round(Number(p.confidence))}%` : ""}</button></li>)}</ul>
                        </details>
                      )}
                      {preview && <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-[10px] bg-paper p-3 text-xs" lang={current.language}>Page {String(preview.page)} ({String(preview.quality)}):{"\n"}{String(preview.text) || "(no text)"}</pre>}
                      {hist.jobs.length > 0 && <p className="text-ink-mid">Last import: {String(hist.jobs[0].status).replace(/_/g, " ")}, {String(hist.jobs[0].pages_received)} of {String(hist.jobs[0].pages_total)} pages received, {String(hist.jobs[0].started_at).slice(0, 16).replace("T", " ")}.</p>}
                    </div>
                  )}
                </section>
                <section className={`${card} p-5`}>
                  <Structure textbookId={current.id} language={current.language as "bn"} />
                </section>
              </>
            )}
          </div>
        </div>
        </>}
      </main>
    </PaperPage>
  );
}
