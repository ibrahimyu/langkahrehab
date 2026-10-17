// DOK-05: the care team removes a check-in booked by mistake (the screen offers Undo, which restores it).
export default defineEventHandler(async (event) => {
  const { ws, id } = await patientContext(event);
  assertCan(actorFrom(event), "checkin.manage");
  const checkInId = getRouterParam(event, "checkInId");
  const p = await updatePatient(ws, id, (p) => {
    if (!p.checkIns.some((c) => c.id === checkInId)) throw createError({ statusCode: 404, statusMessage: "Check-in not found." });
    p.checkIns = p.checkIns.filter((c) => c.id !== checkInId);
  });
  return p.checkIns;
});
