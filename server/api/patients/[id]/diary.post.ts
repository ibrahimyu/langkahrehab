import { pick, sanitizeDiaryEntry } from "#shared/model";

// Adds one phantom limb pain / sensation / mood entry.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const body = await readBody(event);
  const entry = sanitizeDiaryEntry({ ...body, id: undefined, at: undefined }, pick(body?.source, ["coach", "patient", "care_team"] as const, "patient"), iso);
  if (!entry) throw bad("Give a score from 0 to 10 or a note.");
  const p = await updatePatient(ws, id, (p) => {
    p.diary = [...p.diary, entry].slice(-200);
  });
  return p.diary;
});
