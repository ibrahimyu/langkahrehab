import { str } from "#shared/model";

// The patient's own settings: exercise time and days, contact details (PAS-15, PAS-17).
export default defineEventHandler(async (event) => {
  const { ws, id } = await patientContext(event);
  assertCan(actorFrom(event), "prefs.edit");
  const b = (await readBody(event)) ?? {};
  const p = await updatePatient(ws, id, (p) => {
    const cur = p.preferences;
    if (b.exerciseTime !== undefined) cur.exerciseTime = typeof b.exerciseTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.exerciseTime) ? b.exerciseTime : null;
    if (Array.isArray(b.exerciseDays)) cur.exerciseDays = [...new Set(b.exerciseDays.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))] as number[];
    if (b.phone !== undefined) cur.phone = str(b.phone, 32).replace(/[^\d+ ()-]/g, "");
    if (b.email !== undefined) cur.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(b.email, 120)) ? str(b.email, 120) : "";
  });
  return p.preferences;
});
