import { familyView } from "#shared/family";

// Removes a family member. Their open tasks stay, unassigned, so someone else can take them, and
// their sign-in is turned off (Undo adds the member back and turns it on again).
export default defineEventHandler(async (event) => {
  const { ws, id, now, workspace } = await patientContext(event);
  assertCan(actorFrom(event), "family.edit");
  const memberId = getRouterParam(event, "memberId");
  const p = await updatePatient(ws, id, (p) => {
    if (!p.family.some((x) => x.id === memberId)) throw createError({ statusCode: 404, statusMessage: "Family member not found." });
    p.family = p.family.filter((x) => x.id !== memberId);
    for (const t of p.familyTasks) if (t.assigneeId === memberId && t.status === "open") t.assigneeId = null;
  });
  const accounts = (workspace.accounts ?? []).map((a) => (a.id === memberId && a.role === "family" ? { ...a, active: false } : a));
  await setWorkspace(ws, { ...workspace, accounts });
  return familyView(p, now);
});
