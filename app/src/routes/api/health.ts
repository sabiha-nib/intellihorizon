import { createFileRoute } from "@tanstack/react-router";

import { configuredProviders, PROVIDER_IDS } from "../../lib/ai/providers";
import { bindings } from "../../lib/bindings.server";

// Public health check for deploys and monitoring. Says whether the database answers and which AI providers have
// configuration, nothing more: no keys, no model names, no counts of anyone's data.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const b = bindings();
        let db = false;
        let migrations: number | null = null;
        try {
          const r = await b.DB?.prepare("SELECT COUNT(*) AS n FROM d1_migrations").first<{ n: number }>();
          db = !!b.DB;
          migrations = r?.n ?? null;
        } catch {
          try { db = !!(await b.DB?.prepare("SELECT 1 AS x").first()); } catch { db = false; }
        }
        const set = configuredProviders(b as unknown as Record<string, string | undefined>).map((c) => c.id);
        const providers = Object.fromEntries(PROVIDER_IDS.map((id) => [id, set.includes(id) ? "configured" : "not_configured"]));
        return Response.json({ ok: db, db, migrations, storage: !!b.STORAGE, providers }, { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
