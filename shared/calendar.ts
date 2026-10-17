import type { Patient } from "./model";
import { nextTarget } from "./goals";

// The patient's calendar (PAS-15): exercise days, visits, skin checks, targets and plan changes,
// all read from data the app already keeps. Dates are local calendar days ("YYYY-MM-DD").

export type ExerciseState = "done" | "missed" | "today" | "planned" | null;
export type CalEventKind = "doctor_review" | "therapy" | "skin_check" | "target_done" | "plan_change" | "session";
export type CalEvent = {
  kind: CalEventKind;
  date: string;
  /** "HH:MM" when the event has a time. */
  time: string | null;
  /** Free text from the data (target text, visit reason); labels come from i18n. */
  text: string;
  /** Plan version for "plan_change", sessions done that day for "session". */
  n: number | null;
  /** A link inside the app (session summary, goals), if any. */
  to: string | null;
};
export type CalDay = { date: string; exercise: ExerciseState; events: CalEvent[] };

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** Local midnight of a "YYYY-MM-DD" day. */
export const dayStart = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!).getTime();
};
export const addDays = (key: string, n: number) => {
  const d = new Date(dayStart(key));
  d.setDate(d.getDate() + n);
  return dayKey(d.getTime());
};
const weekday = (key: string) => new Date(dayStart(key)).getDay();
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Monday-first week holding `key`. */
export const weekOf = (key: string) => {
  const start = addDays(key, -((weekday(key) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};
/** Monday-first grid of whole weeks covering the month of `key`; days outside the month are kept. */
export const monthGrid = (key: string) => {
  const first = `${key.slice(0, 7)}-01`;
  const start = weekOf(first)[0]!;
  const days: string[] = [];
  for (let d = start; d.slice(0, 7) <= key.slice(0, 7) || days.length % 7; d = addDays(d, 1)) days.push(d);
  return days;
};
export const shiftMonth = (key: string, n: number) => {
  const d = new Date(dayStart(`${key.slice(0, 7)}-01`));
  d.setMonth(d.getMonth() + n);
  return dayKey(d.getTime());
};

/** A check-in time is stored as text: a day ("2026-10-20") or a date-time. */
function parseWhen(s: string | null): { date: string; time: string | null } | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s, time: null };
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : { date: dayKey(ms), time: timeOf(s) };
}

/** Every dated event, one list. */
export function calendarEvents(p: Patient): CalEvent[] {
  const out: CalEvent[] = [];
  const ev = (e: Partial<CalEvent> & Pick<CalEvent, "kind" | "date">) => out.push({ time: null, text: "", n: null, to: null, ...e });

  // One "exercise done" line per day, linking to the latest session of that day.
  const byDay = new Map<string, CalEvent>();
  for (const s of [...p.sessions].sort((a, b) => a.at.localeCompare(b.at))) {
    const date = dayKey(Date.parse(s.at));
    const n = (byDay.get(date)?.n ?? 0) + 1;
    byDay.set(date, { kind: "session", date, time: timeOf(s.at), text: "", n, to: `/patient/${p.id}/summary/${s.id}` });
  }
  out.push(...byDay.values());

  // The doctor's review date; a scheduled doctor check-in on the same day is the same visit.
  const visits = p.checkIns.filter((c) => c.status !== "requested").map((c) => ({ c, when: parseWhen(c.scheduledFor) }));
  if (p.plan.reviewDate && !visits.some((v) => v.c.kind === "doctor_review" && v.when?.date === p.plan.reviewDate)) {
    ev({ kind: "doctor_review", date: p.plan.reviewDate });
  }
  for (const { c, when } of visits) if (when) ev({ kind: c.kind, date: when.date, time: when.time, text: c.reason });

  for (const s of p.skinChecks) ev({ kind: "skin_check", date: dayKey(Date.parse(s.at)), time: timeOf(s.at), text: s.area, to: `/patient/${p.id}/skin` });

  for (const g of p.goals) for (const t of g.targets) if (t.doneAt) ev({ kind: "target_done", date: dayKey(Date.parse(t.doneAt)), text: t.text, to: `/patient/${p.id}/goals` });

  for (const plan of [...p.planHistory, p.plan]) {
    if (plan.version > 1 && !out.some((e) => e.kind === "plan_change" && e.n === plan.version)) ev({ kind: "plan_change", date: dayKey(Date.parse(plan.updatedAt)), n: plan.version });
  }

  return out.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
}

/** The first day the app knows about: missed days are only counted from here. */
const firstDay = (p: Patient) => p.sessions.reduce((min, s) => (s.at < min ? s.at : min), p.createdAt);

/** Exercise state of each day. Missed is neutral (never red): the plan is a plan, not a test. */
export function calendarDays(p: Patient, now: number, dates: string[]): CalDay[] {
  const events = calendarEvents(p);
  const today = dayKey(now);
  const start = dayKey(Date.parse(firstDay(p)));
  const days = new Set(p.preferences.exerciseDays);
  return dates.map((date) => {
    const evs = events.filter((e) => e.date === date);
    let exercise: ExerciseState = null;
    if (evs.some((e) => e.kind === "session")) exercise = "done";
    else if (days.has(weekday(date))) exercise = date === today ? "today" : date > today ? "planned" : date >= start ? "missed" : null;
    return { date, exercise, events: evs };
  });
}

/** The next visit (doctor review or therapy) from today on: what "Add to my phone calendar" saves. */
export function nextVisit(p: Patient, now: number): CalEvent | null {
  const today = dayKey(now);
  return calendarEvents(p).find((e) => (e.kind === "doctor_review" || e.kind === "therapy") && e.date >= today) ?? null;
}

/** The target being worked on, for the calendar header. */
export const currentTarget = (p: Patient) => nextTarget(p.goals)?.target ?? null;

// ---- .ics (RFC 5545) for the phone's own calendar ----
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (date: string) => date.replace(/-/g, "");
export function buildIcs(
  e: Pick<CalEvent, "date" | "time">,
  title: string,
  description: string,
  uid: string,
  stamp: number,
  opts: { rrule?: string; alarm?: string } = {},
): string {
  const d = new Date(stamp);
  const dtstamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const when = e.time
    ? [`DTSTART:${compact(e.date)}T${e.time.replace(":", "")}00`, `DURATION:PT1H`]
    : [`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`];
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Langkah//Rehab//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${dtstamp}`, ...when, ...(opts.rrule ? [`RRULE:${opts.rrule}`] : []), `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(description)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(title)}`, `TRIGGER:${opts.alarm ?? "-P1D"}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

// ---- Exercise time said out loud ("jam 7 pagi", "7.30 pm", "晚上8点", "setengah 8") ----
const PM = /\b(pm|sore|malam|evening|night)\b|下午|晚上|傍晚/i;
const NOON = /\b(siang|afternoon)\b|中午/i;
const AM = /\b(am|pagi|morning)\b|早上|上午|凌晨/i;
export function parseSpokenTime(text: string): string | null {
  const s = text.toLowerCase();
  let h: number;
  let m = 0;
  const half = s.match(/setengah\s*(\d{1,2})/);
  const hm = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  const zh = s.match(/(\d{1,2})\s*点\s*(半|(\d{1,2})\s*分?)?/);
  const lone = s.match(/(\d{1,2})/);
  if (half) [h, m] = [Number(half[1]) - 1, 30];
  else if (hm) [h, m] = [Number(hm[1]), Number(hm[2])];
  else if (zh) [h, m] = [Number(zh[1]), zh[2] === "半" ? 30 : Number(zh[3] ?? 0)];
  else if (lone) h = Number(lone[1]);
  else return null;
  if (/half past/.test(s) && !hm) m = 30;
  if (h < 12 && (PM.test(s) || (NOON.test(s) && h < 6))) h += 12;
  if (h === 12 && AM.test(s)) h = 0;
  if (h > 23 || m > 59 || h < 0) return null;
  return `${pad(h)}:${pad(m)}`;
}
