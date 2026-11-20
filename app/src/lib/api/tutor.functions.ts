import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { currentUser, rateLimit, sameOrigin } from "../auth/session.server";
import { bindings } from "../bindings.server";
import { retrieve, type Scope } from "../curriculum/retrieval.server";
import { catalog, studentContext } from "../curriculum/student.server";
import { SUBJECT_IDS, SUBJECTS, isSubjectId, offeringFor, stripScopeNames } from "../curriculum/registry";
import { resolveQuestionScope, validateSubjectContext } from "../curriculum/subject-scope.server";
import { detectIntent, evalArithmetic, isArithmetic, keyTerms, queryTerms, stem, toAsciiDigits } from "../curriculum/text";
import type { ThreadSummary, TutorMessage, TutorPayload } from "../tutor/types";
import { PERSONA_IDS, STYLE_IDS, STYLE_PROMPT, guideQuestions, styleTerms, teachingMode } from "../tutor/teach";
import { LESSONS as CHAPTER_LESSONS } from "../learning/lessons";
import { learnerContext } from "../learning/context.server";
import { explain } from "../ai/explain.server";
import { embedConfig, rrf } from "../ai/provider";
import { semanticSearch } from "../curriculum/semantic.server";
import { buildExcerpts, visibleById } from "../curriculum/retrieval.server";
import { rewriteToBangla, rewriteToEnglish } from "../curriculum/glossary";
import { MAX_EXCERPTS } from "../curriculum/config";
import { LANG_MODES, detectLanguage, explanationLanguage } from "../tutor/language";
import { checkWorking, looksLikeWorking } from "../tutor/working";

type Fail = { ok: false; code: string };
const fail = (code: string): Fail => ({ ok: false, code });
const now = () => new Date().toISOString();

async function guard() {
  const { DB } = bindings();
  if (!DB) return { error: fail("unavailable_now") } as const;
  if (!sameOrigin()) return { error: fail("bad_origin") } as const;
  const me = await currentUser();
  if (!me) return { error: fail("signed_out") } as const;
  return { DB, me, error: null } as const;
}

const LESSONS: { key: "fall" | "share" | "tree"; route: "/learn/fall" | "/learn/share" | "/learn/tree"; words: string[] }[] = [
  { key: "fall", route: "/learn/fall", words: ["gravity", "free fall", "falling", "fall", "অভিকর্ষ", "পড়ন্ত", "মুক্তভাবে"] },
  { key: "share", route: "/learn/share", words: ["fraction", "denominator", "numerator", "ভগ্নাংশ", "লব", "হর"] },
  { key: "tree", route: "/learn/tree", words: ["photosynthesis", "photosynthesi", "chlorophyll", "সালোকসংশ্লেষণ", "ক্লোরোফিল"] },
];
function lessonFor(q: string) {
  const low = toAsciiDigits(q.toLowerCase());
  const l = LESSONS.find((x) => x.words.some((w) => low.includes(w)));
  return l ? { route: l.route, key: l.key } : null;
}

const CONFUSED = /(বুঝিনি|বুঝতে পারছি না|বুঝলাম না|বুঝি নাই|আবার বলো|সহজ করে|don'?t understand|do not understand|confus|not clear|still lost|simpler|explain again)/i;

function parsePayload(s: string | null): TutorPayload | null {
  if (!s) return null;
  try { return JSON.parse(s) as TutorPayload; } catch { return null; }
}

/* ─────────── Scope for the context picker ─────────── */

export const tutorScope = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  const me = await currentUser();
  if (!DB || !me) return { ok: false as const, code: "signed_out" };
  const ctx = await studentContext(DB, me.id);
  const offering = offeringFor(ctx.grade, ctx.medium);
  const books = ctx.grade !== null && ctx.medium !== null ? await catalog(DB, ctx.grade, ctx.medium) : [];
  const ready = books.filter((b) => b.status === "indexed");
  const chapters = ready.length
    ? (await DB.prepare(`SELECT id, textbook_id, position, label, title FROM chapters WHERE textbook_id IN (${ready.map(() => "?").join(",")}) ORDER BY position`).bind(...ready.map((b) => b.id)).all<{ id: string; textbook_id: string; position: number; label: string | null; title: string }>()).results ?? []
    : [];
  // All eight subjects are always listed; each says which of its books the tutor can search right now.
  const subjects = SUBJECTS.map((s) => ({ id: s.id, label: s.label, short: s.short, hue: s.hue, books: books.filter((b) => b.subject_key === s.id).map((b) => ({ id: b.id, title: b.title, language: b.language, status: b.status })) }));
  return { ok: true as const, ctx, offering, subjects, books: ready, chapters };
});

