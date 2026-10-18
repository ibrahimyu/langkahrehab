import { buildInstruction, coachContext, coachTools } from "#shared/coach";
import { pickLang } from "#shared/model";
import { parseSettings } from "#shared/settings";
import { localizeSeed } from "#shared/seedText";

// Mints a one-use Gemini Live token for one patient's session. The coach's instructions are built
// here from the stored patient (plan, profile, memories) and locked into the token.
export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) ?? {};
  const { ws } = await context(event);
  assertCan(actorFrom(event), "live.start");
  rateLimit(event, ws, "live", 20, 60 * 60 * 1000);
  await aiBudget(event, "live");
  const stored = await getPatient(ws, String(body.patientId ?? ""));
  if (!stored) throw createError({ statusCode: 404, statusMessage: "Patient not found." });
  // The coach speaks the language chosen in the app (the patient's own setting in a real product);
  // demo seed sentences are given to it in that language too.
  const lang = pickLang(body.lang ?? stored.lang);
  const patient = { ...localizeSeed(stored, lang), lang };
  const settings = parseSettings(body.settings);
  const instruction = buildInstruction(patient, { mode: settings.mode, askDiary: settings.askDiary, support: settings.support }, coachContext(patient));
  return mintLiveToken(liveConfig(settings, instruction, coachTools), "Could not start the coach");
});
