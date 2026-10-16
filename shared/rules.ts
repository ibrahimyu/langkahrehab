// Next-action rules. Plain code, not model output, so behaviour is predictable and explainable.

import {
  DAY,
  isoDate,
  newId,
  type Alert,
  type AlertKind,
  type CareRole,
  type NextAction,
  type Patient,
  type SessionRecord,
  type Severity,
  type SkinCheck,
} from "./model";

/** Days without a session before the physio is alerted (the plan is daily). */
export const MISSED_DAYS = 2;

const makeAlert = (kind: AlertKind, severity: Severity, message: string, who: CareRole[], at: string, sessionId: string | null = null): Alert => ({
  id: newId(), kind, severity, message, at, for: who, sessionId, resolvedAt: null, resolvedBy: null,
});

/** Next action for the patient and alerts for the care team after a session. */
export function afterSession(p: Patient, s: SessionRecord, now: number): { nextAction: NextAction; alerts: Alert[] } {
  const at = new Date(now).toISOString();
  const alerts: Alert[] = [];
  let next: NextAction = { kind: "keep_going" };
  const upgrade = (n: NextAction) => {
    if (next.kind === "keep_going") next = n;
  };

  if (s.concern) {
    alerts.push(makeAlert("red_flag", "urgent", `Session stopped: ${s.concern.kind.replace("_", " ")}. Patient said: "${s.concern.details}"`, ["doctor", "physio"], at, s.id));
    next = { kind: "stop_contact", detail: s.concern.kind };
  }

  const { painBefore: before, painAfter: after } = s;
  if (after !== null && (after >= p.plan.painThreshold || (before !== null && after - before >= 3))) {
    alerts.push(makeAlert("pain_high", "high", `Pain ${before ?? "?"} → ${after} after the session (limit ${p.plan.painThreshold}).`, ["doctor", "physio"], at, s.id));
    upgrade({ kind: "rest_contact" });
  }

  const recent = [...p.sessions, s].map((r) => r.painAfter).filter((v): v is number => v !== null).slice(-3);
  if (recent.length === 3 && recent[0]! < recent[1]! && recent[1]! < recent[2]!) {
    alerts.push(makeAlert("pain_rising", "medium", `Pain after sessions is rising: ${recent.join(" → ")}.`, ["physio"], at, s.id));
    upgrade({ kind: "checkin_suggested" });
  }

  if (isoDate(new Date(now)) >= p.plan.reviewDate) {
    alerts.push(makeAlert("review_due", "low", `Review visit due (${p.plan.reviewDate}).`, ["doctor", "physio"], at));
    upgrade({ kind: "review_due" });
  }

  return { nextAction: next, alerts };
}

/** Daily checks, run when the demo clock moves to the next day. */
export function daily(p: Patient, now: number): Alert[] {
  const at = new Date(now).toISOString();
  const alerts: Alert[] = [];
  const last = Date.parse(p.sessions.at(-1)?.at ?? p.plan.updatedAt);
  const days = Math.floor((now - last) / DAY);
  if (days >= MISSED_DAYS) alerts.push(makeAlert("missed_sessions", "low", `No exercise session for ${days} days.`, ["physio"], at));
  if (isoDate(new Date(now)) >= p.plan.reviewDate) alerts.push(makeAlert("review_due", "low", `Review visit due (${p.plan.reviewDate}).`, ["doctor", "physio"], at));
  return alerts;
}

/** Alert for a skin check that needs the clinic. */
export function afterSkinCheck(c: SkinCheck): Alert | null {
  const { urgency, careTeamNote } = c.result;
  if (urgency !== "contact_soon" && urgency !== "urgent") return null;
  return makeAlert("skin", urgency === "urgent" ? "urgent" : "high", `Skin check (${c.area === "other_foot" ? "other foot" : "amputated leg"}): ${careTeamNote}`, ["doctor", "physio"], c.at);
}

/** Adds alerts, skipping any kind that already has an open alert (except red flags, which always count). */
export function addAlerts(p: Patient, alerts: Alert[]) {
  for (const a of alerts) {
    const duplicate = a.kind !== "red_flag" && p.alerts.some((o) => o.kind === a.kind && !o.resolvedAt);
    if (!duplicate) p.alerts.push(a);
  }
  p.alerts = p.alerts.slice(-100);
}

/** Days since the last session, for the patient home screen. */
export const daysSinceSession = (p: Patient, now: number) =>
  p.sessions.length ? Math.floor((now - Date.parse(p.sessions.at(-1)!.at)) / DAY) : null;

/** Share of planned sets done in the last 7 days, assuming one session a day. */
export function weekAdherence(p: Patient, now: number) {
  const perDay = p.plan.items.reduce((n, i) => n + i.sets, 0);
  if (!perDay) return null;
  const done = p.sessions
    .filter((s) => now - Date.parse(s.at) < 7 * DAY)
    .reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.logged.filter((v) => v !== null).length, 0), 0);
  return Math.min(100, Math.round((done / (perDay * 7)) * 100));
}
