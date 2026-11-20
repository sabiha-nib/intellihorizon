import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthButton, FormAlert, PasswordField, TextField } from "../components/auth/fields";
import { call } from "../components/auth/messages";
import { judgeSignIn } from "../lib/api/judge.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/judge")({
  head: () => ({ meta: [{ title: "Judge access | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: JudgeAccess,
});

function JudgeAccess() {
  const { tx } = useLearner();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setCode(null);
    const r = await call(judgeSignIn({ data: { username, password } }));
    setPassword("");
    if (!r.ok) { setBusy(false); setCode(r.code === "judge_disabled" ? "invalid_credentials" : r.code); return; }
    window.location.assign(r.redirect);
  };

  return (
    <AuthLayout title={tx("Judge access", "বিচারক প্রবেশ")} subtitle={tx("For competition judges. No registration needed.", "প্রতিযোগিতার বিচারকদের জন্য। নিবন্ধনের দরকার নেই।")}>
      <div className="mb-6 rounded-[14px] border border-line bg-lilac p-4 text-[15px] text-ink-mid" data-testid="judge-explainer">
        <p className="font-semibold text-ink">{tx("What opens", "কী খুলবে")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{tx("A private student workspace: Class 7 · NCTB Bangladesh · Bangla Version.", "একটি ব্যক্তিগত শিক্ষার্থী ওয়ার্কস্পেস: ৭ম শ্রেণি · এনসিটিবি বাংলাদেশ · বাংলা ভার্সন।")}</li>
          <li>{tx("The tutor answers in Bangla; you can switch it to English or mixed at any time.", "টিউটর বাংলায় উত্তর দেয়; যেকোনো সময় ইংরেজি বা মিশ্র ভাষায় বদলাতে পারেন।")}</li>
          <li>{tx("Every sign-in starts fresh and is visible only to you. It ends after 24 hours.", "প্রতিবার সাইন ইন নতুন করে শুরু হয় এবং শুধু আপনিই দেখতে পান। ২৪ ঘণ্টা পর শেষ হয়।")}</li>
        </ul>
      </div>
      <form onSubmit={submit} noValidate className="space-y-6">
        <FormAlert code={code} />
        <TextField
          label={tx("Judge username", "বিচারকের ইউজারনেম")}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          maxLength={60}
          onChange={(e) => { setUsername(e.target.value); setCode(null); }}
          error={attempted && !username.trim() ? "judge_username_required" : null}
        />
        <PasswordField label={tx("Password", "পাসওয়ার্ড")} name="password" value={password} onChange={(v) => { setPassword(v); setCode(null); }} autoComplete="current-password" error={attempted && !password && !code ? "password_required" : null} />
        <AuthButton loading={busy} loadingLabel={tx("Opening your demo…", "ডেমো খোলা হচ্ছে…")}>{tx("Open the demo", "ডেমো খুলুন")}</AuthButton>
      </form>
      <p className="mt-8 text-center text-sm text-ink-low">
        {tx("Not a judge? ", "বিচারক নন? ")}
        <Link to="/signin" className="font-semibold text-ink underline decoration-dashed underline-offset-4">{tx("Sign in", "সাইন ইন")}</Link>
      </p>
    </AuthLayout>
  );
}
