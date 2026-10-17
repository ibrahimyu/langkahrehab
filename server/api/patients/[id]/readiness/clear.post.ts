import { str } from "#shared/model";
import { allMet, logReadiness, refreshReadiness } from "#shared/readiness";

// DOK-03: the doctor clears the patient for prosthesis fitting (journey step 3). Before all seven
// criteria are met the doctor must write a reason (override). { step: "goal" } marks step 5
// ("Walking toward the goal"), only once the profile says the patient uses a prosthesis.
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso } = await patientContext(event);
  assertCan(actorFrom(event), "readiness.clear");
  const b = (await readBody(event)) ?? {};
  const reason = str(b.reason, 300);
  const p = await updatePatient(ws, id, (p) => {
    refreshReadiness(p, now);
    if (b.step === "goal") {
      if (p.profile.stage !== "prosthetic") throw bad("Set the profile to prosthetic first.");
      if (p.goalReachedAt) return;
      p.goalReachedAt = iso;
      logReadiness(p, { at: iso, what: "goal", from: null, to: null, by: "doctor", note: reason }, "act_goal_reached", {});
      return;
    }
    if (p.clearedForFittingAt) return;
    if (!allMet(p.readiness!) && !reason) throw bad("Write why you clear before all criteria are met.");
    p.clearedForFittingAt = iso;
    p.clearedNote = allMet(p.readiness!) ? "" : reason;
    logReadiness(p, { at: iso, what: "cleared", from: null, to: null, by: "doctor", note: p.clearedNote }, "act_cleared", {});
  });
  return { readiness: p.readiness, readinessLog: p.readinessLog, clearedForFittingAt: p.clearedForFittingAt, clearedNote: p.clearedNote ?? "", goalReachedAt: p.goalReachedAt };
});
