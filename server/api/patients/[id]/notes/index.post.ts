import { NOTE_KINDS, pick, str } from "#shared/model";
import { detectRedFlags } from "#shared/redflags";
import { notesFor } from "#shared/permissions";
import { mergeNotes } from "#shared/noteFilter";
import { routeTalkNote, TALK_TOPICS } from "#shared/talkNotes";

// Adds a note for the care team (PAS-18): the patient's own words plus a one-line summary.
// Urgency comes from rules, never from the model: danger words make it "now" (and it cannot be hidden).
export default defineEventHandler(async (event) => {
  const { ws, id, iso, patient } = await patientContext(event);
  const actor = actorFrom(event);
  assertCan(actor, "note.add");
  const b = (await readBody(event)) ?? {};
  const quote = str(b.quote, 400);
  if (!quote) throw bad("Write or say what you want your care team to know.");
  let kind = pick(b.kind, NOTE_KINDS, "question");
  const flag = detectRedFlags(quote);
  // From Talk by voice (talk: true): the same rules as typed Talk decide where it goes (talkNotes.ts).
  let quiet: { clinicianOnly: true; topic: "body" | "wellbeing" } | null = null;
  if (b.talk === true && actor.role === "patient") {
    const r = routeTalkNote({ kind, quote, summary: str(b.summary, 160), topic: pick(b.topic, TALK_TOPICS, "other"), asked: b.asked === true });
    if (r.route === "drop" && !flag) return { note: null, notes: notesFor(actor.role, patient.notes) };
    if (r.route === "question") kind = r.kind;
    if (r.route === "clinician" && !(flag && r.topic === "body")) {
      kind = r.kind;
      quiet = { clinicianOnly: true, topic: r.topic };
    }
  }
  const note = buildNote({
    ...(quiet ?? {}),
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
    if (note.source !== "coach" && !note.clinicianOnly) return void (p.notes = [...p.notes, note].slice(-200));
    const r = mergeNotes(p.notes, [note], Date.parse(iso));
    p.notes = r.notes;
    saved = r.merged[0] ?? note;
  });
  return { note: saved.clinicianOnly ? null : saved, notes: notesFor(actor.role, p.notes) };
});
