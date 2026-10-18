import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCompanion } from "../shared/companion";
import type { Note } from "../shared/model";
import { notesFor } from "../shared/permissions";
import { routeTalkNote } from "../shared/talkNotes";

test("an explicit body question goes to the patient's questions for the doctor", () => {
  assert.deepEqual(routeTalkNote({ kind: "question", quote: "Please ask the doctor if the stump pain at night is normal", summary: "Asks about night stump pain", topic: "body", asked: true }), { route: "question", kind: "question", topic: "body" });
  assert.equal(routeTalkNote({ kind: "request", quote: "Tolong tanyakan ke dokter soal obat nyeri", summary: "", asked: true }).route, "question");
});

test("feelings stay a private note unless the patient asks for them to go to the doctor", () => {
  assert.deepEqual(routeTalkNote({ kind: "question", quote: "Can you tell the doctor I feel so sad and alone?", summary: "", topic: "wellbeing", asked: true }), { route: "question", kind: "question", topic: "wellbeing" });
  for (const n of [
    { kind: "worry" as const, quote: "Saya takut jadi beban keluarga", summary: "Afraid of being a burden" },
    { kind: "life_event" as const, quote: "My wife and I keep fighting, it's so stressful", summary: "Family stress" },
  ])
    assert.deepEqual(routeTalkNote(n), { route: "clinician", kind: "worry", topic: "wellbeing" }, n.quote);
});

test("body findings the patient did not ask to send are kept quietly for clinicians", () => {
  assert.deepEqual(routeTalkNote({ kind: "complaint", quote: "My stump hurts more at night, it keeps me awake.", summary: "Night stump pain, poor sleep" }), { route: "clinician", kind: "complaint", topic: "body" });
  assert.deepEqual(routeTalkNote({ kind: "worry", quote: "I fell in the bathroom yesterday", summary: "A fall", topic: "body" }), { route: "clinician", kind: "complaint", topic: "body" });
  assert.equal(routeTalkNote({ kind: "need", quote: "Saya butuh kursi roda yang lebih ringan.", summary: "" }).route, "clinician");
});

test("small talk and questions for the AI itself are dropped", () => {
  assert.equal(routeTalkNote({ kind: "question", quote: "What is phantom pain?", summary: "", topic: "body", asked: false }).route, "drop");
  assert.equal(routeTalkNote({ kind: "goal_change", quote: "I want to visit my grandson", summary: "", topic: "other" }).route, "drop");
});

test("the model's topic and asked survive parsing, with safe defaults", () => {
  const t = parseCompanion({ notes: [{ kind: "worry", quote: "I feel low", summary: "Low mood", topic: "wellbeing", asked: "yes" }, { kind: "need", quote: "A walker", topic: "x" }] });
  assert.equal(t.notes[0]!.topic, "wellbeing");
  assert.equal(t.notes[0]!.asked, false);
  assert.equal(t.notes[1]!.topic, "other");
});

test("clinician-only notes never reach the patient or family, but reach the care team", () => {
  const base = { at: "", kind: "worry", quote: "q", summary: "s", urgency: "watch", source: "companion", via: "text", private: false, readAt: null, readBy: null, discussAtVisit: false, reply: "" } as const;
  const notes: Note[] = [{ ...base, id: "a" }, { ...base, id: "b", clinicianOnly: true, topic: "wellbeing" }, { ...base, id: "c", private: true }];
  assert.deepEqual(notesFor("patient", notes).map((n) => n.id), ["a", "c"]);
  assert.deepEqual(notesFor("family", notes).map((n) => n.id), ["a"]);
  assert.deepEqual(notesFor("doctor", notes).map((n) => n.id), ["a", "b"]);
  assert.deepEqual(notesFor("physio", notes).map((n) => n.id), ["a", "b"]);
});
