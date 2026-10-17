import { newId, type Note, type NoteKind } from "#shared/model";

/** A note for the care team in the patient's own words (PAS-18). Urgency is set by rules, never by the model. */
export function buildNote(f: { kind: NoteKind; quote: string; summary?: string; urgency: Note["urgency"]; source: Note["source"]; via: Note["via"]; at: string }): Note {
  return {
    id: newId(),
    at: f.at,
    kind: f.kind,
    quote: f.quote,
    summary: f.summary || f.quote.slice(0, 160),
    urgency: f.urgency,
    source: f.source,
    via: f.via,
    private: false,
    readAt: null,
    readBy: null,
    discussAtVisit: f.urgency === "now",
    reply: "",
    answeredAt: null,
  };
}
