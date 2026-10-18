import { logActivity, WHO_AI, WHO_RULES } from "#shared/activity";
import { LANG_NAMES } from "#shared/exercises";
import { locale } from "#shared/i18n";
import { pickLang } from "#shared/model";
import { familyView, weekFacts, weeklyNews } from "#shared/family";

// KEL-04: this week's news for the family. The numbers come from rules; the model only words them
// warmly (≤ 80 words, no diagnosis). Without a key, over budget, or on any doubt: the template text.
const instruction = (lang: string) => `You write a short weekly update for the family of a person doing home rehabilitation exercises.
Write in ${lang}. At most 70 words, plain everyday words, warm and calm, one short paragraph, no lists, no emoji.
Use only the facts given. Keep every number exactly as given. Do not add medical facts, diagnoses, advice or predictions.
Never describe the person's body or condition. Refer to the person by the name given. Thank the family briefly at the end.`;

export default defineEventHandler(async (event) => {
  const { ws, id, now, iso, patient } = await patientContext(event);
  assertCan(actorFrom(event), "familyUpdate.make");
  rateLimit(event, ws, "family-update", 20, 60 * 60 * 1000);
  const lang = pickLang(((await readBody(event).catch(() => ({}))) ?? {}).lang ?? patient.lang);
  const w = weekFacts(patient, now);
  const dateText = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale(lang), { weekday: "short", day: "numeric", month: "short" });
  let text = weeklyNews(patient.name, w, lang, dateText);
  let by: "ai" | "template" = "template";

  if (useRuntimeConfig().geminiApiKey) {
    try {
      await aiBudget(event, "family");
      const facts = { name: patient.name, daysExercisedOfLast7: w.days, repsThisWeek: w.reps ?? 0, painAfterExercise: w.pain, painComparedWithStartOfWeek: w.painTrend ?? null, familyTasksDone: w.tasksDone ?? 0, nextVisit: w.nextVisit ? dateText(w.nextVisit) : null };
      const response = await gemini().models.generateContent({
        model: useRuntimeConfig().textModel,
        contents: [{ role: "user", parts: [{ text: `Facts (JSON): ${JSON.stringify(facts)}\nSame facts as plain sentences: ${text}` }] }],
        config: { systemInstruction: instruction(LANG_NAMES[lang]), temperature: 0.3, abortSignal: AbortSignal.timeout(20_000) },
      });
      const out = (response.text ?? "").trim();
      // Keep the AI words only if they are short and still carry the real number.
      if (out && out.split(/\s+/).length <= 90 && (!w.days || out.includes(String(w.days)))) {
        text = out;
        by = "ai";
      }
    } catch (e: any) {
      if (e?.statusCode !== 429) console.error("Family update failed, using the template", e?.message ?? e);
    }
  }

  const p = await updatePatient(ws, id, (p) => {
    p.familyUpdate = { text, lang, generatedAt: iso, by };
    logActivity(p, { at: iso, actor: by === "ai" ? "ai" : "rule", who: by === "ai" ? WHO_AI : WHO_RULES, action: "act_family_update", refs: [{ kind: "plan", id: `family-update-${iso}`, label: "Family update" }] });
  });
  return familyView(p, now);
});
