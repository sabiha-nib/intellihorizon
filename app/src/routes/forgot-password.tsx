import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthButton, FormAlert, TextField } from "../components/auth/fields";
import { call } from "../components/auth/messages";
import { requestPasswordReset } from "../lib/api/auth.functions";
import { validateEmail } from "../lib/auth/validation";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset your password | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: Forgot,
});

function Forgot() {
  const { tx, lang } = useLearner();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "queued" | "not_configured">("idle");
  const [code, setCode] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const fieldErr = attempted ? validateEmail(email) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (validateEmail(email) || state === "busy") return;
    setState("busy");
    setCode(null);
    const r = await call(requestPasswordReset({ data: { email, lang } }));
    if (!r.ok) {
      setState("idle");
      setCode(r.code);
      return;
    }
    setState(r.delivery === "not_configured" ? "not_configured" : "queued");
  };

  if (state === "queued" || state === "not_configured") {
    return (
      <AuthLayout title={state === "queued" ? tx("Check your email", "ইমেইল দেখো") : tx("Email isn't set up yet", "ইমেইল এখনো চালু হয়নি")}>
        {state === "queued" ? (
          <FormAlert tone="success">{tx(`If an IntelliHorizon account uses ${email.trim()}, a reset link is on its way. It works for 30 minutes and only once. Check your spam folder too.`, `${email.trim()} দিয়ে কোনো ইন্টেলিহরাইজন অ্যাকাউন্ট থাকলে রিসেট লিংক যাচ্ছে। এটি ৩০ মিনিট কার্যকর এবং একবারই ব্যবহার করা যাবে। স্প্যাম ফোল্ডারও দেখো।`)}</FormAlert>
        ) : (
          <FormAlert tone="info">{tx("IntelliHorizon can't send emails yet, so password reset links can't be delivered. If you remember your password, sign in normally. Otherwise, please ask your teacher to contact the IntelliHorizon team.", "ইন্টেলিহরাইজন এখনো ইমেইল পাঠাতে পারে না, তাই রিসেট লিংক পাঠানো যাচ্ছে না। পাসওয়ার্ড মনে থাকলে স্বাভাবিকভাবে সাইন ইন করো। নইলে শিক্ষককে ইন্টেলিহরাইজন দলের সাথে যোগাযোগ করতে বলো।")}</FormAlert>
        )}
        <div className="mt-6"><Link to="/signin" className="flex h-[52px] items-center justify-center rounded-[14px] bg-brand font-semibold text-sheet">{tx("Back to sign in", "সাইন ইনে ফিরে যাও")}</Link></div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={tx("Reset your password", "পাসওয়ার্ড রিসেট করো")} subtitle={tx("Enter the email you signed up with. We'll send a link to choose a new password.", "যে ইমেইল দিয়ে অ্যাকাউন্ট খুলেছ সেটি লেখো। নতুন পাসওয়ার্ড দেওয়ার লিংক পাঠানো হবে।")}>
      <form onSubmit={submit} noValidate className="space-y-6">
        <FormAlert code={code} />
        <TextField label={tx("Email", "ইমেইল")} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} error={fieldErr} />
        <AuthButton loading={state === "busy"} loadingLabel={tx("Sending…", "পাঠানো হচ্ছে…")}>{tx("Send reset link", "রিসেট লিংক পাঠাও")}</AuthButton>
      </form>
      <p className="mt-8 text-center text-[15px]"><Link to="/signin" className="font-semibold underline decoration-dashed underline-offset-4">{tx("Back to sign in", "সাইন ইনে ফিরে যাও")}</Link></p>
    </AuthLayout>
  );
}
