// Next-action rules. Plain code, not model output, so behaviour is predictable and explainable.

import { logActivity, WHO_RULES } from "./activity";
import { t, type TextKey } from "./i18n";
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
  type DiaryEntry,
} from "./model";

/** DOK-03: automatic readiness signals (pure; never `met`, never overrides a clinician's mark). Lives in readiness.ts. */
export { readinessSignals } from "./readiness";

/** Days without a session before the physio is alerted (the plan is daily). */
export const MISSED_DAYS = 2;

/** Text for an alert: plain English (older callers) or an i18n key with params (SYS-04), so each reader sees their language. */
export type AlertText = string | { key: TextKey; params?: Record<string, string | number> };

export const makeAlert = (kind: AlertKind, severity: Severity, text: AlertText, who: CareRole[], at: string, sessionId: string | null = null): Alert => {
  const keyed = typeof text === "string" ? null : text;
  return {
    id: newId(), kind, severity, message: keyed ? t("en", keyed.key, keyed.params) : (text as string), at, for: who, sessionId, resolvedAt: null, resolvedBy: null,
    ...(keyed ? { messageKey: keyed.key, params: keyed.params ?? {} } : {}),
  };
};

/** Alert text in the reader's language; older alerts without a key keep their English message. */
export const alertText = (lang: Parameters<typeof t>[0], a: Pick<Alert, "message" | "messageKey" | "params">) =>
  a.messageKey ? t(lang, a.messageKey as TextKey, a.params ?? {}) : a.message;

/** Next action for the patient and alerts for the care team after a session. */
export function afterSession(p: Patient, s: SessionRecord, now: number): { nextAction: NextAction; alerts: Alert[] } {
  const at = new Date(now).toISOString();
  const alerts: Alert[] = [];
  let next: NextAction = { kind: "keep_going" };
  const upgrade = (n: NextAction) => {
    if (next.kind === "keep_going") next = n;
  };

  if (s.concern) {
    // Distress is a wellbeing alert, not a wound alert: it needs a call, not a dressing change.
    const via = s.concern.source === "keyword_fallback" ? " (caught by the app's safety check)" : "";
    if (s.concern.kind === "distress")
      alerts.push(makeAlert("wellbeing", "urgent", { key: via ? "alert_distress_check" : "alert_distress", params: { quote: s.concern.details } }, ["doctor", "physio"], at, s.id));
    else alerts.push(makeAlert("red_flag", "urgent", { key: via ? "alert_red_flag_check" : "alert_red_flag", params: { kind: s.concern.kind.replace("_", " "), quote: s.concern.details } }, ["doctor", "physio"], at, s.id));
    next = { kind: "stop_contact", detail: s.concern.kind };
  }

  const { painBefore: before, painAfter: after } = s;
  if (after !== null && (after >= p.plan.painThreshold || (before !== null && after - before >= 3))) {
    alerts.push(makeAlert("pain_high", "high", { key: "alert_pain_high", params: { before: before ?? "?", after, limit: p.plan.painThreshold } }, ["doctor", "physio"], at, s.id));
    upgrade({ kind: "rest_contact" });
  }

  const recent = [...p.sessions, s].map((r) => r.painAfter).filter((v): v is number => v !== null).slice(-3);
  if (recent.length === 3 && recent[0]! < recent[1]! && recent[1]! < recent[2]!) {
    alerts.push(makeAlert("pain_rising", "medium", { key: "alert_pain_rising", params: { series: recent.join(" → ") } }, ["physio"], at, s.id));
    upgrade({ kind: "checkin_suggested" });
  }

  if (isoDate(new Date(now)) >= reviewDay(p)) {
    alerts.push(makeAlert("review_due", "low", { key: "alert_review_due", params: { date: reviewDay(p) } }, ["doctor", "physio"], at));
    upgrade({ kind: "review_due" });
  }

  return { nextAction: next, alerts };
}

