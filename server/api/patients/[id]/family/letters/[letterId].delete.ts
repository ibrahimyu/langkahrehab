import { familyView } from "#shared/family";

// Takes back a letter the doctor has not looked at yet.
export default defineEventHandler(async (event) => {
  const { ws, id, now } = await patientContext(event);
  assertCan(actorFrom(event), "letter.send");
  const letterId = getRouterParam(event, "letterId");
  const p = await updatePatient(ws, id, (p) => {
    const l = p.letters.find((x) => x.id === letterId);
    if (!l) throw createError({ statusCode: 404, statusMessage: "Letter not found." });
    if (l.status !== "awaiting_doctor") throw bad("The doctor has already seen this letter.");
    p.letters = p.letters.filter((x) => x.id !== letterId);
  });
  return familyView(p, now);
});
