import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import { AuthLayout } from "../components/auth/AuthLayout";
import { AvatarEditor, PresetArt, initials, uploadAvatar, type AvatarDraft } from "../components/auth/Avatar";
import { AuthButton, CurriculumPicker, DistrictCombobox, FormAlert, GradePicker, PasswordField, TextField } from "../components/auth/fields";
import { call, msg } from "../components/auth/messages";
import { districtByCode } from "../content/districts";
import { checkUsername, register } from "../lib/api/auth.functions";
import { COUNTRIES, CURRICULA, GRADES, OTHER_CURRICULA } from "../lib/auth/config";
import { normalizeUsername, validateEmail, validateName, validatePassword, validateProfile, validateUsername, type FieldErrors } from "../lib/auth/validation";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create your account | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: SignUp,
});

type Form = {
  fullName: string; username: string; email: string; password: string; confirm: string; avatar: AvatarDraft;
  school: string; country: "BD" | "OTHER"; district: string; region: string; grade: number | null;
  curriculum: string; curriculumOther: string; curriculumOtherText: string; acceptPrivacy: boolean;
};
const DRAFT_KEY = "edu_signup_draft_v1";
const DRAFT_FIELDS = ["fullName", "username", "school", "country", "district", "region", "grade", "curriculum", "curriculumOther", "curriculumOtherText"] as const;
const STEP_FIELDS: string[][] = [["fullName", "username", "email", "password", "confirm"], ["school", "country", "district", "region", "grade", "curriculum", "curriculumOther", "curriculumOtherText"], ["acceptPrivacy"]];

type Uname = { state: "idle" | "checking" | "available" | "taken" | "invalid" | "error"; code?: string; suggestions: string[]; for: string };

function clientErrors(f: Form, step: number): FieldErrors {
  const e: FieldErrors = {};
  if (step === 0) {
    const n = validateName(f.fullName); if (n) e.fullName = n;
    const u = validateUsername(f.username); if (u) e.username = u;
    const m = validateEmail(f.email); if (m) e.email = m;
    const p = validatePassword(f.password, { email: f.email, username: f.username }); if (p) e.password = p;
    if (!e.password && f.confirm !== f.password) e.confirm = "password_mismatch";
  }
  if (step === 1) Object.assign(e, validateProfile(f));
  if (step === 2 && !f.acceptPrivacy) e.acceptPrivacy = "privacy_required";
  return e;
}

