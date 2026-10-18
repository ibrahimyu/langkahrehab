// SYS-11: notifications and email instead of WhatsApp. Three channels: the in-app inbox (built),
// phone push (preview only) and email (preview + a local mail sink until a provider is chosen).
// Notifications are derived from the patient's data by rules, so running the sync twice adds nothing
// (each one has a `key`). Text comes from i18n, never from the AI.

import { addDays, dayKey, dayStart, nextVisit } from "./calendar";
import { DEFAULT_TZ, type Patient, type Role } from "./model";

export const NOTIFY_KINDS = [
  "exercise_reminder",
  "gentle_return",
  "visit_tomorrow",
  "question_answered",
  "family_task",
  "family_weekly",
  "alert_urgent",
  "daily_digest",
  "proposal_pending",
  "journey_step",
] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];
export const CHANNELS = ["inapp", "push", "email"] as const;
export type NotifyChannel = (typeof CHANNELS)[number];

/** Who gets it: a role, plus the family member or clinician account when it is one person. */
export type NotifyTo = { role: Role; familyMemberId?: string | null; accountId?: string | null };
export type Notification = {
  id: string;
  /** Makes the rules idempotent: one notification per key. */
  key: string;
  at: string;
  to: NotifyTo;
  patientId: string | null;
  kind: NotifyKind;
  /** Plain values for the i18n text (names, counts). Never pain numbers, diary text or quotes. */
  params: Record<string, string | number>;
  readAt: string | null;
  /** Removed by the person (kept so the rules do not make it again; Undo clears it). */
  hiddenAt?: string | null;
  channels: NotifyChannel[];
};

/** The patient's exercise time and days live in Patient.preferences (set on Me and Calendar). */
export type NotifySettings = {
  channels: NotifyChannel[];
  email: string;
  /** 21:00–07:00 nothing is sent, except urgent alerts for clinicians. */
  quietHours: boolean;
  /** Last time this person opened the app: reminders stop after 3 ignored, until they come back. */
  lastOpenedAt: string | null;
};
export const defaultNotifySettings = (): NotifySettings => ({ channels: ["inapp"], email: "", quietHours: true, lastOpenedAt: null });

export const NOTIFY_MAX = 100;
export const QUIET_FROM = 21;
export const QUIET_TO = 7;
export const MAX_REMINDERS_PER_DAY = 2;
export const STOP_AFTER_IGNORED = 3;
const DAY = 86_400_000;
const REMINDERS: NotifyKind[] = ["exercise_reminder", "gentle_return"];

/** One key per person for settings. Clinicians share one per role (alerts go to a role, not an account). */
export function personKey(to: NotifyTo, patientId: string | null): string {
  if (to.role === "patient") return `patient:${patientId}`;
  if (to.role === "family") return `family:${patientId}:${to.familyMemberId ?? "all"}`;
  return `role:${to.role}`;
}

/** Hour and minute in the clinic's time zone. */
export function localTime(now: number, tz = DEFAULT_TZ): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { h: get("hour"), m: get("minute") };
}

export const inQuietHours = (now: number, tz = DEFAULT_TZ) => {
  const { h } = localTime(now, tz);
  return h >= QUIET_FROM || h < QUIET_TO;
};

/** Whether a notification of this kind may appear now for someone with these settings. */
export function allowedNow(kind: NotifyKind, to: NotifyTo, s: NotifySettings, now: number): boolean {
  if (!s.quietHours || !inQuietHours(now)) return true;
  return kind === "alert_urgent" && (to.role === "physio" || to.role === "doctor");
}

const day = (iso: string) => dayKey(Date.parse(iso));

/** True when the last three reminders all came after the person last opened the app. */
export function remindersPaused(list: Notification[], s: NotifySettings): boolean {
  const reminders = list.filter((n) => REMINDERS.includes(n.kind)).slice(-STOP_AFTER_IGNORED);
  if (reminders.length < STOP_AFTER_IGNORED) return false;
  const opened = s.lastOpenedAt ? Date.parse(s.lastOpenedAt) : 0;
  return reminders.every((n) => !n.readAt && Date.parse(n.at) > opened);
}

type Draft = Omit<Notification, "id" | "readAt" | "channels" | "at"> & { at?: string };

/**
 * Patient reminders: exercise time (if not trained today), a gentle return after 2 days without
 * exercise (at most once per 2 days) and the visit tomorrow. At most 2 reminders a day, no blame.
 */
