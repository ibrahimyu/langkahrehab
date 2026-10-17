import { LANG_NAMES } from "#shared/exercises";
import { familyView, loadsBody, textOf } from "#shared/family";
import { TASK_TEMPLATES } from "#shared/familyTaskTemplates";
import { pickLang, str } from "#shared/model";

// Ideas for the "Add a task" sheet: approved templates this family does not have yet (free), and on
// request a few more from the AI, written from what the family already sees. The family picks one,
// can change the words, and adds it; nothing is added on its own.
const instruction = (lang: string) => `You suggest practical jobs for the family of someone recovering at home after an amputation.
Write in ${lang}. Give 3 to 5 jobs that fit the facts and are not already in the open tasks.
Each: title (an action, at most 8 words), detail (one plain sentence), item (true when it is about getting a thing).
Good jobs: home safety, papers and insurance, getting to visits, company and mood, meals, sharing the work, rest for the carer.
Never jobs about medicines, or about helping the person stand, walk or exercise (the physio decides those).
Answer with a JSON array only.`;

export default defineEventHandler(async (event) => {
  const { ws, now, patient } = await patientContext(event);
  assertCan(actorFrom(event), "familyTask.do");
  const b = (await readBody(event)) ?? {};
  const lang = pickLang(b.lang ?? patient.lang);
  const memberId = typeof b.memberId === "string" ? b.memberId : null;
  const dismissed = new Set((patient.dismissedTasks ?? []).filter((d) => d.memberId === memberId || d.memberId === null).map((d) => d.templateId));
  const open = new Set(patient.familyTasks.filter((t) => t.status === "open" && t.templateId).map((t) => t.templateId));
  const templates = TASK_TEMPLATES.filter((t) => !open.has(t.id) && !dismissed.has(t.id)).map((t) => ({ title: t.title[lang], detail: t.detail[lang], item: t.category === "equipment", templateId: t.id as string | null }));
  if (!b.ai || !useRuntimeConfig().geminiApiKey) return { ideas: templates, by: "template" };

  rateLimit(event, ws, "task-ideas", 20, 60 * 60 * 1000);
  await aiBudget(event, "family");
  const v = familyView(patient, now);
  const facts = { patient: v.name, today: v.today, week: v.week, nextVisit: v.nextVisit, goal: v.goal?.text ?? null, openTasks: v.tasks.filter((t) => t.status === "open").map((t) => textOf(t.title, lang)), familySize: v.family.length };
  try {
    const response = await gemini().models.generateContent({
      model: useRuntimeConfig().textModel,
      contents: [{ role: "user", parts: [{ text: `Facts (JSON): ${JSON.stringify(facts)}` }] }],
      config: { systemInstruction: instruction(LANG_NAMES[lang]), responseMimeType: "application/json", temperature: 0.6, abortSignal: AbortSignal.timeout(20_000) },
    });
    const raw = JSON.parse(response.text ?? "[]");
    const ai = (Array.isArray(raw) ? raw : [])
      .map((x: any) => ({ title: str(x?.title, 120), detail: str(x?.detail, 400), item: !!x?.item, templateId: null }))
      .filter((x: { title: string; detail: string }) => x.title && !loadsBody(`${x.title} ${x.detail}`) && !/\b(obat|medicine|dosis|tablet)\b/i.test(`${x.title} ${x.detail}`))
      .slice(0, 5);
    return { ideas: [...ai, ...templates], by: "ai" };
  } catch (e: any) {
    if (e?.statusCode === 429) throw e;
    console.error("Task ideas failed, using templates", e?.message ?? e);
    return { ideas: templates, by: "template" };
  }
});