/* ─────────── Threads ─────────── */

export const listThreads = createServerFn({ method: "POST" })
  .inputValidator(z.object({ search: z.string().max(100).default(""), subjectId: z.enum(SUBJECT_IDS).nullable().default(null) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const q = data.search.trim();
    const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    const where = ["th.user_id = ?"];
    const args: string[] = [g.me.id];
    if (q) { where.push("(th.title LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM tutor_messages m WHERE m.thread_id = th.id AND m.role = 'student' AND m.text LIKE ? ESCAPE '\\'))"); args.push(like, like); }
    if (data.subjectId) { where.push("COALESCE(th.subject_key, t.subject_key) = ?"); args.push(data.subjectId); }
    const rows = await g.DB.prepare(
      `SELECT th.id, th.title, th.updated_at, th.textbook_id, th.chapter_id, COALESCE(th.subject_key, t.subject_key) AS subject_key,
              COALESCE(c.title, t.title) AS context_label
         FROM tutor_threads th LEFT JOIN textbooks t ON t.id = th.textbook_id LEFT JOIN chapters c ON c.id = th.chapter_id
        WHERE ${where.join(" AND ")}
        ORDER BY th.updated_at DESC LIMIT 50`,
    ).bind(...args).all<{ id: string; title: string; updated_at: string; textbook_id: string | null; chapter_id: string | null; subject_key: string | null; context_label: string | null }>();
    const threads: ThreadSummary[] = (rows.results ?? []).map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at, textbookId: r.textbook_id, chapterId: r.chapter_id, contextLabel: r.context_label, subjectKey: r.subject_key }));
    return { ok: true as const, threads };
  });

export const getThread = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const th = await g.DB.prepare(
      `SELECT th.id, th.title, th.textbook_id, th.chapter_id, COALESCE(th.subject_key, t.subject_key) AS subject_key, t.title AS book_title, c.title AS chapter_title, c.position AS chapter_position
         FROM tutor_threads th LEFT JOIN textbooks t ON t.id = th.textbook_id LEFT JOIN chapters c ON c.id = th.chapter_id
        WHERE th.id = ? AND th.user_id = ?`,
    ).bind(data.id, g.me.id).first<{ id: string; title: string; textbook_id: string | null; chapter_id: string | null; subject_key: string | null; book_title: string | null; chapter_title: string | null; chapter_position: number | null }>();
    if (!th) return fail("not_found");
    const rows = await g.DB.prepare("SELECT id, role, text, payload, feedback, created_at FROM (SELECT * FROM tutor_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 200) ORDER BY id")
      .bind(th.id).all<{ id: number; role: "student" | "tutor"; text: string; payload: string | null; feedback: number | null; created_at: string }>();
    const messages: TutorMessage[] = (rows.results ?? []).map((m) => ({ id: m.id, role: m.role, text: m.text, payload: parsePayload(m.payload), feedback: m.feedback, createdAt: m.created_at }));
    return { ok: true as const, thread: th, messages };
  });

export const renameThread = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), title: z.string().min(1).max(80) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const r = await g.DB.prepare("UPDATE tutor_threads SET title = ? WHERE id = ? AND user_id = ?").bind(data.title.trim(), data.id, g.me.id).run();
    return (r.meta?.changes ?? 0) > 0 ? { ok: true as const } : fail("not_found");
  });

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const owned = await g.DB.prepare("SELECT id FROM tutor_threads WHERE id = ? AND user_id = ?").bind(data.id, g.me.id).first();
    if (!owned) return fail("not_found");
    await g.DB.batch([g.DB.prepare("DELETE FROM tutor_messages WHERE thread_id = ?").bind(data.id), g.DB.prepare("DELETE FROM tutor_threads WHERE id = ?").bind(data.id)]);
    return { ok: true as const };
  });

/* ─────────── Asking ─────────── */