export function patientReminders(p: Patient, s: NotifySettings, existing: Notification[], now: number): Draft[] {
  const to: NotifyTo = { role: "patient" };
  const today = dayKey(now);
  const out: Draft[] = [];
  const mine = existing.filter((n) => n.to.role === "patient" && n.patientId === p.id);
  const remindersToday = mine.filter((n) => REMINDERS.includes(n.kind) && day(n.at) === today).length;
  const paused = remindersPaused(mine, s);
  const sessions = p.sessions.map((x) => Date.parse(x.at)).filter(Number.isFinite);
  const last = sessions.length ? Math.max(...sessions) : Date.parse(p.createdAt);
  const trainedToday = sessions.some((t) => dayKey(t) === today);
  const { h, m } = localTime(now);
  let budget = paused ? 0 : MAX_REMINDERS_PER_DAY - remindersToday;

  const time = p.preferences.exerciseTime;
  const exerciseDay = p.preferences.exerciseDays.includes(new Date(dayStart(today)).getDay());
  if (budget > 0 && time && exerciseDay && !trainedToday && `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` >= time) {
    const minutes = p.plan.items.length * 3;
    out.push({ key: `exercise_reminder:${today}`, to, patientId: p.id, kind: "exercise_reminder", params: { min: Math.max(5, minutes) } });
    budget--;
  }
  const lastGentle = mine.filter((n) => n.kind === "gentle_return").map((n) => Date.parse(n.at)).sort().pop() ?? 0;
  if (budget > 0 && now - last >= 2 * DAY && now - lastGentle >= 2 * DAY) {
    out.push({ key: `gentle_return:${today}`, to, patientId: p.id, kind: "gentle_return", params: {} });
  }
  const visit = nextVisit(p, now);
  if (visit && visit.date === addDays(today, 1)) {
    out.push({ key: `visit_tomorrow:${visit.date}`, to, patientId: p.id, kind: "visit_tomorrow", params: { time: visit.time ?? "" } });
    for (const f of p.family) out.push({ key: `visit_tomorrow:${visit.date}:${f.id}`, to: { role: "family", familyMemberId: f.id }, patientId: p.id, kind: "visit_tomorrow", params: { name: p.name, time: visit.time ?? "" } });
  }
  return out;
}

/** Events in the data: answered questions, new family tasks, the weekly family update, urgent alerts, proposals. */
export function eventNotifications(p: Patient, existing: Notification[], now: number): Draft[] {
  const out: Draft[] = [];
  const recent = (iso: string | null | undefined) => !!iso && now - Date.parse(iso) < 14 * DAY;
  for (const n of p.notes) {
    if (n.kind !== "question" || !n.reply?.trim()) continue;
    const to: NotifyTo = n.familyMemberId ? { role: "family", familyMemberId: n.familyMemberId } : { role: "patient" };
    out.push({ key: `question_answered:${n.id}`, to, patientId: p.id, kind: "question_answered", params: {} });
  }
  for (const task of p.familyTasks) {
    if (task.status !== "open" || !recent(task.createdAt)) continue;
    const title = typeof task.title === "string" ? task.title : task.title.en;
    const people = task.assigneeId ? p.family.filter((f) => f.id === task.assigneeId) : p.family;
    for (const f of people) {
      const t = typeof task.title === "string" ? task.title : task.title[f.lang] ?? title;
      out.push({ key: `family_task:${task.id}:${f.id}`, to: { role: "family", familyMemberId: f.id }, patientId: p.id, kind: "family_task", params: { task: t }, at: task.createdAt });
    }
  }
  // KEL-04: once every 7 days, only a summary (never pain numbers, diary text or the patient's words).
  const weekly = existing.filter((n) => n.kind === "family_weekly" && n.patientId === p.id).map((n) => Date.parse(n.at)).sort().pop() ?? 0;
  if (now - weekly >= 7 * DAY) {
    for (const f of p.family) out.push({ key: `family_weekly:${dayKey(now)}:${f.id}`, to: { role: "family", familyMemberId: f.id }, patientId: p.id, kind: "family_weekly", params: { name: p.name } });
  }
  for (const a of p.alerts) {
    if (a.severity !== "urgent" || a.resolvedAt || !recent(a.at)) continue;
    for (const role of a.for) out.push({ key: `alert_urgent:${a.id}:${role}`, to: { role }, patientId: p.id, kind: "alert_urgent", params: { name: p.name }, at: a.at });
  }
  for (const x of p.proposals) {
    if (x.status !== "pending") continue;
    out.push({ key: `proposal_pending:${x.id}`, to: { role: "physio" }, patientId: p.id, kind: "proposal_pending", params: { name: p.name }, at: x.createdAt });
  }
  // DOK-03: the family hears when the doctor clears fitting (step 3) or the patient walks toward the goal (step 5).
  const steps: [number, string | null | undefined][] = [[3, p.clearedForFittingAt], [5, p.goalReachedAt]];
  for (const [step, at] of steps) {
    if (!at || !recent(at)) continue;
    for (const f of p.family) out.push({ key: `journey_step:${step}:${at}:${f.id}`, to: { role: "family", familyMemberId: f.id }, patientId: p.id, kind: "journey_step", params: { name: p.name }, at });
  }
  return out;
}

