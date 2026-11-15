# IntelliHorizon

*Expand the horizons of human learning.* (Formerly Educerro.)

A personalised learning platform for Bangladeshi students, starting with the Class 7 NCTB curriculum.
Live at https://educerro.higgsfield.app (the address is a deployed resource and keeps its original name).

## Stack

- React 19 + TanStack Start, server-rendered on a Cloudflare Worker (Higgsfield hosting).
- D1 (SQLite, FTS5 trigram search) for all data; R2 for profile pictures.
- No external AI model. The tutor is retrieval-grounded: it finds and quotes approved textbook passages and never generates textbook content.
- Tailwind v4 tokens in `src/styles.css`. The colour palette is unchanged by the rename.

## What is where

| Area | Files |
|---|---|
| Curriculum registry (8 subjects, 9 books, 110 chapters) | `src/lib/curriculum/registry.ts`, `data/grade7-books.json`, migration `0006` |
| Accounts, sessions, rate limits | `src/lib/auth/*`, `src/lib/api/auth.functions.ts` |
| Tutor (retrieval, scope, personas, ask-differently) | `src/lib/api/tutor.functions.ts`, `src/lib/curriculum/retrieval.server.ts`, `src/lib/tutor/teach.ts` |
| Learning rules (grading, XP, levels, streak, mastery, radar, adaptive level) | `src/lib/learning/rules.ts` (pure, unit-tested) |
| Learning engine (attempts, ledger, achievements, audit) | `src/lib/learning/engine.server.ts` |
| Student features (dashboard, sessions, map, path, radar, revision) | `src/lib/api/universe.functions.ts`, `src/routes/*` |
| Content Studio (import, OCR review, question review, audit) | `src/routes/admin.tsx`, `src/components/admin/*`, `src/lib/api/admin.functions.ts` |
| PWA | `public/sw.js`, `public/manifest.webmanifest`, `public/offline.html`, `src/components/universe/Pwa.tsx` |

## Rules the product keeps

- Exactly eight subjects. Soptoborna and Anandapath are two books under Bangla 1st Paper.
- English-version books are not available and nothing is translated to stand in for them.
- Only approved text is searchable; only published questions reach students (a database trigger enforces this).
- XP is a ledger with `UNIQUE(user, kind, ref)`: a replayed or duplicated event pays nothing.
- A chapter is "demonstrated" only after 5 different questions right, one due revision right and 70% recent accuracy. Opening a chapter is "introduced", never more.
- Prerequisite links between chapters are not drawn, because the books state none.
- Signing up never grants admin. Admin needs the one-time owner code (only its hash is stored) or the `EDU_ADMIN_TOKEN` secret; every attempt is audited.

## Names kept on purpose after the rename

Changing these would break existing records or deployed resources: the site address, cookie `edu_sid`, local-storage keys `edu_*`, the secret `EDU_ADMIN_TOKEN`, the question source value `educerro_authored`, the text-pack format `educerro-text-pack`, and migration file names. Records written before the rename that say "Educerro" are shown as "IntelliHorizon" at display time; stored rows are untouched.

## Production configuration

Set in Higgsfield website settings (all optional):

- `EDU_ADMIN_TOKEN` (32+ characters): a second way to unlock admin.
- `RESEND_API_KEY`, `EMAIL_FROM`: enables verification and password-reset email. Without them the app says email isn't set up.
- `APP_ORIGIN`: overrides the site origin used in emailed links.
- AI explanations (all three required to switch on; there is no built-in default model):
  - `AI_PROVIDER`: `openai` (any OpenAI-compatible Chat Completions API) or `anthropic`.
  - `AI_API_KEY`: the provider key. Read only on the server; never in the browser bundle (a test checks this).
  - `AI_MODEL`: the model id.
  - Optional: `AI_BASE_URL` (https only), `AI_TIMEOUT_MS` (default 20000), `AI_DAILY_LIMIT` per student (default 60),
    `AI_VISION=on` to read homework photos (the model must accept images).
  Without them the tutor shows checked textbook text only and says AI explanations aren't switched on.

Migrations in `migrations/` are additive and are applied on deploy.

## AI tutor: how an answer is built

