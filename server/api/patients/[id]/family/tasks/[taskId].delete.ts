import { familyView } from "#shared/family";

// Deletes a family task. The screen offers Undo (re-created through POST).
export default defineEventHandler(async (event) => {
  const { ws, id, now } = await patientContext(event);
  assertCan(actorFrom(event), "familyTask.edit");
  const taskId = getRouterParam(event, "taskId");
  const p = await updatePatient(ws, id, (p) => {
    if (!p.familyTasks.some((x) => x.id === taskId)) throw createError({ statusCode: 404, statusMessage: "Task not found." });
    p.familyTasks = p.familyTasks.filter((x) => x.id !== taskId);
  });
  return familyView(p, now);
});
