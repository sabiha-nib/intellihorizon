import { useEffect, useState } from "react";

import { auditTrail, type Row } from "../../lib/api/admin.functions";
import { call } from "../auth/messages";

export function Audit() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    void call(auditTrail()).then((r) => r.ok && setRows((r as { entries: Row[] }).entries));
  }, []);
  if (!rows) return <p>Loading…</p>;
  if (!rows.length) return <p className="text-ink-mid">No administrative actions recorded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <thead>
          <tr className="border-b border-line text-ink-mid">
            <th className="py-2 pr-3">When (UTC)</th>
            <th className="py-2 pr-3">Who</th>
            <th className="py-2 pr-3">Action</th>
            <th className="py-2 pr-3">Target</th>
            <th className="py-2">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)} className="border-b border-line/60 align-top">
              <td className="py-2 pr-3 whitespace-nowrap">
                {String(r.created_at).slice(0, 16).replace("T", " ")}
              </td>
              <td className="py-2 pr-3">{r.username ? `@${String(r.username)}` : "—"}</td>
              <td className="py-2 pr-3 font-semibold">{String(r.action).replace(/_/g, " ")}</td>
              <td className="py-2 pr-3 font-mono text-[12px]">
                {String(r.target ?? "").slice(0, 46)}
              </td>
              <td className="py-2 font-mono text-[12px] text-ink-mid">
                {String(r.detail ?? "").slice(0, 120)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
