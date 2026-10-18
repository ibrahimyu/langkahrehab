import { logActivity, WHO_AI } from "#shared/activity";
import { pickLang } from "#shared/model";

// Writes the care team brief from everything stored for the patient.
export default defineEventHandler(async (event) => {
  const { ws, id, iso, patient: p } = await patientContext(event);
  assertCan(actorFrom(event), "brief.generate");
  rateLimit(event, ws, "brief", 30, 60 * 60 * 1000);
  await aiBudget(event, "brief");
  const lang = pickLang((await readBody(event).catch(() => ({})))?.lang ?? "en");
  const { text, stats } = await writeBrief(event, p, lang);

  const updated = await updatePatient(ws, id, (q) => {
    q.brief = { text, lang, generatedAt: iso, editedAt: null };
    logActivity(q, { at: iso, actor: "ai", who: WHO_AI, action: "act_brief", refs: [{ kind: "plan", id: `brief-${iso}`, label: "Brief" }] });
  });
  return { brief: updated.brief, stats };
});
