// Readiness Radar (DOK-03, FIS-07, DAT-06): seven criteria for prosthesis fitting.
// Automatic signals come from data the patient already makes; they are never "met" and never
// overwrite a status a clinician set. Every threshold here is CLINICAL_REVIEW_NEEDED.

import {
  CRITERIA,
  DAY,
  emptyReadiness,
  newId,
  type ActivityEvent,
  type CareRole,
  type Criterion,
  type Evidence,
  type Patient,
  type Readiness,
  type ReadinessChange,
  type ReadinessItem,
  type ReadinessStatus,
} from "./model";

/** Who may mark each criterion (ROL-03). The physio owns movement, strength and the home; the doctor owns all. */
export const SETTERS: Record<Criterion, CareRole[]> = {
  wound: ["doctor"],
  volume: ["doctor"],
  range: ["physio", "doctor"],
  strength: ["physio", "doctor"],
  skin: ["doctor"],
  engagement: ["physio", "doctor"],
  falls_home: ["physio", "doctor"],
};
export const canSet = (role: CareRole, c: Criterion) => SETTERS[c].includes(role);

// CLINICAL_REVIEW_NEEDED: thresholds for the automatic signals (docs/DECISIONS.md).
export const WOUND_QUIET_DAYS = 7;
export const STRENGTH_ADHERENCE = 0.8;
export const ENGAGEMENT_ADHERENCE = 0.6;
export const HOME_TASKS_DONE = 0.75;
const WINDOW_DAYS = 14;

type Signal = { status: ReadinessStatus; evidence: Evidence[] };
const shortDate = (iso: string) => iso.slice(5, 10);
const repsOf = (s: Patient["sessions"][number]) => s.exercises.reduce((t, e) => t + e.logged.reduce<number>((a, r) => a + (r ?? 0), 0), 0);

/** Share of planned sets done over the last 14 days, counting only the patient's exercise days. */
export function adherence14(p: Pick<Patient, "sessions" | "plan" | "preferences">, now: number): number | null {
  const perDay = p.plan.items.reduce((n, i) => n + i.sets, 0);
  if (!perDay) return null;
  const days = p.preferences?.exerciseDays?.length ? p.preferences.exerciseDays : [0, 1, 2, 3, 4, 5, 6];
  let planned = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) if (days.includes(new Date(now - i * DAY).getDay())) planned += perDay;
  if (!planned) return null;
  const done = p.sessions
    .filter((s) => now - Date.parse(s.at) < WINDOW_DAYS * DAY && Date.parse(s.at) <= now)
    .reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.logged.filter((v) => v !== null).length, 0), 0);
  return Math.min(1, done / planned);
}

/**
 * Automatic signals for each criterion, at most "progressing" (DOK-03 table). Pure.
 * Criteria without a measurement in the app stay "not_assessed".
 */
