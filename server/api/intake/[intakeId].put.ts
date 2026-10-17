import { applyEdits, sanitizeFamily, sanitizeTasks } from "#shared/intake";

// The doctor's corrections, saved as a draft (nothing reaches a patient before Confirm).
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
  intake.updatedAt = new Date(now).toISOString();
  await saveIntake(ws, intake);
  return { intake };
});
