import { useRouter } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { L, Lang } from "../content/types";
import type { AccountSummary } from "./auth/types";
import { forgetMe, recordEvidence, savePrefs } from "./api/learner.functions";
import { answerQuestion } from "./api/universe.functions";
import type { AttemptResult } from "./learning/engine.server";
import { buildModel, DEFAULT_PREFS, emptyConcept, type ConceptModel, type EvidenceKind, type EvidenceRow, type Prefs } from "./model";

export type EvidenceInput = {
  concept: string;
  kind: EvidenceKind;
  item: string;
  correct: boolean;
  confidence: 1 | 2 | 3;
  misconception?: string | null;
  detail?: string | null;
};

type Initial = { hasLearner: boolean; storage: boolean; prefs: Prefs; rows: EvidenceRow[]; account: AccountSummary | null; xp: number | null };

type Ctx = {
  lang: Lang;
  t: (l: L) => string;
  tx: (en: string, bn: string) => string;
  prefs: Prefs;
  rows: EvidenceRow[];
  model: Record<string, ConceptModel>;
  concept: (id: string) => ConceptModel;
  record: (ev: EvidenceInput) => void;
  updatePrefs: (p: Partial<Prefs>) => void;
  forget: () => Promise<void>;
  online: boolean;
  pending: number;
  storage: boolean;
  account: AccountSummary | null;
  /** Total XP from the server ledger (null when signed out). */
  xp: number | null;
  /** Send an answer; if the device is offline it is kept here and sent later with the same id, so it counts once. */
  answer: (a: AnswerInput) => Promise<AnswerOutcome>;
  /** Re-read learner state and account from the server (after sign-in, sign-out or profile edits). */
  refresh: () => Promise<void>;
};

export type AnswerInput = { questionId: string; response: string; confidence: 1 | 2 | 3 | null; mode: "practice" | "review"; sessionId: string | null };
export type AnswerOutcome = AttemptResult | { ok: false; code: string } | { ok: true; queued: true };
type QueuedAnswer = AnswerInput & { clientEventId: string; at: string };
const answerKey = (user: string) => `edu_answers_v1:${user}`;
function readAnswers(user: string | null): QueuedAnswer[] {
  if (!user) return [];
  try { return JSON.parse(window.localStorage.getItem(answerKey(user)) ?? "[]") as QueuedAnswer[]; } catch { return []; }
}
function writeAnswers(user: string, q: QueuedAnswer[]) {
  try { if (q.length) window.localStorage.setItem(answerKey(user), JSON.stringify(q.slice(-300))); else window.localStorage.removeItem(answerKey(user)); } catch { /* storage unavailable */ }
}
const newEventId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
const transportFailure = (e: unknown) => (typeof navigator !== "undefined" && !navigator.onLine) || /fetch|network|load failed/i.test((e as Error)?.message ?? "");

const LearnerCtx = createContext<Ctx | null>(null);
const QUEUE_KEY = "edu_sync_queue_v1";

function readQueue(): EvidenceInput[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as EvidenceInput[]) : [];
  } catch {
    return [];
  }
}
function writeQueue(q: EvidenceInput[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200)));
  } catch {
    /* storage unavailable: evidence stays in memory for this visit */
  }
}

