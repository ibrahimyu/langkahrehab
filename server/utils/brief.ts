import type { H3Event } from "h3";
import type { Lang } from "#shared/exercises";
import { describeProfile, type Patient } from "#shared/model";
import { patientStats } from "#shared/stats";
import { localizeSeed } from "#shared/seedText";

/** Writes the care team brief from everything stored for the patient (DOK-04). Throws when the model fails. */
export async function writeBrief(event: H3Event, p: Patient, lang: Lang): Promise<{ text: string; stats: ReturnType<typeof patientStats> }> {
  const stats = patientStats(p);
  // Demo seed sentences in the brief language, as on screen (stored data is unchanged).
  const data = localizeSeed({
    patient: `${p.name}, ${p.age}. ${describeProfile(p.profile)}`,
    plan: { version: p.plan.version, items: p.plan.items, painThreshold: p.plan.painThreshold, reviewDate: p.plan.reviewDate },
    stats,
    sessions: p.sessions.slice(-20).map(({ id, source, lang, ...s }) => s),
    diary: p.diary.slice(-30).map(({ id, source, ...d }) => d),
    skinChecks: p.skinChecks.slice(-10).map((c) => ({ at: c.at, area: c.area, urgency: c.result.urgency, findings: c.result.findings, note: c.result.careTeamNote })),
    openAlerts: p.alerts.filter((a) => !a.resolvedAt).map((a) => ({ at: a.at, kind: a.kind, message: a.message })),
    memories: p.memories.map((m) => ({ kind: m.kind, text: m.text })),
    // PAS-18: what the patient told the team, grouped by kind; private notes stay out.
    notes: p.notes.filter((n) => !n.private).slice(-30).reduce<Record<string, { at: string; quote: string; urgency: string; discussAtVisit: boolean; reply: string; topic?: string }[]>>((g, n) => ((g[n.kind] ??= []).push({ at: n.at, quote: n.quote, urgency: n.urgency, discussAtVisit: n.discussAtVisit, reply: n.reply, topic: n.topic }), g), {}),
  }, lang);

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
  return { text, stats };
}
