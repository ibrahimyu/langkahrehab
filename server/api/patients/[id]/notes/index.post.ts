import { NOTE_KINDS, pick, str } from "#shared/model";
import { detectRedFlags } from "#shared/redflags";
import { notesFor } from "#shared/permissions";
import { mergeNotes } from "#shared/noteFilter";

// Adds a note for the care team (PAS-18): the patient's own words plus a one-line summary.
// Urgency comes from rules, never from the model: danger words make it "now" (and it cannot be hidden).
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const actor = actorFrom(event);
  assertCan(actor, "note.add");
  const b = (await readBody(event)) ?? {};
  const quote = str(b.quote, 400);
  if (!quote) throw bad("Write or say what you want your care team to know.");
  const kind = pick(b.kind, NOTE_KINDS, "question");
  const flag = detectRedFlags(quote);
  const note = buildNote({
    kind,
    quote,
    summary: str(b.summary, 160),
    urgency: flag ? "now" : kind === "complaint" || kind === "worry" ? "watch" : "normal",
    source: actor.role === "family" ? "family" : pick(b.source, ["coach", "companion", "typed"] as const, "typed"),
    via: b.via === "voice" ? "voice" : "text",
    at: iso,
  });
  // AI-10: notes the coach writes merge with the same thing said in the last 7 days.
  let saved = note;
  const p = await updatePatient(ws, id, (p) => {
    if (note.source !== "coach") return void (p.notes = [...p.notes, note].slice(-200));
    const r = mergeNotes(p.notes, [note], Date.parse(iso));
    p.notes = r.notes;
    saved = r.merged[0] ?? note;
  });
  return { note: saved, notes: notesFor(actor.role, p.notes) };
});
