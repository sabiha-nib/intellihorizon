import { useEffect, useState } from "react";

import { call } from "../auth/messages";
import { endJudgeSessions, judgeAdminStatus, rotateJudgePassword, setJudgeAccess } from "../../lib/api/judge.functions";

type Status = Extract<Awaited<ReturnType<typeof judgeAdminStatus>>, { ok: true }>;

/** Judge demo access: status, rotation (new password shown once), ending all judge sessions, turning access off. */
export function JudgeAdmin() {
  const [s, setS] = useState<Status | null>(null);
  const [shown, setShown] = useState<{ username: string; password: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => void call(judgeAdminStatus()).then((r) => r.ok && setS(r as Status));
  useEffect(load, []);
  if (!s) return <p>Loading…</p>;
  return (
    <div className="space-y-4" data-testid="judge-admin">
      <h2 className="font-display text-xl font-bold">Judge demo access</h2>
      <p className="max-w-prose text-sm text-ink-mid">Judges sign in at /judge (or on the normal sign-in page). The credential never expires. The first sign-in on a browser opens an isolated Class 7 Bangla Version student workspace; signing in again on that browser reopens it, and another browser gets its own. Workspaces are never deleted. Demo workspaces are students: they can't open admin pages or change credentials. Only the password's hash is stored. To revoke access, rotate the password, end judge sessions or turn judge access off.</p>
      {s.access ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Username</dt><dd>{s.access.username}</dd></div>
          <div><dt className="font-semibold">Status</dt><dd>{s.access.active ? "On" : "Off"} · password version {s.access.version}, set {new Date(s.access.rotatedAt).toLocaleString()}</dd></div>
          <div><dt className="font-semibold">Workspaces</dt><dd>{s.workspaces.live} signed in now · {s.workspaces.total} workspaces in total</dd></div>
          <div><dt className="font-semibold">AI requests by judges today</dt><dd>{s.aiToday} · limits {s.limits.perWorkspace} per workspace, {s.limits.allJudges} for all judges (JUDGE_AI_DAILY_LIMIT, JUDGE_AI_TOTAL_DAILY)</dd></div>
        </dl>
      ) : <p>Not provisioned.</p>}
      {shown && (
        <div className="rounded-[14px] border-2 border-brand bg-brand-soft p-4 text-sm" role="status">
          <p className="font-semibold">New judge password (shown once; copy it now)</p>
          <p className="mt-1 font-mono text-base">Username: {shown.username}<br />Password: {shown.password}</p>
        </div>
      )}
      {msg && <p className="text-sm" role="status">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-[12px] bg-brand px-4 py-2 font-semibold text-white" onClick={async () => { const r = await call(rotateJudgePassword()); if (r.ok) { setShown({ username: r.username, password: r.password }); setMsg(`Rotated. ${r.endedSessions} judge session(s) ended.`); load(); } else setMsg(`Not rotated: ${r.code}`); }}>Rotate password</button>
        <button type="button" className="rounded-[12px] border border-line px-4 py-2 font-semibold" onClick={async () => { const r = await call(endJudgeSessions()); setMsg(r.ok ? `${r.ended} judge session(s) ended.` : `Failed: ${r.code}`); load(); }}>End judge sessions</button>
        {s.access && <button type="button" className="rounded-[12px] border border-line px-4 py-2 font-semibold" onClick={async () => { await call(setJudgeAccess({ data: { active: !s.access!.active } })); load(); }}>{s.access.active ? "Turn judge access off" : "Turn judge access on"}</button>}
      </div>
    </div>
  );
}
