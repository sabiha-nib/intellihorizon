import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthButton, FormAlert, PasswordField } from "../components/auth/fields";
import { call } from "../components/auth/messages";
import { checkResetToken, resetPassword } from "../lib/api/auth.functions";
import { validatePassword } from "../lib/auth/validation";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({ token: typeof s.token === "string" ? s.token : undefined }),
  head: () => ({ meta: [{ title: "Choose a new password | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: Reset,
});

function Reset() {
  const { tx, refresh } = useLearner();
  const { token: fromUrl } = Route.useSearch();
  const token = useRef<string>(fromUrl ?? "");
  const [state, setState] = useState<"checking" | "valid" | "invalid" | "expired" | "used" | "done">("checking");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [server, setServer] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (fromUrl) window.history.replaceState(null, "", "/reset-password"); // keep the token out of history and screenshots
    if (!token.current) return setState("invalid");
    void call(checkResetToken({ data: { token: token.current } })).then((r) => setState(r.ok ? r.state : "invalid"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const err = server ?? (attempted ? validatePassword(pw) : null);
  const cErr = attempted && !err && confirm !== pw ? "password_mismatch" : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (validatePassword(pw) || confirm !== pw || busy) return;
    setBusy(true);
    setCode(null);
    const r = await call(resetPassword({ data: { token: token.current, password: pw } }));
    setBusy(false);
    if (!r.ok) {
      if (r.fields?.password) setServer(r.fields.password);
      else if (r.code.startsWith("token_")) setState(r.code.slice(6) as "invalid" | "expired" | "used");
      else setCode(r.code);
      return;
    }
    setPw("");
    setConfirm("");
    setState("done");
    await refresh();
  };

  if (state === "checking") return <AuthLayout title={tx("Checking your link…", "লিংক যাচাই হচ্ছে…")}><div className="h-1 w-full overflow-hidden rounded-full bg-ink-low/15"><div className="h-full w-1/3 animate-pulse rounded-full bg-brand motion-reduce:animate-none" /></div></AuthLayout>;
  if (state === "invalid" || state === "expired" || state === "used") {
    return (
      <AuthLayout title={state === "expired" ? tx("This link has expired", "লিংকের মেয়াদ শেষ") : state === "used" ? tx("This link was already used", "লিংকটি আগেই ব্যবহার হয়েছে") : tx("This link doesn't work", "লিংকটি কাজ করছে না")}>
        <FormAlert code={`token_${state}`} />
        <div className="mt-6"><Link to="/forgot-password" className="flex h-[52px] items-center justify-center rounded-[14px] bg-brand font-semibold text-sheet">{tx("Request a new link", "নতুন লিংক চাও")}</Link></div>
      </AuthLayout>
    );
  }
  if (state === "done") {
    return (
      <AuthLayout title={tx("Password changed", "পাসওয়ার্ড বদলানো হয়েছে")} subtitle={tx("You're signed in. For your safety, every other device has been signed out.", "তুমি সাইন ইন করা আছ। নিরাপত্তার জন্য অন্য সব ডিভাইস থেকে সাইন আউট করা হয়েছে।")}>
        <Link to="/home" className="flex h-[52px] items-center justify-center rounded-[14px] bg-brand font-semibold text-sheet">{tx("Go to my dashboard", "আমার ড্যাশবোর্ডে চলো")}</Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title={tx("Choose a new password", "নতুন পাসওয়ার্ড দাও")}>
      <form onSubmit={submit} noValidate className="space-y-6">
        <FormAlert code={code} />
        <PasswordField label={tx("New password", "নতুন পাসওয়ার্ড")} value={pw} onChange={(v) => { setPw(v); setServer(null); }} error={err} autoComplete="new-password" meter hint={tx("At least 8 characters.", "কমপক্ষে ৮ অক্ষর।")} />
        <PasswordField label={tx("Confirm new password", "নতুন পাসওয়ার্ড আবার লেখো")} value={confirm} onChange={setConfirm} error={cErr} autoComplete="new-password" />
        <AuthButton loading={busy} loadingLabel={tx("Saving…", "সংরক্ষণ হচ্ছে…")}>{tx("Save new password", "নতুন পাসওয়ার্ড সংরক্ষণ")}</AuthButton>
      </form>
    </AuthLayout>
  );
}