export function LearnerProvider({ initial, children }: { initial: Initial; children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(initial.prefs ?? DEFAULT_PREFS);
  const [rows, setRows] = useState<EvidenceRow[]>(initial.rows ?? []);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const nextId = useRef<number>(rows.reduce((m, r) => Math.max(m, r.id), 0) + 1);
  const router = useRouter();

  // When the root loader re-runs (sign in, sign out), adopt the server's view of this learner.
  useEffect(() => {
    setPrefs(initial.prefs ?? DEFAULT_PREFS);
    setRows(initial.rows ?? []);
    nextId.current = (initial.rows ?? []).reduce((m, r) => Math.max(m, r.id), 0) + 1;
  }, [initial]);

  const refresh = useCallback(async () => {
    await router.invalidate();
  }, [router]);

  const user = initial.account?.username ?? null;
  const [answerPending, setAnswerPending] = useState(0);
  const flushAnswers = useCallback(async () => {
    const q = readAnswers(user);
    if (!user || !q.length) { setAnswerPending(0); return; }
    const left: QueuedAnswer[] = [];
    for (const a of q) {
      try {
        const r = await answerQuestion({ data: { questionId: a.questionId, response: a.response, confidence: a.confidence, mode: a.mode, clientEventId: a.clientEventId, sessionId: a.sessionId } });
        if (!r.ok && (r.code === "rate_limited" || r.code === "unavailable_now")) left.push(a);
      } catch (e) {
        if (transportFailure(e)) left.push(a);
      }
    }
    writeAnswers(user, left);
    setAnswerPending(left.length);
    if (left.length < q.length) void router.invalidate();
  }, [user, router]);
  const answer = useCallback(async (a: AnswerInput): Promise<AnswerOutcome> => {
    const clientEventId = newEventId();
    const queue = () => {
      if (!user) return { ok: false as const, code: "network" };
      const q = [...readAnswers(user), { ...a, clientEventId, at: new Date().toISOString() }];
      writeAnswers(user, q);
      setAnswerPending(q.length);
      return { ok: true as const, queued: true as const };
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
    try {
      return await answerQuestion({ data: { ...a, clientEventId } });
    } catch (e) {
      return transportFailure(e) ? queue() : { ok: false as const, code: "unknown" };
    }
  }, [user]);

  const flush = useCallback(async () => {
    void flushAnswers();
    const q = readQueue();
    if (q.length === 0) return;
    const left: EvidenceInput[] = [];
    for (const ev of q) {
      try {
        await recordEvidence({ data: { ...ev, misconception: ev.misconception ?? null, detail: ev.detail ?? null } });
      } catch {
        left.push(ev);
      }
    }
    writeQueue(left);
    setPending(left.length);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(readQueue().length);
    setAnswerPending(readAnswers(user).length);
    const on = () => {
      setOnline(true);
      void flush();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [flush, user]);

  const record = useCallback((ev: EvidenceInput) => {
    const row: EvidenceRow = {
      id: nextId.current++,
      concept: ev.concept,
      kind: ev.kind,
      item: ev.item,
      correct: ev.correct ? 1 : 0,
      confidence: ev.confidence,
      misconception: ev.misconception ?? null,
      detail: ev.detail ?? null,
      created_at: new Date().toISOString(),
    };
    setRows((r) => [...r, row]);
    recordEvidence({ data: { ...ev, misconception: ev.misconception ?? null, detail: ev.detail ?? null } }).catch(() => {
      const q = readQueue();
      q.push(ev);
      writeQueue(q);
      setPending(q.length);
    });
  }, []);

  const updatePrefs = useCallback((p: Partial<Prefs>) => {
    setPrefs((cur) => ({ ...cur, ...p }));
    savePrefs({ data: p }).catch(() => undefined);
  }, []);

  const forget = useCallback(async () => {
    try {
      await forgetMe();
    } finally {
      writeQueue([]);
      setPending(0);
      setRows([]);
      setPrefs((cur) => ({ ...DEFAULT_PREFS, lang: cur.lang }));
    }
  }, []);

  const model = useMemo(() => buildModel(rows), [rows]);
  const lang = prefs.lang;
  const value = useMemo<Ctx>(
    () => ({
      lang,
      t: (l: L) => l[lang],
      tx: (en: string, bn: string) => (lang === "bn" ? bn : en),
      prefs,
      rows,
      model,
      concept: (id: string) => model[id] ?? emptyConcept(id),
      record,
      updatePrefs,
      forget,
      online,
      pending: pending + answerPending,
      answer,
      storage: initial.storage,
      account: initial.account ?? null,
      xp: initial.xp ?? null,
      refresh,
    }),
    [lang, prefs, rows, model, record, updatePrefs, forget, online, pending, answerPending, answer, initial.storage, initial.account, initial.xp, refresh],
  );
  return <LearnerCtx.Provider value={value}>{children}</LearnerCtx.Provider>;
}

export function useLearner(): Ctx {
  const c = useContext(LearnerCtx);
  if (!c) throw new Error("useLearner outside LearnerProvider");
  return c;
}
