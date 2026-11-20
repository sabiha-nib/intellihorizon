# Deploying IntelliHorizon (GitHub → Vercel, database on Supabase)

```
GitHub (private repo) ──push──▶ Vercel builds app/ (TanStack Start, Nitro "vercel" output)
        │                               │
        └── GitHub Actions CI           ├── static assets on Vercel's CDN
            (typecheck, unit tests,     └── server functions in bom1 (Mumbai) ─┐
             build, secret scan)                                               │ pooled Postgres (TLS)
                                                                               ▼
                                    Supabase project "IntelliHorizon" (ap-south-1): Postgres 17
                                    role ih_app (least privilege, RLS on every table; the public
                                    anon/authenticated API roles have no access to any table)
        AI providers (server-side only): Anthropic · Google Gemini · OpenAI
```

The browser never talks to Supabase directly: every query runs on the server as `ih_app`, and the app's own
authentication (salted PBKDF2 passwords, hashed session tokens) decides what each user may see. That is why existing
accounts kept their passwords through the migration.

Steps marked **(you)** need your own accounts.

## Already done

- Supabase project **IntelliHorizon**: schema (`app/supabase/migrations/*`, tracked in `ih_migrations`), curriculum
  content and all production records copied from the old database, row counts verified.
- Vercel project **intellihorizon**: root directory `app`, Bun install, `bun run build`, functions in `bom1`,
  production public, preview deployments private (Vercel Authentication). Environment variables set:
  `DATABASE_URL` (sensitive), model names, AI budgets and limits.

## 1. Put the code on GitHub (you)

1. github.com → New repository → name `intellihorizon`, **Private**, no README. Keep it private: it contains NCTB
   textbook passages, and NCTB's permission has not been received.
2. Push this code to it (from the `intellihorizon.bundle` file you were given, or from any clone):
   ```
   git clone intellihorizon.bundle intellihorizon && cd intellihorizon
   git remote set-url origin https://github.com/<you>/intellihorizon.git
   git push -u origin main
   ```

## 2. Connect Vercel to the repo (you)

Vercel → intellihorizon → Settings → Git → Connect Git Repository → pick `intellihorizon`. Every push to `main` then
deploys to production; every pull request gets a private preview. (Claude can do this step through the Vercel connector
once the Vercel GitHub app can see the repository.)

## 3. AI keys (you): Vercel → intellihorizon → Settings → Environment Variables → Add (type **Sensitive**)

| Name | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key |
| `OPENAI_API_KEY` | platform.openai.com → API keys |

Optional: `EDU_ADMIN_TOKEN` (32+ random characters), `RESEND_API_KEY` + `EMAIL_FROM` (email),
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (store uploads in Supabase Storage instead of the private `app_files`
table). Then Deployments → … → Redeploy. Never put keys in the repo or in a chat.

Model names and spending limits are ordinary variables already set: `ANTHROPIC_MODEL`, `GEMINI_MODEL`, `OPENAI_MODEL`,
`AI_MONTHLY_BUDGET_USD` (25), `AI_DAILY_BUDGET_USD` (3), `AI_DAILY_LIMIT` (60 per student), `JUDGE_AI_DAILY_LIMIT`
(40), `JUDGE_AI_TOTAL_DAILY` (400). A provider counts as configured only when its key and model are both set; Admin →
AI providers → "Test connection" makes one real request per provider and reports the result.

## 4. After deploying

- `node app/scripts/smoke.mjs https://<production-url>` checks pages, deep links, assets, the API and the database
  from a clean client.
- Admin → AI providers → test each provider, then run the Provider evaluation and score the answers.
- Sign in at `/judge` in a private window and walk the judge journey.

## Database changes

Add a new file to `app/supabase/migrations/` (additive changes only) and apply it with
`DATABASE_URL=<owner connection string> node app/scripts/pg-migrate.mjs app/supabase/migrations` (or in the Supabase SQL
editor, then insert the file name into `ih_migrations`). The app role `ih_app` cannot change the schema.

## Rolling back

- Code: Vercel → Deployments → pick the previous production deployment → "Promote to Production" (instant).
- Data: Supabase → Database → Backups (daily backups; point-in-time recovery on paid plans). Migrations never delete
  data.
- The old Higgsfield deployment still exists unchanged and can be used as a fallback until you retire it.
