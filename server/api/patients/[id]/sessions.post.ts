import { exerciseById, LANGS } from "#shared/exercises";
import { CONCERNS, newId, pick, score, str, type SessionRecord } from "#shared/model";
import { addAlerts, afterSession } from "#shared/rules";

// Saves a finished (or stopped) session, then runs the next-action rules.
export default defineEventHandler(async (event) => {
  const { ws, id, iso, now, patient } = await patientContext(event);
  const b = (await readBody(event)) ?? {};
  const exercises = (Array.isArray(b.exercises) ? b.exercises : [])
    .filter((e: any) => exerciseById(e?.exerciseId))
    .slice(0, 6)
    .map((e: any) => {
      const sets = Math.min(5, Math.max(1, Math.round(Number(e.sets) || 1)));
      const logged = Array.isArray(e.logged) ? e.logged : [];
      return {
        exerciseId: e.exerciseId,
        sets,
        reps: Math.min(30, Math.max(1, Math.round(Number(e.reps) || 1))),
        logged: Array.from({ length: sets }, (_, i) => {
          const n = Number(logged[i]);
          return logged[i] === null || logged[i] === undefined || !Number.isInteger(n) ? null : Math.min(100, Math.max(0, n));
        }),
      };
    });
  if (!exercises.length) throw bad("Session has no exercises.");
  const session: SessionRecord = {
    id: newId(),
    at: iso,
    planVersion: patient.plan.version,
    lang: pick(b.lang, LANGS, patient.lang),
    mode: pick(b.mode, ["camera", "patient", "coach"] as const, "camera"),
    exercises,
    painBefore: score(b.painBefore),
    painAfter: score(b.painAfter),
    difficulty: (["easy", "ok", "hard"] as const).includes(b.difficulty) ? b.difficulty : null,
    concern: b.concern && typeof b.concern === "object"
      ? { kind: pick(b.concern.kind, CONCERNS, "other"), details: str(b.concern.details, 300) }
      : null,
    nextAction: { kind: "keep_going" },
    source: "session",
  };
  const result = afterSession(patient, session, now);
  session.nextAction = result.nextAction;
  await updatePatient(ws, id, (p) => {
    p.sessions = [...p.sessions, session].slice(-100);
    addAlerts(p, result.alerts);
  });
  return { session, alerts: result.alerts };
});
