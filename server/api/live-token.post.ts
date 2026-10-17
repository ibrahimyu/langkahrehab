import { buildInstruction, coachContext, coachTools } from "#shared/coach";
import { pickLang } from "#shared/model";
import { parseSettings } from "#shared/settings";

// Mints a one-use Gemini Live token for one patient's session. The coach's instructions are built
// here from the stored patient (plan, profile, memories) and locked into the token.
export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) ?? {};
  const { ws } = await context(event);
  assertCan(actorFrom(event), "live.start");
  rateLimit(event, ws, "live", 20, 60 * 60 * 1000);
  await aiBudget(event, "live");
  const patient = await getPatient(ws, String(body.patientId ?? ""));
  if (!patient) throw createError({ statusCode: 404, statusMessage: "Patient not found." });
  const settings = parseSettings(body.settings);
  // The coach speaks the language chosen in the app (the patient's own setting in a real product).
  patient.lang = pickLang(body.lang ?? patient.lang);
  const instruction = buildInstruction(patient, { mode: settings.mode, askDiary: settings.askDiary, support: settings.support }, coachContext(patient));
  return mintLiveToken(liveConfig(settings, instruction, coachTools), "Could not start the coach");
});
