import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthButton, FormAlert, PasswordField, TextField } from "../components/auth/fields";
import { call } from "../components/auth/messages";
import { signIn } from "../lib/api/auth.functions";
import { safeNext } from "../lib/auth/validation";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/signin")({
  validateSearch: (s: Record<string, unknown>): { next?: string; notice?: string } => ({
    next: typeof s.next === "string" ? s.next : undefined,
    notice: typeof s.notice === "string" ? s.notice : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: SignIn,
});

function SignIn() {
  const { tx, refresh, account } = useLearner();
  const { next, notice } = Route.useSearch();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!identifier.trim() || !password || busy) return;
    setBusy(true);
    setCode(null);
    const r = await call(signIn({ data: { identifier, password } }));
    if (!r.ok) {
      setBusy(false);
      setCode(r.code);
      setPassword("");
      return;
    }
    setPassword("");
    // The judge credential opens a fresh demo workspace; a full load makes sure nothing from before carries over.
    if ("redirect" in r && typeof r.redirect === "string") { window.location.assign(r.redirect); return; }
    await refresh();
    void navigate({ to: safeNext(next) });
  };

  return (
    <AuthLayout title={tx("Welcome back", "আবার স্বাগতম")} subtitle={tx("Sign in to pick up your sky where you left it.", "যেখানে থেমেছিলে সেখান থেকে শুরু করতে সাইন ইন করো।")}>
      <form onSubmit={submit} noValidate className="space-y-6">
        {notice === "created" && <FormAlert tone="success">{tx("Your account was created. Sign in to continue.", "তোমার অ্যাকাউন্ট তৈরি হয়েছে। চালিয়ে যেতে সাইন ইন করো।")}</FormAlert>}
        {notice === "expired" && <FormAlert tone="info">{tx("Your session ended. Please sign in again.", "তোমার সেশন শেষ হয়েছে। আবার সাইন ইন করো।")}</FormAlert>}
        {notice === "reset" && <FormAlert tone="success">{tx("Password changed. Sign in with your new password.", "পাসওয়ার্ড বদলেছে। নতুন পাসওয়ার্ড দিয়ে সাইন ইন করো।")}</FormAlert>}
        {account && <FormAlert tone="info">{tx(`You're signed in as @${account.username}. Signing in again will switch accounts on this device.`, `তুমি @${account.username} হিসেবে সাইন ইন করা আছ। আবার সাইন ইন করলে এই ডিভাইসে অ্যাকাউন্ট বদলাবে।`)}</FormAlert>}
        <FormAlert code={code} />
        <TextField
          label={tx("Email or username", "ইমেইল বা ইউজারনেম")}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          maxLength={254}
          onChange={(e) => { setIdentifier(e.target.value); setCode(null); }}
          error={attempted && !identifier.trim() ? "email_required" : null}
        />
        <div>
          <PasswordField label={tx("Password", "পাসওয়ার্ড")} name="password" value={password} onChange={(v) => { setPassword(v); setCode(null); }} autoComplete="current-password" error={attempted && !password && !code ? "password_required" : null} />
          <div className="mt-3 text-right">
            <Link to="/forgot-password" className="text-sm font-semibold text-ink underline decoration-dashed underline-offset-4">{tx("Forgot password?", "পাসওয়ার্ড ভুলে গেছ?")}</Link>
          </div>
        </div>
        <AuthButton loading={busy} loadingLabel={tx("Signing in…", "সাইন ইন হচ্ছে…")}>{tx("Sign in", "সাইন ইন")}</AuthButton>
      </form>
      <p className="mt-8 text-center text-[15px] text-ink-mid">
        {tx("New to IntelliHorizon? ", "ইন্টেলিহরাইজনে নতুন? ")}
        <Link to="/signup" className="font-semibold text-ink underline decoration-dashed underline-offset-4">{tx("Create an account", "অ্যাকাউন্ট খোলো")}</Link>
      </p>
      <p className="mt-3 text-center text-sm text-ink-mid">
        {tx("Competition judge? ", "প্রতিযোগিতার বিচারক? ")}
        <Link to="/judge" className="font-semibold text-ink underline decoration-dashed underline-offset-4">{tx("Use judge access", "বিচারক প্রবেশ ব্যবহার করুন")}</Link>
      </p>
      <p className="mt-3 text-center text-sm text-ink-low">{tx("You can also keep learning without an account. Your progress then stays on this device only.", "অ্যাকাউন্ট ছাড়াও শেখা যায়। তখন অগ্রগতি শুধু এই ডিভাইসেই থাকে।")}</p>
    </AuthLayout>
  );
}