/** Morning digest for each clinician role: how many patients have open alerts for them. */
export function dailyDigests(patients: Patient[], now: number): Draft[] {
  if (localTime(now).h < QUIET_TO) return [];
  const today = dayKey(now);
  return (["physio", "doctor"] as const).map((role) => ({
    key: `daily_digest:${today}:${role}`,
    to: { role },
    patientId: null,
    kind: "daily_digest" as const,
    params: { n: patients.filter((p) => p.alerts.some((a) => !a.resolvedAt && a.for.includes(role))).length },
  }));
}

/** Whether a notification belongs to this person (clinician role notifications go to every clinician of that role). */
export function isFor(n: Notification, to: NotifyTo, patientId: string | null): boolean {
  if (n.to.role !== to.role) return false;
  if (to.role === "patient") return n.patientId === patientId;
  if (to.role === "family") return n.patientId === patientId && (!n.to.familyMemberId || n.to.familyMemberId === to.familyMemberId);
  return !n.to.accountId || n.to.accountId === to.accountId;
}

/**
 * Adds the drafts that are new (by key) and allowed now; channels follow each person's settings.
 * Returns the notifications that were added, newest last; the list keeps at most NOTIFY_MAX.
 */
export function addNotifications(
  list: Notification[],
  drafts: Draft[],
  settingsOf: (to: NotifyTo, patientId: string | null) => NotifySettings,
  now: number,
  newId: () => string,
): Notification[] {
  const keys = new Set(list.map((n) => n.key));
  const added: Notification[] = [];
  for (const d of drafts) {
    if (keys.has(d.key)) continue;
    const s = settingsOf(d.to, d.patientId);
    if (!allowedNow(d.kind, d.to, s, now)) continue;
    const channels = s.channels.filter((c) => c !== "email" || !!s.email.trim());
    const n: Notification = { ...d, id: newId(), at: d.at ?? new Date(now).toISOString(), readAt: null, channels: channels.length ? channels : ["inapp"] };
    keys.add(n.key);
    added.push(n);
  }
  list.push(...added);
  list.sort((a, b) => a.at.localeCompare(b.at));
  if (list.length > NOTIFY_MAX) list.splice(0, list.length - NOTIFY_MAX);
  return added;
}

/** The screen a notification opens. */
export function linkFor(n: Notification): string {
  const id = n.patientId;
  switch (n.kind) {
    case "exercise_reminder":
    case "gentle_return":
      return `/patient/${id}`;
    case "visit_tomorrow":
      return n.to.role === "family" ? `/family/${id}` : `/patient/${id}/calendar`;
    case "question_answered":
      return n.to.role === "family" ? `/family/${id}/questions` : `/patient/${id}/questions`;
    case "family_task":
      return `/family/${id}/tasks`;
    case "family_weekly":
    case "journey_step":
      return `/family/${id}`;
    case "alert_urgent":
    case "proposal_pending":
      return `/care/${id}`;
    case "daily_digest":
      return "/care";
  }
}

export const isEmailValid = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Normalises settings sent by a screen (the endpoint rejects an invalid email first). */
export function cleanSettings(raw: Partial<NotifySettings>, prev: NotifySettings): NotifySettings {
  const channels = Array.isArray(raw.channels) ? CHANNELS.filter((c) => raw.channels!.includes(c)) : prev.channels;
  const email = typeof raw.email === "string" ? raw.email.trim().slice(0, 200) : prev.email;
  return {
    channels: channels.includes("inapp") ? channels : ["inapp", ...channels],
    email: email && !isEmailValid(email) ? prev.email : email,
    quietHours: typeof raw.quietHours === "boolean" ? raw.quietHours : prev.quietHours,
    lastOpenedAt: prev.lastOpenedAt,
  };
}
