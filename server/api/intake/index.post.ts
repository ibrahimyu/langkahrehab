import { newId, pickLang } from "#shared/model";
import { emptyFields, LETTER_PAGE, sanitizeExtraction, sanitizePages, type Intake } from "#shared/intake";
import { sampleFields, sampleLetter } from "#shared/sampleLetters";
import { intakeInstruction, intakeSchema } from "../../utils/intakePrompt";

// AI-03 / DOK-01: reads one discharge letter (photos of each page, or a PDF) into a draft intake for the doctor to review.
// The photo comes from the doctor's browser, or from a letter the family sent (DOK-07). It is passed
// to the model and dropped: only the extracted fields are stored, and it is never logged.

export default defineEventHandler(async (event) => {
  const { ws, now } = await context(event);
  const actor = actorFrom(event);
  assertCan(actor, "intake.review");
  const b = (await readBody(event).catch(() => ({}))) ?? {};
  const iso = new Date(now).toISOString();
  const sample = sampleLetter(b.sample);

  // A letter from the family: one draft per letter, so opening it twice does not read it twice.
  let pages = sanitizePages(b.pages ?? b.image);
  let patientId: string | null = null;
  let letterId: string | null = null;
  let lang = pickLang(sample?.lang ?? b.lang);
  if (typeof b.letterId === "string" && typeof b.patientId === "string") {
    const p = await getPatient(ws, b.patientId);
    const letter = p?.letters.find((l) => l.id === b.letterId);
    if (!p || !letter) throw createError({ statusCode: 404, statusMessage: "Letter not found." });
    if (letter.status !== "awaiting_doctor") throw bad("This letter has already been reviewed.");
    const open = (await listIntakes(ws)).find((x) => x.letterId === letter.id && x.status === "awaiting_doctor");
    if (open) return { intake: open, fallback: open.readBy !== "ai" };
    pages = sanitizePages(letter.pages?.length ? letter.pages : letter.image);
    patientId = p.id;
    letterId = letter.id;
    lang = pickLang(b.lang ?? p.lang);
  }
  if (!pages) throw bad("Choose photos (JPEG or PNG) or a PDF of the letter, up to 6 pages and about 9 MB.");
  rateLimit(event, ws, "intake", 10, 3_600_000);

  let read: Pick<Intake, "fields" | "medicationsMentioned" | "suggestedTasks" | "explanation" | "readBy">;
  try {
    await aiBudget(event, "intake");
    const response = await gemini().models.generateContent({
      model: useRuntimeConfig().textModel,
      contents: [
        {
          role: "user",
          parts: [
            ...pages.map((page) => {
              const m = LETTER_PAGE.exec(page)!;
              return { inlineData: { mimeType: m[1]!, data: m[2]! } };
            }),
            { text: pages.length > 1 ? `Read this discharge letter (${pages.length} pages, in order).` : "Read this discharge letter." },
          ],
        },
      ],
      config: {
        systemInstruction: intakeInstruction(lang),
        responseMimeType: "application/json",
        responseSchema: intakeSchema as never,
        temperature: 0,
        abortSignal: AbortSignal.timeout(60_000),
      },
    });
    read = { ...sanitizeExtraction(JSON.parse(response.text ?? "{}")), readBy: "ai" };
  } catch (e: any) {
    // Never log the request: it carries the photo (AI-03 privacy).
    console.error("Intake read failed:", e?.statusCode ?? "", String(e?.statusMessage ?? e?.message ?? "").replace(/\s+/g, " ").slice(0, 120));
    read = sample
      ? { fields: sampleFields(sample), medicationsMentioned: [...sample.medications], suggestedTasks: [], explanation: null, readBy: "sample" }
      : { fields: emptyFields(), medicationsMentioned: [], suggestedTasks: [], explanation: null, readBy: "manual" };
  }

  const intake: Intake = {
    id: newId(), createdAt: iso, uploadedBy: letterId ? "family" : actor.role, status: "awaiting_doctor",
    ...read, family: [], lang, patientId, letterId, sample: sample?.id ?? null, confirmedAt: null, updatedAt: iso,
  };
  await saveIntake(ws, intake);
  return { intake, fallback: intake.readBy !== "ai" };
});
