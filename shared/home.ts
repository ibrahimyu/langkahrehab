import { exerciseById } from "./exercises";
import { DAY, type PlanItem, type SessionRecord } from "./model";
import { addDays, dayKey } from "./calendar";

// Small facts for the patient home (PAS-01): how long today's plan takes, and true moments of progress.

/** Seconds per rep before the hold: lift and lower. */
const REP_SECONDS = 3;

/** Minutes for the plan: sets × (reps × (tempo + hold)) + rest between sets, rounded, at least 1. */
export function planMinutes(items: PlanItem[]) {
  const seconds = items.reduce((sum, it) => {
    const ex = exerciseById(it.exerciseId);
    const hold = ex?.holdSeconds ?? 0;
    const rest = ex?.restSeconds ?? 30;
    return sum + it.sets * it.reps * (REP_SECONDS + hold) + Math.max(0, it.sets - 1) * rest;
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** Days in a row with a session, counting back from today (or yesterday, if today is still open). */
export function streakDays(sessions: Pick<SessionRecord, "at">[], now: number) {
  const days = new Set(sessions.map((s) => dayKey(Date.parse(s.at))));
  let d = dayKey(now);
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

const repsOf = (s: Pick<SessionRecord, "exercises">) => s.exercises.reduce((t, e) => t + e.logged.reduce<number>((a, r) => a + (r ?? 0), 0), 0);

/** Reps done in the latest session minus the last session at least a week earlier; null when there is nothing fair to compare. */
export function repsSinceLastWeek(sessions: Pick<SessionRecord, "at" | "exercises">[]) {
  const last = sessions.at(-1);
  if (!last) return null;
  const before = [...sessions].reverse().find((s) => Date.parse(last.at) - Date.parse(s.at) >= 7 * DAY);
  return before ? repsOf(last) - repsOf(before) : null;
}
