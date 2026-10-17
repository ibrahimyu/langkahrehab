import { applyEdits, applyIntake, missingRequired, patientFromIntake, sanitizeExplanation, sanitizeFamily, sanitizeTasks, type IntakeResult } from "#shared/intake";

// DOK-01 Confirm: the doctor's reviewed fields become a patient (profile, plan v1 waiting for the
// physio, readiness, family tasks, the follow-up visit) in one write. For a letter from the family
// (DOK-07) they update that patient instead, as a new plan version.
export default defineEventHandler(async (event) => {
  const { ws, now } = await context(event);
  assertCan(actorFrom(event), "intake.review");
  const intake = await getIntake(ws, getRouterParam(event, "intakeId") ?? "");
  if (!intake) throw createError({ statusCode: 404, statusMessage: "Intake not found." });
  if (intake.status !== "awaiting_doctor") throw bad("This intake is already closed.");
  const b = (await readBody(event)) ?? {};
  intake.fields = applyEdits(intake.fields, b.values);
  if (b.family !== undefined) intake.family = sanitizeFamily(b.family, intake.lang);
  if (b.tasks !== undefined) intake.suggestedTasks = sanitizeTasks(b.tasks);
  if (b.explanation !== undefined) intake.explanation = sanitizeExplanation(b.explanation);
  const missing = missingRequired(intake.fields);
  if (missing.length) throw createError({ statusCode: 400, statusMessage: `Fill in: ${missing.join(", ")}.`, data: { missing } });
  const iso = new Date(now).toISOString();

  let result: IntakeResult;
  if (intake.patientId) {
    let r: IntakeResult | null = null;
    await updatePatient(ws, intake.patientId, (p) => {
      r = applyIntake(p, intake, now);
    });
    result = r!;
    Object.assign(intake, { status: "confirmed", confirmedAt: iso, updatedAt: iso });
    await saveIntake(ws, intake);
  } else {
    const made = patientFromIntake(intake, now);
    result = made.result;
    Object.assign(intake, { status: "confirmed", confirmedAt: iso, updatedAt: iso, patientId: made.patient.id });
    await createPatientFromIntake(ws, made.patient, intake);
  }
  return { intake, result };
});