Student question -> signed-in learner context (class, version, chapter in focus, recent practice and repeated mistakes
on that chapter only) -> subject resolution (asks which subject when the best matches come from two) -> retrieval of
student-visible passages only (`STUDENT_VISIBLE` in `lib/curriculum/retrieval.server.ts`) -> if nothing is found, an
honest "not in your books" with no model call -> the provider (`lib/ai/provider.ts`) gets only those passages ->
`validateExplanation` (`lib/ai/grounding.ts`) removes citations to records that weren't retrieved, drops quotations not
found word for word in the cited passage, strips quotation marks from invented quotes, marks any block naming a page that
isn't the cited source's printed page as "unverified", labels check questions as AI-made practice, and rejects the whole
reply if it needed four or more corrections -> the student sees each block labelled (from the textbook / explained from
the textbook / general / AI practice / couldn't be checked) above the real source cards -> `ai_requests` logs metadata only.
On a timeout, outage, rate limit or invalid reply the student still gets the textbook passages and an honest note.

## Content trust lifecycle

Two independent fields on every passage (migration 0010):
- `review_status`: NULL (extracted) -> `ocr_corrected` -> `checked` (word by word against the page image) ->
  `teacher_reviewed` (with the teacher's name) or `rejected`.
- `publish_status`: `draft` -> `approved` -> `published` -> `withdrawn`. NULL on older rows means "follow the book's approval".
Students see a passage only if it is published, or it is unreviewed, unflagged text of a book an admin approved as a whole;
never rejected or withdrawn text. Quality warnings (`lib/curriculum/quality.ts`): low OCR confidence, unchecked
mathematics, unbalanced maths markup, duplicate, very short, no printed page, no chapter. All but "short" and
"no chapter" hold a passage back until a reviewer clears them; mathematics can only be marked checked with an explicit
"every expression matches the printed page" confirmation. Teacher review is not an NCTB endorsement, and publishing is
not copyright permission (that is `textbooks.license_status`). Re-imports and page corrections never delete or overwrite
reviewed, approved, published or withdrawn passages. Every review action is in `passage_reviews` and `audit_log`.

## Importing a text pack

```
bun scripts/content/import-pack.ts <pack.json[.gz]> <out-dir> [book-key,...]
wrangler d1 execute DB --local --file <out-dir>/<key>.sql     # or import the pack in Content Studio
```
Validates each book against the registry (id, key, page count), classifies pages, segments passages with the same code
as the app, flags quality problems, skips repeated text, and writes idempotent SQL (running it twice changes nothing;
reviewed passages are never touched). Everything arrives as `draft`.

## Running the checks

```
bun install
bun test tests/                 # unit tests
bunx tsc --noEmit               # types
bunx vite build                 # production build
# end-to-end (needs wrangler dev on :8787 with a fresh local D1, see tests/*.mjs headers)
node tests/e2e.universe.mjs && node tests/e2e.grade7.mjs && node tests/e2e.curriculum.mjs && node tests/e2e.accounts.mjs
node tests/e2e.ai.mjs && node tests/e2e.content.mjs && node tests/e2e.inputs.mjs && node tests/e2e.security.mjs
# the AI suites need the test double: node tests/mock-ai.mjs (port 8790) and AI_* vars pointing at it
```

## Implementation log (IntelliHorizon transformation)

1. Inspected the repository and live database (8 subjects, 16 offerings, 9 books, 110 chapters; 22 published questions).
2. Renamed the product everywhere a person can see it; kept internal identifiers (above).
3. Tutor: five teaching approaches and seven "ask differently" styles that change presentation only.
4. Adaptive practice level (Foundation, Developing, Applied, Challenging) from a published rule; stored with each session.
5. Sessions now persist a summary: attempted, right and wrong, misconceptions, XP, minutes (when reliable), next step.
6. Knowledge Map: six node states with per-node evidence and next step. Horizon Path added.
7. Misconception Radar: evidence, cautious confidence, and whether a pattern is improving.
8. Levels renamed (Explorer to Mastermind); achievements renamed; landing page and dashboard updated.

## Phase 2 log

1. Baseline re-run before changes: unit 63/63, universe 65/65, grade7 44/44, curriculum 29/29 (one earlier run timed out
   registering a test account, then passed), accounts 51/51, layout passed.
2. Grounded AI explanation engine with a provider abstraction, validation, fallback and metadata-only logging.
3. Passage trust lifecycle, review history, quality warnings; importer and page correction made safe for reviewed text.
4. Repeatable, idempotent import pipeline (`scripts/content/import-pack.ts`).
5. Content Studio: Coverage (real counts, filters) and Passage review (side-by-side PDF page rendered on the
   reviewer's device, correction, checks, teacher review, approve, publish, withdraw, reject, history).
6. Homework photos (validated, re-encoded on device, read by the configured vision model, confirmed by the student,
   image not stored); PDF errors named (scanned, password, damaged, empty, long); voice with language choice and confirmation.
7. Ambiguous questions ask which subject; Misconception Radar shows last seen and a suggested fix; revision says why
   each item is due; Explain It Back gets an optional, labelled AI second opinion.

## Deferred

- Owner action: claim admin with the owner code, then import the Class 7 text pack in Content Studio (or run the
  pipeline) and review passages. The live site has no OCR text yet beyond the 16 checked passages.
- Owner action: set the AI_* secrets to switch on AI explanations, and RESEND_API_KEY + EMAIL_FROM for email.
- Human correction of Mathematics OCR; questions beyond Mathematics Chapter 2; key ideas beyond the three chapters with lessons.
- English-version books (not supplied) and NCTB's written permission (not received).
- Teacher accounts (teacher reviews are recorded by an admin with the teacher's name); parent views; leaderboards.
