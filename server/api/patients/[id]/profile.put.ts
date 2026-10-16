import { sanitizeProfile } from "#shared/model";

// Care team: the doctor records the amputation details once.
export default defineEventHandler(async (event) => {
  const { ws, id } = await patientContext(event);
  const profile = sanitizeProfile(await readBody(event));
  await updatePatient(ws, id, (p) => (p.profile = profile));
  return profile;
});
