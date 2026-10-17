import { familyView, loadsBody, sanitizeTaskInput, validId } from "#shared/family";

// Marks a task done or open (family), or changes who does it, the date, or the words of a task
// written by a person (template words stay as the care team approved them).
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso } = await patientContext(event);
  const actor = actorFrom(event);
  const taskId = getRouterParam(event, "taskId");
  const b = (await readBody(event)) ?? {};
  if (b.status !== undefined) assertCan(actor, "familyTask.do");
  const p = await updatePatient(ws, id, (p) => {
    const t = p.familyTasks.find((x) => x.id === taskId);
    if (!t) throw createError({ statusCode: 404, statusMessage: "Task not found." });
    if (b.status !== undefined) {
      assertCan(actor, "familyTask.do");
      const done = b.status === "done";
      t.status = done ? "done" : "open";
      t.doneAt = done ? iso : null;
      t.doneBy = done ? validId(b.by) : null;
    }
    const edits = ["assigneeId", "dueDate", "title", "detail", "cost"].some((k) => b[k] !== undefined);
    if (!edits) return;
    assertCan(actor, "familyTask.edit");
    const input = sanitizeTaskInput(b);
    if (b.assigneeId !== undefined) t.assigneeId = p.family.some((m) => m.id === b.assigneeId) ? b.assigneeId : null;
    if (b.dueDate !== undefined) t.dueDate = input.dueDate;
    if (t.templateId) return;
    const title = b.title !== undefined ? input.title : String(t.title);
    const detail = b.detail !== undefined ? input.detail : String(t.detail);
    if (!title) throw bad("Write what needs doing.");
    if (actor.role === "family" && loadsBody(`${title} ${detail}`))
      throw createError({ statusCode: 400, statusMessage: "Tasks about standing or walking come from the physio.", data: { code: "body_task" } });
    t.title = title;
    t.detail = detail;
    if (b.cost !== undefined) t.cost = input.cost;
  });
  return familyView(p, now);
});
