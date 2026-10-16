import { describeProfile, pickLang } from "#shared/model";
import { patientStats } from "#shared/stats";

// Writes the care team brief from everything stored for the patient.
export default defineEventHandler(async (event) => {
  const { ws, id, iso, patient: p } = await patientContext(event);
  rateLimit(event, ws, "brief", 30, 60 * 60 * 1000);
  const lang = pickLang((await readBody(event).catch(() => ({})))?.lang ?? "en");
  const stats = patientStats(p);
  const data = {
    patient: `${p.name}, ${p.age}. ${describeProfile(p.profile)}`,
    plan: { version: p.plan.version, items: p.plan.items, painThreshold: p.plan.painThreshold, reviewDate: p.plan.reviewDate },
    stats,
    sessions: p.sessions.slice(-20).map(({ id, source, lang, ...s }) => s),
    diary: p.diary.slice(-30).map(({ id, source, ...d }) => d),
    skinChecks: p.skinChecks.slice(-10).map((c) => ({ at: c.at, area: c.area, urgency: c.result.urgency, findings: c.result.findings, note: c.result.careTeamNote })),
    openAlerts: p.alerts.filter((a) => !a.resolvedAt).map((a) => ({ at: a.at, kind: a.kind, message: a.message })),
    memories: p.memories.map((m) => ({ kind: m.kind, text: m.text })),
  };

  let text: string;
  try {
    const response = await gemini().models.generateContent({
      model: useRuntimeConfig().textModel,
      contents: [{ role: "user", parts: [{ text: `Patient data (JSON):\n${JSON.stringify(data)}` }] }],
      config: { systemInstruction: briefInstruction(lang), temperature: 0.2, abortSignal: AbortSignal.timeout(45_000) },
    });
    text = (response.text ?? "").trim();
  } catch (e) {
    throw providerError(e, "Brief failed");
  }
  if (!text) throw createError({ statusCode: 502, statusMessage: "The model returned an empty brief." });

  const updated = await updatePatient(ws, id, (q) => {
    q.brief = { text, lang, generatedAt: iso, editedAt: null };
  });
  return { brief: updated.brief, stats };
});
