import { mergeGoals } from "#shared/goals";

// Replaces the goal list after an edit (PAS-14). mergeGoals keeps what this role may not change:
// only the physio grants the OK for body-loading targets.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const actor = actorFrom(event);
  assertCan(actor, "goal.edit");
  const body = (await readBody(event)) ?? {};
  const p = await updatePatient(ws, id, (p) => {
    p.goals = mergeGoals(p.goals, body.goals, actor.role, iso);
  });
  return p.goals;
});
