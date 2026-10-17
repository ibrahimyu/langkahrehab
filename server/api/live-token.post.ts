import { buildInstruction, coachContext, coachTools } from "#shared/coach";
import { pickLang } from "#shared/model";
import { parseSettings } from "#shared/settings";

// Mints a one-use Gemini Live token for one patient's session. The coach's instructions are built
// here from the stored patient (plan, profile, memories) and locked into the token.
// Audio goes from the browser straight to Gemini, never through this server.
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
  const config = liveConfig(settings, instruction, coachTools);
  const model = useRuntimeConfig().liveModel;
  const now = Date.now();
  const expiresAt = new Date(now + LIVE_SECONDS * 1000).toISOString();

  let token: { name?: string };
  try {
    token = await gemini().authTokens.create({
      config: {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: { model, config: config as never },
        abortSignal: AbortSignal.timeout(15_000),
      },
    });
  } catch (e) {
    throw providerError(e, "Could not start the coach");
  }
  if (!token.name?.startsWith("auth_tokens/")) throw createError({ statusCode: 503, statusMessage: "Could not start the coach." });

  // The raw WebSocket setup message nests some fields differently from the SDK's flat config.
  const { responseModalities, maxOutputTokens, speechConfig, systemInstruction, ...rest } = config;
  return {
    token: token.name,
    expiresAt,
    setup: {
      model: `models/${model}`,
      ...rest,
      generationConfig: { responseModalities, maxOutputTokens, speechConfig },
      systemInstruction: { parts: [{ text: systemInstruction }] },
    },
  };
});
