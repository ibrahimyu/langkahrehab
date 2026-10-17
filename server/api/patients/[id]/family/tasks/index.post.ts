import type { FamilyTask } from "#shared/model";
import { newId } from "#shared/model";
import { capTasks, familyView, generateFamilyTasks, loadsBody, sanitizeTaskInput, templateById, validId } from "#shared/family";

// Family tasks (KEL-03, DAT-03):
//   { generate: true }      adds the template tasks the profile calls for (idempotent, no open duplicates)
//   { templateId, ... }     brings back a template task (Undo after delete)
//   { title, detail, ... }  a task written by the family or the physio
// Free text from the family may not ask for standing or walking: those come from templates only.
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso } = await patientContext(event);
  const actor = actorFrom(event);
  assertCan(actor, "familyTask.edit");
  const b = (await readBody(event)) ?? {};
  const p = await updatePatient(ws, id, (p) => {
    if (b.generate) {
      p.familyTasks = capTasks([...p.familyTasks, ...generateFamilyTasks(p, now)]);
      return;
    }
    const input = sanitizeTaskInput(b);
    const assigneeId = p.family.some((m) => m.id === b.assigneeId) ? (b.assigneeId as string) : null;
    const done = b.status === "done";
    const base = {
      id: newId(),
      assigneeId,
      dueDate: input.dueDate,
      status: done ? ("done" as const) : ("open" as const),
      createdAt: iso,
      doneAt: done ? iso : null,
      doneBy: done ? validId(b.doneBy) : null,
    };
    let task: FamilyTask;
    if (b.templateId) {
      const tpl = templateById(b.templateId);
      if (!tpl) throw bad("Unknown task.");
      task = { ...base, templateId: tpl.id, title: { ...tpl.title }, detail: { ...tpl.detail }, category: tpl.category, cost: tpl.cost, source: "template" };
    } else {
      if (!input.title) throw bad("Write what needs doing.");
      if (actor.role === "family" && loadsBody(`${input.title} ${input.detail}`))
        throw createError({ statusCode: 400, statusMessage: "Tasks about standing or walking come from the physio.", data: { code: "body_task" } });
      task = { ...base, templateId: null, title: input.title, detail: input.detail, category: input.category, cost: input.cost, source: actor.role === "family" ? "family" : "care_team" };
    }
    p.familyTasks = capTasks([...p.familyTasks, task]);
  });
  return familyView(p, now);
});
