import { newId } from "#shared/model";
import { familyView, validId } from "#shared/family";

// KEL-07: the family sends a photo of the hospital discharge letter for the doctor to review (DOK-01).
// The photo is shrunk in the browser first; the family never sees what is read from it.
const MAX_CHARS = 900_000;
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso } = await patientContext(event);
  assertCan(actorFrom(event), "letter.send");
  const b = (await readBody(event)) ?? {};
  const image = typeof b.image === "string" ? b.image : "";
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw bad("Choose a photo of the letter.");
  if (image.length > MAX_CHARS) throw bad("The photo is too large. Try again with a smaller one.");
  const p = await updatePatient(ws, id, (p) => {
    const by = p.family.some((m) => m.id === b.by) ? validId(b.by) : null;
    p.letters = [...p.letters, { id: newId(), at: iso, by, image, status: "awaiting_doctor" as const }].slice(-3);
  });
  return familyView(p, now);
});