/** The day the doctor's review is due: the booked visit when there is one, else the plan's review date. */
export function reviewDay(p: Pick<Patient, "checkIns" | "plan">): string {
  const booked = p.checkIns
    .filter((c) => c.kind === "doctor_review" && c.status === "scheduled" && c.scheduledFor)
    .map((c) => c.scheduledFor!)
    .sort()[0];
  return booked ?? p.plan.reviewDate;
}

/** Daily checks, run once per day by the navigator cycle. */
export function daily(p: Patient, now: number): Alert[] {
  const at = new Date(now).toISOString();
  const alerts: Alert[] = [];
  const last = Date.parse(p.sessions.at(-1)?.at ?? p.plan.updatedAt);
  const days = Math.floor((now - last) / DAY);
  if (days >= MISSED_DAYS) alerts.push(makeAlert("missed_sessions", "low", { key: "alert_missed", params: { n: days } }, ["physio"], at));
  if (isoDate(new Date(now)) >= reviewDay(p)) alerts.push(makeAlert("review_due", "low", { key: "alert_review_due", params: { date: reviewDay(p) } }, ["doctor", "physio"], at));
  return alerts;
}

/** Alert for a skin check that needs the clinic. */
export function afterSkinCheck(c: SkinCheck): Alert | null {
  const { urgency, careTeamNote } = c.result;
  if (urgency !== "contact_soon" && urgency !== "urgent") return null;
  return makeAlert("skin", urgency === "urgent" ? "urgent" : "high", { key: c.area === "other_foot" ? "alert_skin_foot" : "alert_skin", params: { note: careTeamNote } }, ["doctor", "physio"], c.at);
}

/** Adds alerts, skipping any kind that already has an open alert (except red flags, which always count). Logs each one to the feed. */
export function addAlerts(p: Patient, alerts: Alert[], groupId: string | null = null) {
  for (const a of alerts) {
    const duplicate = a.kind !== "red_flag" && a.kind !== "wellbeing" && p.alerts.some((o) => o.kind === a.kind && !o.resolvedAt);
    if (duplicate) continue;
    p.alerts.push(a);
    logActivity(p, { at: a.at, actor: "rule", who: WHO_RULES, action: "act_alert", params: { kind: a.kind, severity: a.severity }, refs: [{ kind: "alert", id: a.id, label: a.kind }], groupId });
  }
  p.alerts = p.alerts.slice(-100);
}

/** SYS-07: mood entries in a row at or below this (0–10) count as low. CLINICAL_REVIEW_NEEDED. */
export const LOW_MOOD = 3;
export const LOW_MOOD_STREAK = 3;

/** True when the last LOW_MOOD_STREAK mood entries are all low (an entry in between that is not low breaks the streak). */
export function lowMoodStreak(diary: DiaryEntry[]): boolean {
  const moods = diary.filter((d) => d.kind === "mood" && d.score !== null).sort((a, b) => a.at.localeCompare(b.at)).slice(-LOW_MOOD_STREAK);
  return moods.length === LOW_MOOD_STREAK && moods.every((d) => d.score! <= LOW_MOOD);
}

/** SYS-07: a gentle wellbeing alert for the physio, at most one open at a time (addAlerts skips no wellbeing, so check here). */
export function moodAlert(p: Patient, now: number): Alert | null {
  if (!lowMoodStreak(p.diary)) return null;
  const open = p.alerts.some((a) => a.kind === "wellbeing" && !a.resolvedAt && a.messageKey === "alert_low_mood");
  const last = p.diary.filter((d) => d.kind === "mood").at(-1)!;
  const handledAfter = p.alerts.some((a) => a.messageKey === "alert_low_mood" && a.resolvedAt && a.at >= last.at);
  if (open || handledAfter) return null;
  return makeAlert("wellbeing", "medium", { key: "alert_low_mood", params: { n: LOW_MOOD_STREAK } }, ["physio"], new Date(now).toISOString());
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
