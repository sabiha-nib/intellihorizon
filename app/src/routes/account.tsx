import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { AccountAvatar, AvatarEditor, uploadAvatar, type AvatarDraft } from "../components/auth/Avatar";
import { AuthButton, CurriculumPicker, DistrictCombobox, FormAlert, GradePicker, PasswordField, TextField } from "../components/auth/fields";
import { call } from "../components/auth/messages";
import { PaperPage } from "../components/edu/ui";
import { changePassword, checkUsername, deleteAccount, getAccount, requestEmailChange, resendVerification, setAvatarPreset, signOut, signOutEverywhere, updateProfile } from "../lib/api/auth.functions";
import { COUNTRIES, GOALS } from "../lib/auth/config";
import type { AccountSummary } from "../lib/auth/types";
import { normalizeUsername, validateEmail, validateName, validatePassword, validateProfile, validateUsername, type FieldErrors } from "../lib/auth/validation";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/account")({
  loader: async () => {
    const a = await getAccount();
    if (!a) throw redirect({ to: "/signin", search: { next: "/account" } });
    return a;
  },
  head: () => ({ meta: [{ title: "Your account | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-[22px] bg-sheet p-5 shadow-[0_1px_0_rgba(52,36,140,0.06),0_18px_40px_-28px_rgba(52,36,140,0.55)] sm:p-7">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      {desc && <p className="mt-1 text-[15px] text-ink-mid">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function useExpired() {
  const navigate = useNavigate();
  return (code: string) => {
    if (code === "signed_out") {
      void navigate({ to: "/signin", search: { next: "/account", notice: "expired" } });
      return true;
    }
    return false;
  };
}

function Photo({ a }: { a: AccountSummary }) {
  const { tx, refresh } = useLearner();
  const expired = useExpired();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const draft: AvatarDraft = a.avatar?.type === "preset" ? { kind: "preset", id: a.avatar.id } : { kind: "none" };
  const change = async (v: AvatarDraft) => {
    setBusy(true);
    setCode(null);
    setSaved(false);
    let r: { ok: boolean; code?: string };
    if (v.kind === "file") r = await uploadAvatar(v.blob);
    else if (v.kind === "preset") r = await call(setAvatarPreset({ data: { preset: v.id } }));
    else r = await call(fetch("/api/avatar", { method: "DELETE", credentials: "same-origin" }).then((x) => x.json() as Promise<{ ok: boolean; code?: string }>));
    if (v.kind === "file") URL.revokeObjectURL(v.url);
    setBusy(false);
    if (!r.ok) {
      if (!expired(r.code ?? "")) setCode(r.code ?? "upload_failed");
      return;
    }
    await refresh();
    setSaved(true);
  };
  return (
    <Section title={tx("Profile picture", "প্রোফাইল ছবি")} desc={tx("Only you can see your photo.", "তোমার ছবি শুধু তুমিই দেখতে পাও।")}>
      <AvatarEditor key={a.avatar ? JSON.stringify(a.avatar) : "none"} value={a.avatar?.type === "upload" ? { kind: "file", blob: new Blob(), url: `/api/avatar?v=${a.avatar.v}` } : draft} onChange={(v) => void change(v)} name={a.fullName} busy={busy} hideLabel />
      <p className="mt-3 text-sm font-medium text-ink-mid" aria-live="polite">{busy ? tx("Saving…", "সংরক্ষণ হচ্ছে…") : saved ? tx("Saved.", "সংরক্ষিত।") : ""}</p>
      {code && <div className="mt-4"><FormAlert code={code} /></div>}
    </Section>
  );
}

function Profile({ a }: { a: AccountSummary }) {
  const { tx, refresh } = useLearner();
  const expired = useExpired();
  const init = () => ({ fullName: a.fullName, username: a.username, school: a.school, country: a.country, district: a.district, region: a.region, grade: a.grade as number | null, curriculum: a.curriculum, curriculumOther: a.curriculumOther, curriculumOtherText: a.curriculumOtherText, explainLang: a.explainLang, goals: a.goals as ("exam" | "understand" | "catch_up" | "get_ahead")[] });
  const [f, setF] = useState(init);
  const [server, setServer] = useState<FieldErrors>({});
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(false);
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    const u = normalizeUsername(f.username);
    setTaken(false);
    if (u === a.username || validateUsername(u)) return;
    const timer = setTimeout(async () => {
      const r = await call(checkUsername({ data: { username: u } }), 8000);
      if (r.ok && !r.available) setTaken(true);
    }, 450);
    return () => clearTimeout(timer);
  }, [f.username, a.username]);
  const local: FieldErrors = { ...validateProfile(f) };
  const n = validateName(f.fullName); if (n) local.fullName = n;
  const u = validateUsername(f.username); if (u) local.username = u; else if (taken) local.username = "username_taken";
  const show = (k: string) => server[k] ?? (attempted ? local[k] : undefined);
  const set = (p: Partial<ReturnType<typeof init>>) => { setF((x) => ({ ...x, ...p })); setSaved(false); setCode(null); setServer({}); };
  const dirty = JSON.stringify(f) !== JSON.stringify(init());
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(local).length || busy) return;
    setBusy(true);
    const r = await call(updateProfile({ data: f }));
    setBusy(false);
    if (!r.ok) {
      if (expired(r.code)) return;
      if (r.fields) setServer(r.fields);
      else setCode(r.code);
      return;
    }
    await refresh();
    setSaved(true);
  };
  return (
    <Section title={tx("Profile", "প্রোফাইল")} desc={tx("Private to you. Class and curriculum shape which chapters you see.", "শুধু তোমার জন্য। শ্রেণি ও পাঠ্যক্রম অনুযায়ী অধ্যায় দেখানো হয়।")}>
      <form onSubmit={submit} noValidate className="space-y-6">
        <TextField label={tx("Full name", "পুরো নাম")} autoComplete="name" value={f.fullName} maxLength={120} onChange={(e) => set({ fullName: e.target.value })} error={show("fullName")} />
        <TextField label={tx("Username", "ইউজারনেম")} autoComplete="username" autoCapitalize="none" spellCheck={false} value={f.username} maxLength={30} onChange={(e) => set({ username: e.target.value })} error={show("username") ?? (taken ? "username_taken" : null)} />
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">{tx("Country", "দেশ")}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-1.5 rounded-[14px] bg-paper p-1.5">
            {COUNTRIES.map((c) => (
              <button key={c.code} type="button" role="radio" aria-checked={f.country === c.code} onClick={() => set({ country: c.code })} className={`h-11 rounded-[10px] text-[15px] font-semibold ${f.country === c.code ? "bg-sheet shadow-[0_1px_2px_rgba(52,36,140,0.18)]" : "text-ink-mid"}`}>{tx(c.label.en, c.label.bn)}</button>
            ))}
          </div>
        </fieldset>
        {f.country === "BD" ? <DistrictCombobox value={f.district} onChange={(d) => set({ district: d })} error={show("district")} /> : <TextField label={tx("State or region", "রাজ্য বা অঞ্চল")} optional value={f.region} maxLength={80} onChange={(e) => set({ region: e.target.value })} error={show("region")} />}
        <TextField label={tx("School", "স্কুল")} optional autoComplete="organization" value={f.school} maxLength={120} onChange={(e) => set({ school: e.target.value })} error={show("school")} />
        <GradePicker value={f.grade} onChange={(g) => set({ grade: g })} error={show("grade")} />
        <CurriculumPicker value={f.curriculum} other={f.curriculumOther} otherText={f.curriculumOtherText} onChange={(p) => set(p)} errors={{ curriculum: show("curriculum"), curriculumOther: show("curriculumOther"), curriculumOtherText: show("curriculumOtherText") }} />
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">{tx("Explain things to me in", "আমাকে বোঝাও")}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-1.5 rounded-[14px] bg-paper p-1.5">
            {(["bn", "en"] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={(f.explainLang ?? "en") === l} onClick={() => set({ explainLang: l })} className={`h-11 rounded-[10px] text-[15px] font-semibold ${(f.explainLang ?? "en") === l ? "bg-sheet shadow-[0_1px_2px_rgba(52,36,140,0.18)]" : "text-ink-mid"}`} lang={l}>{l === "bn" ? "বাংলা" : "English"}</button>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-mid">{tx("This is the language of IntelliHorizon's guidance. Textbook excerpts stay in your textbook's language.", "এটি ইন্টেলিহরাইজনের নির্দেশনার ভাষা। পাঠ্যবইয়ের অংশ তোমার বইয়ের ভাষাতেই থাকে।")}</p>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">{tx("My goals", "আমার লক্ষ্য")} <span className="text-xs font-medium text-ink-low">{tx("Optional", "ঐচ্ছিক")}</span></legend>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((gl) => {
              const on = f.goals.includes(gl.id as never);
              return (
                <button key={gl.id} type="button" aria-pressed={on} onClick={() => set({ goals: on ? f.goals.filter((x) => x !== gl.id) : [...f.goals, gl.id as never] })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${on ? "border-brand bg-brand text-sheet" : "border-ink-low/35 hover:border-ink"}`}>{tx(gl.label.en, gl.label.bn)}</button>
              );
            })}
          </div>
        </fieldset>
        {code && <FormAlert code={code} />}
        {saved && <FormAlert tone="success">{tx("Profile saved.", "প্রোফাইল সংরক্ষিত হয়েছে।")}</FormAlert>}
        <AuthButton loading={busy} loadingLabel={tx("Saving…", "সংরক্ষণ হচ্ছে…")} disabled={!dirty}>{tx("Save changes", "পরিবর্তন সংরক্ষণ")}</AuthButton>
      </form>
    </Section>
  );
}

function Email({ a }: { a: AccountSummary }) {
  const { tx, lang, refresh } = useLearner();
  const expired = useExpired();
  const [resend, setResend] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [errs, setErrs] = useState<FieldErrors>({});
  const [code, setCode] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const doResend = async () => {
    setResend("busy");
    const r = await call(resendVerification({ data: { lang } }));
    if (!r.ok) { if (!expired(r.code)) setResend(r.code); return; }
    setResend(r.delivery);
  };
  const change = async (e: FormEvent) => {
    e.preventDefault();
    const local: FieldErrors = {};
    const m = validateEmail(email); if (m) local.email = m;
    if (!pw) local.password = "password_required";
    setErrs(local);
    if (Object.keys(local).length || busy) return;
    setBusy(true);
    setCode(null);
    const r = await call(requestEmailChange({ data: { email, password: pw, lang } }));
    setBusy(false);
    setPw("");
    if (!r.ok) { if (expired(r.code)) return; if (r.fields) setErrs(r.fields); else setCode(r.code); return; }
    setSent(email.trim());
    setOpen(false);
    await refresh();
  };
  return (
    <Section title={tx("Email", "ইমেইল")} desc={tx("Used to sign in and recover your account. Never shown to other students.", "সাইন ইন ও অ্যাকাউন্ট উদ্ধারের জন্য। অন্য শিক্ষার্থীদের দেখানো হয় না।")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all text-[17px] font-semibold">{a.email}</p>
          <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${a.emailVerified ? "text-right" : "text-[#8a5a12]"}`}>
            <span aria-hidden="true">{a.emailVerified ? "✓" : "!"}</span>
            {a.emailVerified ? tx("Confirmed", "নিশ্চিত") : tx("Not confirmed yet", "এখনো নিশ্চিত হয়নি")}
          </p>
        </div>
        {!a.emailVerified && (
          <div className="w-full sm:w-auto"><AuthButton type="button" tone="quiet" loading={resend === "busy"} onClick={() => void doResend()}>{tx("Send confirmation link", "নিশ্চিতকরণ লিংক পাঠাও")}</AuthButton></div>
        )}
      </div>
      {a.pendingEmail && <p className="mt-3 text-sm text-ink-mid">{tx(`Waiting for you to confirm ${a.pendingEmail}. Your sign-in email changes only after you open that link.`, `${a.pendingEmail} নিশ্চিত করার অপেক্ষায়। লিংক খোলার পরেই সাইন-ইন ইমেইল বদলাবে।`)}</p>}
      {sent && <div className="mt-4"><FormAlert tone="success">{tx(`We sent a link to ${sent}. Open it to finish the change.`, `${sent}-এ লিংক পাঠানো হয়েছে। পরিবর্তন শেষ করতে লিংকটি খোলো।`)}</FormAlert></div>}
      {resend && resend !== "busy" && (
        <div className="mt-4">
          {resend === "sent" ? <FormAlert tone="success">{tx("Link sent. It works for 24 hours.", "লিংক পাঠানো হয়েছে। ২৪ ঘণ্টা কার্যকর।")}</FormAlert>
          : resend === "not_configured" ? <FormAlert code="email_not_configured" />
          : resend === "already" ? <FormAlert tone="success">{tx("Your email is already confirmed.", "তোমার ইমেইল আগেই নিশ্চিত।")}</FormAlert>
          : <FormAlert code={resend === "failed" ? "unknown" : resend} />}
        </div>
      )}
      <div className="mt-5 border-t border-ink-low/15 pt-5">
        {!a.emailDelivery ? (
          <p className="text-sm text-ink-mid">{tx("Changing your email needs email confirmation, which isn't switched on yet.", "ইমেইল বদলাতে ইমেইল নিশ্চিতকরণ লাগে, যা এখনো চালু হয়নি।")}</p>
        ) : !open ? (
          <button type="button" onClick={() => setOpen(true)} className="font-semibold underline decoration-dashed underline-offset-4">{tx("Change email", "ইমেইল বদলাও")}</button>
        ) : (
          <form onSubmit={change} noValidate className="edu-rise space-y-5">
            <TextField label={tx("New email", "নতুন ইমেইল")} type="email" autoComplete="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} error={errs.email} />
            <PasswordField label={tx("Current password", "বর্তমান পাসওয়ার্ড")} value={pw} onChange={setPw} autoComplete="current-password" error={errs.password} />
            {code && <FormAlert code={code} />}
            <div className="flex gap-3"><AuthButton loading={busy}>{tx("Send link", "লিংক পাঠাও")}</AuthButton><AuthButton type="button" tone="quiet" onClick={() => setOpen(false)}>{tx("Cancel", "বাতিল")}</AuthButton></div>
          </form>
        )}
      </div>
    </Section>
  );
}

function Security() {
  const { tx, refresh } = useLearner();
  const expired = useExpired();
  const navigate = useNavigate();
  const [cur, setCur] = useState("");
  const [nx, setNx] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errs, setErrs] = useState<FieldErrors>({});
  const [code, setCode] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState<"pw" | "out" | "all" | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: FieldErrors = {};
    if (!cur) local.current = "password_required";
    const p = validatePassword(nx); if (p) local.next = p;
    if (!p && confirm !== nx) local.confirm = "password_mismatch";
    setErrs(local);
    setOk(false);
    if (Object.keys(local).length || busy) return;
    setBusy("pw");
    const r = await call(changePassword({ data: { current: cur, next: nx } }));
    setBusy(null);
    setCur("");
    if (!r.ok) { if (expired(r.code)) return; if (r.fields) setErrs(r.fields); else setCode(r.code); return; }
    setNx("");
    setConfirm("");
    setOk(true);
  };
  const out = async (all: boolean) => {
    setBusy(all ? "all" : "out");
    const r = await call(all ? signOutEverywhere() : signOut());
    try { await caches.delete("edu-pages-v2"); } catch { /* no cache api */ }
    setBusy(null);
    if (!r.ok && r.code !== "signed_out") { setCode(r.code); return; }
    await refresh();
    void navigate({ to: "/" });
  };
  return (
    <Section title={tx("Security", "নিরাপত্তা")}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <h3 className="text-[15px] font-semibold">{tx("Change password", "পাসওয়ার্ড বদলাও")}</h3>
        <PasswordField label={tx("Current password", "বর্তমান পাসওয়ার্ড")} value={cur} onChange={setCur} autoComplete="current-password" error={errs.current} />
        <PasswordField label={tx("New password", "নতুন পাসওয়ার্ড")} value={nx} onChange={setNx} autoComplete="new-password" meter error={errs.next} />
        <PasswordField label={tx("Confirm new password", "নতুন পাসওয়ার্ড আবার লেখো")} value={confirm} onChange={setConfirm} autoComplete="new-password" error={errs.confirm} />
        {code && <FormAlert code={code} />}
        {ok && <FormAlert tone="success">{tx("Password changed. Other devices have been signed out.", "পাসওয়ার্ড বদলেছে। অন্য ডিভাইসগুলো থেকে সাইন আউট করা হয়েছে।")}</FormAlert>}
        <AuthButton loading={busy === "pw"} loadingLabel={tx("Saving…", "সংরক্ষণ হচ্ছে…")}>{tx("Update password", "পাসওয়ার্ড আপডেট")}</AuthButton>
      </form>
      <div className="mt-6 grid gap-3 border-t border-ink-low/15 pt-6 sm:grid-cols-2">
        <AuthButton type="button" tone="quiet" loading={busy === "out"} onClick={() => void out(false)}>{tx("Sign out", "সাইন আউট")}</AuthButton>
        <AuthButton type="button" tone="quiet" loading={busy === "all"} onClick={() => void out(true)}>{tx("Sign out everywhere", "সব জায়গা থেকে সাইন আউট")}</AuthButton>
      </div>
      <p className="mt-3 text-sm text-ink-mid">{tx("Signing out keeps your account and your sky. On a shared phone, always sign out when you finish.", "সাইন আউট করলে অ্যাকাউন্ট ও আকাশ থেকেই যায়। শেয়ার করা ফোনে কাজ শেষে সবসময় সাইন আউট করো।")}</p>
    </Section>
  );
}

function Danger() {
  const { tx, refresh } = useLearner();
  const expired = useExpired();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return setErr("password_required");
    setBusy(true);
    const r = await call(deleteAccount({ data: { password: pw } }));
    setBusy(false);
    setPw("");
    if (!r.ok) { if (expired(r.code)) return; setErr(r.fields?.password ?? r.code); return; }
    try { await caches.delete("edu-pages-v2"); } catch { /* ignore */ }
    await refresh();
    void navigate({ to: "/" });
  };
  return (
    <Section title={tx("Delete account", "অ্যাকাউন্ট মুছে ফেলো")} desc={tx("This permanently deletes your account, profile, photo and all learning progress. It can't be undone. Signing out is different: it keeps everything.", "এতে তোমার অ্যাকাউন্ট, প্রোফাইল, ছবি আর শেখার সব অগ্রগতি স্থায়ীভাবে মুছে যাবে। ফেরানো যাবে না। সাইন আউট আলাদা: তাতে সব থেকে যায়।")}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-again underline decoration-dashed underline-offset-4">{tx("I want to delete my account", "আমি অ্যাকাউন্ট মুছতে চাই")}</button>
      ) : (
        <form onSubmit={submit} noValidate className="edu-rise space-y-5">
          <PasswordField label={tx("Enter your password to confirm", "নিশ্চিত করতে পাসওয়ার্ড দাও")} value={pw} onChange={(v) => { setPw(v); setErr(null); }} autoComplete="current-password" error={err} />
          <div className="grid gap-3 sm:grid-cols-2">
            <AuthButton tone="danger" loading={busy} loadingLabel={tx("Deleting…", "মুছে ফেলা হচ্ছে…")}>{tx("Delete permanently", "স্থায়ীভাবে মুছে ফেলো")}</AuthButton>
            <AuthButton type="button" tone="quiet" onClick={() => setOpen(false)}>{tx("Keep my account", "অ্যাকাউন্ট রেখে দাও")}</AuthButton>
          </div>
        </form>
      )}
    </Section>
  );
}

function Account() {
  const loaded = Route.useLoaderData();
  const { account, tx, lang } = useLearner();
  const a = account ?? loaded;
  const since = new Date(a.createdAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { year: "numeric", month: "long" });
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-6 md:px-6">
        <header className="flex items-center gap-4">
          <AccountAvatar avatar={a.avatar} name={a.fullName} size={64} />
          <div className="min-w-0">
            <h1 className="font-display truncate text-3xl font-bold tracking-tight">{a.fullName}</h1>
            <p className="truncate text-ink-mid">@{a.username} · {tx(`Joined ${since}`, `যোগ দিয়েছ ${since}`)}</p>
          </div>
        </header>
        <Photo a={a} />
        <Profile a={a} />
        <Email a={a} />
        <Security />
        <Section title={tx("Who can see your profile", "তোমার প্রোফাইল কে দেখতে পারে")}>
          <p className="leading-relaxed text-ink-mid">{tx("Only you. IntelliHorizon has no public profiles yet. Your email, school and district are never shown to other students. Teacher and family sharing are separate choices in your ", "শুধু তুমি। ইন্টেলিহরাইজনে এখনো কোনো পাবলিক প্রোফাইল নেই। তোমার ইমেইল, স্কুল ও জেলা অন্য শিক্ষার্থীদের কখনো দেখানো হয় না। শিক্ষক ও পরিবারের সাথে শেয়ার করা আলাদা পছন্দ, তোমার ")}<Link to="/mirror" className="font-semibold text-ink underline decoration-dashed underline-offset-4">{tx("Mirror", "আয়না")}</Link>{tx(".", "-তে।")}</p>
        </Section>
        <Danger />
      </main>
    </PaperPage>
  );
}
