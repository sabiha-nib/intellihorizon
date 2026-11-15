import { bindings } from "../bindings.server";

export type Delivery = "sent" | "not_configured" | "failed";

export function emailConfigured(): boolean {
  const { RESEND_API_KEY, EMAIL_FROM } = bindings();
  return !!RESEND_API_KEY && !!EMAIL_FROM;
}

async function send(to: string, subject: string, text: string): Promise<Delivery> {
  const { RESEND_API_KEY, EMAIL_FROM } = bindings();
  if (!RESEND_API_KEY || !EMAIL_FROM) return "not_configured";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text }),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

type Lang = "en" | "bn";

export function sendVerifyEmail(to: string, link: string, lang: Lang): Promise<Delivery> {
  return lang === "bn"
    ? send(to, "ইন্টেলিহরাইজন: তোমার ইমেইল নিশ্চিত করো", `তোমার ইন্টেলিহরাইজন অ্যাকাউন্টের ইমেইল নিশ্চিত করতে এই লিংকে যাও (২৪ ঘণ্টা কার্যকর):\n\n${link}\n\nতুমি এই অ্যাকাউন্ট না খুলে থাকলে এই ইমেইলটি উপেক্ষা করো।`)
    : send(to, "IntelliHorizon: confirm your email", `Confirm the email for your IntelliHorizon account by opening this link (valid for 24 hours):\n\n${link}\n\nIf you did not create this account, you can ignore this email.`);
}

export function sendResetEmail(to: string, link: string, lang: Lang): Promise<Delivery> {
  return lang === "bn"
    ? send(to, "ইন্টেলিহরাইজন: পাসওয়ার্ড রিসেট", `নতুন পাসওয়ার্ড দিতে এই লিংকে যাও (৩০ মিনিট কার্যকর, একবারই ব্যবহার করা যাবে):\n\n${link}\n\nতুমি অনুরোধ না করে থাকলে কিছু করতে হবে না। তোমার পাসওয়ার্ড বদলাবে না।`)
    : send(to, "IntelliHorizon: reset your password", `Choose a new password by opening this link (valid for 30 minutes, single use):\n\n${link}\n\nIf you did not ask for this, you don't need to do anything. Your password has not changed.`);
}

export function sendEmailChange(to: string, link: string, lang: Lang): Promise<Delivery> {
  return lang === "bn"
    ? send(to, "ইন্টেলিহরাইজন: নতুন ইমেইল নিশ্চিত করো", `তোমার ইন্টেলিহরাইজন অ্যাকাউন্টে এই ইমেইল যুক্ত করতে লিংকে যাও (২৪ ঘণ্টা কার্যকর):\n\n${link}`)
    : send(to, "IntelliHorizon: confirm your new email", `Open this link to use this address for your IntelliHorizon account (valid for 24 hours):\n\n${link}`);
}
