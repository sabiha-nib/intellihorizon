// Server-only configuration and services. On Vercel (Node) everything comes from environment variables:
// DATABASE_URL (Supabase Postgres, server role) and optionally SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for Storage.
// The DB and STORAGE objects keep the D1/R2-shaped API the rest of the server code was written against.
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

import { pgDatabase } from "./db/pg-d1.server";
import { postgresStore, supabaseStore } from "./db/storage.server";

type AppEnv = {
  DB?: D1Database;
  STORAGE?: R2Bucket;
  HF_ENV?: string;
  APP_SLUG?: string;
  // Optional secrets for account email (set in Higgsfield website settings).
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_ORIGIN?: string;
  // Secret that lets a signed-in account claim the admin role for curriculum imports.
  EDU_ADMIN_TOKEN?: string;
  // Optional AI provider settings (see lib/ai/provider.ts). Never sent to the browser.
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_BASE_URL?: string;
  AI_TIMEOUT_MS?: string;
  AI_DAILY_LIMIT?: string;
  AI_VISION?: string;
  EMBED_API_KEY?: string;
  EMBED_MODEL?: string;
  EMBED_BASE_URL?: string;
  EMBED_MIN_SIM?: string;
};

let cached: AppEnv | null = null;

export function bindings(): AppEnv {
  if (cached) return cached;
  const env = process.env as Record<string, string | undefined>;
  const db = env.DATABASE_URL ? pgDatabase(env.DATABASE_URL) : null;
  const store = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_STORAGE_BUCKET || "intellihorizon-files")
    : db ? postgresStore(db) : null;
  cached = {
    ...(env as AppEnv),
    DB: (db ?? undefined) as unknown as D1Database | undefined,
    STORAGE: (store ?? undefined) as unknown as R2Bucket | undefined,
  };
  return cached;
}
