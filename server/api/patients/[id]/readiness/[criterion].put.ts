import { CRITERIA, READINESS_STATUSES, pick, str, type Criterion } from "#shared/model";
import { canSet, logReadiness, refreshReadiness } from "#shared/readiness";

// DOK-03 / FIS-07: a clinician marks one readiness criterion. "auto" hands the row back to the
// automatic signal. The physio owns range, strength, engagement and home; the doctor owns all seven.
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso } = await patientContext(event);
  const actor = actorFrom(event);
  assertCan(actor, "readiness.edit");
  const role = actor.role === "doctor" ? "doctor" : "physio";
  const criterion = getRouterParam(event, "criterion") as Criterion;
  if (!CRITERIA.includes(criterion)) throw bad("Unknown criterion.");
  if (!canSet(role, criterion)) throw createError({ statusCode: 403, statusMessage: "Set by the doctor.", data: { action: "readiness.edit", role } });
  const b = (await readBody(event)) ?? {};
  const toAuto = b.status === "auto";
  const status = pick(b.status, READINESS_STATUSES, "not_assessed");
  const note = str(b.note, 300);
  const p = await updatePatient(ws, id, (p) => {
    refreshReadiness(p, now);
    const before = p.readiness![criterion];
    p.readiness![criterion] = toAuto
      ? { ...before, source: "auto", note: "", setAt: iso }
      : { status, source: role, setAt: iso, evidence: before.evidence, note };
    refreshReadiness(p, now);
    const after = p.readiness![criterion];
    logReadiness(p, { at: iso, what: criterion, from: before.status, to: after.status, by: role, note }, "act_readiness", { criterion, status: after.status });
  });
  return { readiness: p.readiness, readinessLog: p.readinessLog, clearedForFittingAt: p.clearedForFittingAt, clearedNote: p.clearedNote ?? "", goalReachedAt: p.goalReachedAt };
});
