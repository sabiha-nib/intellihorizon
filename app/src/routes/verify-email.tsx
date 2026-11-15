import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AuthLayout } from "../components/auth/AuthLayout";
import { FormAlert } from "../components/auth/fields";
import { call } from "../components/auth/messages";
import { verifyEmail } from "../lib/api/auth.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({ token: typeof s.token === "string" ? s.token : undefined }),
  head: () => ({ meta: [{ title: "Confirm your email | IntelliHorizon" }, { name: "robots", content: "noindex" }] }),
  component: Verify,
});

function Verify() {
  const { tx, refresh, account } = useLearner();
  const { token } = Route.useSearch();
  const ran = useRef(false);
  const [state, setState] = useState<"checking" | "verified" | "changed" | string>("checking");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (token) window.history.replaceState(null, "", "/verify-email");
    if (!token) return setState("token_invalid");
    void call(verifyEmail({ data: { token } })).then(async (r) => {
      if (r.ok) {
        setState(r.kind);
        await refresh();
      } else setState(r.code);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "checking") return <AuthLayout title={tx("Confirming your email…", "ইমেইল নিশ্চিত হচ্ছে…")}><div className="h-1 w-full overflow-hidden rounded-full bg-ink-low/15"><div className="h-full w-1/3 animate-pulse rounded-full bg-brand motion-reduce:animate-none" /></div></AuthLayout>;
  const ok = state === "verified" || state === "changed";
  return (
    <AuthLayout title={ok ? (state === "changed" ? tx("Email updated", "ইমেইল বদলানো হয়েছে") : tx("Email confirmed", "ইমেইল নিশ্চিত হয়েছে")) : tx("We couldn't confirm your email", "ইমেইল নিশ্চিত করা যায়নি")}>
      {ok ? (
        <FormAlert tone="success">{tx("Thank you. You can now recover your account with this email if you ever forget your password.", "ধন্যবাদ। পাসওয়ার্ড ভুলে গেলে এখন এই ইমেইল দিয়ে অ্যাকাউন্ট উদ্ধার করতে পারবে।")}</FormAlert>
      ) : (
        <>
          <FormAlert code={state} />
          {state === "token_expired" && <p className="mt-4 text-ink-mid">{account ? tx("You can send a fresh link from your account page.", "অ্যাকাউন্ট পেজ থেকে নতুন লিংক পাঠাতে পারো।") : tx("Sign in, then send a fresh link from your account page.", "সাইন ইন করে অ্যাকাউন্ট পেজ থেকে নতুন লিংক পাঠাও।")}</p>}
        </>
      )}
      <div className="mt-6">
        <Link to={account ? "/account" : "/signin"} className="flex h-[52px] items-center justify-center rounded-[14px] bg-brand font-semibold text-sheet">{account ? tx("Go to my account", "আমার অ্যাকাউন্টে চলো") : tx("Sign in", "সাইন ইন")}</Link>
      </div>
    </AuthLayout>
  );
}
