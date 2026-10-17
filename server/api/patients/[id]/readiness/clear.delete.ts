import { logReadiness } from "#shared/readiness";

// Undo for the doctor's clearance (?step=goal undoes "Walking toward the goal").
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  assertCan(actorFrom(event), "readiness.clear");
  const goal = getQuery(event).step === "goal";
  const p = await updatePatient(ws, id, (p) => {
    if (goal) {
      if (!p.goalReachedAt) return;
      p.goalReachedAt = null;
      logReadiness(p, { at: iso, what: "ungoal", from: null, to: null, by: "doctor", note: "" }, "act_goal_undone", {});
    } else {
      if (!p.clearedForFittingAt) return;
      p.clearedForFittingAt = null;
      p.clearedNote = "";
      logReadiness(p, { at: iso, what: "uncleared", from: null, to: null, by: "doctor", note: "" }, "act_cleared_undone", {});
    }
  });
  return { readiness: p.readiness, readinessLog: p.readinessLog, clearedForFittingAt: p.clearedForFittingAt, clearedNote: p.clearedNote ?? "", goalReachedAt: p.goalReachedAt };
});
