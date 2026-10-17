// Admin: which physio and doctor look after this patient (null = any clinician).
export default defineEventHandler(async (event) => {
  const { ws, id, workspace } = await patientContext(event);
  assertCan(actorFrom(event), "account.manage");
  const b = (await readBody(event)) ?? {};
  const accounts = workspace.accounts ?? [];
  const pickId = (v: unknown, role: "physio" | "doctor") => (typeof v === "string" && accounts.some((a) => a.id === v && a.role === role) ? v : null);
  const careTeam = { physioId: pickId(b.physioId, "physio"), doctorId: pickId(b.doctorId, "doctor") };
  const p = await updatePatient(ws, id, (q) => void (q.careTeam = careTeam));
  return { careTeam: p.careTeam };
});
