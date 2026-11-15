// Route guard for signed-in pages. The check runs on the server (session cookie), so a visitor without an account is sent to sign in.
import { redirect } from "@tanstack/react-router";

import { getAccount } from "./api/auth.functions";

export async function requireAccount(next: string) {
  const a = await getAccount();
  if (!a) throw redirect({ to: "/signin", search: { next } });
  return a;
}
