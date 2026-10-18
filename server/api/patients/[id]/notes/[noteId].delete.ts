// The patient deletes their own note, except urgent ones (the care team must see those).
export default defineEventHandler(async (event) => {
  const { ws, id } = await patientContext(event);
  assertCan(actorFrom(event), "note.manage");
  const noteId = getRouterParam(event, "noteId");
  const p = await updatePatient(ws, id, (p) => {
    const n = p.notes.find((n) => n.id === noteId && !n.clinicianOnly);
    if (!n) throw createError({ statusCode: 404, statusMessage: "Note not found." });
    if (n.urgency === "now") throw bad("Urgent notes stay visible to your care team.");
    p.notes = p.notes.filter((x) => x.id !== noteId);
  });
  return p.notes;
});
