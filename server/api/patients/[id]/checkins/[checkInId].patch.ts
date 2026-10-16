import { pick, str } from "#shared/model";

// Care team: schedules a check-in or records the visit.
export default defineEventHandler(async (event) => {
  const { ws, id } = await patientContext(event);
  const checkInId = getRouterParam(event, "checkInId");
  const b = (await readBody(event)) ?? {};
  const p = await updatePatient(ws, id, (p) => {
    const c = p.checkIns.find((c) => c.id === checkInId);
    if (!c) throw createError({ statusCode: 404, statusMessage: "Check-in not found." });
    if (b.status) c.status = pick(b.status, ["requested", "scheduled", "done"] as const, c.status);
    if (b.scheduledFor !== undefined) c.scheduledFor = str(b.scheduledFor, 40) || null;
    if (b.visitNote !== undefined) c.visitNote = str(b.visitNote, 2000);
    if (c.status === "done") c.planVersion = p.plan.version;
  });
  return p.checkIns;
});
