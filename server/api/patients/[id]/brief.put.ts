// Saves the care team's edits to the brief.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const body = (await readBody(event).catch(() => ({}))) ?? {};
  const text = typeof body.text === "string" ? body.text.slice(0, 5000) : "";
  const p = await updatePatient(ws, id, (q) => {
    q.brief = { ...q.brief, text, editedAt: iso };
  });
  return p.brief;
});
