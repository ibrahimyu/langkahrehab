import { FAMILY_MAX, newId } from "#shared/model";
import { capTasks, familyView, generateFamilyTasks, sanitizeMember, validId } from "#shared/family";

// Adds a family member (DAT-02, max 6). New members get a share of any template tasks still missing,
// and their own sign-in (the account id is the member id).
// `id` and `taskIds` let Undo bring back a removed member with their open tasks.
export default defineEventHandler(async (event) => {
  const { ws, id, now, patient, workspace } = await patientContext(event);
  assertCan(actorFrom(event), "family.edit");
  const b = (await readBody(event)) ?? {};
  const m = sanitizeMember(b, patient.lang);
  if (!m) throw bad("Write a name.");
  let mid = "";
  const p = await updatePatient(ws, id, (p) => {
    if (p.family.length >= FAMILY_MAX) throw bad(`A family can have up to ${FAMILY_MAX} people here.`);
    const want = validId(b.id);
    mid = want && !p.family.some((x) => x.id === want) ? want : newId();
    p.family.push({ id: mid, ...m });
    const restore = new Set(Array.isArray(b.taskIds) ? b.taskIds.filter((x: unknown) => typeof x === "string") : []);
    for (const t of p.familyTasks) if (restore.has(t.id) && !t.assigneeId) t.assigneeId = mid;
    p.familyTasks = capTasks([...p.familyTasks, ...generateFamilyTasks(p, now)]);
  });
  const others = (workspace.accounts ?? []).filter((a) => a.id !== mid);
  await setWorkspace(ws, { ...workspace, accounts: [...others, { id: mid, role: "family", name: m.name, patientId: id, active: true }] });
  return familyView(p, now);
});
