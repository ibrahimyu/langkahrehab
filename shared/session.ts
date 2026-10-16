// Live state of one exercise session, which runs through every exercise in the plan.
// The coach moves it forward through tool calls; the app validates every call, so a wrong
// call is answered with an error instead of corrupting the log.

import type { Exercise } from "./exercises";
import { heardCount } from "./numbers";
import { CONCERNS, type ConcernKind, type CountMode, type Difficulty, type SessionExercise } from "./model";

export type Phase = "intro" | "ready" | "set" | "rest" | "after" | "done" | "stopped";

export type SetLog = {
  set: number;
  /** What the patient said during the set (input transcription). */
  heardText: string;
  /** Reps counted by the camera (camera mode). */
  camera: number | null;
  /** Reps logged at the end of the set (camera count in camera mode). */
  logged: number | null;
  startedAt: number | null;
  endedAt: number | null;
  /** Coach turns during the set that were not the end-of-set confirmation. */
  midSetTurns: number;
};

export type SessionItem = { exercise: Exercise; sets: number; reps: number; log: SetLog[] };

export type Session = {
  mode: CountMode;
  items: SessionItem[];
  /** Index of the current (or next) exercise. */
  item: number;
  /** 1-based number of the current (or next) set within the exercise. */
  current: number;
  phase: Phase;
  painBefore: number | null;
  painAfter: number | null;
  difficulty: Difficulty | null;
  concern: { kind: ConcernKind; details: string; at: number } | null;
  restUntil: number | null;
};

export type ToolResponse = Record<string, unknown> & { ok: boolean };

const newLog = (set: number): SetLog => ({
  set, heardText: "", camera: null, logged: null, startedAt: null, endedAt: null, midSetTurns: 0,
});

export function createSession(mode: CountMode, items: { exercise: Exercise; sets: number; reps: number }[]): Session {
  return {
    mode,
    items: items.map((i) => ({ ...i, log: Array.from({ length: i.sets }, (_, n) => newLog(n + 1)) })),
    item: 0,
    current: 1,
    phase: "intro",
    painBefore: null,
    painAfter: null,
    difficulty: null,
    concern: null,
    restUntil: null,
  };
}

export const currentItem = (s: Session) => s.items[s.item]!;
export const currentLog = (s: Session) => currentItem(s).log[s.current - 1]!;

const fail = (error: string): ToolResponse => ({ ok: false, error });
const intIn = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export function applyTool(s: Session, name: string, args: Record<string, unknown>, now: number): ToolResponse {
  if (s.phase === "stopped" || s.phase === "done") return fail("The session has ended.");
  const item = currentItem(s);

  switch (name) {
    case "record_pain": {
      const score = intIn(args.score, 0, 10);
      if (score === null) return fail("score must be a whole number from 0 to 10. Ask the patient for a number.");
      if (args.when === "before") {
        s.painBefore = score;
        if (s.phase === "intro") s.phase = "ready";
        return { ok: true, next: `Explain the first exercise (${item.exercise.name.en}) briefly and ask if they are ready for set 1.` };
      }
      if (args.when === "after") {
        s.painAfter = score;
        s.phase = "after";
        return { ok: true, next: "Ask how hard it felt: easy, OK or hard. Then call finish_session." };
      }
      return fail('when must be "before" or "after".');
    }

    case "start_set": {
      const set = intIn(args.set, 1, item.sets);
      if (s.phase === "intro") return fail("Ask for the pain score before starting.");
      if (s.phase === "rest") return fail("The patient is resting. Wait for the [APP] message.");
      if (s.phase !== "ready") return fail(`Cannot start a set now (phase: ${s.phase}).`);
      if (set !== s.current) return fail(`The next set is set ${s.current} of ${item.exercise.name.en}.`);
      s.phase = "set";
      currentLog(s).startedAt = now;
      return { ok: true, exercise: item.exercise.name.en, set, targetReps: item.reps };
    }

    case "log_set": {
      const set = intIn(args.set, 1, item.sets);
      const reps = intIn(args.reps, 0, 100);
      if (s.phase !== "set") return fail("No set is in progress.");
      if (set !== s.current) return fail(`The set in progress is set ${s.current}.`);
      if (reps === null) return fail("reps must be a whole number.");
      const log = currentLog(s);
      log.logged = reps;
      log.endedAt = now;
      const rest = item.exercise.restSeconds;
      if (s.current < item.sets) {
        s.current++;
        s.phase = "rest";
        s.restUntil = now + rest * 1000;
        return { ok: true, next: `Tell the patient to rest for ${rest} seconds. Do not start set ${s.current} until an [APP] message says the rest is over.` };
      }
      if (s.item < s.items.length - 1) {
        s.item++;
        s.current = 1;
        s.phase = "rest";
        s.restUntil = now + rest * 1000;
        return { ok: true, next: `${item.exercise.name.en} is done. Tell the patient to rest for ${rest} seconds before the next exercise. Wait for the [APP] message.` };
      }
      s.phase = "after";
      return { ok: true, next: "All exercises are done. Ask for the pain score now (0–10) and call record_pain with when=after." };
    }

    case "report_concern": {
      const kind = CONCERNS.includes(args.kind as ConcernKind) ? (args.kind as ConcernKind) : "other";
      s.concern = { kind, details: String(args.details ?? "").slice(0, 300), at: now };
      s.phase = "stopped";
      s.restUntil = null;
      return {
        ok: true,
        next: "The session is stopped. Tell the patient to stop exercising and rest, and to contact their clinic today, or emergency services if it is an emergency. The care team has been alerted. Do not continue the exercise.",
      };
    }

    case "finish_session": {
      if (s.phase !== "after") return fail("Finish only after all exercises and the pain score after.");
      s.difficulty = (["easy", "ok", "hard"] as const).includes(args.difficulty as Difficulty) ? (args.difficulty as Difficulty) : null;
      s.phase = "done";
      return { ok: true, next: "Close with one short encouraging sentence." };
    }
  }
  return fail(`Unknown tool ${name}.`);
}

/** Ends the rest and returns the message the app sends to the coach. */
export function endRest(s: Session): string | null {
  if (s.phase !== "rest") return null;
  s.phase = "ready";
  s.restUntil = null;
  const item = currentItem(s);
  return s.current === 1
    ? `[APP] Rest is over. Next exercise: ${item.exercise.name.en}. Explain it in one or two sentences and start set 1 when the patient is ready.`
    : `[APP] Rest is over. Start set ${s.current} of ${item.sets} of ${item.exercise.name.en} when the patient is ready.`;
}

/** The session as stored in the patient's history. */
export function toRecordExercises(s: Session): SessionExercise[] {
  return s.items.map((i) => ({
    exerciseId: i.exercise.id,
    sets: i.sets,
    reps: i.reps,
    logged: i.log.map((l) => l.logged),
  }));
}

/** Per-set comparison for the developer panel. */
export function results(s: Session) {
  return s.items.flatMap((i) =>
    i.log.map((l) => ({
      exercise: i.exercise.name.en,
      set: l.set,
      target: i.reps,
      heard: heardCount(l.heardText),
      camera: l.camera,
      logged: l.logged,
      midSetTurns: l.midSetTurns,
      seconds: l.startedAt && l.endedAt ? Math.round((l.endedAt - l.startedAt) / 1000) : null,
    })),
  );
}
