import { newId } from "#shared/model";
import { familyView, validId } from "#shared/family";
import { sanitizePages } from "#shared/intake";

// KEL-07: the family sends the hospital discharge letter (photos of each page, or a PDF) for the doctor
// to review (DOK-01). Photos are shrunk in the browser first.
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso } = await patientContext(event);
  assertCan(actorFrom(event), "letter.send");
  const b = (await readBody(event)) ?? {};
  const pages = sanitizePages(b.pages ?? b.image);
  if (!pages) throw bad("Choose photos or a PDF of the letter, up to 6 pages and about 9 MB.");
  const p = await updatePatient(ws, id, (p) => {
    const by = p.family.some((m) => m.id === b.by) ? validId(b.by) : null;
    p.letters = [...p.letters, { id: newId(), at: iso, by, image: pages[0]!, pages, status: "awaiting_doctor" as const }].slice(-3);
  });
  return familyView(p, now);
});
