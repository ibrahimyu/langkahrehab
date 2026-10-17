import { newId, pickLang } from "#shared/model";
import { emptyFields, sanitizeExtraction, type Intake } from "#shared/intake";
import { sampleFields, sampleLetter } from "#shared/sampleLetters";

// AI-03 / DOK-01: reads one discharge letter photo into a draft intake for the doctor to review.
// The photo comes from the doctor's browser, or from a letter the family sent (DOK-07). It is passed
// to the model and dropped: only the extracted fields are stored, and it is never logged.
const MAX_CHARS = 5_600_000; // about 4 MB of image
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export default defineEventHandler(async (event) => {
  const { ws, now } = await context(event);
  const actor = actorFrom(event);
  assertCan(actor, "intake.review");
  const b = (await readBody(event).catch(() => ({}))) ?? {};
  const iso = new Date(now).toISOString();
  const sample = sampleLetter(b.sample);

  // A letter from the family: one draft per letter, so opening it twice does not read it twice.
  let image = typeof b.image === "string" ? b.image : "";
  let patientId: string | null = null;
  let letterId: string | null = null;
  let lang = pickLang(sample?.id ?? b.lang);
  if (typeof b.letterId === "string" && typeof b.patientId === "string") {
    const p = await getPatient(ws, b.patientId);
    const letter = p?.letters.find((l) => l.id === b.letterId);
    if (!p || !letter) throw createError({ statusCode: 404, statusMessage: "Letter not found." });
    if (letter.status !== "awaiting_doctor") throw bad("This letter has already been reviewed.");
    const open = (await listIntakes(ws)).find((x) => x.letterId === letter.id && x.status === "awaiting_doctor");
    if (open) return { intake: open, fallback: open.readBy !== "ai" };
    image = letter.image;
    patientId = p.id;
    letterId = letter.id;
    lang = pickLang(b.lang ?? p.lang);
  }
  const match = DATA_URL.exec(image);
  if (!match || image.length > MAX_CHARS) throw bad("Choose a JPEG or PNG photo under 4 MB.");
  rateLimit(event, ws, "intake", 10, 3_600_000);

  let read: Pick<Intake, "fields" | "medicationsMentioned" | "readBy">;
  try {
    await aiBudget(event, "intake");
    const response = await gemini().models.generateContent({
      model: useRuntimeConfig().textModel,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: match[1]!, data: match[2]! } }, { text: "Read this discharge letter." }] }],
      config: {
        systemInstruction: intakeInstruction,
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
      ? { fields: sampleFields(sample), medicationsMentioned: [...sample.medications], readBy: "sample" }
      : { fields: emptyFields(), medicationsMentioned: [], readBy: "manual" };
  }

  const intake: Intake = {
    id: newId(), createdAt: iso, uploadedBy: letterId ? "family" : actor.role, status: "awaiting_doctor",
    ...read, family: [], lang, patientId, letterId, sample: sample?.id ?? null, confirmedAt: null, updatedAt: iso,
  };
  await saveIntake(ws, intake);
  return { intake, fallback: intake.readBy !== "ai" };
});
