# Deploying IntelliHorizon (GitHub → Cloudflare)

IntelliHorizon is one Cloudflare Worker (pages, assets and API) with a D1 database and an R2 bucket. GitHub holds
the code; GitHub Actions builds, tests and deploys it to your Cloudflare account. No other host is involved.

```
GitHub repo (private) ──push to main──▶ GitHub Actions: typecheck · unit tests · build · secret scan
                                              │
                                              ▼
                     Cloudflare: D1 migrations ─▶ wrangler deploy ─▶ smoke test of the live URL
                                              │
            Worker "intellihorizon"  ──  D1 "intellihorizon" (APAC)  ──  R2 "intellihorizon-files"
                     │
                     └── server-side only: Anthropic · Gemini · OpenAI (keys are Worker secrets)
```

Steps marked **(you)** need your own accounts; nothing else does.

## 1. One-time setup

1. **(you) Turn on R2.** Cloudflare dashboard → R2 Object Storage → Get started. (Free tier; Cloudflare asks for a
   payment method before enabling R2.)
2. **(you) Create a private GitHub repository** named `intellihorizon`, empty (no README). Keep it private: it
   contains NCTB textbook passages, and NCTB's permission to publish them has not been received.
3. **(you) Create the deploy token.** Cloudflare → My Profile → API Tokens → Create Token → template
   "Edit Cloudflare Workers". Add permissions: Account · D1 · Edit, Account · Workers R2 Storage · Edit.
   Limit it to your account.
4. **(you) Add two GitHub secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (Cloudflare dashboard, right-hand sidebar).
5. Push the code to the repository (`git push -u origin main`). The workflow in `.github/workflows/deploy.yml` runs,
   applies the database migrations, deploys and smoke-tests the site. The production URL is printed in the run log
   (`https://intellihorizon.<your-subdomain>.workers.dev`).
6. Restore the private production rows (your account, the owner-code hash, the judge credential) from the backup
   file you were given, after the first deploy: Cloudflare dashboard → D1 → intellihorizon → Console → paste and run.
   (Claude can also do this through the Cloudflare connector.)

## 2. Secrets (Worker → Settings → Variables and Secrets → Add → type "Secret")

| Name | What it is | Needed for |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | Claude |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key | Gemini |
| `OPENAI_API_KEY` | platform.openai.com → API keys | OpenAI |
| `EDU_ADMIN_TOKEN` | any random string of 32+ characters | optional second way to unlock admin |
| `RESEND_API_KEY`, `EMAIL_FROM` | resend.com | optional: verification and password-reset email |
| `EMBED_API_KEY` | an OpenAI-compatible embeddings key | optional: meaning-based search |

Or from a terminal with the repo checked out: `cd app && npx wrangler secret put ANTHROPIC_API_KEY`.
Never put keys in the repository, in `wrangler.jsonc`, or in a chat.

Non-secret settings are in `app/wrangler.jsonc` → `vars`: the three model names, `AI_MONTHLY_BUDGET_USD` (25),
`AI_DAILY_BUDGET_USD` (3), per-student and judge daily limits. Change them there (or override in the dashboard).
A provider counts as configured only when both its key and its model are set; Admin → AI providers shows the status
and has a "Test connection" check that makes one real request per provider.

## 3. After the keys are in

1. Admin → AI providers → test each provider (real request, no student data).
2. Admin → AI providers → Provider evaluation → Run. Score the answers.
3. Sign in at `/judge` in a private window and walk the judge journey.

## 4. Rolling back

- Code: Cloudflare dashboard → Workers → intellihorizon → Deployments → pick the previous version → Rollback
  (or `npx wrangler rollback`). Every deploy keeps its version.
- Data: migrations are additive and never delete data. D1 Time Travel restores the database to any minute in the
  last 30 days: `npx wrangler d1 time-travel restore intellihorizon --timestamp <ISO time>`.
- Take a manual export any time: `npx wrangler d1 export intellihorizon --remote --output backup.sql` (keep it private).

## 5. Custom domain (optional)

Workers → intellihorizon → Settings → Domains & Routes → Add → Custom domain (the domain must be on your Cloudflare
account). Then set the GitHub variable `PRODUCTION_URL` and the Worker variable `APP_ORIGIN` to the new address.
