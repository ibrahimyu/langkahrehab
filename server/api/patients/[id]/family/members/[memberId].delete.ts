import { familyView } from "#shared/family";

// Removes a family member. Their open tasks stay, unassigned, so someone else can take them.
export default defineEventHandler(async (event) => {
  const { ws, id, now } = await patientContext(event);
  assertCan(actorFrom(event), "family.edit");
  const memberId = getRouterParam(event, "memberId");
  const p = await updatePatient(ws, id, (p) => {
    if (!p.family.some((x) => x.id === memberId)) throw createError({ statusCode: 404, statusMessage: "Family member not found." });
    p.family = p.family.filter((x) => x.id !== memberId);
    for (const t of p.familyTasks) if (t.assigneeId === memberId && t.status === "open") t.assigneeId = null;
  });
  return familyView(p, now);
});
