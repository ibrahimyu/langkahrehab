// One intake for the review screen. For a letter from the family the photo comes from the patient
// record while the letter waits; a photo from the doctor's own browser was never stored.
export default defineEventHandler(async (event) => {
  const { ws } = await context(event);
  assertCan(actorFrom(event), "intake.review");
  const intake = await getIntake(ws, getRouterParam(event, "intakeId") ?? "");
  if (!intake) throw createError({ statusCode: 404, statusMessage: "Intake not found." });
  let letter: { image: string; pages: string[]; by: string | null; patientName: string } | null = null;
  if (intake.patientId && intake.letterId) {
    const p = await getPatient(ws, intake.patientId);
    const l = p?.letters.find((x) => x.id === intake.letterId);
    if (p && l) letter = { image: l.image, pages: l.pages ?? [l.image], by: p.family.find((m) => m.id === l.by)?.name ?? null, patientName: p.name };
  }
  return { intake, letter };
});
