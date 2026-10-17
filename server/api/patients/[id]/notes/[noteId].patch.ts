import { str } from "#shared/model";
import { detectRedFlags } from "#shared/redflags";
import { notesFor } from "#shared/permissions";

// The patient may hide a non-urgent note, fix its wording, or mark a question answered (PAS-05); the care team marks it read (or unread again), flags it for
// the visit and replies (PAS-18). A private note does not exist for anyone but the patient.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const actor = actorFrom(event);
  const noteId = getRouterParam(event, "noteId");
  const b = (await readBody(event)) ?? {};
  const p = await updatePatient(ws, id, (p) => {
    const n = notesFor(actor.role, p.notes).find((n) => n.id === noteId);
    if (!n) throw createError({ statusCode: 404, statusMessage: "Note not found." });
    if (b.private !== undefined) {
      assertCan(actor, "note.manage");
      if (b.private && n.urgency === "now") throw bad("Urgent notes stay visible to your care team.");
      n.private = !!b.private;
    }
    if (b.quote !== undefined) {
      assertCan(actor, "note.manage");
      if (n.urgency === "now") throw bad("Urgent notes stay visible to your care team.");
      const quote = str(b.quote, 400);
      if (!quote) throw bad("Write or say what you want your care team to know.");
      n.quote = quote;
      n.summary = quote.slice(0, 160);
      // Rules, not the model, decide urgency: new danger words make it urgent and visible.
      if (detectRedFlags(quote)) Object.assign(n, { urgency: "now", private: false, discussAtVisit: true });
    }
    if (b.answered !== undefined) {
      // The patient marks a question answered; the care team does so at the visit with its answer (DOK-05).
      assertCan(actor, actor.role === "physio" || actor.role === "doctor" ? "note.review" : "note.manage");
      n.answeredAt = b.answered ? (n.answeredAt ?? iso) : null;
    }
    if (b.read !== undefined || b.discussAtVisit !== undefined || b.reply !== undefined) {
      assertCan(actor, "note.review");
      if (b.read === true) {
        n.readAt = n.readAt ?? iso;
        n.readBy = n.readBy ?? (actor.role === "doctor" ? "doctor" : "physio");
      } else if (b.read === false) {
        n.readAt = null;
        n.readBy = null;
      }
      if (b.discussAtVisit !== undefined) n.discussAtVisit = !!b.discussAtVisit;
      if (b.reply !== undefined) n.reply = str(b.reply, 600);
    }
  });
  return notesFor(actor.role, p.notes);
});
