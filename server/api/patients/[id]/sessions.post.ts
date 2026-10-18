import { logActivity, WHO_RULES } from "#shared/activity";
import { exerciseById, LANGS } from "#shared/exercises";
import { CONCERNS, newId, pick, score, str, type SessionRecord } from "#shared/model";
import { addAlerts, afterSession } from "#shared/rules";

// Saves a finished (or stopped) session, then runs the next-action rules.
export default defineEventHandler(async (event) => {
  const { ws, id, iso, now, patient } = await patientContext(event);
  assertCan(actorFrom(event), "session.save");
  const b = (await readBody(event)) ?? {};
  // SYS-05: a retried save with the same clientId returns the first copy instead of a second session.
  const clientId = str(b.clientId, 64) || null;
  const existing = clientId ? patient.sessions.find((s) => s.clientId === clientId) : undefined;
  if (existing) return { session: existing, alerts: [] };
  const exercises = (Array.isArray(b.exercises) ? b.exercises : [])
    .filter((e: any) => exerciseById(e?.exerciseId))
    .slice(0, 6)
    .map((e: any) => {
      const sets = Math.min(5, Math.max(1, Math.round(Number(e.sets) || 1)));
      const logged = Array.isArray(e.logged) ? e.logged : [];
      const form = Array.isArray(e.form) ? e.form : [];
      return {
        exerciseId: e.exerciseId,
        sets,
        reps: Math.min(30, Math.max(1, Math.round(Number(e.reps) || 1))),
        logged: Array.from({ length: sets }, (_, i) => {
          const n = Number(logged[i]);
          return logged[i] === null || logged[i] === undefined || !Number.isInteger(n) ? null : Math.min(100, Math.max(0, n));
        }),
        form: Array.from({ length: sets }, (_, i) => {
          const n = Number(form[i]);
          return form[i] === null || form[i] === undefined || !Number.isFinite(n) ? null : Math.min(100, Math.max(0, Math.round(n)));
        }),
      };
    });
  if (!exercises.length) throw bad("Session has no exercises.");
  const session: SessionRecord = {
    id: newId(),
    clientId,
    at: iso,
    planVersion: patient.plan.version,
    lang: pick(b.lang, LANGS, patient.lang),
    mode: pick(b.mode, ["camera", "patient", "coach"] as const, "camera"),
    exercises,
    painBefore: score(b.painBefore),
    painAfter: score(b.painAfter),
    difficulty: (["easy", "ok", "hard"] as const).includes(b.difficulty) ? b.difficulty : null,
    concern: b.concern && typeof b.concern === "object"
      ? { kind: pick(b.concern.kind, CONCERNS, "other"), details: str(b.concern.details, 300), source: pick(b.concern.source, ["coach", "keyword_fallback", "patient"] as const, "coach") }
      : null,
    nextAction: { kind: "keep_going" },
    source: "session",
  };
  const result = afterSession(patient, session, now);
  session.nextAction = result.nextAction;
  await updatePatient(ws, id, (p) => {
    // Checked again inside the transaction: two retries racing each other still make one session.
    if (clientId && p.sessions.some((s) => s.clientId === clientId)) return;
    p.sessions = [...p.sessions, session].slice(-100);
    // FIS-08: the patient's session, the alerts the rules raised and the next step they chose.
    const ref = { kind: "session" as const, id: session.id, label: session.at.slice(0, 10) };
    logActivity(p, { at: session.at, actor: "human", who: "patient", action: "act_session", params: { pain: `${session.painBefore ?? "?"}→${session.painAfter ?? "?"}` }, refs: [ref] });
    addAlerts(p, result.alerts);
    if (result.nextAction.kind !== "keep_going") logActivity(p, { at: session.at, actor: "rule", who: WHO_RULES, action: "act_next", params: { kind: result.nextAction.kind }, refs: [ref] });
  });
  return { session, alerts: result.alerts };
});
