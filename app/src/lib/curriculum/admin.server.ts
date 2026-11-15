import { currentUser, type SessionUser } from "../auth/session.server";

export async function requireAdmin(): Promise<SessionUser | null> {
  const me = await currentUser();
  return me && me.role === "admin" ? me : null;
}
