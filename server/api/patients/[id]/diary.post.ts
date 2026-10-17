import { pick, sanitizeDiaryEntry } from "#shared/model";
import { addAlerts, moodAlert } from "#shared/rules";

// Adds one phantom limb pain / sensation / mood entry.
export default defineEventHandler(async (event) => {
  const { ws, id, iso, now } = await patientContext(event);
  assertCan(actorFrom(event), "diary.add");
  const body = await readBody(event);
  const entry = sanitizeDiaryEntry({ ...body, id: undefined, at: undefined }, pick(body?.source, ["coach", "patient", "care_team"] as const, "patient"), iso);
  if (!entry) throw bad("Give a score from 0 to 10 or a note.");
  const p = await updatePatient(ws, id, (p) => {
    p.diary = [...p.diary, entry].slice(-200);
    // SYS-07: several low moods in a row → a gentle wellbeing alert for the physio.
    const mood = entry.kind === "mood" ? moodAlert(p, now) : null;
    if (mood) addAlerts(p, [mood]);
  });
  return p.diary;
});
