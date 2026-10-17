import { newPatient, sanitizeNewPatient } from "#shared/patients";

// Admin or doctor: a new patient without a discharge letter. The first plan waits for the physio;
// the patient and each family member get a sign-in account.
export default defineEventHandler(async (event) => {
  const { ws, workspace, now } = await context(event);
  assertCan(actorFrom(event), "patient.create");
  const input = sanitizeNewPatient((await readBody(event)) ?? {});
  if (typeof input === "string") throw bad(input);
  const accounts = workspace.accounts ?? [];
  const isRole = (id: string | null, role: "physio" | "doctor") => !id || accounts.some((a) => a.id === id && a.role === role);
  if (!isRole(input.physioId, "physio") || !isRole(input.doctorId, "doctor")) throw bad("Choose a physio and a doctor from the list.");
  const made = newPatient(input, now);
  await createPatient(ws, made.patient);
  await setWorkspace(ws, { ...workspace, accounts: [...accounts, ...made.accounts] });
  return { patient: made.patient, accounts: made.accounts };
});