function SignUp() {
  const { t, tx, lang, prefs, account, refresh } = useLearner();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<null | { delivery: string; avatar: "none" | "ok" | "failed"; code?: string }>(null);
  const [form, setForm] = useState<Form>({
    fullName: "", username: "", email: "", password: "", confirm: "", avatar: { kind: "none" },
    school: "", country: "BD", district: "", region: "", grade: prefs.grade,
    curriculum: prefs.medium === "english" ? "nctb-english" : prefs.medium === "bangla" ? "nctb-bangla" : "", curriculumOther: "", curriculumOtherText: "", acceptPrivacy: false,
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState<boolean[]>([false, false, false]);
  const [server, setServer] = useState<FieldErrors>({});
  const [formCode, setFormCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uname, setUname] = useState<Uname>({ state: "idle", suggestions: [], for: "" });
  const requestId = useRef<string>("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    requestId.current = crypto.randomUUID();
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) setForm((f) => ({ ...f, ...(JSON.parse(raw) as Partial<Form>) }));
    } catch { /* no saved draft */ }
  }, []);
  useEffect(() => {
    try {
      const draft = Object.fromEntries(DRAFT_FIELDS.map((k) => [k, form[k]]));
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { /* storage unavailable */ }
  }, [form]);

  // Debounced, server-side username availability.
  useEffect(() => {
    const u = normalizeUsername(form.username);
    if (!u || validateUsername(u)) {
      setUname({ state: u ? "invalid" : "idle", suggestions: [], for: u });
      return;
    }
    setUname({ state: "checking", suggestions: [], for: u });
    const timer = setTimeout(async () => {
      const r = await call(checkUsername({ data: { username: u } }), 8000);
      setUname((cur) => {
        if (cur.for !== u) return cur;
        if (!r.ok) return { state: r.code === "username_reserved" || r.code === "username_inappropriate" ? "invalid" : "error", code: r.code, suggestions: [], for: u };
        return r.available ? { state: "available", suggestions: [], for: u } : { state: "taken", suggestions: r.suggestions, for: u };
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [form.username]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServer((s) => ({ ...s, [k]: undefined }));
    setFormCode(null);
  };
  const errs = clientErrors(form, step);
  if (step === 0 && !errs.username && uname.state === "taken") errs.username = "username_taken";
  if (step === 0 && !errs.username && uname.state === "invalid" && uname.code) errs.username = uname.code;
  const show = (k: string) => server[k] ?? ((touched[k] || attempted[step]) ? errs[k] : undefined);
  const blur = (k: string) => () => setTouched((x) => ({ ...x, [k]: true }));

  const goStep = (n: number) => {
    setStep(n);
    setTimeout(() => headingRef.current?.focus(), 30);
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    setAttempted((a) => a.map((v, i) => (i === step ? true : v)));
    if (Object.keys(errs).length || (step === 0 && uname.state === "checking")) return;
    if (step < 2) goStep(step + 1);
    else void submit();
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFormCode(null);
    const r = await call(
      register({
        data: {
          requestId: requestId.current, fullName: form.fullName, username: form.username, email: form.email, password: form.password,
          avatarPreset: form.avatar.kind === "preset" ? form.avatar.id : null, acceptPrivacy: form.acceptPrivacy, lang,
          school: form.school, country: form.country, district: form.district, region: form.region, grade: form.grade,
          curriculum: form.curriculum, curriculumOther: form.curriculumOther, curriculumOtherText: form.curriculumOtherText,
        },
      }),
      30000,
    );
    if (!r.ok) {
      setSubmitting(false);
      if (r.code === "created_signin_failed") {
        void navigate({ to: "/signin", search: { notice: "created" } });
        return;
      }
      if (r.fields && Object.keys(r.fields).length) {
        setServer(r.fields);
        const first = STEP_FIELDS.findIndex((fs) => fs.some((k) => r.fields![k]));
        if (first >= 0 && first !== step) goStep(first);
        setFormCode(first === 2 || first < 0 ? null : "fix_fields");
      } else setFormCode(r.code);
      return;
    }
    let avatar: "none" | "ok" | "failed" = "none";
    let code: string | undefined;
    if (form.avatar.kind === "file") {
      const up = await uploadAvatar(form.avatar.blob);
      avatar = up.ok ? "ok" : "failed";
      if (!up.ok) code = up.code;
    }
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setForm((f) => ({ ...f, password: "", confirm: "" }));
    setDone({ delivery: r.resumed ? "resumed" : r.delivery, avatar, code });
    setSubmitting(false);
    await refresh();
    setTimeout(() => headingRef.current?.focus(), 30);
  };

  if (account && !done) {
    return (
      <AuthLayout title={tx("You're already signed in", "তুমি ইতিমধ্যে সাইন ইন করা আছ")} subtitle={tx(`Signed in as @${account.username}.`, `@${account.username} হিসেবে সাইন ইন করা আছ।`)}>
        <div className="grid gap-3">
          <Link to="/home" className="flex h-[52px] items-center justify-center rounded-[14px] bg-brand font-semibold text-sheet">{tx("Go to my dashboard", "আমার ড্যাশবোর্ডে চলো")}</Link>
          <Link to="/account" className="flex h-[52px] items-center justify-center rounded-[14px] border border-ink-low/35 font-semibold">{tx("Manage account", "অ্যাকাউন্ট দেখো")}</Link>
        </div>
      </AuthLayout>
    );
  }

  if (done) return <Done done={done} headingRef={headingRef} form={form} onRetryAvatar={async () => {
    if (form.avatar.kind !== "file") return;
    const up = await uploadAvatar(form.avatar.blob);
    setDone((d) => d && { ...d, avatar: up.ok ? "ok" : "failed", code: up.ok ? undefined : up.code });
    if (up.ok) await refresh();
  }} />;

  const titles = [tx("Create your account", "তোমার অ্যাকাউন্ট খোলো"), tx("Your learning profile", "তোমার শেখার প্রোফাইল"), tx("Check and create", "দেখে নাও, তারপর খোলো")];
  const subs = [
    tx("Your learning universe starts here. It takes about a minute.", "তোমার শেখার মহাবিশ্ব শুরু এখানেই। লাগবে প্রায় এক মিনিট।"),
    tx("This helps IntelliHorizon show the right chapters and examples. Only you can see it.", "এতে ইন্টেলিহরাইজন সঠিক অধ্যায় আর উদাহরণ দেখাতে পারে। এটা শুধু তুমিই দেখতে পাবে।"),
    tx("Make sure everything looks right.", "সব ঠিক আছে কিনা দেখে নাও।"),
  ];

  const stepNames = [tx("Account", "অ্যাকাউন্ট"), tx("Profile", "প্রোফাইল"), tx("Review", "যাচাই")];
  const unameStatus =
    uname.state === "checking" ? { text: tx("Checking…", "দেখছি…"), cls: "text-ink-mid" }
    : uname.state === "available" ? { text: tx("Available", "পাওয়া যাচ্ছে"), cls: "text-right" }
    : uname.state === "error" ? { text: tx("Couldn't check right now. We'll check again when you continue.", "এখন দেখা গেল না। এগোলে আবার দেখা হবে।"), cls: "text-ink-mid" }
    : null;

  return (
    <AuthLayout title={titles[step]} subtitle={subs[step]}>
      <ol className="mb-8 grid grid-cols-3 gap-2" aria-label={tx("Progress", "অগ্রগতি")}>
        {stepNames.map((n, i) => (
          <li key={n} aria-current={i === step ? "step" : undefined}>
            <span className={`block h-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-brand" : "bg-ink-low/20"}`} />
            <span className={`mt-2 block text-xs font-semibold ${i === step ? "text-ink" : "text-ink-low"}`}>{n}</span>
          </li>
        ))}
      </ol>
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">{tx(`Step ${step + 1} of 3: ${stepNames[step]}`, `ধাপ ${step + 1} / ৩: ${stepNames[step]}`)}</h2>

      <form onSubmit={next} noValidate className="space-y-6" key={step}>
        {formCode === "fix_fields" ? (
          <FormAlert>{tx("Please check the highlighted fields.", "চিহ্নিত ঘরগুলো দেখে নাও।")}</FormAlert>
        ) : (
          <FormAlert code={formCode} />
        )}

        {step === 0 && (
          <div className="edu-rise space-y-6">
            <TextField label={tx("Full name", "পুরো নাম")} name="name" autoComplete="name" value={form.fullName} maxLength={120} onChange={(e) => set("fullName", e.target.value)} onBlur={blur("fullName")} error={show("fullName")} hint={tx("The name you'd like to be called. Bangla or English.", "যে নামে ডাকা হোক চাও। বাংলা বা ইংরেজিতে।")} />
            <div>
              <TextField
                label={tx("Username", "ইউজারনেম")}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={form.username}
                maxLength={30}
                onChange={(e) => set("username", e.target.value)}
                onBlur={blur("username")}
                error={show("username")}
                hint={tx("3 to 20 characters: letters, numbers, dots or underscores. It doesn't need to be your real name.", "৩ থেকে ২০ অক্ষর: অক্ষর, সংখ্যা, ডট বা আন্ডারস্কোর। আসল নাম হওয়ার দরকার নেই।")}
                trailing={
                  uname.state === "checking" ? <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-ink-low border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
                  : uname.state === "available" ? <svg className="mr-3 text-right" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="currentColor" /><path d="M5 9.4l2.6 2.6L13 6.6" stroke="#fff" strokeWidth="2" fill="none" /></svg>
                  : null
                }
                status={unameStatus && !show("username") ? <p className={`mt-2 text-sm font-medium ${unameStatus.cls}`} aria-live="polite">{unameStatus.text}</p> : null}
              />
              {uname.state === "taken" && uname.suggestions.length > 0 && (
                <div className="edu-rise mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink-mid">{tx("Try:", "চেষ্টা করো:")}</span>
                  {uname.suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => set("username", s)} className="rounded-full border border-ink-low/35 px-3 py-1 text-sm font-semibold hover:border-ink">@{s}</button>
                  ))}
                </div>
              )}
            </div>
            <TextField label={tx("Email", "ইমেইল")} type="email" name="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={form.email} maxLength={254} onChange={(e) => set("email", e.target.value)} onBlur={blur("email")} error={show("email")} hint={tx("Used to sign in and to recover your account. Never shown to anyone.", "সাইন ইন ও অ্যাকাউন্ট উদ্ধারের জন্য। কাউকে দেখানো হয় না।")} />
            <PasswordField label={tx("Password", "পাসওয়ার্ড")} name="new-password" value={form.password} onChange={(v) => set("password", v)} onBlur={blur("password")} error={show("password")} autoComplete="new-password" meter hint={tx("At least 8 characters. A short sentence you'll remember works well.", "কমপক্ষে ৮ অক্ষর। মনে থাকবে এমন একটি ছোট বাক্য ভালো কাজ করে।")} />
            <PasswordField label={tx("Confirm password", "পাসওয়ার্ড আবার লেখো")} name="confirm-password" value={form.confirm} onChange={(v) => set("confirm", v)} onBlur={blur("confirm")} error={show("confirm")} autoComplete="new-password" />
            <AvatarEditor value={form.avatar} onChange={(v) => set("avatar", v)} name={form.fullName} />
          </div>
        )}

        {step === 1 && (
          <div className="edu-rise space-y-6">
            <fieldset>
              <legend className="mb-2 text-[15px] font-semibold">{tx("Country", "দেশ")}</legend>
              <div role="radiogroup" className="grid grid-cols-2 gap-1.5 rounded-[14px] bg-paper p-1.5">
                {COUNTRIES.map((c) => (
                  <button key={c.code} type="button" role="radio" aria-checked={form.country === c.code} onClick={() => set("country", c.code)} className={`h-11 rounded-[10px] text-[15px] font-semibold transition-all ${form.country === c.code ? "bg-sheet shadow-[0_1px_2px_rgba(52,36,140,0.18),0_4px_12px_-6px_rgba(52,36,140,0.4)]" : "text-ink-mid hover:text-ink"}`}>
                    {t(c.label)}
                  </button>
                ))}
              </div>
            </fieldset>
            {form.country === "BD" ? (
              <DistrictCombobox value={form.district} onChange={(c) => set("district", c)} error={show("district")} />
            ) : (
              <TextField label={tx("State or region", "রাজ্য বা অঞ্চল")} optional value={form.region} maxLength={80} onChange={(e) => set("region", e.target.value)} error={show("region")} />
            )}
            <TextField label={tx("School", "স্কুল")} optional name="organization" autoComplete="organization" value={form.school} maxLength={120} onChange={(e) => set("school", e.target.value)} onBlur={blur("school")} error={show("school")} hint={tx("Type your school's name as you usually write it. Never shown to other students.", "যেভাবে সাধারণত লেখো সেভাবে স্কুলের নাম লেখো। অন্য শিক্ষার্থীদের দেখানো হয় না।")} />
            <GradePicker value={form.grade} onChange={(g) => set("grade", g)} error={show("grade")} />
            <CurriculumPicker
              value={form.curriculum}
              other={form.curriculumOther}
              otherText={form.curriculumOtherText}
              onChange={(p) => { setForm((f) => ({ ...f, ...p })); setServer((s) => ({ ...s, curriculum: undefined, curriculumOther: undefined, curriculumOtherText: undefined })); }}
              errors={{ curriculum: show("curriculum"), curriculumOther: show("curriculumOther"), curriculumOtherText: show("curriculumOtherText") }}
            />
            <p className="text-sm leading-relaxed text-ink-mid">{tx("Why we ask: your class and curriculum choose the right chapters and language; your district helps us add local examples. None of this is used to judge you.", "কেন জানতে চাই: শ্রেণি ও পাঠ্যক্রম দিয়ে সঠিক অধ্যায় ও ভাষা বেছে নেওয়া হয়; জেলা দিয়ে স্থানীয় উদাহরণ যোগ হয়। এগুলো দিয়ে তোমাকে বিচার করা হয় না।")}</p>
          </div>
        )}

        {step === 2 && (
          <div className="edu-rise space-y-6">
            <div className="flex items-center gap-4 rounded-[18px] bg-sheet p-4 shadow-[0_1px_0_rgba(52,36,140,0.06),0_16px_36px_-24px_rgba(52,36,140,0.5)]">
              {form.avatar.kind === "file" ? <img src={form.avatar.url} alt="" className="h-16 w-16 rounded-full object-cover" /> : form.avatar.kind === "preset" ? <PresetArt id={form.avatar.id} size={64} /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-night-2 text-xl font-bold text-cloth">{initials(form.fullName)}</span>}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{form.fullName.trim()}</p>
                <p className="truncate text-ink-mid">@{normalizeUsername(form.username)}</p>
              </div>
            </div>
            <ReviewBlock title={tx("Account", "অ্যাকাউন্ট")} onEdit={() => goStep(0)} rows={[[tx("Email", "ইমেইল"), form.email.trim()], [tx("Password", "পাসওয়ার্ড"), "••••••••"]]} />
            <ReviewBlock
              title={tx("Learning profile", "শেখার প্রোফাইল")}
              onEdit={() => goStep(1)}
              rows={[
                [tx("Class", "শ্রেণি"), t(GRADES.find((g) => g.value === form.grade)?.label ?? { en: "", bn: "" })],
                [tx("Curriculum", "পাঠ্যক্রম"), form.curriculum === "other" ? (form.curriculumOther === "other" ? form.curriculumOtherText : t(OTHER_CURRICULA.find((o) => o.id === form.curriculumOther)?.label ?? { en: "", bn: "" })) : t(CURRICULA.find((c) => c.id === form.curriculum)?.label ?? { en: "", bn: "" })],
                [form.country === "BD" ? tx("District", "জেলা") : tx("Region", "অঞ্চল"), form.country === "BD" ? t(districtByCode(form.district) ?? { en: "", bn: "" }) : form.region || tx("Not given", "দেওয়া হয়নি")],
                [tx("School", "স্কুল"), form.school.trim() || tx("Not given", "দেওয়া হয়নি")],
              ]}
            />
            <div>
              <label className="flex items-start gap-3 rounded-[14px] border border-ink-low/30 bg-sheet p-4">
                <input type="checkbox" checked={form.acceptPrivacy} onChange={(e) => set("acceptPrivacy", e.target.checked)} aria-invalid={!!show("acceptPrivacy")} className="mt-1 h-5 w-5 shrink-0 accent-[#1D1B2C]" />
                <span className="text-[15px] leading-relaxed">
                  {tx("I've read ", "আমি পড়েছি ")}
                  <Link to="/privacy" target="_blank" className="font-semibold underline decoration-dashed underline-offset-4">{tx("how IntelliHorizon looks after my information", "ইন্টেলিহরাইজন কীভাবে আমার তথ্য রাখে")}</Link>
                  {tx(". My profile is private, and nothing is shared unless I choose.", "। আমার প্রোফাইল গোপন, আর আমি না চাইলে কিছুই শেয়ার হয় না।")}
                </span>
              </label>
              {show("acceptPrivacy") && <p className="mt-2 text-sm font-medium text-again" role="alert">{t(msg(show("acceptPrivacy"))!)}</p>}
              <p className="mt-3 text-sm text-ink-mid">{tx("If you're under 18, please tell a parent or guardian that you're creating an account.", "তোমার বয়স ১৮-এর কম হলে, অ্যাকাউন্ট খোলার কথা মা-বাবা বা অভিভাবককে জানাও।")}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
          {step > 0 && (
            <div className="sm:w-40"><AuthButton type="button" tone="quiet" onClick={() => goStep(step - 1)} disabled={submitting}>{tx("Back", "পেছনে")}</AuthButton></div>
          )}
          <AuthButton loading={submitting} loadingLabel={tx("Creating your account…", "অ্যাকাউন্ট তৈরি হচ্ছে…")}>
            {step < 2 ? tx("Continue", "এগিয়ে চলো") : tx("Create account", "অ্যাকাউন্ট খোলো")}
          </AuthButton>
        </div>
      </form>
      <p className="mt-8 text-center text-[15px] text-ink-mid">
        {tx("Already have an account? ", "আগে থেকেই অ্যাকাউন্ট আছে? ")}
        <Link to="/signin" className="font-semibold text-ink underline decoration-dashed underline-offset-4">{tx("Sign in", "সাইন ইন")}</Link>
      </p>
    </AuthLayout>
  );
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  const { tx } = useLearner();
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <button type="button" onClick={onEdit} className="text-sm font-semibold text-ink underline decoration-dashed underline-offset-4">{tx("Edit", "বদলাও")}</button>
      </div>
      <dl className="divide-y divide-ink-low/15 rounded-[14px] border border-ink-low/25 bg-sheet">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 px-4 py-3 text-[15px]">
            <dt className="shrink-0 text-ink-mid">{k}</dt>
            <dd className="min-w-0 break-words text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Done({ done, headingRef, form, onRetryAvatar }: { done: { delivery: string; avatar: "none" | "ok" | "failed"; code?: string }; headingRef: RefObject<HTMLHeadingElement | null>; form: Form; onRetryAvatar: () => Promise<void> }) {
  const { tx, account } = useLearner();
  const [retrying, setRetrying] = useState(false);
  const first = form.fullName.trim().split(/\s+/)[0] ?? "";
  return (
    <AuthLayout title={tx(`Welcome, ${first}.`, `স্বাগতম, ${first}।`)} subtitle={tx("Your account is ready. Your sky will now follow you on any device you sign in to.", "তোমার অ্যাকাউন্ট তৈরি। যেকোনো ডিভাইসে সাইন ইন করলে তোমার আকাশ সাথে থাকবে।")}>
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">{tx("Account created", "অ্যাকাউন্ট তৈরি হয়েছে")}</h2>
      <div className="space-y-4">
        {done.delivery === "sent" && <FormAlert tone="success">{tx(`We sent a confirmation link to ${account?.email ?? "your email"}. Open it within 24 hours so you can always recover your account.`, `${account?.email ?? "তোমার ইমেইলে"} একটি নিশ্চিতকরণ লিংক পাঠানো হয়েছে। ২৪ ঘণ্টার মধ্যে খোলো, যাতে অ্যাকাউন্ট সবসময় উদ্ধার করা যায়।`)}</FormAlert>}
        {done.delivery === "not_configured" && <FormAlert tone="info">{tx("Your email isn't confirmed yet. Email sending is still being set up on IntelliHorizon, so we couldn't send a link. You can do this later from your account page.", "তোমার ইমেইল এখনো নিশ্চিত হয়নি। ইন্টেলিহরাইজনে ইমেইল পাঠানোর ব্যবস্থা এখনো চালু হচ্ছে, তাই লিংক পাঠানো যায়নি। পরে অ্যাকাউন্ট পেজ থেকে করতে পারবে।")}</FormAlert>}
        {done.delivery === "failed" && <FormAlert tone="info">{tx("We couldn't send the confirmation email just now. You can resend it from your account page.", "এখন নিশ্চিতকরণ ইমেইল পাঠানো যায়নি। অ্যাকাউন্ট পেজ থেকে আবার পাঠাতে পারো।")}</FormAlert>}
        {done.avatar === "failed" && (
          <FormAlert tone="error">
            <span className="block">{tx("Your account is ready, but your photo didn't upload.", "অ্যাকাউন্ট তৈরি, কিন্তু ছবি আপলোড হয়নি।")}</span>
            <button type="button" disabled={retrying} onClick={async () => { setRetrying(true); await onRetryAvatar(); setRetrying(false); }} className="mt-2 font-semibold underline decoration-dashed underline-offset-4">
              {retrying ? tx("Uploading…", "আপলোড হচ্ছে…") : tx("Try the upload again", "আবার আপলোড করো")}
            </button>
          </FormAlert>
        )}
        <Link to="/home" className="flex h-[52px] items-center justify-center rounded-[14px] bg-brand text-[16px] font-semibold text-sheet transition-transform active:scale-[0.985]">{tx("Go to my dashboard", "আমার ড্যাশবোর্ডে চলো")}</Link>
        <Link to="/account" className="flex h-[52px] items-center justify-center rounded-[14px] border border-ink-low/35 text-[16px] font-semibold">{tx("View my profile", "আমার প্রোফাইল দেখো")}</Link>
      </div>
    </AuthLayout>
  );
}
