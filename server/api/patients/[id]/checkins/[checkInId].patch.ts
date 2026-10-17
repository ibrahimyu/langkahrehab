import { pick, str } from "#shared/model";

// Care team: schedules a check-in or records the visit.
export default defineEventHandler(async (event) => {
  const { ws, id } = await patientContext(event);
  assertCan(actorFrom(event), "checkin.manage");
  const checkInId = getRouterParam(event, "checkInId");
  const b = (await readBody(event)) ?? {};
  const p = await updatePatient(ws, id, (p) => {
    const c = p.checkIns.find((c) => c.id === checkInId);
    if (!c) throw createError({ statusCode: 404, statusMessage: "Check-in not found." });
    const wasDone = c.status === "done";
    if (b.status) c.status = pick(b.status, ["requested", "scheduled", "done"] as const, c.status);
    if (b.scheduledFor !== undefined) c.scheduledFor = str(b.scheduledFor, 40) || null;
    if (b.visitNote !== undefined) c.visitNote = str(b.visitNote, 2000);
    // The plan in force at the visit, fixed when the visit is closed (later note edits keep it).
    if (c.status === "done" && !wasDone) c.planVersion = p.plan.version;
    if (c.status !== "done") c.planVersion = null;
  });
  return p.checkIns;
});
