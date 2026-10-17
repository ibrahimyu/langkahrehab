import { str } from "#shared/model";
import { familyView, validId } from "#shared/family";
import { detectRedFlags } from "#shared/redflags";

// A question for the doctor from a family member (KEL-05, like PAS-05): stored as a note of kind
// "question" with the member's id, so the care team reads and answers it with the patient's notes.
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso } = await patientContext(event);
  assertCan(actorFrom(event), "familyQuestion.add");
  const b = (await readBody(event)) ?? {};
  const text = str(b.text, 300);
  if (!text) throw bad("Write your question.");
  const p = await updatePatient(ws, id, (p) => {
    const m = p.family.find((x) => x.id === validId(b.by));
    const note = buildNote({
      kind: "question",
      quote: text,
      summary: `Question from ${m ? m.name : "the family"}: ${text}`.slice(0, 160),
      urgency: detectRedFlags(text) ? "now" : "normal",
      source: "family",
      via: b.via === "voice" ? "voice" : "text",
      at: iso,
    });
    note.familyMemberId = m?.id ?? null;
    p.notes = [...p.notes, note].slice(-200);
  });
  return familyView(p, now);
});
