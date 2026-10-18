import { LANG_NAMES } from "#shared/exercises";
import { emptySourcing, familyView, needsItem, sanitizeOptions, textOf } from "#shared/family";
import { t } from "#shared/i18n";
import { pickLang, str, type SourceOption } from "#shared/model";

// The navigator for an item the family needs (a walker, a chair, a bath mat): ways to get it in their
// city, free first, then borrow, then buy, with sources from Google Search. Only the item and the city
// are sent to the model, never anything about the patient's health.
const instruction = (lang: string) => `You help a family in Indonesia get an item for someone recovering at home after an amputation.
Write in ${lang}. Search the web for real, current options in or near the given city.
Give 3 to 6 options as a JSON array and nothing else. Each option: {"kind": "free" | "borrow" | "buy", "title": short name of the place or way, "detail": one or two plain sentences on how to get it there (who to ask, what to bring, e.g. BPJS card or a letter from the doctor), "cost": a price range in rupiah or "free" or "borrow, return later", "url": a https link from your search or null}.
Order: free ways first (BPJS, government or hospital programmes, charities), then places that lend items (community, religious groups, PMI, loan services), then where to buy with typical prices.
Only include places and programmes you found in the search. Never give medical advice.`;

const templateOptions = (lang: ReturnType<typeof pickLang>, city: string): SourceOption[] => [
  { kind: "free", title: t(lang, "navFreeT"), detail: t(lang, "navFreeD"), cost: t(lang, "navFreeC"), url: null },
  { kind: "borrow", title: t(lang, "navBorrowT"), detail: city ? t(lang, "navBorrowD", { city }) : t(lang, "navBorrowDAny"), cost: t(lang, "navBorrowC"), url: null },
  { kind: "buy", title: t(lang, "navBuyT"), detail: t(lang, "navBuyD"), cost: "", url: null },
];

function parseOptions(text: string): SourceOption[] {
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  if (!json) return [];
  try {
    return sanitizeOptions(JSON.parse(json));
  } catch {
    return [];
  }
}

export default defineEventHandler(async (event) => {
  const { ws, id, now, iso, patient } = await patientContext(event);
  assertCan(actorFrom(event), "familyTask.do");
  rateLimit(event, ws, "navigator", 20, 60 * 60 * 1000);
  const taskId = getRouterParam(event, "taskId");
  const task = patient.familyTasks.find((x) => x.id === taskId);
  if (!task) throw createError({ statusCode: 404, statusMessage: "Task not found." });
  if (!needsItem(task)) throw bad("This task is not about getting an item.");
  const b = (await readBody(event)) ?? {};
  const lang = pickLang(b.lang ?? patient.lang);
  const city = str(b.city, 60);
  let options = templateOptions(lang, city);
  let by: "ai" | "template" = "template";

  if (useRuntimeConfig().geminiApiKey && city) {
    try {
      await aiBudget(event, "navigator");
      const response = await gemini().models.generateContent({
        model: useRuntimeConfig().textModel,
        contents: [{ role: "user", parts: [{ text: `Item: ${textOf(task.title, "en")} (${textOf(task.title, lang)})\nCity: ${city}` }] }],
        config: { systemInstruction: instruction(LANG_NAMES[lang]), tools: [{ googleSearch: {} }], temperature: 0.2, abortSignal: AbortSignal.timeout(30_000) },
      });
      const found = parseOptions(response.text ?? "");
      if (found.length >= 2) {
        options = found;
        by = "ai";
      }
    } catch (e: any) {
      if (e?.statusCode !== 429) console.error("Navigator search failed, using the template", e?.message ?? e);
    }
  }

  const p = await updatePatient(ws, id, (p) => {
    const t = p.familyTasks.find((x) => x.id === taskId);
    if (!t) return;
    t.sourcing = { ...(t.sourcing ?? emptySourcing()), city, options, optionsAt: iso, optionsBy: by };
  });
  return familyView(p, now);
});
