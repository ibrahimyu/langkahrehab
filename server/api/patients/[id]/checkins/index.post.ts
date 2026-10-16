import { newId, pick, str, type CheckIn } from "#shared/model";

// Patient (or care team) asks for a check-in.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const b = (await readBody(event)) ?? {};
  const checkIn: CheckIn = {
    id: newId(),
    kind: pick(b.kind, ["doctor_review", "therapy"] as const, "therapy"),
    reason: str(b.reason, 300),
    requestedAt: iso,
    requestedBy: pick(b.role, ["patient", "physio", "doctor"] as const, "patient"),
    status: "requested",
    scheduledFor: null,
    visitNote: "",
    planVersion: null,
  };
  const p = await updatePatient(ws, id, (p) => {
    p.checkIns = [...p.checkIns, checkIn].slice(-50);
  });
  return p.checkIns;
});
