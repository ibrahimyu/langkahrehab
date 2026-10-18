import { logActivity } from "#shared/activity";
import { str } from "#shared/model";

// DOK-05: at the visit the care team ticks a patient or family question "Answered" and writes the
// answer. The answer is the note's `reply`, which the patient (Questions) and the family see.
// Body: { answered?: boolean, answer?: string }. Unticking keeps the words but reopens the question.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const actor = actorFrom(event);
  assertCan(actor, "question.answer");
  const qid = getRouterParam(event, "qid");
  const b = (await readBody(event)) ?? {};
  const by = actor.role === "doctor" ? "doctor" : "physio";
  const p = await updatePatient(ws, id, (p) => {
    const n = p.notes.find((n) => n.id === qid && n.kind === "question" && !n.private);
    if (!n) throw createError({ statusCode: 404, statusMessage: "Question not found." });
    const was = !!n.answeredAt;
    if (b.answer !== undefined) n.reply = str(b.answer, 600);
    if (b.answered !== undefined) n.answeredAt = b.answered ? (n.answeredAt ?? iso) : null;
    else if (b.answer !== undefined && n.reply) n.answeredAt = n.answeredAt ?? iso;
    if (n.answeredAt || n.reply) {
      n.readAt = n.readAt ?? iso;
      n.readBy = n.readBy ?? by;
    }
    if (n.answeredAt && !was) logActivity(p, { at: iso, actor: "human", who: by, action: "act_question_answered", params: {}, refs: [{ kind: "question", id: n.id, label: n.source === "family" ? "family" : "patient" }] });
  });
  const q = p.notes.find((n) => n.id === qid)!;
  return { id: q.id, reply: q.reply, answeredAt: q.answeredAt ?? null, readAt: q.readAt };
});
