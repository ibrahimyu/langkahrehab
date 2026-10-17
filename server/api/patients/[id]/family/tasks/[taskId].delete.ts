import { familyView } from "#shared/family";

// Deletes a family task. The screen offers Undo (re-created through POST). With ?dismiss=1 a suggested
// task is also not suggested again to the person it was given to.
export default defineEventHandler(async (event) => {
  const { ws, id, now } = await patientContext(event);
  assertCan(actorFrom(event), "familyTask.edit");
  const taskId = getRouterParam(event, "taskId");
  const p = await updatePatient(ws, id, (p) => {
    if (!p.familyTasks.some((x) => x.id === taskId)) throw createError({ statusCode: 404, statusMessage: "Task not found." });
    const t = p.familyTasks.find((x) => x.id === taskId)!;
    p.familyTasks = p.familyTasks.filter((x) => x.id !== taskId);
    if (getQuery(event).dismiss && t.templateId) {
      const d = { templateId: t.templateId, memberId: t.assigneeId };
      p.dismissedTasks = [...(p.dismissedTasks ?? []).filter((x) => x.templateId !== d.templateId || x.memberId !== d.memberId), d].slice(-60);
    }
  });
  return familyView(p, now);
});