export const ask = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    threadId: z.string().uuid().nullable(),
    question: z.string().min(1).max(1000),
    // Only the eight registry subject ids are accepted; anything else is rejected by the validator.
    subjectId: z.enum(SUBJECT_IDS).nullable().default(null),
    textbookId: z.string().uuid().nullable().default(null),
    chapterId: z.string().uuid().nullable().default(null),
    /** true: the subject/book/chapter fields are the student's current choice (null = all subjects). false: reuse the thread's. */
    scopeExplicit: z.boolean().default(false),
    /** Teaching approach. It changes presentation and follow-ups only; retrieval rules stay the same. */
    persona: z.enum(PERSONA_IDS).default("mentor"),
    style: z.enum(STYLE_IDS).nullable().default(null),
    /** Explanation language: auto (follow the question), Bangla, English or mixed. Remembered on the profile. */
    langMode: z.enum(LANG_MODES as [string, ...string[]]).default("auto"),
  }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const question = data.question.normalize("NFC").trim();
    if (!question) return fail("empty_question");
    if (!(await rateLimit(`ask:${g.me.id}`, 40, 600))) return fail("rate_limited");

    const student = await studentContext(g.DB, g.me.id);
    let threadId = data.threadId;
    let requested = { subjectId: data.subjectId as string | null, textbookId: data.textbookId, chapterId: data.chapterId };
    if (threadId) {
      const th = await g.DB.prepare("SELECT id, subject_key, textbook_id, chapter_id FROM tutor_threads WHERE id = ? AND user_id = ?").bind(threadId, g.me.id)
        .first<{ id: string; subject_key: string | null; textbook_id: string | null; chapter_id: string | null }>();
      if (!th) return fail("not_found");
      if (!data.scopeExplicit && !data.subjectId && !data.textbookId && !data.chapterId)
        requested = { subjectId: th.subject_key && isSubjectId(th.subject_key) ? th.subject_key : null, textbookId: th.textbook_id, chapterId: th.chapter_id };
    }
    // Learning memory for this conversation: only the previous turn (never the whole history), plus confusion signals.
    let prev: { question: string; payload: TutorPayload | null } | null = null;
    let confusion = 0;
    if (threadId) {
      const recent = (await g.DB.prepare("SELECT role, text, payload FROM tutor_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 8").bind(threadId).all<{ role: string; text: string; payload: string | null }>()).results ?? [];
      const lastTutor = recent.find((m) => m.role === "tutor");
      const lastStudent = recent.find((m) => m.role === "student");
      if (lastStudent) prev = { question: lastStudent.text, payload: parsePayload(lastTutor?.payload ?? null) };
      confusion = recent.filter((m) => m.role === "student" && CONFUSED.test(m.text)).length;
    }
    if (CONFUSED.test(question)) confusion++;
    if (data.style === "beginner") confusion++;
    if (data.langMode !== "auto") await g.DB.prepare("UPDATE profiles SET tutor_lang = ? WHERE user_id = ?").bind(data.langMode, g.me.id).run().catch(() => undefined);
    const checked = await validateSubjectContext(g.DB, student, requested);
    if (!checked.ok) return fail(checked.code);
    const selected = checked.ctx;

    const offering = offeringFor(student.grade, student.medium);
    const resolved = resolveQuestionScope(question, student, selected);
    // A book or subject named in the question decides where to search; its name is not itself a search word.
    let terms = queryTerms(resolved.kind === "scope" ? stripScopeNames(question, { bookId: resolved.book?.id, subjectId: resolved.from === "question" ? resolved.ctx.subjectId : null }) : question);
    const base: TutorPayload = {
      status: "needs_context", intent: detectIntent(question), terms, excerpts: [], keyTerms: [],
      scope: { grade: student.grade, medium: student.medium, textbookId: selected.textbookId, chapterId: selected.chapterId, booksInScope: 0, subjectKey: selected.subjectId },
      subject: { subjectId: selected.subjectId, from: selected.subjectId ? "selected" : null, book: null },
      offering: offering ? { grade: offering.grade, medium: offering.medium, status: offering.status } : null,
      practice: null, lesson: lessonFor(question),
    };
    const langInfo = detectLanguage(question);
    const teachMode = teachingMode(data.persona, data.style);
    const explainLang = explanationLanguage(question, data.langMode as "auto", teachMode.lang);
    base.language = { question: langInfo.primary, mixed: langInfo.mixed, explanation: explainLang };
    // A follow-up with few words of its own ("why?", "explain more simply") continues the previous topic.
    let followUp = false;
    if (prev?.payload?.terms?.length && terms.length < 2 && !isArithmetic(question)) {
      terms = [...new Set([...prev.payload.terms, ...terms])].slice(0, 12);
      followUp = true;
      base.terms = terms;
    }
    let payload: TutorPayload;
    if (looksLikeWorking(question)) {
      // Worked steps: checked line by line with exact arithmetic; the first step that doesn't hold is shown.
      payload = { ...base, status: "working_check", working: checkWorking(question), lesson: null };
    } else if (isArithmetic(question)) {
      try {
        const r = evalArithmetic(question);
        payload = { ...base, status: "calculation", calc: { expression: question.replace(/[=?]\s*$/, "").trim(), decimal: r.decimal, fraction: r.fraction } };
      } catch (e) {
        payload = { ...base, status: "calculation", calc: { expression: question, error: (e as Error).message } };
      }
    } else if (resolved.kind === "unsupported") {
      payload = { ...base, status: "unsupported_subject", unsupported: resolved.label, lesson: null };
    } else if (resolved.kind === "conflict") {
      payload = { ...base, status: "subject_conflict", conflict: { selected: resolved.selected, named: resolved.named, bookId: resolved.bookId }, lesson: null };
    } else if (!terms.length) {
      payload = base;
    } else {
      const ctx = resolved.ctx;
      const scope: Scope = { grade: student.grade, medium: student.medium, subjectKey: ctx.subjectId, textbookId: ctx.textbookId, chapterId: ctx.chapterId };
      const mode = teachMode;
      let r = await retrieve(g.DB, scope, terms);
      // Cross-language retrieval: an English (or mixed) question about Bangla-medium text is rewritten into the book's
      // own terms with the curriculum glossary, and the rewrite is reported to the student. No match, no rewrite.
      let rewrite: TutorPayload["rewrite"] = null;
      if (!r.excerpts.length && r.booksInScope > 0) {
        const rw = langInfo.primary === "en" || langInfo.mixed ? rewriteToBangla(question) : rewriteToEnglish(question);
        if (rw.terms.length) {
          const t2 = [...new Set(rw.terms.flatMap((x) => queryTerms(x)))];
          const r2 = await retrieve(g.DB, scope, t2);
          if (r2.excerpts.length) { r = r2; terms = t2; rewrite = { from: langInfo.primary, matched: rw.matched, searched: rw.terms }; }
        }
      }
      // Hybrid retrieval: when an embedding provider is configured and passages are indexed, semantic matches are fused
      // with keyword matches (reciprocal-rank fusion). Same trust rule and scope; otherwise keyword-only, said plainly.
      const ecfg = embedConfig(bindings() as unknown as Record<string, string | undefined>);
      const sem = await semanticSearch(g.DB, ecfg, scope, rewrite ? `${question} ${rewrite.searched.join(" ")}` : question);
      let topSim: number | null = null;
      // Fail closed: when keyword search found nothing, a meaning-only match is used only if it is strong (>= 0.6),
      // and even then the answer is marked partial, never fully grounded.
      const semUsable = sem.active && sem.hits.length > 0 && (r.excerpts.length > 0 || sem.hits[0].sim >= 0.6);
      if (sem.active && sem.hits.length) topSim = sem.hits[0].sim;
      if (semUsable) {
        const lexIds = r.excerpts.map((e) => e.source.passageId);
        const order = rrf([lexIds, sem.hits.map((h) => h.id)]).slice(0, MAX_EXCERPTS);
        const missing = order.filter((id) => !lexIds.includes(id));
        const extra = await buildExcerpts(g.DB, await visibleById(g.DB, scope, missing), terms);
        const all = [...r.excerpts, ...extra];
        const semanticOnly = !r.excerpts.length;
        r = { ...r, excerpts: order.map((id) => all.find((e) => e.source.passageId === id)).filter((e): e is NonNullable<typeof e> => !!e), topChapter: r.topChapter ?? extra[0]?.source.chapter ?? null };
        if (semanticOnly) r.bestCoverage = 0.4;
      }
      base.retrieval = { mode: sem.active ? "hybrid" : "lexical", semantic: sem.active, reason: sem.active ? null : sem.reason ?? null, topSim, indexed: sem.indexed };
      base.rewrite = rewrite;
      base.followUp = followUp;
      // "Example" and "steps" put passages that contain worked examples or solutions first. Coverage is still judged on the question's own words.
      const prefer = styleTerms(data.style);
      if (prefer.length) r.excerpts = [...r.excerpts].sort((a, b) => Number(prefer.some((w) => b.text.includes(w))) - Number(prefer.some((w) => a.text.includes(w))));
      // Simplifying means less at once: the shortest matching passage first, and only that one.
      if (mode.simplify && r.excerpts.length > 1) r.excerpts = [...r.excerpts].sort((a, b) => a.text.length - b.text.length).slice(0, 1);
      let status: TutorPayload["status"] = r.booksInScope === 0 ? "no_books" : r.excerpts.length === 0 ? "not_found" : r.bestCoverage >= 0.6 || (terms.length <= 2 && r.bestCoverage === 1) ? "grounded" : "partial";
      // With no subject chosen, if the two best matches come from different subjects, ask which one is meant instead of guessing.
      let choices: TutorPayload["choices"];
      if ((status === "grounded" || status === "partial") && !ctx.subjectId && !ctx.textbookId && r.excerpts.length >= 2 && r.excerpts[0].source.subjectKey !== r.excerpts[1].source.subjectKey) {
        const seen = new Map<string, string>();
        for (const e of r.excerpts) if (!seen.has(e.source.subjectKey)) seen.set(e.source.subjectKey, e.source.subjectName);
        choices = [...seen].map(([subjectId, name]) => ({ subjectId, name }));
        status = "ambiguous";
      }
      const chapterId = scope.chapterId ?? r.topChapter?.id ?? null;
      let practice: TutorPayload["practice"] = null;
      if (chapterId && (status === "grounded" || status === "partial")) {
        const q = await g.DB.prepare("SELECT c.title, (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = c.id AND q.status = 'published') AS n FROM chapters c WHERE c.id = ?").bind(chapterId).first<{ title: string; n: number }>();
        if (q && q.n > 0) practice = { chapterId, chapterTitle: q.title, count: q.n };
      }
      const found = status === "grounded" || status === "partial";
      const kt = r.excerpts.length ? keyTerms(r.excerpts[0].text.replace(/…/g, ""), terms) : [];
      const teach: NonNullable<TutorPayload["teach"]> = { persona: data.persona, style: data.style, lang: mode.lang };
      if (found && mode.guide) teach.guide = guideQuestions(kt);
      if (chapterId && mode.steps) {
        const l = CHAPTER_LESSONS[chapterId];
        teach.steps = l ? { pages: l.pages, steps: l.steps, chapterId } : null;
      }
      if (chapterId && mode.challenge) {
        const c = await g.DB.prepare("SELECT COUNT(*) AS n FROM questions q WHERE q.chapter_id = ? AND q.status = 'published' AND q.difficulty >= 2 AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = ? AND a.question_id = q.id AND a.correct = 1)").bind(chapterId, g.me.id).first<{ n: number }>();
        teach.challenge = c && c.n > 0 ? { chapterId, count: c.n } : null;
      }
      if (chapterId && mode.exam) {
        const [obj, ex] = await Promise.all([
          g.DB.prepare("SELECT o.text, o.source_page, t.page_offset FROM objectives o JOIN chapters c ON c.id = o.chapter_id JOIN textbooks t ON t.id = c.textbook_id WHERE o.chapter_id = ? ORDER BY o.position LIMIT 8").bind(chapterId).all<{ text: string; source_page: number | null; page_offset: number | null }>(),
          g.DB.prepare("SELECT COUNT(*) AS n FROM questions WHERE chapter_id = ? AND status = 'published' AND source = 'textbook_exercise'").bind(chapterId).first<{ n: number }>(),
        ]);
        teach.exam = { chapterId, objectives: (obj.results ?? []).map((o) => ({ text: o.text, printedPage: o.source_page !== null && o.page_offset !== null ? o.source_page - o.page_offset : null })), exercises: ex?.n ?? 0 };
      }
      // AI explanation: only when approved text was found, and only from that text. Without configuration or on failure
      // the student still gets the retrieved passages; nothing is generated without sources.
      let ai: TutorPayload["ai"];
      if (found && status !== "ambiguous") {
        const learner = await learnerContext(g.DB, g.me.id, { chapterId, grade: student.grade, medium: student.medium, lang: explainLang === "en" ? "en" : "bn" });
        const pa = prev?.payload?.ai;
        const previous = prev ? { question: prev.question, tutorSaid: pa?.blocks.find((b) => b.role === "direct")?.text ?? null, tutorAsked: pa?.blocks.find((b) => b.role === "check")?.text ?? null } : null;
        ai = await explain(g.DB, bindings() as unknown as Record<string, string | undefined>, {
          userId: g.me.id, question, persona: data.persona, lang: explainLang, excerpts: r.excerpts, learner, evidence: status === "partial" ? "partial" : "sufficient",
          style: data.style ? STYLE_PROMPT[data.style] : null, socratic: (data.persona === "socratic" && data.style !== "direct") || data.style === "questions", previous, subjectKey: ctx.subjectId,
        });
      }
      payload = {
        ...base, status, excerpts: status === "ambiguous" ? [] : r.excerpts, practice: status === "ambiguous" ? null : practice, teach, choices, ai,
        keyTerms: kt,
        scope: { ...base.scope, subjectKey: ctx.subjectId, textbookId: ctx.textbookId, chapterId: ctx.chapterId, booksInScope: r.booksInScope },
        subject: { subjectId: ctx.subjectId, from: resolved.from, book: resolved.book },
        ...(resolved.mentioned ? { conflict: { selected: ctx.subjectId ?? "", named: resolved.mentioned, bookId: null } } : {}),
      };
    }

    // DoubtDetector: repeated "I don't understand" / "simpler" requests in this conversation. The tutor offers help; it
    // never guesses how the student feels.
    if (confusion >= 2 && payload.status !== "working_check") payload.doubt = { signals: confusion };
    const ts = now();
    const keep = payload.subject?.subjectId ?? selected.subjectId;
    if (!threadId) {
      threadId = crypto.randomUUID();
      const title = [...question].slice(0, 60).join("") + ([...question].length > 60 ? "…" : "");
      await g.DB.prepare("INSERT INTO tutor_threads (id, user_id, title, subject_key, textbook_id, chapter_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(threadId, g.me.id, title, keep, selected.textbookId, selected.chapterId, ts, ts).run();
    } else if (data.scopeExplicit || data.subjectId || data.textbookId || data.chapterId) {
      await g.DB.prepare("UPDATE tutor_threads SET subject_key = ?, textbook_id = ?, chapter_id = ? WHERE id = ? AND user_id = ?").bind(selected.subjectId, selected.textbookId, selected.chapterId, threadId, g.me.id).run();
    }
    const res = await g.DB.batch([
      g.DB.prepare("INSERT INTO tutor_messages (thread_id, role, text, payload, created_at) VALUES (?, 'student', ?, NULL, ?)").bind(threadId, question, ts),
      g.DB.prepare("INSERT INTO tutor_messages (thread_id, role, text, payload, created_at) VALUES (?, 'tutor', '', ?, ?)").bind(threadId, JSON.stringify(payload), ts),
      g.DB.prepare("UPDATE tutor_threads SET updated_at = ? WHERE id = ?").bind(ts, threadId),
    ]);
    const sid = Number(res[0].meta?.last_row_id ?? 0);
    const tid = Number(res[1].meta?.last_row_id ?? 0);
    const messages: TutorMessage[] = [
      { id: sid, role: "student", text: question, payload: null, feedback: null, createdAt: ts },
      { id: tid, role: "tutor", text: "", payload, feedback: null, createdAt: ts },
    ];
    return { ok: true as const, threadId, messages };
  });

