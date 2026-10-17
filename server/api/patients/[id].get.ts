import { familyView } from "#shared/family";
import { notesFor } from "#shared/permissions";
import { patientStats } from "#shared/stats";

export default defineEventHandler(async (event) => {
  const { patient, now } = await patientContext(event);
  const role = actorFrom(event).role;
  // The family gets its own reduced copy: no brief, diary, alert messages or clinical notes (KEL-01, ROL-06).
  if (role === "family") return { family: familyView(patient, now), now };
  // Private notes never leave the server for anyone but the patient (PAS-18).
  const visible = { ...patient, notes: notesFor(role, patient.notes) };
  return { patient: visible, stats: patientStats(patient), now };
});
