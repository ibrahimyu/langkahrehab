// Discard (DOK-01): deletes the draft. For a letter from the family, ?letter=dismiss also closes the
// letter and drops its photo; without it the letter stays waiting and can be read again.
export default defineEventHandler(async (event) => {
  const { ws } = await context(event);
  assertCan(actorFrom(event), "intake.review");
  const intake = await getIntake(ws, getRouterParam(event, "intakeId") ?? "");
  if (!intake) throw createError({ statusCode: 404, statusMessage: "Intake not found." });
  if (intake.status !== "awaiting_doctor") throw bad("This intake is already closed.");
  await deleteIntake(ws, intake.id);
  if (getQuery(event).letter === "dismiss" && intake.patientId && intake.letterId) {
    await updatePatient(ws, intake.patientId, (p) => {
      p.letters = p.letters.map((l) => (l.id === intake.letterId ? { ...l, status: "reviewed" as const, image: "" } : l));
    });
  }
  return { ok: true };
});