export function readinessSignals(p: Patient, now: number): Record<Criterion, Signal> {
  const out = Object.fromEntries(CRITERIA.map((c) => [c, { status: "not_assessed", evidence: [] } as Signal])) as Record<Criterion, Signal>;

  // wound: no worrying check of the leg in the last 7 days, and at least one calm check.
  const legChecks = p.skinChecks.filter((c) => c.area !== "other_foot" && c.result.usable && Date.parse(c.at) <= now);
  const worrying = legChecks.filter((c) => (c.result.urgency === "contact_soon" || c.result.urgency === "urgent") && now - Date.parse(c.at) < WOUND_QUIET_DAYS * DAY);
  const calm = legChecks.filter((c) => c.result.urgency === "none" || c.result.urgency === "monitor");
  if (worrying.length) out.wound = { status: "not_yet", evidence: worrying.slice(-2).map((c) => ({ kind: "skin", id: c.id, label: `Skin check ${shortDate(c.at)} · ${c.result.urgency}` })) };
  else if (calm.length) out.wound = { status: "progressing", evidence: calm.slice(-2).map((c) => ({ kind: "skin", id: c.id, label: `Skin check ${shortDate(c.at)} · ${c.result.urgency}` })) };

  // strength: adherence ≥ 80% over 14 days and logged reps steady or rising.
  const recent = p.sessions.filter((s) => now - Date.parse(s.at) < WINDOW_DAYS * DAY && Date.parse(s.at) <= now);
  const adh = adherence14(p, now);
  if (recent.length && adh !== null) {
    const first = repsOf(recent[0]!);
    const last = repsOf(recent.at(-1)!);
    const steady = recent.length >= 2 && last >= first;
    const ev: Evidence[] = [{ kind: "session", id: recent.at(-1)!.id, label: `Adherence ${Math.round(adh * 100)}% · 14 days` }];
    if (recent.length >= 2) ev.push({ kind: "session", id: recent[0]!.id, label: `Reps ${first}→${last}` });
    out.strength = { status: adh >= STRENGTH_ADHERENCE && steady ? "progressing" : "not_yet", evidence: ev };
  }

  // engagement: a personal goal and adherence ≥ 60%.
  const goal = p.goals[0];
  if (goal || recent.length) {
    const ev: Evidence[] = [];
    if (goal) ev.push({ kind: "note", id: goal.id, label: `Goal: ${goal.text.slice(0, 40)}` });
    if (adh !== null) ev.push({ kind: "session", id: recent.at(-1)?.id ?? "", label: `Adherence ${Math.round(adh * 100)}%` });
    out.engagement = { status: goal && adh !== null && adh >= ENGAGEMENT_ADHERENCE ? "progressing" : "not_yet", evidence: ev };
  }

  // falls_home: ≥ 75% of the family's home safety tasks done.
  const home = p.familyTasks.filter((t) => t.category === "home_safety");
  if (home.length) {
    const done = home.filter((t) => t.status === "done").length;
    out.falls_home = { status: done / home.length >= HOME_TASKS_DONE ? "progressing" : "not_yet", evidence: [{ kind: "task", id: home[0]!.id, label: `Home safety tasks ${done}/${home.length}` }] };
  }
  return out;
}

/** The stored readiness with automatic rows refreshed. Rows a clinician set are kept as they are. */
export function mergeReadiness(stored: Readiness | undefined, signals: Record<Criterion, Signal>, now: number): Readiness {
  const base = { ...emptyReadiness(), ...(stored ?? {}) };
  const iso = new Date(now).toISOString();
  return Object.fromEntries(
    CRITERIA.map((c): [Criterion, ReadinessItem] => {
      const item = base[c];
      if (item.source !== "auto") return [c, item];
      const s = signals[c];
      const changed = s.status !== item.status;
      return [c, { status: s.status, source: "auto", setAt: changed ? iso : item.setAt, evidence: s.evidence, note: "" }];
    }),
  ) as Readiness;
}

/** Readiness as the record shows it today. */
export const readinessNow = (p: Patient, now: number) => mergeReadiness(p.readiness, readinessSignals(p, now), now);

/** Refreshes the automatic rows in place (daily cycle and every readiness save). */
export function refreshReadiness(p: Patient, now: number) {
  p.readiness = readinessNow(p, now);
}

export const metCount = (r: Readiness) => CRITERIA.filter((c) => r[c].status === "met").length;
export const allMet = (r: Readiness) => metCount(r) === CRITERIA.length;

/** One history row plus one activity event (FIS-08) for a readiness decision. */
export function logReadiness(p: Patient, change: Omit<ReadinessChange, "id">, action: string, params: Record<string, string | number>) {
  p.readinessLog = [...(p.readinessLog ?? []), { id: newId(), ...change }].slice(-100);
  const event: ActivityEvent = { id: newId(), at: change.at, actor: "human", who: change.by, action, params, refs: [], groupId: null };
  p.activity = [...(p.activity ?? []), event].slice(-200);
}
