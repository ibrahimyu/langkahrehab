import { familyView } from "#shared/family";

// Deletes a family question (not the patient's own, and not urgent ones: the care team must see those).
export default defineEventHandler(async (event) => {
  const { ws, id, now } = await patientContext(event);
  assertCan(actorFrom(event), "familyQuestion.add");
  const noteId = getRouterParam(event, "noteId");
  const p = await updatePatient(ws, id, (p) => {
    const n = p.notes.find((x) => x.id === noteId && x.source === "family" && x.kind === "question");
    if (!n) throw createError({ statusCode: 404, statusMessage: "Question not found." });
    if (n.urgency === "now") throw bad("Urgent notes stay visible to the care team.");
    p.notes = p.notes.filter((x) => x.id !== noteId);
  });
  return familyView(p, now);
});