/** Deterministic explain-back check: which of the textbook's key words appear in the student's own explanation. */
export const explainBack = createServerFn({ method: "POST" })
  .inputValidator(z.object({ messageId: z.number().int().positive(), text: z.string().min(1).max(1500) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const m = await g.DB.prepare("SELECT m.id, m.thread_id, m.payload FROM tutor_messages m JOIN tutor_threads th ON th.id = m.thread_id WHERE m.id = ? AND m.role = 'tutor' AND th.user_id = ?")
      .bind(data.messageId, g.me.id).first<{ id: number; thread_id: string; payload: string | null }>();
    const p = m ? parsePayload(m.payload) : null;
    if (!m || !p || !p.keyTerms.length) return fail("not_found");
    const words = new Set(toAsciiDigits(data.text.normalize("NFC").toLowerCase()).replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).map(stem));
    const joined = [...words].join(" ");
    const covered = p.keyTerms.filter((k) => words.has(k) || joined.includes(k));
    const missing = p.keyTerms.filter((k) => !covered.includes(k));
    const check: TutorPayload = { ...p, status: "explain_check", excerpts: [], practice: null, lesson: null, check: { covered, missing, forMessageId: m.id } };
    const ts = now();
    const res = await g.DB.batch([
      g.DB.prepare("INSERT INTO tutor_messages (thread_id, role, text, payload, created_at) VALUES (?, 'student', ?, NULL, ?)").bind(m.thread_id, data.text.trim(), ts),
      g.DB.prepare("INSERT INTO tutor_messages (thread_id, role, text, payload, created_at) VALUES (?, 'tutor', '', ?, ?)").bind(m.thread_id, JSON.stringify(check), ts),
      g.DB.prepare("UPDATE tutor_threads SET updated_at = ? WHERE id = ?").bind(ts, m.thread_id),
    ]);
    return {
      ok: true as const,
      messages: [
        { id: Number(res[0].meta?.last_row_id ?? 0), role: "student", text: data.text.trim(), payload: null, feedback: null, createdAt: ts },
        { id: Number(res[1].meta?.last_row_id ?? 0), role: "tutor", text: "", payload: check, feedback: null, createdAt: ts },
      ] as TutorMessage[],
    };
  });

