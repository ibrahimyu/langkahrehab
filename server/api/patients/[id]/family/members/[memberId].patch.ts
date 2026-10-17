import { familyView, sanitizeMember } from "#shared/family";

// Edits a family member: name, relation, phone, lives with the patient.
export default defineEventHandler(async (event) => {
  const { ws, id, now, patient, workspace } = await patientContext(event);
  assertCan(actorFrom(event), "family.edit");
  const memberId = getRouterParam(event, "memberId");
  const m = sanitizeMember((await readBody(event)) ?? {}, patient.lang);
  if (!m) throw bad("Write a name.");
  const p = await updatePatient(ws, id, (p) => {
    const i = p.family.findIndex((x) => x.id === memberId);
    if (i < 0) throw createError({ statusCode: 404, statusMessage: "Family member not found." });
    p.family[i] = { id: p.family[i]!.id, ...m };
  });
  // Their sign-in shows the same name.
  if ((workspace.accounts ?? []).some((a) => a.id === memberId)) {
    await setWorkspace(ws, { ...workspace, accounts: workspace.accounts!.map((a) => (a.id === memberId ? { ...a, name: m.name } : a)) });
  }
  return familyView(p, now);
});
