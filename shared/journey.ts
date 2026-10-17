// "My journey" (PAS-03): five steps toward the patient's own goal, never with dates.
// The step comes from rules on clinician-set data. Readiness, cleared-for-fitting and goal-reached
// (DAT-06) are read when present; without them the step follows the profile. CLINICAL_REVIEW_NEEDED.

import type { Patient, SessionRecord } from "./model";
import { limbsOf } from "./limbs";

export const JOURNEY_STEPS = [1, 2, 3, 4, 5] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

type ReadinessStatus = "not_assessed" | "not_yet" | "progressing" | "met";
/** DAT-06 fields, optional until the readiness model lands. */
export type JourneyInput = Pick<Patient, "profile"> & {
  readiness?: Partial<Record<string, { status: ReadinessStatus }>>;
  clearedForFittingAt?: string | null;
  goalReachedAt?: string | null;
};

export function computeJourneyStage(p: JourneyInput): JourneyStep {
  // A tester without an amputation is always "getting strong".
  if (!limbsOf(p.profile).length) return 2;
  if (p.goalReachedAt) return 5;
  if (p.profile.stage === "prosthetic") return 4;
  if (p.clearedForFittingAt) return 3;
  const wound = p.readiness?.wound?.status;
  // "not_assessed" says nothing about the wound; only a known open wound keeps step 1.
  if (wound === "not_yet") return 1;
  return 2;
}

/** The i18n key for the one-line next step on each journey step. */
export const nextStepKey = (s: JourneyStep) => `journeyNext${s}` as const;

const repsOf = (s: Pick<SessionRecord, "exercises">) => s.exercises.reduce((t, e) => t + e.logged.reduce<number>((a, r) => a + (r ?? 0), 0), 0);

/** Evidence from the patient's own body (AI-08 template): reps in the first session at least two
 *  weeks back versus the latest. Null unless there is real, fair progress to show. */
export function repsProgress(sessions: Pick<SessionRecord, "at" | "exercises">[], now: number): { weeks: number; before: number; today: number } | null {
  const last = sessions.at(-1);
  if (!last) return null;
  const WEEK = 7 * 86_400_000;
  const old = sessions.find((s) => Date.parse(last.at) - Date.parse(s.at) >= 2 * WEEK);
  if (!old) return null;
  const before = repsOf(old);
  const today = repsOf(last);
  if (before <= 0 || today <= before) return null;
  return { weeks: Math.max(2, Math.round((now - Date.parse(old.at)) / WEEK)), before, today };
}