export const setFeedback = createServerFn({ method: "POST" })
  .inputValidator(z.object({ messageId: z.number().int().positive(), value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const r = await g.DB.prepare("UPDATE tutor_messages SET feedback = ? WHERE id = ? AND role = 'tutor' AND thread_id IN (SELECT id FROM tutor_threads WHERE user_id = ?)")
      .bind(data.value === 0 ? null : data.value, data.messageId, g.me.id).run();
    return (r.meta?.changes ?? 0) > 0 ? { ok: true as const } : fail("not_found");
  });

/* ─────────── Saved excerpts ─────────── */

export const saveExcerpt = createServerFn({ method: "POST" })
  .inputValidator(z.object({ messageId: z.number().int().positive(), index: z.number().int().min(0).max(5) }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const m = await g.DB.prepare("SELECT m.payload FROM tutor_messages m JOIN tutor_threads th ON th.id = m.thread_id WHERE m.id = ? AND th.user_id = ?").bind(data.messageId, g.me.id).first<{ payload: string | null }>();
    const ex = parsePayload(m?.payload ?? null)?.excerpts[data.index];
    if (!ex) return fail("not_found");
    const dup = await g.DB.prepare("SELECT id FROM saved_items WHERE user_id = ? AND kind = 'excerpt' AND passage_id = ?").bind(g.me.id, ex.source.passageId).first<{ id: string }>();
    if (dup) return { ok: true as const, id: dup.id, already: true };
    const id = crypto.randomUUID();
    const subjectKey = isSubjectId(ex.source.subjectKey) ? ex.source.subjectKey : null;
    await g.DB.prepare("INSERT INTO saved_items (id, user_id, kind, passage_id, excerpt, source, subject_key, textbook_id, created_at) VALUES (?, ?, 'excerpt', ?, ?, ?, ?, ?, ?)")
      .bind(id, g.me.id, ex.source.passageId, ex.text, JSON.stringify(ex.source), subjectKey, ex.source.textbookId, now()).run();
    return { ok: true as const, id, already: false };
  });

export const listSaved = createServerFn({ method: "POST" })
  .inputValidator(z.object({ subjectId: z.enum(SUBJECT_IDS).nullable().default(null) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    const me = await currentUser();
    if (!DB || !me) return { ok: false as const, code: "signed_out" };
    const r = await DB.prepare(`SELECT id, kind, excerpt, source, note, subject_key, textbook_id, created_at FROM saved_items WHERE user_id = ? ${data.subjectId ? "AND subject_key = ?" : ""} ORDER BY created_at DESC LIMIT 200`)
      .bind(...(data.subjectId ? [me.id, data.subjectId] : [me.id]))
      .all<{ id: string; kind: string; excerpt: string | null; source: string | null; note: string | null; subject_key: string | null; textbook_id: string | null; created_at: string }>();
    return { ok: true as const, items: r.results ?? [] };
  });

export const deleteSaved = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const g = await guard();
    if (g.error) return g.error;
    const r = await g.DB.prepare("DELETE FROM saved_items WHERE id = ? AND user_id = ?").bind(data.id, g.me.id).run();
    return (r.meta?.changes ?? 0) > 0 ? { ok: true as const } : fail("not_found");
  });
