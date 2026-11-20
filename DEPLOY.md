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

## 3. AI provider (you): free tiers, no purchase needed

IntelliTutor needs **one** working AI provider. All of these are free to start (no card), all keys go in Vercel →
intellihorizon → Settings → Environment Variables → Add, type **Sensitive**, environment Production, then Deployments →
… → Redeploy. Never put a key in the repo or in a chat.

| Priority | Name | Free key | Model variable (already set) | Free limits (checked 20 Nov 2026, can change) |
|---|---|---|---|---|
| 1 (main) | `GEMINI_API_KEY` | aistudio.google.com/apikey (Google account) | `GEMINI_MODEL` | Flash-class models only; per-model daily caps on aistudio.google.com/rate-limit. Outside the EU/UK/EEA, free-tier prompts may be used by Google to improve its products. |
| 2 (checker) | `GROQ_API_KEY` | console.groq.com/keys | `GROQ_MODEL` = `openai/gpt-oss-120b` | 30 requests/min, 1,000/day, 8K tokens/min |
| 3 (fallback) | `OPENROUTER_API_KEY` | openrouter.ai/settings/keys | `OPENROUTER_MODEL` = a model ending in `:free` | 20 requests/min, 50/day |

With Gemini alone the tutor works (one model). Adding Groq gives maths and translation answers an independent second
check. Hugging Face is not used: it removed free inference credits on 15 Oct 2026. Ollama works only on a local computer
(set `GROQ_BASE_URL=http://localhost:11434/v1` and `GROQ_MODEL` to a pulled model when running the app locally); Vercel
can't reach it.

The app keeps free-tier use low on its own: a validated answer is reused for the same student, question and evidence;
each student has a daily limit (`AI_DAILY_LIMIT`, 60) and judges share `JUDGE_AI_TOTAL_DAILY` (400); and each provider has a
daily cap a little under its free limit (`GEMINI_DAILY_LIMIT` 200, `GROQ_DAILY_LIMIT` 800, `OPENROUTER_DAILY_LIMIT` 45,
change any of them in Vercel). When every provider is at its cap or unavailable, the tutor still shows the checked
textbook passages and says the AI explanation is unavailable; it never invents one. Textbook retrieval, source
checks and arithmetic checks run on the server whichever provider answers.

Admin → AI providers shows each provider's model, free-tier note, today's calls against the cap, the exact missing
variable, and "Test connections", which makes one tiny real request per provider and reports the result and error.

Paid providers stay supported but off: `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are only used if you add them.

Optional: `EDU_ADMIN_TOKEN` (32+ random characters), `RESEND_API_KEY` + `EMAIL_FROM` (needed to send verification
and password-reset emails), `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (store uploads in Supabase Storage instead of the
private `app_files` table).

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
